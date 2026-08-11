import os
import subprocess
from flask import jsonify
from insetu.core.sdk import InSetuExtension
from insetu.extensions.git.engine_git import execute_git
# Declarative schema for Semantic Release parameters
UPDATE_SETTINGS_SCHEMA = [
    {
        "id": "commit_parser",
        "label": "Commit Parser Style",
        "type": "select",
        "scope": "repo",
        "options": [
            {"value": "conventional", "label": "Conventional Commits (Angular)"},
            {"value": "emoji", "label": "Emoji"},
            {"value": "scipy", "label": "SciPy"}
        ],
        "default": "conventional",
        "description": "The commit parsing convention utilized to calculate the next semantic version."
    },
    {
        "id": "auto_publish",
        "label": "Auto-Publish after Bump",
        "type": "boolean",
        "scope": "repo",
        "default": False,
        "description": "If enabled, successfully bumping the version will immediately trigger distribution."
    },
    {
        "id": "pypi_token",
        "label": "PyPI Distribution Token",
        "type": "password",
        "scope": "workspace",
        "secure": True,
        "default": "",
        "description": "Token utilized for authentication during the PyPI publishing phase."
    }
]
update_bp = InSetuExtension(
    'update', 
    __name__, 
    title="Semantic Update", 
    description="Automated semantic versioning and package distribution.", 
    settings_schema=UPDATE_SETTINGS_SCHEMA
)
__depends__ = ['git']
__external_depends__ = ['semantic_release']
__external_binaries__ = ['git']
@update_bp.worker("bump_task")
def _background_bump_task(ctx, repo):
    """Phase 1: Validates tree integrity, calculates versions, and updates the changelog."""
    repo_path = ctx.get_repo_path(repo)
    if not os.path.exists(repo_path):
        raise ValueError(f"Target repository path not found: {repo}")

    ctx.jobs.update_progress("Validating working tree integrity...")
    # Pre-flight Validation: Block execution if uncommitted changes exist
    status_check = execute_git(repo_path, ['status', '--porcelain', '-uall'], check=False)
    if status_check.stdout.strip():
        raise RuntimeError("Working tree is not clean. Please commit or stash your changes before initiating a release bump.")
    ctx.jobs.update_progress("Calculating semantic version and bumping repository...")
    # Environment Variable Injection for Parser Settings
    env = os.environ.copy()
    parser_style = ctx.settings.get("commit_parser", "conventional", repo=repo)
    if parser_style == "angular": parser_style = "conventional"
    env["PSR_COMMIT_PARSER"] = parser_style
    res = subprocess.run(
        ['semantic-release', 'version'], 
        cwd=repo_path, 
        capture_output=True, 
        text=True, 
        check=False,
        env=env
    )
    import re
    # Clean up timestamps and python file references from the raw logs
    clean_log = re.sub(r'\[\d{2}:\d{2}:\d{2}\]\s*', '', res.stderr.strip())
    clean_log = re.sub(r'\b[a-zA-Z_]+\.py:\d+\b', '', clean_log)
    clean_log = re.sub(r' +', ' ', clean_log)

    # Combine stderr (evaluation logs) and stdout (raw version)
    output = f"{clean_log}\n\nNext Version: {res.stdout.strip()}".strip()

    if res.returncode != 0:
        if "no release" in clean_log.lower() or "nothing to do" in clean_log.lower():
            return {"message": "No version bump required.", "artifact": {"output": output}}

        tag_check = execute_git(repo_path, ['tag', '--points-at', 'HEAD'], check=False)
        if tag_check.returncode == 0 and tag_check.stdout.strip():
            output += f"\n\n⚠️ Local version bump and tag ({tag_check.stdout.strip()}) succeeded, but remote VCS publishing/pushing failed."
            return {"message": "Version bumped locally with VCS warnings.", "artifact": {"output": output}}

        err_msg = res.stderr.strip() if res.stderr else res.stdout.strip()
        raise RuntimeError(f"Semantic Release Engine Failed:\n{err_msg}")

    # Evaluate Phase 2 Automation
    if ctx.settings.get("auto_publish", False, repo=repo):
        ctx.jobs.update_progress("Auto-publish enabled. Routing to distribution pipeline...")
        ctx.jobs.submit("publish_task", repo=repo)
        output += "\n\nAuto-publish workflow triggered."

    return {"message": "Version bumped successfully.", "artifact": {"output": output}}
