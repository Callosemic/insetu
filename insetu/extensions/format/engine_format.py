from pathlib import Path
import os
import sys
from flask import jsonify
from insetu.core.sdk import InSetuExtension

format_bp = InSetuExtension(
    'format',
    __name__,
    title="Code Formatting",
    description="Source code beautification and formatting."
)
__depends__ = []

@format_bp.worker("format_code_task")
def _background_format_code(ctx, filepath=None):
    ctx.jobs.update_progress("Formatting source code...")
    if not filepath:
        raise ValueError("Filepath is required for code formatting.")

    abs_path = ctx.resolve_path(filepath)
    if not os.path.exists(abs_path):
        raise FileNotFoundError(f"Target file not found: {filepath}")

    ext = Path(filepath).suffix.lower()
    content = ctx.vfs.read(filepath)
    if content is None:
        raise ValueError(f"Unable to read file content: {filepath}")
    if ext in ('.js', '.json', '.css', '.html'):
        try:
            import jsbeautifier
            opts = jsbeautifier.default_options()
            opts.indent_size = 4
            opts.space_in_empty_paren = True
            opts.end_with_newline = True

            formatted = jsbeautifier.beautify(content, opts)
            ctx.vfs.save(filepath, formatted)
            return {"message": "Source code formatted successfully.", "artifact": {"filepath": filepath}}
        except ImportError:
            raise RuntimeError("jsbeautifier is required for JS/JSON/CSS formatting. Run: pip install jsbeautifier")
    elif ext == '.py':
        try:
            import autopep8
            formatted = autopep8.fix_code(content, options={'indent_size': 4})
        except ImportError:
            try:
                import black
                formatted = black.format_str(content, mode=black.Mode())
            except ImportError:
                raise RuntimeError("autopep8 or black is required for Python code formatting. Run: pip install autopep8")

        ctx.vfs.save(filepath, formatted)
        return {"message": "Python code formatted successfully.", "artifact": {"filepath": filepath}}
    else:
        raise ValueError(f"Unsupported file type for code formatting: {ext}")

@format_bp.route('format-code', methods=['POST'])
def api_format_code(ctx):
    data = ctx.req.json or {}
    filepath = data.get('filepath')

    if not filepath:
        return jsonify({"error": "Filepath required"}), 400

    job_id = ctx.jobs.submit("format_code_task", filepath=filepath)
    return jsonify({"status": "accepted", "job_id": job_id}), 202

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
    print("🧹 Booting native Python JS Formatter (Context-Bound)...")
    try:
        ctx = format_bp.get_context('default')
        manifest = ctx.manifest
    except Exception:
        print("❌ Error: Failed to load context manifest.")
        sys.exit(1)

    if not manifest:
        print("❌ Error: Context manifest is empty or unavailable.")
        print("   Please open or refresh the web UI to auto-compile the ecosystem context.")
        sys.exit(1)

    workspace_root = os.getcwd()
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