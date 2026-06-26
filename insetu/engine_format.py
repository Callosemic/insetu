import os
import sys
import json

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
        import insetu.engine_gather as engine_gather
        workspace_root = utils_core.WORKSPACE_ROOT
        manifest_path = os.path.join(engine_gather.CONTEXTS_DIR, "manifest.json")
    except ImportError:
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