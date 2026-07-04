import os
import sys
import json
from flask import Blueprint, request, jsonify, send_file
from insetu.utils_core import extension_auth

format_bp = Blueprint('format', __name__)

@format_bp.route('/api/<workspace_id>/format/compile-document', methods=['POST'])
@extension_auth('format')
def api_format_compile_document(workspace_id):
    data = request.json
    filepath = data.get('filepath')
    target_format = data.get('format', 'pdf')

    if not filepath: return jsonify({"error": "Filepath required"}), 400

    try:
        mem_file, download_name = compile_document_payload(workspace_id, filepath, target_format)
        return send_file(mem_file, as_attachment=True, download_name=download_name)
    except FileNotFoundError:
        return jsonify({"error": "File not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def compile_document_payload(workspace_id, filepath, target_format):
    import re, os, tempfile, subprocess, json, sqlite3, shutil, io
    from insetu.utils_core import get_gather_paths, resolve_workspace_path

    resolved_path = resolve_workspace_path(filepath, workspace_id)
    if not os.path.exists(resolved_path): 
        raise FileNotFoundError("File not found")

    with open(resolved_path, 'r', encoding='utf-8') as f:
        content = f.read()

    paths = get_gather_paths(workspace_id)
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
            with open(os.path.join(temp_dir, filename), 'w', encoding='utf-8') as f:
                f.write(file_content)

        out_filename = f"compiled_output.{target_format}"
        out_path = os.path.join(temp_dir, out_filename)

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

        with open(out_path, 'rb') as f:
            file_data = f.read()

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
        manifest_path = os.path.join(paths["contexts_dir"], "manifest.json")
    except Exception:
        print("❌ Error: Could not load core tooling modules.")
        sys.exit(1)

    if not os.path.exists(manifest_path):
        print(f"❌ Error: Context manifest not found at {manifest_path}")
        print("   Please open or refresh the Axoneme web UI to auto-compile the ecosystem context.")
        sys.exit(1)

    print("🧹 Booting native Python JS Formatter (Context-Bound)...")
    
    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
    except json.JSONDecodeError:
        print("❌ Error: Failed to parse manifest.json.")
        sys.exit(1)
    # Target the directory where the user executed the command
    target_dir = os.getcwd()

    # Collect unique JS files from the manifest, restricted to the current directory
    js_files = set()
    for context_name, file_list in manifest.items():
        for filepath in file_list:
            if filepath.endswith(".js") and not filepath.endswith(".min.js"):
                abs_filepath = os.path.join(workspace_root, filepath)
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
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(res)
                
                # Display relative path for cleaner terminal output
                display_path = filepath.replace(workspace_root + os.sep, "")
                print(f"  [+] Formatted: {display_path}")
                formatted_count += 1
            except Exception as e:
                print(f"  [!] Failed to format {filepath}: {e}")

    print(f"✅ Formatting complete. {formatted_count} files normalized.")

if __name__ == "__main__":
    run_formatter()