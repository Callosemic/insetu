from pathlib import Path
import os
import sys
import json
import uuid
from flask import jsonify, send_file
from insetu.sdk import InSetuExtension
from insetu.workers import submit_immediate_job, register_ephemeral_artifact
format_bp = InSetuExtension('format', __name__, title="Document Formatting", description="Document compilation (Pandoc) and JavaScript code formatting.")
__depends__ = []
@format_bp.worker("compile_task")
def _background_compile(ctx, filepath, target_format, job_id=None):
    import os
    ctx.jobs.update_progress(f"Compiling document to {target_format.upper()}...")
    mem_file, download_name = compile_document_payload(ctx.workspace_id, filepath, target_format)

    paths = ctx.paths
    safe_name = f"{job_id}_{download_name}" if job_id else download_name
    out_path = Path(paths["artifacts_base"]).joinpath(safe_name).as_posix()
    Path(out_path).write_bytes(mem_file.read())

    register_ephemeral_artifact(out_path, "format", 3600, workspace_id=ctx.workspace_id)

    return {"message": "Compilation successful.", "artifact": {"download_url": f"/download/{safe_name}", "filename": download_name}}

@format_bp.route('compile-document', methods=['POST'])
def api_format_compile_document(ctx):
    data = ctx.req.json
    filepath = data.get('filepath')

    if not filepath: return jsonify({"error": "Filepath required"}), 400

    job_id = ctx.jobs.submit("compile_task", filepath=filepath, target_format=data.get('format', 'pdf'))
    return jsonify({"status": "accepted", "job_id": job_id}), 202
def compile_document_payload(workspace_id, filepath, target_format):
    import re, os, tempfile, subprocess, json, shutil, io
    from insetu.sdk import ExtensionContext

    ctx = ExtensionContext('format', workspace_id)
    resolved_path = ctx.resolve_path(filepath)
    if not os.path.exists(resolved_path): 
        raise FileNotFoundError("File not found")

    content = ctx.vfs.read(filepath) or ""

    paths = ctx.paths
    backmatter_match = re.search(r'\n+---\n+citations:\n([\s\S]*?)\n---$', content)

    true_ids = []
    if backmatter_match:
        lines = backmatter_match.group(1).splitlines()
        for line in lines:
            parts = line.split(':')
            if len(parts) >= 2:
                true_ids.append(parts[1].replace('"', '').replace("'", "").strip())
    # 1. Initialize generic compiler payload
    temp_files = {}
    compiler_flags = []

    # 2. Broadcast to all extensions: "Inject your middleware now"
    from insetu.hooks import hooks
    try:
        results = hooks.emit('pre_compile_document', filepath=filepath, text=doc_text, workspace_id=workspace_id)
        for res in results:
            if res and isinstance(res, dict):
                temp_files.update(res.get('temp_files', {}))
                compiler_flags.extend(res.get('compiler_flags', []))
    except Exception as e:
        print(f"Warning: Extension middleware failed during document compilation: {e}")
    temp_dir = tempfile.mkdtemp()
    try:
        # Write injected middleware temp files to disk
        for filename, file_content in temp_files.items():
            Path(temp_dir).joinpath(filename).write_text(file_content, encoding='utf-8')

        out_filename = f"compiled_output.{target_format}"
        out_path = Path(temp_dir).joinpath(out_filename).as_posix()

        cmd = ['pandoc', resolved_path, '-o', out_path]
        cmd.extend(compiler_flags)

        try:
            res = subprocess.run(cmd, capture_output=True, text=True)
        except FileNotFoundError:
            raise RuntimeError("Pandoc is not installed or not in PATH.")

        if res.returncode != 0:
            err_msg = res.stderr.strip()
            if "pdflatex not found" in err_msg.lower():
                err_msg += " (Please install a LaTeX engine like MacTeX, MiKTeX, or TeX Live to generate PDFs)."
            raise RuntimeError(f"Pandoc failed: {err_msg}")
        file_data = Path(out_path).read_bytes()

        mem_file = io.BytesIO(file_data)
        mem_file.seek(0)
        safe_basename = os.path.basename(resolved_path).rsplit('.', 1)[0]

        return mem_file, f"{safe_basename}.{target_format}"

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

def run_formatter():
    try:
        import jsbeautifier
    except ImportError:
        print("❌ Missing jsbeautifier. Please run: pip install jsbeautifier")
        sys.exit(1)

    # Standardize to your 4-space indentation rule
    opts = jsbeautifier.default_options()
    opts.indent_size = 4
    opts.space_in_empty_paren = True
    opts.end_with_newline = True

    # Resolve workspace root dynamically via utils_core
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    try:
        import insetu.utils_core as utils_core
        paths = utils_core.get_gather_paths()
        workspace_root = paths["workspace_root"]
        manifest_path = Path(paths["contexts_dir"]).joinpath("manifest.json").as_posix()
    except Exception:
        print("❌ Error: Could not load core tooling modules.")
        sys.exit(1)

    if not os.path.exists(manifest_path):
        print(f"❌ Error: Context manifest not found at {manifest_path}")
        print("   Please open or refresh the Axoneme web UI to auto-compile the ecosystem context.")
        sys.exit(1)

    print("🧹 Booting native Python JS Formatter (Context-Bound)...")
    try:
        manifest_text = Path(manifest_path).read_text(encoding="utf-8")
        manifest = json.loads(manifest_text)
    except Exception:
        print("❌ Error: Failed to parse manifest.json.")
        sys.exit(1)
    # Target the directory where the user executed the command
    target_dir = os.getcwd()
    # Collect unique JS files from the manifest, restricted to the current directory
    js_files = set()
    for context_name, data in manifest.items():
        file_list = data.get("files", []) if isinstance(data, dict) else data
        for filepath in file_list:
            if filepath.endswith(".js") and not filepath.endswith(".min.js"):
                abs_filepath = Path(workspace_root).joinpath(filepath).as_posix()
                # Guardrail: Only format files that are inside the current working directory
                if abs_filepath.startswith(target_dir):
                    js_files.add(abs_filepath)

    if not js_files:
        print("✅ No tracked JavaScript files found in the current context manifest.")
        return

    formatted_count = 0
    for filepath in js_files:
        if os.path.exists(filepath):
            try:
                res = jsbeautifier.beautify_file(filepath, opts)
                Path(filepath).write_text(res, encoding="utf-8")
                
                # Display relative path for cleaner terminal output
                display_path = filepath.replace(workspace_root + os.sep, "")
                print(f"  [+] Formatted: {display_path}")
                formatted_count += 1
            except Exception as e:
                print(f"  [!] Failed to format {filepath}: {e}")

    print(f"✅ Formatting complete. {formatted_count} files normalized.")

if __name__ == "__main__":
    run_formatter()