@update_bp.worker("first_release_task")
def _background_first_release_task(ctx, repo):
    """Initial Release: Builds distribution, validates wheel contents, uploads to PyPI, and tags baseline version."""
    import zipfile
    import tarfile
    from pathlib import Path

    repo_path = ctx.get_repo_path(repo)
    if not os.path.exists(repo_path):
        raise ValueError(f"Target repository path not found: {repo}")

    log_lines = []

    ctx.jobs.update_progress("Validating working tree cleanliness...")
    status_check = execute_git(repo_path, ['status', '--porcelain', '-uall'], check=False)
    if status_check.stdout.strip():
        raise RuntimeError("Working tree is not clean. Please commit or stash your changes before issuing the initial release.")

    ctx.jobs.update_progress("Building distribution artifacts (sdist & wheel)...")
    build_res = subprocess.run([sys.executable, "-m", "build"], cwd=repo_path, capture_output=True, text=True, check=False)
    log_lines.append(f"=== BUILD STDOUT ===\n{build_res.stdout}\n=== BUILD STDERR ===\n{build_res.stderr}")
    if build_res.returncode != 0:
        raise RuntimeError(f"Build failed:\n{build_res.stderr or build_res.stdout}")

    ctx.jobs.update_progress("Validating package data in wheel distribution...")
    dist_dir = Path(repo_path) / "dist"
    wheels = list(dist_dir.glob("*.whl"))
    if not wheels:
        raise RuntimeError("No .whl package found in dist/ after build.")
    latest_wheel = max(wheels, key=lambda p: p.stat().st_mtime)
    with zipfile.ZipFile(latest_wheel, 'r') as z:
        archived_files = z.namelist()
        # Agnostic check: Ensure the archive contains valid non-metadata payload files
        has_package_payload = any(not f.endswith('/') and '.dist-info/' not in f and '.data/' not in f for f in archived_files)
        if not has_package_payload:
            raise RuntimeError(f"Package validation failed: No active code or asset payload found in {latest_wheel.name}.")
    log_lines.append(f"=== WHEEL VALIDATION ===\nVerified package payload present in {latest_wheel.name}")

    ctx.jobs.update_progress("Running twine check on distribution artifacts...")
    twine_check = subprocess.run([sys.executable, "-m", "twine", "check", "dist/*"], cwd=repo_path, capture_output=True, text=True, check=False)
    log_lines.append(f"=== TWINE CHECK STDOUT ===\n{twine_check.stdout}\n=== TWINE CHECK STDERR ===\n{twine_check.stderr}")
    if twine_check.returncode != 0:
        raise RuntimeError(f"Twine validation failed:\n{twine_check.stderr or twine_check.stdout}")

    ctx.jobs.update_progress("Uploading initial release to PyPI...")
    env = os.environ.copy()
    pypi_token = ctx.settings.get("pypi_token", "") or os.getenv("TWINE_PASSWORD", "") or os.getenv("PYPI_TOKEN", "")
    if pypi_token:
        env["TWINE_PASSWORD"] = pypi_token
        env["TWINE_USERNAME"] = "__token__"

    upload_res = subprocess.run([sys.executable, "-m", "twine", "upload", "dist/*"], cwd=repo_path, capture_output=True, text=True, check=False, env=env)
    log_lines.append(f"=== TWINE UPLOAD STDOUT ===\n{upload_res.stdout}\n=== TWINE UPLOAD STDERR ===\n{upload_res.stderr}")
    if upload_res.returncode != 0:
        raise RuntimeError(f"PyPI upload failed:\n{upload_res.stderr or upload_res.stdout}")

    ctx.jobs.update_progress("Tagging initial release in Git...")
    pyproject_file = Path(repo_path) / "pyproject.toml"
    content = pyproject_file.read_text(encoding='utf-8')
    import re
    v_match = re.search(r'^version\s*=\s*[\'"]([^\'"]+)[\'"]', content, re.MULTILINE)
    version_str = v_match.group(1) if v_match else "0.1.0"

    tag_res = execute_git(repo_path, ['tag', '-a', f'v{version_str}', '-m', f'v{version_str} initial PyPI release baseline'], check=False)
    push_res = execute_git(repo_path, ['push', 'origin', f'v{version_str}'], check=False)
    log_lines.append(f"=== GIT TAG & PUSH ===\nTag: {tag_res.stdout}\nPush: {push_res.stdout} {push_res.stderr}")

    full_output = "\n\n".join(log_lines)
    return {"message": f"Successfully published initial release v{version_str} to PyPI and tagged Git!", "artifact": {"version": version_str, "output": full_output}}

