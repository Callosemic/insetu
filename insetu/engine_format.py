import os
import sys
import json
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

    csl_items = []
    if true_ids:
        db_path = os.path.join(paths["artifacts_base"], "citations.db")
        if os.path.exists(db_path):
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            placeholders = ','.join(['?'] * len(true_ids))
            try:
                cursor = conn.execute(f"SELECT raw_json FROM citations WHERE id IN ({placeholders})", tuple(true_ids))
                for row in cursor.fetchall():
                    csl_items.append(json.loads(row['raw_json']))
            except Exception:
                pass
            finally:
                conn.close()

    temp_dir = tempfile.mkdtemp()
    try:
        bib_path = os.path.join(temp_dir, 'bibliography.json')
        with open(bib_path, 'w', encoding='utf-8') as f:
            json.dump(csl_items, f)

        out_filename = f"compiled_output.{target_format}"
        out_path = os.path.join(temp_dir, out_filename)

        cmd = ['pandoc', resolved_path, '-o', out_path]
        if csl_items:
            cmd.extend(['--citeproc', '--bibliography', bib_path])

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