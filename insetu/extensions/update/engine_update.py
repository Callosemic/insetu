import os
import subprocess
from flask import jsonify
from insetu.core.sdk import InSetuExtension

# Declarative schema for Semantic Release parameters
UPDATE_SETTINGS_SCHEMA = [
    {
        "id": "commit_parser",
        "label": "Commit Parser Style",
        "type": "select",
        "options": [
            {"value": "angular", "label": "Angular (Conventional Commits)"},
            {"value": "emoji", "label": "Emoji"},
            {"value": "scipy", "label": "SciPy"}
        ],
        "default": "angular",
        "description": "The commit parsing convention utilized to calculate the next semantic version."
    },
    {
        "id": "auto_publish",
        "label": "Auto-Publish after Bump",
        "type": "boolean",
        "default": False,
        "description": "If enabled, successfully bumping the version will immediately trigger distribution."
    },
    {
        "id": "pypi_token",
        "label": "PyPI Distribution Token",
        "type": "password",
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
    status_check = subprocess.run(['git', 'status', '--porcelain', '-uall'], cwd=repo_path, capture_output=True, text=True)
    if status_check.stdout.strip():
        raise RuntimeError("Working tree is not clean. Please commit or stash your changes before initiating a release bump.")

    ctx.jobs.update_progress("Calculating semantic version and bumping repository...")
    
    # Environment Variable Injection for Parser Settings
    env = os.environ.copy()
    parser_style = ctx.settings.get("commit_parser", "angular")
    env["PSR_COMMIT_PARSER"] = parser_style

    try:
        res = subprocess.run(
            ['semantic-release', 'version'], 
            cwd=repo_path, 
            capture_output=True, 
            text=True, 
            check=True,
            env=env
        )
        
        output = res.stdout.strip()
        # Evaluate Phase 2 Automation
        if ctx.settings.get("auto_publish", False):
            ctx.jobs.update_progress("Auto-publish enabled. Routing to distribution pipeline...")
            ctx.jobs.submit("publish_task", repo=repo)
            output += "\n\nAuto-publish workflow triggered."

        return {"message": "Version bumped successfully.", "artifact": {"output": output}}
        
    except subprocess.CalledProcessError as e:
        err_msg = e.stderr.strip() if e.stderr else e.stdout.strip()
        raise RuntimeError(f"Semantic Release Engine Failed:\n{err_msg}")

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

    status_check = subprocess.run(['git', 'status', '--porcelain', '-uall'], cwd=repo_path, capture_output=True, text=True)
    if status_check.stdout.strip():
        raise RuntimeError("Working tree is not clean. Please commit or stash your changes before previewing a release bump.")

    env = os.environ.copy()
    parser_style = ctx.settings.get("commit_parser", "angular")
    env["PSR_COMMIT_PARSER"] = parser_style
    try:
        res = subprocess.run(
            ['semantic-release', '--noop', 'version'], 
            cwd=repo_path, 
            capture_output=True, 
            text=True, 
            check=True,
            env=env
        )
        return {"message": "Preview generated.", "artifact": {"output": res.stdout.strip()}}
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
        status_res = subprocess.run(['git', 'status', '--porcelain', '-uall'], cwd=repo_path, capture_output=True, text=True)
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

    # 1. Always attempt to parse the static baseline version
    v_match = re.search(r'^version\s*=\s*[\'"]([^\'"]+)[\'"]', content, re.MULTILINE)
    if v_match:
        version = v_match.group(1)

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
    return {"message": "Status resolved.", "artifact": {"version": version, "configured": configured, "has_pyproject": has_pyproject, "is_clean": is_clean, "has_release": has_release}}

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

    subprocess.run(['git', 'add', 'pyproject.toml'], cwd=repo_path, check=True)

    status_res = subprocess.run(['git', 'status', '--porcelain', 'pyproject.toml'], cwd=repo_path, capture_output=True, text=True)
    if status_res.stdout.strip():
        subprocess.run(['git', 'commit', '-m', f'chore: force version bump to {new_version} [skip ci]'], cwd=repo_path, check=True)

    # Tag the release so semantic-release uses it as the new baseline
    subprocess.run(['git', 'tag', f'v{new_version}'], cwd=repo_path, check=True)

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

    psr_config = f'''
[tool.semantic_release]
version_toml = [
    "pyproject.toml:project.version"
]
commit_parser = "angular"
'''
    content += psr_config

    # Enforce Event Ledger Parity via VFS and apply barrier for synchronous Git staging
    ctx.vfs.save(pyproject_file, content, data={"is_absolute_artifact": True})
    ctx.sync_vfs_barrier()

    ctx.jobs.update_progress("Committing and tagging initial version...")

    subprocess.run(['git', 'add', 'pyproject.toml'], cwd=repo_path, check=True)
    status_res = subprocess.run(['git', 'status', '--porcelain', 'pyproject.toml'], cwd=repo_path, capture_output=True, text=True)
    if status_res.stdout.strip():
        subprocess.run(['git', 'commit', '-m', f'chore: initialize semantic versioning at v{initial_version} [skip ci]'], cwd=repo_path, check=True)

        return {"message": f"Successfully initialized at v{initial_version}. Ready for first release."}
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
commit_parser = "angular"
build_command = "false"
'''
    # Enforce Event Ledger Parity via VFS and apply barrier for synchronous Git staging
    ctx.vfs.save(pyproject_file, content, data={"is_absolute_artifact": True})
    ctx.sync_vfs_barrier()

    ctx.jobs.update_progress("Committing pyproject.toml...")
    subprocess.run(['git', 'add', 'pyproject.toml'], cwd=repo_path, check=True)
    status_res = subprocess.run(['git', 'status', '--porcelain', 'pyproject.toml'], cwd=repo_path, capture_output=True, text=True)
    if status_res.stdout.strip():
        subprocess.run(['git', 'commit', '-m', f'chore: add basic pyproject.toml [skip ci]'], cwd=repo_path, check=True)

    return {"message": "Successfully created pyproject.toml. Ready for initialization."}
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