@update_bp.worker("publish_task")
def _background_publish_task(ctx, repo):
    """Phase 2: Distributes the updated package to configured registries."""
    repo_path = ctx.get_repo_path(repo)
    if not os.path.exists(repo_path):
        raise ValueError(f"Target repository path not found: {repo}")

    ctx.jobs.update_progress("Publishing package to registry...")
    
    env = os.environ.copy()
    pypi_token = ctx.settings.get("pypi_token", "")
    if pypi_token:
        # Map the UI token to the standard twine/PSR environment variable
        env["TWINE_PASSWORD"] = pypi_token
        env["TWINE_USERNAME"] = "__token__"

    try:
        res = subprocess.run(
            ['semantic-release', 'publish'], 
            cwd=repo_path, 
            capture_output=True, 
            text=True, 
            check=True,
            env=env
        )
        
        return {"message": "Package distributed successfully.", "artifact": {"output": res.stdout.strip()}}
        
    except subprocess.CalledProcessError as e:
        err_msg = e.stderr.strip() if e.stderr else e.stdout.strip()
        raise RuntimeError(f"Semantic Release Publish Failed:\n{err_msg}")
@update_bp.worker("preview_bump_task")
def _background_preview_bump_task(ctx, repo):
    import subprocess
    import os

    repo_path = ctx.get_repo_path(repo)
    if not os.path.exists(repo_path):
        raise ValueError(f"Target repository path not found: {repo}")
    ctx.jobs.update_progress("Evaluating dry-run semantic version bump...")

    status_check = execute_git(repo_path, ['status', '--porcelain', '-uall'], check=False)
    if status_check.stdout.strip():
        raise RuntimeError("Working tree is not clean. Please commit or stash your changes before previewing a release bump.")
    env = os.environ.copy()
    parser_style = ctx.settings.get("commit_parser", "conventional")
    if parser_style == "angular": parser_style = "conventional"
    env["PSR_COMMIT_PARSER"] = parser_style
    try:
        res = subprocess.run(
            ['semantic-release', '-v', '--noop', 'version'], 
            cwd=repo_path, 
            capture_output=True, 
            text=True, 
            check=True,
            env=env
        )
        import re
        # Clean up timestamps and python file references from the raw logs
        clean_log = re.sub(r'\[\d{2}:\d{2}:\d{2}\]\s*', '', res.stderr.strip())
        clean_log = re.sub(r'\b[a-zA-Z_]+\.py:\d+\b', '', clean_log)
        clean_log = re.sub(r' +', ' ', clean_log)

        # Extract the release notes / changelog block
        changelog_match = re.search(r'with the following notes:\s*\n(.*?)(?=\n\s*(?:INFO|\[🛡 NOP\]|Next Version:|$))', clean_log, re.DOTALL)
        changelog = changelog_match.group(1).strip() if changelog_match else "No changelog notes generated for this release."

        # Combine stderr (evaluation logs) and stdout (raw version)
        combined_output = f"{clean_log}\n\nNext Version: {res.stdout.strip()}".strip()
        return {"message": "Preview generated.", "artifact": {"output": combined_output, "changelog": changelog}}
    except subprocess.CalledProcessError as e:
        err_msg = e.stderr.strip() if e.stderr else e.stdout.strip()
        raise RuntimeError(f"Semantic Release Preview Failed:\n{err_msg}")

@update_bp.route('preview_bump', methods=['POST'])
def api_update_preview_bump(ctx):
    repo = ctx.req.json.get('repo')
    if not repo: 
        return jsonify({"error": "Repository target is required."}), 400

    job_id = ctx.jobs.submit("preview_bump_task", repo=repo)
    return jsonify({"status": "accepted", "job_id": job_id}), 202

@update_bp.route('bump', methods=['POST'])
def api_update_bump(ctx):
    repo = ctx.req.json.get('repo')
    if not repo: 
        return jsonify({"error": "Repository target is required."}), 400
    
    job_id = ctx.jobs.submit("bump_task", repo=repo)
    return jsonify({"status": "accepted", "job_id": job_id}), 202
