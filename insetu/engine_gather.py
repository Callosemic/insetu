import os
import json
import datetime
import subprocess
import shutil
from insetu.utils_core import WORKSPACE_ROOT, CONFIG_PATH, get_valid_workspace_files
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Route artifacts into a dedicated data folder next to the active config
WORKSPACE_DIR = os.path.dirname(CONFIG_PATH)
ARTIFACTS_BASE = os.path.join(WORKSPACE_DIR, "data")

CONTEXTS_DIR = os.path.join(ARTIFACTS_BASE, "contexts")
PROMPTS_DIR = os.path.join(WORKSPACE_DIR, "prompts")
DIFFS_DIR = os.path.join(ARTIFACTS_BASE, "diffs")
GATHER_DIR = os.path.join(ARTIFACTS_BASE, "workflows")

os.makedirs(CONTEXTS_DIR, exist_ok=True)
os.makedirs(PROMPTS_DIR, exist_ok=True)
os.makedirs(DIFFS_DIR, exist_ok=True)
os.makedirs(GATHER_DIR, exist_ok=True)

def generate_ascii_tree(file_paths):
    tree = {}
    for path in file_paths:
        parts = path.split('/')
        current = tree
        for part in parts:
            if part not in current: current[part] = {}
            current = current[part]
            
    def print_tree(node, prefix=""):
        lines = []
        entries = sorted(list(node.keys()))
        for i, key in enumerate(entries):
            is_last = (i == len(entries) - 1)
            lines.append(f"{prefix}{'└── ' if is_last else '├── '}{key}")
            lines.extend(print_tree(node[key], prefix + ("    " if is_last else "│   ")))
        return lines
    return ".\n" + "\n".join(print_tree(tree))
def write_bucket(output_path, filepaths, title, domain_str, repo_path):
    if not filepaths: return
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as outfile:
        outfile.write("="*60 + f"\nINSETU TOPOLOGY ({title})\n" + "="*60 + "\n")
        outfile.write(generate_ascii_tree(filepaths) + "\n\n")
        for filepath in filepaths:
            try:
                with open(os.path.join(repo_path, filepath), 'r', encoding='utf-8') as infile: content = infile.read()

                display_domain = domain_str

                outfile.write(f"\n\n{'='*60}\n>>>NEW FILE :: /{filepath} | {display_domain}\n{'='*60}\n\n{content}")
            except Exception as e: print(f"Skipping {filepath}: {e}")
