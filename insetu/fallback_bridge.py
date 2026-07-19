from pathlib import Path
# insetu/fallback_bridge.py

import os
import sys
import json
import re
from flask import Flask, request, jsonify, send_file, render_template_string

app = Flask(__name__)

# --- STANDALONE PATCH ENGINE ---
# (Isolated from engine_bridge.py to ensure zero dependencies during Kernel Panic)

def expand_macros(text):
    text = re.sub(r'\{\{\s*(.)\s*\*\s*(\d+)\s*\}\}', lambda m: m.group(1) * int(m.group(2)), text)
    text = re.sub(r'\{\{\s*triple(.)\s*\}\}', lambda m: m.group(1) * 3, text)
    text = re.sub(r'_(?:[^_\n]_){3,}', lambda m: m.group(0).replace('_', ''), text)
    text = re.sub(r'\x5b\x73\x6f\x75\x72\x63\x65\x3a\x5c\x73\x2a\x5c\x64\x2b\x5d', '', text)
    text = re.sub(r'\x5b\x63\x69\x74\x65\x3a\x5c\x73\x2a\x5b\x5c\x64\x5c\x73\x2c\x5d\x2b\x5d', '', text)
    return text

def parse_blocks(text):
    files = {}
    current_file = None
    state = "OUTSIDE"
    search_lines, replace_lines = [], []
    lines = text.replace('\r\n', '\n').split('\n')
    for line in lines:
        if line.startswith("<<<<<<< FILE:"):
            current_file = line.replace("<<<<<<< FILE:", "").strip()
            if current_file not in files: files[current_file] = []
            state = "OUTSIDE"
        elif line.startswith("<<<<<<< SEARCH"):
            state = "SEARCH"
            search_lines = []
        elif line.startswith("======="):
            if state == "SEARCH":
                state = "REPLACE"
                replace_lines = []
        elif line.startswith(">>>>>>> REPLACE"):
            if state == "REPLACE" and current_file:
                files[current_file].append({
                    "search": "\n".join(search_lines),
                    "replace": "\n".join(replace_lines)
                })
            state = "OUTSIDE"
        else:
            if state == "SEARCH": search_lines.append(line)
            elif state == "REPLACE": replace_lines.append(line)
    return files

def apply_block_in_memory(content, block):
    content = content.replace('\r\n', '\n')
    search_str = expand_macros(block["search"])
    replace_str = expand_macros(block["replace"])
    
    if not search_str.strip():
        return True, replace_str # Genesis patch
        
    # Simplified diff anchor logic for the lifeboat to ensure maximum stability
    if search_str in content:
        return True, content.replace(search_str, replace_str)
    else:
        return False, content