@update_bp.worker("preview_publish_task")
def _background_preview_publish_task(ctx, repo):
    import subprocess
    import os
    import re
    repo_path = ctx.get_repo_path(repo)
    if not os.path.exists(repo_path):
        raise ValueError(f"Target repository path not found: {repo}")

    ctx.jobs.update_progress("Evaluating dry-run semantic publish...")

    env = os.environ.copy()
    pypi_token = ctx.settings.get("pypi_token", "")
    if pypi_token:
        env["TWINE_PASSWORD"] = pypi_token
        env["TWINE_USERNAME"] = "__token__"

    try:
        res = subprocess.run(
            ['semantic-release', '-v', '--noop', 'publish'], 
            cwd=repo_path, 
            capture_output=True, 
            text=True, 
            check=True,
            env=env
        )
        # Clean up timestamps and python file references from the raw logs
        clean_log = re.sub(r'\[\d{2}:\d{2}:\d{2}\]\s*', '', res.stderr.strip())
        clean_log = re.sub(r'\b[a-zA-Z_]+\.py:\d+\b', '', clean_log)
        clean_log = re.sub(r' +', ' ', clean_log)

        combined_output = f"{clean_log}\n\n{res.stdout.strip()}".strip()
        return {"message": "Publish preview generated.", "artifact": {"output": combined_output}}
    except subprocess.CalledProcessError as e:
        err_msg = e.stderr.strip() if e.stderr else e.stdout.strip()
        raise RuntimeError(f"Semantic Release Publish Preview Failed:\n{err_msg}")
@update_bp.route('preview_publish', methods=['POST'])
def api_update_preview_publish(ctx):
    repo = ctx.req.json.get('repo')
    if not repo: 
        return jsonify({"error": "Repository target is required."}), 400

    job_id = ctx.jobs.submit("preview_publish_task", repo=repo)
    return jsonify({"status": "accepted", "job_id": job_id}), 202
@update_bp.route('first_release', methods=['POST'])
def api_update_first_release(ctx):
    repo = ctx.req.json.get('repo')
    if not repo:
        return jsonify({"error": "Repository target is required."}), 400

    job_id = ctx.jobs.submit("first_release_task", repo=repo)
    return jsonify({"status": "accepted", "job_id": job_id}), 202

@update_bp.route('publish', methods=['POST'])
def api_update_publish(ctx):
    repo = ctx.req.json.get('repo')
    if not repo: 
        return jsonify({"error": "Repository target is required."}), 400

    job_id = ctx.jobs.submit("publish_task", repo=repo)
    return jsonify({"status": "accepted", "job_id": job_id}), 202