def generate_context_file():
    # Pre-flight purge: destroy all stale contexts to prevent ghost files
    for f in os.listdir(CONTEXTS_DIR):
        f_path = os.path.join(CONTEXTS_DIR, f)
        if os.path.isfile(f_path): os.remove(f_path)

    from insetu.utils_core import load_config
    live_cfg = load_config()
    from insetu.utils_core import get_safe_repo_id
    manifest = {}
    for config in live_cfg.get("target_repos", []):
        if config.get("exclude_from_context"): continue
 
        safe_r_dir = get_safe_repo_id(config.get("repo_dir"))

        physical_path = config.get("physical_path")
        if physical_path:
            repo_path = os.path.abspath(os.path.expanduser(physical_path))
        else:
            repo_path = os.path.abspath(os.path.join(WORKSPACE_ROOT, config["repo_dir"]))

        if not os.path.exists(repo_path): continue
        final_list = get_valid_workspace_files(repo_path, config)
        if not final_list: continue
        archive_type = config.get("archive_type", "repo")
        if archive_type == "media-vault":
            # Expose to UI manifest without generating massive context string payloads
            manifest[f"{config['repo_dir']}_vault.json"] = [f"{config['repo_dir']}/{f}" for f in final_list]
            continue
        elif archive_type == "prompt-library":
            # Inject into UI under the Prompts & State category without dumping context payloads
            manifest["prompts_context.txt"] = [f"{config['repo_dir']}/{f}" for f in final_list]
            continue

        # --- IMPLICIT TRACKER EXTRACTION ---
        tracker_files = [f for f in final_list if f.startswith(".tracker/")]
        if tracker_files:
            tracker_out = f"{safe_r_dir}_tracker_context.txt"
            out_path = os.path.join(CONTEXTS_DIR, tracker_out)
            write_bucket(out_path, tracker_files, f"ISSUE TRACKER ({config['repo_dir'].upper()})", "Active bugs, tasks, and planned units of work", repo_path)
            manifest[tracker_out] = [f"{config['repo_dir']}/{f}" for f in tracker_files]
            # Remove tracker files from main pipeline to prevent catch-all duplication
            final_list = [f for f in final_list if not f.startswith(".tracker/")]

        if not final_list: continue

        sub_buckets = config.get("sub_buckets", [])
        if sub_buckets:
            buckets = {b["id"]: {"files": [], "cfg": b} for b in sub_buckets if not b.get("dynamic_split_prefix")}
            dynamic_files = {}
            for filepath in final_list:
                matched = False
                for b in sub_buckets:
                    prefix = b.get("dynamic_split_prefix")
                    if prefix:
                        if prefix == "." or filepath.startswith(prefix):
                            parts = filepath.split("/")
                            module_idx = len([p for p in prefix.split('/') if p and p != '.'])
                            if len(parts) > module_idx + 1:
                                module = parts[module_idx]
                                if module not in dynamic_files: dynamic_files[module] = {"files": [], "cfg": b}
                                dynamic_files[module]["files"].append(filepath)
                                matched = True
                                break
                    elif b.get("match_prefixes") and any(filepath.startswith(p) for p in b["match_prefixes"]):
                        buckets[b["id"]]["files"].append(filepath)
                        matched = True
                        break
                
                if not matched:
                    catch_all = next((b for b in sub_buckets if b.get("is_catch_all")), None)
                    if catch_all: buckets[catch_all["id"]]["files"].append(filepath)

            for b_id, data in buckets.items():
                if data["files"]:
                    safe_out = data["cfg"].get("out_file", f"{config['repo_dir']}_{b_id}_context.txt")
                    out_path = os.path.join(CONTEXTS_DIR, safe_out)
                    write_bucket(out_path, data["files"], data["cfg"].get("title", b_id.upper()), data["cfg"].get("domain", ""), repo_path)
                    manifest[safe_out] = [f"{config['repo_dir']}/{f}" for f in data["files"]]
            for module, data in dynamic_files.items():
                files = data["files"]
                cfg = data["cfg"]
                meta_map = cfg.get("meta_map", {})
                meta = meta_map.get(module, {})

                title = meta.get("title", module.replace('_', ' ').title())
                domain = meta.get("domain", cfg.get("domain", "Dynamic Modules"))

                out_path = os.path.join(CONTEXTS_DIR, f"{module}_context.txt")
                write_bucket(out_path, files, title.upper(), domain, repo_path)
                manifest[f"{module}_context.txt"] = [f"{config['repo_dir']}/{f}" for f in files]
        else:
            safe_out = config.get("out_file", f"{safe_r_dir}_context.txt")
            out_path = os.path.join(CONTEXTS_DIR, safe_out)
            write_bucket(out_path, final_list, config.get("title", config["repo_dir"]), config.get("domain", ""), repo_path)
            manifest[safe_out] = [f"{config['repo_dir']}/{f}" for f in final_list]
    # --- EXTENSION HOOKS ---
    if "citations" in live_cfg.get("extensions", []):
        try:
            import sqlite3
            db_path = os.path.join(ARTIFACTS_BASE, "citations.db")
            if os.path.exists(db_path):
                conn = sqlite3.connect(db_path)
                conn.row_factory = sqlite3.Row

                # Auto-migrate attachments column if it doesn't exist
                try:
                    conn.execute("ALTER TABLE citations ADD COLUMN attachments TEXT DEFAULT '[]'")
                    conn.commit()
                except sqlite3.OperationalError:
                    pass

                cursor = conn.execute("SELECT raw_json, attachments FROM citations ORDER BY id ASC")
                rows = cursor.fetchall()

                if rows:
                    def write_citation_bucket(filename, items, list_title):
                        out_path = os.path.join(CONTEXTS_DIR, filename)
                        with open(out_path, 'w', encoding='utf-8') as outfile:
                            outfile.write("============================================================\n")
                            outfile.write(f"INSETU TOPOLOGY ({list_title})\n")
                            outfile.write("============================================================\n\n")
                            for item in items:
                                csl_id = item.get("id", "unknown")
                                title = item.get("title", "Untitled")
                                authors = ", ".join([a.get('family', '') for a in item.get('author', [])])
                                outfile.write(f"--- [@{csl_id}] ---\n")
                                outfile.write(f"Title: {title}\n")
                                outfile.write(f"Author(s): {authors}\n")
                                outfile.write(f"Type: {item.get('type', 'unknown')}\n")
                                outfile.write(f"Raw CSL-JSON: {json.dumps(item)}\n\n")
                            manifest[filename] = ["data/citations.db"]

                    global_items = []
                    bucketed_items = {}

                    for row in rows:
                        item = json.loads(row['raw_json'])
                        atts = json.loads(row['attachments']) if row['attachments'] else []
                        global_items.append(item)

                        for att in atts:
                            repo = att.get("repo")
                            bucket = att.get("bucket", "None")
                            if repo:
                                if repo not in bucketed_items: bucketed_items[repo] = []
                                if item not in bucketed_items[repo]: bucketed_items[repo].append(item)
                                if bucket and bucket != "None":
                                    rb_key = f"{repo}_{bucket}"
                                    if rb_key not in bucketed_items: bucketed_items[rb_key] = []
                                    if item not in bucketed_items[rb_key]: bucketed_items[rb_key].append(item)

                    write_citation_bucket("citations_context.txt", global_items, "GLOBAL REFERENCE LIBRARY")
                    for k, items in bucketed_items.items():
                        write_citation_bucket(f"{k}_citations_context.txt", items, f"REFERENCE LIBRARY ({k.upper()})")

        except Exception as e:
            print(f"Extension Hook Error (citations): {e}")
    # --- COMPILE CONTEXT BATCHES ---
    from insetu.utils_core import load_workflows
    w_cfg = load_workflows()
    context_batches = w_cfg.get("context_batches", [])
    for batch in context_batches:
        compile_batch(batch)

    with open(os.path.join(CONTEXTS_DIR, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f)

def compile_batch(batch):
    batch_id = batch.get("id")
    if not batch_id: return
    includes = batch.get("includes", [])
    out_path = os.path.join(GATHER_DIR, f"{batch_id}_context.txt")
    with open(out_path, "w", encoding="utf-8") as out_f:
        out_f.write(f"========== BATCH: {batch.get('title', batch_id)} ==========\n\n")
        for inc in includes:
            inc_path = os.path.join(ARTIFACTS_BASE, inc)
            if os.path.exists(inc_path):
                with open(inc_path, "r", encoding="utf-8") as in_f:
                    out_f.write(f"--- {inc} ---\n")
                    out_f.write(in_f.read())
                    out_f.write("\n\n")
            else:
                out_f.write(f"--- {inc} (NOT FOUND) ---\n\n")
def generate_diff_context():
    # Pre-flight purge: destroy all stale diffs to prevent ghost files
    for f in os.listdir(DIFFS_DIR):
        f_path = os.path.join(DIFFS_DIR, f)
        if os.path.isfile(f_path): os.remove(f_path)

    from insetu.utils_core import load_config
    live_cfg = load_config()
    diff_manifest = []
    from insetu.utils_core import get_safe_repo_id
    for config in live_cfg.get("target_repos", []):
        if config.get("exclude_from_diffs"): continue
   
        if config.get("archive_type", "repo") == "media-vault":
            continue
        safe_r_dir = get_safe_repo_id(config.get("repo_dir"))
        physical_path = config.get("physical_path")
        if physical_path:
            repo_path = os.path.abspath(os.path.expanduser(physical_path))
        else:
            repo_path = os.path.abspath(os.path.join(WORKSPACE_ROOT, config["repo_dir"]))

        if not os.path.exists(repo_path): continue
        try:
            # Use -uall to force Git to recursively list untracked files instead of just untracked directories
            result = subprocess.run(['git', 'status', '--porcelain', '-uall'], capture_output=True, text=True, cwd=repo_path)
            lines = result.stdout.splitlines()
            if not lines: continue
            changed_files = []
            for line in lines:
                if len(line) < 3: continue
                status = line[:2]
                filepath = line[3:]
                if '->' in filepath: filepath = filepath.split('->')[-1].strip()
                # Prevent recursive diff-ception by dropping the diffs directory
                if filepath.startswith('diffs/') or filepath.endswith('_diffs.txt'):
                    continue

                if os.path.isfile(os.path.join(repo_path, filepath)) or 'D' in status:
                    changed_files.append((filepath, status))
            if not changed_files: continue

            sub_buckets = config.get("sub_buckets", [])
            bucketed_files = {}
            # --- IMPLICIT TRACKER DIFFS ---
            tracker_diffs = [(f, s) for f, s in changed_files if f.startswith(".tracker/")]
            if tracker_diffs:
                tracker_out = f"{safe_r_dir}_tracker_diffs.txt"
                bucketed_files[tracker_out] = tracker_diffs
                changed_files = [(f, s) for f, s in changed_files if not f.startswith(".tracker/")]

            if not changed_files:
                pass
            elif sub_buckets:
                for filepath, status in changed_files:
                    matched = False
                    for b in sub_buckets:
                        prefix = b.get("dynamic_split_prefix")
                        if prefix:
                            if prefix == "." or filepath.startswith(prefix):
                                parts = filepath.split("/")
                                module_idx = len([p for p in prefix.split('/') if p and p != '.'])
                                module = parts[module_idx] if len(parts) > module_idx + 1 else "misc"
                                b_id = f"{module}_diffs.txt"
                                if b_id not in bucketed_files: bucketed_files[b_id] = []
                                bucketed_files[b_id].append((filepath, status))
                                matched = True
                                break
                        elif b.get("match_prefixes") and any(filepath.startswith(p) for p in b["match_prefixes"]):
                            b_id = b["out_file"].replace("_context.txt", "_diffs.txt")
                            if b_id not in bucketed_files: bucketed_files[b_id] = []
                            bucketed_files[b_id].append((filepath, status))
                            matched = True
                            break
                    if not matched:
                        catch_all = next((b for b in sub_buckets if b.get("is_catch_all")), None)
                        if catch_all:
                            b_id = catch_all["out_file"].replace("_context.txt", "_diffs.txt")
                            if b_id not in bucketed_files: bucketed_files[b_id] = []
                            bucketed_files[b_id].append((filepath, status))
            else:
                out_filename = config.get("out_file", f"{safe_r_dir}_context.txt").replace("_context.txt", "_diffs.txt")
                bucketed_files[out_filename] = changed_files
                
            for out_filename, files_in_bucket in bucketed_files.items():
                out_lines = []

                # Inject a summary block at the top
                out_lines.append(f"============================================================")
                out_lines.append(f">>> DIFF SUMMARY :: {len(files_in_bucket)} FILE(S) CHANGED")
                out_lines.append(f"============================================================")
                for f_path, f_status in files_in_bucket:
                    out_lines.append(f"[{f_status.ljust(2)}] {f_path}")
                out_lines.append("\n\n")
                for filepath, status in files_in_bucket:
                    abs_filepath = os.path.join(repo_path, filepath)
                    if 'D' in status:
                        out_lines.append(f"============================================================")
                        out_lines.append(f">>>DELETED FILE :: /{filepath} | PREVIOUSLY TRACKED")
                        out_lines.append(f"============================================================")
                        try:
                            diff_res = subprocess.run(['git', 'diff', 'HEAD', '--', filepath], capture_output=True, text=True, cwd=repo_path)
                            out_lines.append(diff_res.stdout)
                        except Exception as e:
                            out_lines.append(f"[Error generating diff: {e}]")
                        out_lines.append("\n\n")
                        continue

                    else:
                        out_lines.append(f"============================================================")
                        out_lines.append(f">>>NEW FILE :: /{filepath} | CURRENT CONTENTS")
                        out_lines.append(f"============================================================")
                        try:
                            with open(abs_filepath, 'r', encoding='utf-8') as cf: out_lines.append(cf.read())
                        except Exception:
                            out_lines.append("[Binary or unreadable file]")

                    out_lines.append(f"\n============================================================")
                    out_lines.append(f">>>DIFF :: /{filepath} | CHANGES SINCE LAST COMMIT")
                    out_lines.append(f"============================================================")

                    if status == "??":
                        out_lines.append("[Untracked file - full content above]")
                    else:
                        try:
                            diff_res = subprocess.run(['git', 'diff', 'HEAD', '--', filepath], capture_output=True, text=True, cwd=repo_path)
                            out_lines.append(diff_res.stdout)
                        except Exception as e:
                            out_lines.append(f"[Error generating diff: {e}]")
                    out_lines.append("\n\n")

                if out_lines:
                    out_path = os.path.join(DIFFS_DIR, out_filename)
                    with open(out_path, 'w', encoding='utf-8') as out_f:
                        out_f.write("\n".join(out_lines))
                    diff_manifest.append(out_filename)

        except Exception as e:
            print(f"Skipping diff generation for {config['repo_dir']}: {e}")

    return diff_manifest