# --- LIFEBOAT UI ---
HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>inSetu Recovery OS</title>
    <style>
        body { font-family: monospace; background: #0f172a; color: #38bdf8; padding: 20px; line-height: 1.6; }
        .banner { background: #dc2626; color: white; padding: 15px; font-weight: bold; border-radius: 4px; margin-bottom: 20px; text-align: center; }
        .panic-trace { background: rgba(0,0,0,0.3); padding: 15px; border-radius: 4px; text-align: left; font-family: monospace; font-size: 0.85rem; white-space: pre-wrap; overflow-x: auto; margin-top: 15px; color: #f8fafc; border: 1px solid #991b1b; }
        textarea { width: 100%; height: 300px; background: #1e293b; color: #e2e8f0; border: 1px solid #334155; padding: 10px; margin-bottom: 10px; font-family: monospace; box-sizing: border-box; }
        button { background: #10b981; color: white; border: none; padding: 10px 20px; cursor: pointer; font-weight: bold; border-radius: 4px; }
        .fs-container { background: #1e293b; padding: 15px; border: 1px solid #334155; border-radius: 4px; margin-top: 10px; max-height: 400px; overflow-y: auto; }
        .file-link { color: #38bdf8; text-decoration: none; cursor: pointer; display: block; margin: 5px 0; padding: 5px; border-radius: 4px; }
        .file-link:hover { background: #334155; text-decoration: none; }
    </style>
</head>
<body>
    <div class="banner">
        ⚠️ KERNEL PANIC: INSETU RECOVERY OS (LIFEBOAT FS) ⚠️<br><br>
        The primary Developer OS failed to boot. You are running on the zero-dependency fallback bridge.
        {% if panic_details %}
        <div class="panic-trace">{{ panic_details }}</div>
        {% endif %}
    </div>
    
    <h3>1. Emergency Sync Bridge</h3>
    <p>Paste your patch sandwich below to fix the corrupted core file. A successful patch will require you to manually restart the daemon.</p>
    <textarea id="payload" placeholder="<<<<<<< FILE: insetu/app.py
<<<<<<< SEARCH
[fixed code]
=======
[fixed code]
>>>>>>> REPLACE"></textarea>
    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button onclick="sync()">⚡ Execute Emergency Patch</button>
        <button onclick="navigator.clipboard.readText().then(t => { document.getElementById('payload').value = t; }).catch(e => alert('Clipboard access denied.'))" style="background: #475569;">📋 Paste</button>
        <button onclick="document.getElementById('payload').value = ''" style="background: #64748b;">❌ Clear</button>
        <button onclick="rebootOS()" style="background: #3b82f6;">🔄 Reboot inSetu OS</button>
    </div>
    <pre id="log" style="color: #f59e0b; margin-top: 15px; background: #1e293b; padding: 10px; border-radius: 4px; display: none;"></pre>

    <div style="background: #3b82f620; border: 1px solid #3b82f6; padding: 15px; border-radius: 4px; margin-top: 20px;">
        <h4 style="margin-top: 0; color: #60a5fa;">🆘 Architect Rescue Protocol</h4>
        <p style="font-size: 0.9rem; color: #94a3b8;">If you need an LLM to debug this kernel panic, this button will instantly compile the raw source code of the entire inSetu OS into a single context payload.</p>
        <button id="btn-emergency-dump" onclick="emergencyDump()" style="background: #3b82f6;">📦 Generate Core OS Context</button>
    </div>

    <hr style="border-color: #334155; margin: 30px 0;">

    <h3>2. Lifeboat File Evacuation</h3>
    <p style="color: #94a3b8;">If the OS is irreparably bricked, use this zero-dependency explorer to manually download and evacuate your tracked files.</p>
    <p>Current Directory: <span id="cwd-display" style="color: #f8fafc; font-weight: bold;"></span></p>
    <button onclick="loadFS('..')" style="background: #3b82f6; padding: 6px 12px; margin-bottom: 10px;">⬆️ Up Directory</button>
    
    <div class="fs-container" id="fs-list">Loading...</div>

    <script>
        async function downloadFileResilient(fetchUrl, filename) {
            try {
                const res = await fetch(fetchUrl);
                if (!res.ok) throw new Error("Download failed");
                const blob = await res.blob();

                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
            } catch (e) {
                window.location.href = fetchUrl;
            }
        }

        async function sync() {
            const text = document.getElementById('payload').value;
            const log = document.getElementById('log');
            log.style.display = 'block';
            log.innerText = "Applying patch...";
            try {
                const res = await fetch('/api/bridge/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: text })
                });
                log.innerText = await res.text();
            } catch (e) {
                log.innerText = "Network Error: " + e.message;
            }
        }

        async function rebootOS() {
            if (!confirm("Attempt to reboot into the primary Developer OS?")) return;
            document.body.innerHTML = "<h2 style='color: #10b981; text-align: center; margin-top: 20%;'>Rebooting Engine...<br><span style='font-size: 0.8rem; color: #888;'>Page will reload automatically</span></h2>";
            try {
                await fetch('/api/system/reboot', { method: 'POST' });
                setTimeout(() => window.location.reload(), 3000);
            } catch (e) {
                alert("Reboot failed: " + e.message);
            }
        }

        async function emergencyDump() {
            const btn = document.getElementById('btn-emergency-dump');
            const orig = btn.innerText;
            btn.innerText = "⏳ Compiling...";
            try {
                const res = await fetch('/api/system/emergency_dump', { method: 'POST' });
                const data = await res.json();
                if (res.ok) {
                    btn.innerText = "✅ Compiled successfully";
                    setTimeout(() => btn.innerText = orig, 3000);
                    await downloadFileResilient('/download/' + encodeURIComponent(data.file), data.file);
                } else {
                    alert("Dump failed: " + data.message);
                    btn.innerText = orig;
                }
            } catch (e) {
                alert("Network error: " + e.message);
                btn.innerText = orig;
            }
        }

        let currentPath = ".";
        async function loadFS(target) {
            if (target === '..') {
                const parts = currentPath.split('/');
                parts.pop();
                currentPath = parts.length ? parts.join('/') : '.';
            } else if (target !== '.') {
                currentPath = currentPath === '.' ? target : currentPath + '/' + target;
            }

            document.getElementById('cwd-display').innerText = currentPath === '.' ? '[Workspace Root]' : currentPath;
            const res = await fetch('/api/fs/list?dir=' + encodeURIComponent(currentPath));
            const data = await res.json();
            
            const list = document.getElementById('fs-list');
            list.innerHTML = '';
            
            if (data.dirs.length === 0 && data.files.length === 0) {
                list.innerHTML = '<span style="color: #64748b;">Directory is empty.</span>';
                return;
            }

            data.dirs.forEach(d => {
                const a = document.createElement('a');
                a.className = 'file-link';
                a.innerText = '📁 ' + d;
                a.onclick = () => loadFS(d);
                list.appendChild(a);
            });
            
            data.files.forEach(f => {
                const a = document.createElement('a');
                a.className = 'file-link';
                a.innerText = '📄 ' + f;
                a.href = '#';
                const dlUrl = '/download/' + encodeURIComponent(currentPath === '.' ? f : currentPath + '/' + f);
                a.onclick = (e) => {
                    e.preventDefault();
                    downloadFileResilient(dlUrl, f);
                };
                list.appendChild(a);
            });
        }
        
        // Boot the explorer
        loadFS('.');
    </script>
</body>
</html>
"""

@app.route('/')
def index():
    details = os.environ.get("INSETU_PANIC_DETAILS", "")
    return render_template_string(HTML_TEMPLATE, panic_details=details)

@app.route('/api/bridge/sync', methods=['POST'])
def bridge_sync():
    data = request.json
    raw_text = data.get("text", "")
    parsed = parse_blocks(raw_text)
    
    log = []
    for target_file, blocks in parsed.items():
        abs_path = os.path.abspath(target_file)
        log.append(f"Targeting: {target_file}")
        
        if os.path.exists(abs_path):
            with open(abs_path, 'r', encoding='utf-8') as f:
                content = f.read()
        else:
            content = ""
            
        success = True
        for b in blocks:
            ok, content = apply_block_in_memory(content, b)
            if not ok:
                success = False
                log.append(f"  [!] Failed to anchor SEARCH block in {target_file}")
                break
                
        if success:
            if Path(abs_path).parent:
                os.makedirs(Path(abs_path).parent, exist_ok=True)
            with open(abs_path, 'w', encoding='utf-8') as f:
                f.write(content)
            log.append(f"  [✓] Successfully patched {target_file}")
            
    if not log:
        log.append("No valid patch blocks detected in payload.")
        
    return "\n".join(log), 200

@app.route('/api/fs/list')
def fs_list():
    target_dir = request.args.get('dir', '.')
    abs_dir = os.path.abspath(target_dir)
    if not os.path.exists(abs_dir) or not os.path.isdir(abs_dir):
        return jsonify({"dirs": [], "files": []})
        
    dirs = []
    files = []
    for item in sorted(os.listdir(abs_dir)):
        # Hide internal Python files and Git noise
        if item.startswith('__') or item == '.git':
            continue
            
        if os.path.isdir(Path(abs_dir).joinpath(item).as_posix()):
            dirs.append(item)
        else:
            files.append(item)
            
    return jsonify({"dirs": dirs, "files": files})

@app.route('/download/<path:filepath>')
def download(filepath):
    # Werkzeug normalizes double slashes in URLs, stripping the leading slash off absolute paths.
    # If the stripped path doesn't exist but the absolute one does, repair it.
    if not os.path.exists(filepath) and os.path.exists('/' + filepath):
        filepath = '/' + filepath
        
    abs_path = os.path.abspath(filepath)
    if os.path.exists(abs_path):
        return send_file(abs_path, as_attachment=True)
    return "File not found", 404

@app.route('/api/system/emergency_dump', methods=['POST'])
def api_emergency_dump():
    """Zero-dependency hardcoded compiler that survives core config corruption."""
    import os
    from datetime import datetime
    try:
        # Hardcoded to the current file's directory (insetu/insetu)
        script_dir = Path(__file__).resolve().parent.as_posix()
        
        # Drop it in the localized CWD so the dumb-terminal download route doesn't trip on absolute path slashes
        out_file = "emergency_core_context.txt"
        
        with open(out_file, "w", encoding="utf-8") as out:
            out.write("============================================================\n")
            out.write(f"INSETU EMERGENCY CORE CONTEXT ({datetime.now()})\n")
            out.write("============================================================\n\n")
            
            for root, _, files in os.walk(script_dir):
                # Skip massive vendor/cache directories
                if "__pycache__" in root or "node_modules" in root or ".git" in root: 
                    continue
                    
                for f in files:
                    if f.endswith(('.py', '.js', '.html', '.css')):
                        filepath = Path(root).joinpath(f).as_posix()
                        rel_path = os.path.relpath(filepath, script_dir)
                        try:
                            with open(filepath, 'r', encoding='utf-8') as inf:
                                content = inf.read()
                            out.write(f"\n\n{'='*60}\n>>> FILE: {rel_path}\n{'='*60}\n\n{content}")
                        except Exception:
                            pass
                            
        return jsonify({"status": "success", "file": out_file})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/system/reboot', methods=['POST'])
def system_reboot():
    import threading
    def restart():
        import time
        time.sleep(1.0)
        python_exe = sys.executable
        cli_script = os.path.abspath(sys.argv[0])
        os.execv(python_exe, [python_exe, cli_script] + sys.argv[1:])
    
    threading.Thread(target=restart, daemon=True).start()
    return jsonify({"status": "success", "message": "Rebooting..."})

def run_recovery_app():
    port = int(os.environ.get("INSETU_PORT", 5005))
    print(f"🚀 Booting Immutable Recovery OS on Port {port}...")
    print(f"👉 Navigate to http://127.0.0.1:{port} to evacuate files or issue emergency patches.")
    app.run(port=port, debug=False)

if __name__ == "__main__":
    run_recovery_app()