@update_bp.worker("status_task")
def _background_status_task(ctx, repo):
    """Runs the semantic-release CLI off-thread to retrieve the current version."""
    import subprocess
    import os
    from pathlib import Path
    repo_path = ctx.get_repo_path(repo)
    if not os.path.exists(repo_path):
        return {"message": "Repo not found.", "artifact": {"version": None, "configured": False, "has_pyproject": False, "is_clean": True}}
    is_clean = True
    try:
        status_res = execute_git(repo_path, ['status', '--porcelain', '-uall'], check=False)
        if status_res.stdout.strip():
            is_clean = False
    except Exception:
        pass

    # Bypass logical VFS boundaries to guarantee physical file resolution for the CLI
    pyproject_path = Path(repo_path).joinpath("pyproject.toml").as_posix()

    content = ctx.vfs.read(pyproject_path, is_absolute_artifact=True)
    has_pyproject = content is not None
    if content is None:
        content = ""

    configured = "[tool.semantic_release]" in content
    version = None
    has_release = False
    import re
    # 1. Parse package name and static baseline version from pyproject.toml
    name_match = re.search(r'^name\s*=\s*[\'"]([^\'"]+)[\'"]', content, re.MULTILINE)
    package_name = name_match.group(1) if name_match else repo

    v_match = re.search(r'^version\s*=\s*[\'"]([^\'"]+)[\'"]', content, re.MULTILINE)
    if v_match:
        version = v_match.group(1)
    b_match = re.search(r'^build_command\s*=\s*[\'"]([^\'"]*)[\'"]', content, re.MULTILINE)
    build_command = b_match.group(1) if b_match else ""

    vcs_match = re.search(r'^vcs_release\s*=\s*(true|false)', content, re.MULTILINE | re.IGNORECASE)
    vcs_release = vcs_match.group(1).lower() == 'true' if vcs_match else True
    has_pypi_token = bool(ctx.settings.get("pypi_token") or os.getenv("TWINE_PASSWORD") or os.getenv("PYPI_TOKEN"))
    has_token = bool(has_pypi_token or os.getenv("GH_TOKEN") or os.getenv("GITHUB_TOKEN"))

    # 2. If configured, let the CLI take precedence (as it resolves Git tags accurately)
    if configured:
        try:
            res = subprocess.run(
                ['semantic-release', 'version', '--print-last-released'], 
                cwd=repo_path, 
                capture_output=True, 
                text=True, 
                check=True
            )
            if res.stdout.strip():
                version = res.stdout.strip()
                has_release = True
        except subprocess.CalledProcessError:
            pass

    # 3. Query PyPI JSON API to verify if this version is published on PyPI.org
    pypi_published = False
    if version:
        try:
            import urllib.request
            req = urllib.request.Request(f"https://pypi.org/pypi/{package_name}/json", headers={'User-Agent': 'inSetu-OS/1.0'})
            with urllib.request.urlopen(req, timeout=3) as response:
                if response.status == 200:
                    pypi_data = json.loads(response.read().decode('utf-8'))
                    pypi_published = version in pypi_data.get("releases", {})
        except Exception:
            pypi_published = False

    return {"message": "Status resolved.", "artifact": {
        "version": version, 
        "package_name": package_name,
        "configured": configured, 
        "has_pyproject": has_pyproject, 
        "is_clean": is_clean, 
        "has_release": has_release, 
        "pypi_published": pypi_published,
        "build_command": build_command,
        "vcs_release": vcs_release,
        "has_pypi_token": has_pypi_token,
        "has_token": has_token
    }}

@update_bp.worker("update_toml_config_task")
def _background_update_toml_config(ctx, repo, build_command=None, vcs_release=None):
    import os
    import re
    from pathlib import Path
    repo_path = ctx.get_repo_path(repo)
    if not os.path.exists(repo_path):
        raise ValueError(f"Target repository path not found: {repo}")

    ctx.jobs.update_progress("Updating pyproject.toml...")
    pyproject_file = Path(repo_path).joinpath("pyproject.toml").as_posix()
    content = ctx.vfs.read(pyproject_file, is_absolute_artifact=True)
    if content is None:
        raise ValueError("pyproject.toml not found.")

    new_content = content
    if build_command is not None:
        if re.search(r'^build_command\s*=', new_content, re.MULTILINE):
            new_content = re.sub(r'^build_command\s*=\s*[\'"][^\'"]*[\'"]', f'build_command = "{build_command}"', new_content, flags=re.MULTILINE)
        else:
            new_content = re.sub(r'(\[tool\.semantic_release\])', r'\1\nbuild_command = "' + build_command + '"', new_content)

    if vcs_release is not None:
        vcs_str = "true" if vcs_release else "false"
        if re.search(r'^vcs_release\s*=', new_content, re.MULTILINE):
            new_content = re.sub(r'^vcs_release\s*=\s*(true|false)', f'vcs_release = {vcs_str}', new_content, flags=re.MULTILINE | re.IGNORECASE)
        else:
            new_content = re.sub(r'(\[tool\.semantic_release\])', r'\1\nvcs_release = ' + vcs_str, new_content)

    ctx.vfs.save(pyproject_file, new_content, data={"is_absolute_artifact": True})
    ctx.sync_vfs_barrier()

    from insetu.extensions.git.engine_git import execute_git
    execute_git(repo_path, ['add', 'pyproject.toml'], check=False)
    status_res = execute_git(repo_path, ['status', '--porcelain', 'pyproject.toml'], check=False)
    if status_res.stdout.strip():
        execute_git(repo_path, ['commit', '-m', f'chore: update semantic_release config in pyproject.toml [skip ci]'], check=False)

    return {"message": "Configuration updated successfully.", "artifact": {"build_command": build_command, "vcs_release": vcs_release}}

@update_bp.route('update_toml_config', methods=['POST'])
def api_update_toml_config(ctx):
    repo = ctx.req.json.get('repo')
    build_command = ctx.req.json.get('build_command')
    vcs_release = ctx.req.json.get('vcs_release')
    if not repo:
        return jsonify({"error": "Repo required"}), 400

    job_id = ctx.jobs.submit("update_toml_config_task", repo=repo, build_command=build_command, vcs_release=vcs_release)
    return jsonify({"status": "accepted", "job_id": job_id}), 202

@update_bp.route('status', methods=['POST'])
def api_update_status(ctx):
    repo = ctx.req.json.get('repo')
    if not repo: 
        return jsonify({"error": "Repo required"}), 400

    job_id = ctx.jobs.submit("status_task", repo=repo)
    return jsonify({"status": "accepted", "job_id": job_id}), 202
@update_bp.worker("force_version_task")
def _background_force_version(ctx, repo, new_version):
    import subprocess
    import os
    import re
    from pathlib import Path

    repo_path = ctx.get_repo_path(repo)
    if not os.path.exists(repo_path):
        raise ValueError(f"Target repository path not found: {repo}")

    ctx.jobs.update_progress(f"Forcing version to {new_version}...")
    pyproject_file = Path(repo_path).joinpath("pyproject.toml").as_posix()

    content = ctx.vfs.read(pyproject_file, is_absolute_artifact=True)
    if content is None:
        raise ValueError("pyproject.toml not found.")

    new_content = re.sub(r'^version\s*=\s*[\'"][^\'"]+[\'"]', f'version = "{new_version}"', content, flags=re.MULTILINE)

    # Enforce Event Ledger Parity via VFS and apply barrier for synchronous Git staging
    ctx.vfs.save(pyproject_file, new_content, data={"is_absolute_artifact": True})
    ctx.sync_vfs_barrier()
    ctx.jobs.update_progress("Committing and tagging new version...")

    execute_git(repo_path, ['add', 'pyproject.toml'])

    status_res = execute_git(repo_path, ['status', '--porcelain', 'pyproject.toml'], check=False)
    if status_res.stdout.strip():
        execute_git(repo_path, ['commit', '-m', f'chore: force version bump to {new_version} [skip ci]'])

    # Tag the release so semantic-release uses it as the new baseline
    execute_git(repo_path, ['tag', f'v{new_version}'])

    return {"message": f"Successfully forced version to v{new_version}.", "artifact": {"version": new_version}}

@update_bp.route('force_version', methods=['POST'])
def api_update_force_version(ctx):
    repo = ctx.req.json.get('repo')
    version = ctx.req.json.get('version')
    if not repo or not version: 
        return jsonify({"error": "Repo and version required"}), 400

    job_id = ctx.jobs.submit("force_version_task", repo=repo, new_version=version)
    return jsonify({"status": "accepted", "job_id": job_id}), 202
@update_bp.worker("scaffold_task")
def _background_scaffold_task(ctx, repo, initial_version):
    import os
    import subprocess
    import re
    from pathlib import Path

    repo_path = ctx.get_repo_path(repo)
    if not os.path.exists(repo_path):
        raise ValueError("Target repository path not found.")

    ctx.jobs.update_progress(f"Scaffolding semantic-release (v{initial_version})...")
    pyproject_file = Path(repo_path).joinpath("pyproject.toml").as_posix()
    content = ctx.vfs.read(pyproject_file, is_absolute_artifact=True)
    if content is None:
        content = ""

    if "[tool.semantic_release]" in content:
        raise ValueError("Semantic release is already configured for this repository.")

    if "[project]" not in content:
        content += f'\n[project]\nname = "{repo}"\nversion = "{initial_version}"\n'
    else:
        if not re.search(r'^version\s*=', content, re.MULTILINE):
            content = re.sub(r'(\[project\])', r'\1\nversion = "' + initial_version + '"', content)
        else:
            content = re.sub(r'^version\s*=\s*[\'"][^\'"]+[\'"]', f'version = "{initial_version}"', content, flags=re.MULTILINE)
    allow_zero = 'allow_zero_version = true\nmajor_on_zero = false' if initial_version.startswith('0.') else ''
    psr_config = f'''
[tool.semantic_release]
version_toml = [
    "pyproject.toml:project.version"
]
commit_parser = "conventional"
vcs_release = false
{allow_zero}
[tool.semantic_release.changelog]
exclude_commit_patterns = [
    \'\'\'(?i)chore(?:\\([^)]*?\\))?: .+$\'\'\',
    \'\'\'(?i)ci(?:\\([^)]*?\\))?: .+$\'\'\'
]
'''
    content += psr_config

    # Enforce Event Ledger Parity via VFS and apply barrier for synchronous Git staging
    ctx.vfs.save(pyproject_file, content, data={"is_absolute_artifact": True})
    ctx.sync_vfs_barrier()
    ctx.jobs.update_progress("Committing and tagging initial version...")

    execute_git(repo_path, ['add', 'pyproject.toml'])
    status_res = execute_git(repo_path, ['status', '--porcelain', 'pyproject.toml'], check=False)
    if status_res.stdout.strip():
        execute_git(repo_path, ['commit', '-m', f'chore: initialize semantic versioning at v{initial_version} [skip ci]'])

        # Force the SemVer baseline immediately so the engine respects arbitrary initial numbers
        execute_git(repo_path, ['tag', f'v{initial_version}'])

        return {"message": f"Successfully initialized at v{initial_version}. Ready for distribution."}
@update_bp.worker("create_dummy_toml_task")
def _background_create_dummy_toml(ctx, repo, initial_version):
    import os
    import subprocess
    from pathlib import Path

    repo_path = ctx.get_repo_path(repo)
    if not os.path.exists(repo_path):
        raise ValueError("Target repository path not found.")

    ctx.jobs.update_progress(f"Creating basic pyproject.toml for {repo} (v{initial_version})...")
    pyproject_file = Path(repo_path).joinpath("pyproject.toml").as_posix()
    content = f'''[project]
name = "{repo}"
version = "{initial_version}"
description = "Auto-generated project configuration"
[tool.semantic_release]
version_toml = [
    "pyproject.toml:project.version"
]
commit_parser = "conventional"
vcs_release = false
build_command = ""
{'allow_zero_version = true\nmajor_on_zero = false' if initial_version.startswith('0.') else ''}
'''
    # Enforce Event Ledger Parity via VFS and apply barrier for synchronous Git staging
    ctx.vfs.save(pyproject_file, content, data={"is_absolute_artifact": True})
    ctx.sync_vfs_barrier()
    ctx.jobs.update_progress("Committing and tagging basic pyproject.toml...")
    execute_git(repo_path, ['add', 'pyproject.toml'])
    status_res = execute_git(repo_path, ['status', '--porcelain', 'pyproject.toml'], check=False)
    if status_res.stdout.strip():
        execute_git(repo_path, ['commit', '-m', f'chore: add basic pyproject.toml [skip ci]'])

    # Force the SemVer baseline immediately so the engine respects arbitrary initial numbers
    execute_git(repo_path, ['tag', f'v{initial_version}'])

    return {"message": f"Successfully created pyproject.toml and established baseline v{initial_version}."}
@update_bp.route('create_dummy_toml', methods=['POST'])
def api_update_create_dummy_toml(ctx):
    repo = ctx.req.json.get('repo')
    initial_version = ctx.req.json.get('initial_version', '0.1.0')
    if not repo: return jsonify({"error": "Repo required"}), 400
    job_id = ctx.jobs.submit("create_dummy_toml_task", repo=repo, initial_version=initial_version)
    return jsonify({"status": "accepted", "job_id": job_id}), 202

@update_bp.route('eligible_repos', methods=['GET'])
def api_update_eligible_repos(ctx):
    import os
    from pathlib import Path
    eligibility = {}
    for r in ctx.config.get("target_repos", []):
        repo = r.get("repo_dir")
        if not repo: continue
        repo_path = ctx.get_repo_path(repo)
        pyproject_file = Path(repo_path).joinpath("pyproject.toml").as_posix()
        eligibility[repo] = os.path.exists(pyproject_file)
    return jsonify({"eligibility": eligibility})

@update_bp.route('scaffold', methods=['POST'])
def api_update_scaffold(ctx):
    """Injects the semantic-release configuration and establishes the initial version directly through the Event Ledger."""
    repo = ctx.req.json.get('repo')
    initial_version = ctx.req.json.get('initial_version', '0.1.0')
    if not repo: 
        return jsonify({"error": "Repo required"}), 400

    job_id = ctx.jobs.submit("scaffold_task", repo=repo, initial_version=initial_version)
    return jsonify({"status": "accepted", "job_id": job_id}), 202