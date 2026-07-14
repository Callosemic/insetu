from pathlib import Path
import os
import json
import datetime
import subprocess
import shutil
from flask import jsonify
from insetu.utils_core import get_valid_workspace_files, get_workspace_physics
from insetu.sdk import InSetuExtension
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

GATHER_SETTINGS_SCHEMA = [
    {
        "id": "max_context_size_kb",
        "label": "Max Context Size (KB)",
        "type": "number",
        "default": 0,
        "description": "Set to 0 to disable chunking. Context files exceeding this limit will be cleanly split into numbered parts."
    }
]
gather_bp = InSetuExtension('gather', __name__, core=True, settings_schema=GATHER_SETTINGS_SCHEMA)
__depends__ = []
from insetu.hooks import hooks

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
def resolve_file_bucket(filepath, sub_buckets):
    """DRY Helper to map a filepath to its configured sub-bucket."""
    for b in sub_buckets:
        prefix = b.get("dynamic_split_prefix")
        if prefix:
            if prefix == "." or filepath.startswith(prefix):
                parts = filepath.split("/")
                module_idx = len([p for p in prefix.split('/') if p and p != '.'])
                if len(parts) > module_idx + 1:
                    return b, parts[module_idx]
                continue # Let boundary files fall through to explicit buckets or the catch-all
        elif b.get("match_prefixes") and any(filepath.startswith(p) for p in b["match_prefixes"]):
            return b, None

    catch_all = next((b for b in sub_buckets if b.get("is_catch_all")), None)
    return catch_all, None
def compile_context_payload(workspace_id, output_dir, base_filename, header_block, text_blocks, files, meta, max_kb=None):
    """Universal compiler for all system contexts (Gather, Git, Flow)."""
    from insetu.context import VFSTransaction
    from insetu.sdk import ExtensionContext

    if max_kb is None:
        ctx = ExtensionContext('gather', workspace_id)
        max_kb = ctx.settings.get("max_context_size_kb", 0)

    vfs = VFSTransaction(workspace_id)
    max_bytes = (max_kb * 1024) if max_kb and max_kb > 0 else float('inf')
    current_chunk = 1
    chunks = []

    def get_chunk_name(chunk_num):
        if chunk_num == 1: return base_filename
        base, ext = os.path.splitext(base_filename)
        return f"{base}_part{chunk_num}{ext}"
    header_bytes = len(header_block.encode('utf-8'))
    bins = [{"size": header_bytes, "content": header_block}]

    for block in text_blocks:
        block_bytes = len(block.encode('utf-8'))
        placed = False

        # First Fit: Try to slot into any existing open chunk
        for b in bins:
            if b["size"] + block_bytes <= max_bytes:
                b["content"] += block
                b["size"] += block_bytes
                placed = True
                break

        # If it overflows all current chunks, open a new one
        if not placed:
            new_idx = len(bins) + 1
            new_header = header_block + f"=== (CONTINUED - PART {new_idx}) ===\n\n"
            bins.append({
                "size": len(new_header.encode('utf-8')) + block_bytes,
                "content": new_header + block
            })
    chunk_sizes = []
    for i, b in enumerate(bins):
        chunk_name = get_chunk_name(i + 1)
        chunk_path = Path(output_dir).joinpath(chunk_name).as_posix()
        vfs.save(chunk_path, b["content"], data={"is_absolute_artifact": True})
        chunks.append(chunk_name)
        chunk_sizes.append(b["size"])
    meta_copy = meta.copy()
    if "type" not in meta_copy:
        meta_copy["type"] = "gather"

    manifest_entry = {
        "files": files,
        "meta": meta_copy
    }
    manifest_entry["meta"]["size_bytes"] = sum(chunk_sizes)
    if len(chunks) > 1:
        manifest_entry["meta"]["chunks"] = chunks
        manifest_entry["meta"]["chunk_sizes"] = chunk_sizes
    return manifest_entry

def write_bucket(output_path, filepaths, title, domain_str, repo_path, repo_dir, workspace_id=None, max_kb=None):
    if not filepaths: return []
    from insetu.context import VFSTransaction
    vfs = VFSTransaction(workspace_id)

    header_str = "="*60 + f"\nINSETU TOPOLOGY ({title})\n" + "="*60 + "\n" + generate_ascii_tree(filepaths) + "\n\n"
    text_blocks = []

    for filepath in filepaths:
        try:
            content = vfs.read(f"{repo_dir}/{filepath}")
            if content is not None:
                text_blocks.append(f"\n\n{'='*60}\n>>>NEW FILE :: {repo_dir}/{filepath} | {domain_str}\n{'='*60}\n\n{content}")
        except Exception as e:
            print(f"Skipping {filepath}: {e}")


    output_dir = os.path.dirname(output_path)
    base_filename = os.path.basename(output_path)
    manifest_entry = compile_context_payload(
        workspace_id, output_dir, base_filename, header_str, text_blocks, 
        [f"{repo_dir}/{f}" for f in filepaths], 
        {"title": title, "domain": domain_str, "desc": f"Context payload for {title}."}, 
        max_kb=max_kb
    )
    return manifest_entry
def _compile_repo_buckets(config, paths, workspace_id, manifest_ref, touched_buckets=None):
    from insetu.sdk import ExtensionContext
    from insetu.utils_core import get_valid_workspace_files, get_safe_repo_id

    ctx = ExtensionContext('gather', workspace_id)
    safe_r_dir = get_safe_repo_id(config.get("repo_dir"))
    max_kb = config.get("max_context_size_kb", ctx.settings.get("max_context_size_kb", 0))
    physical_path = config.get("physical_path")

    if physical_path:
        repo_path = os.path.abspath(os.path.expanduser(physical_path))
    else:
        repo_path = ctx.resolve_path(config["repo_dir"])

    if not os.path.exists(repo_path): return False

    final_list = get_valid_workspace_files(repo_path, config, workspace_id) or []
    archive_type = config.get("archive_type", "repo")
    if archive_type == "media-vault":
        if touched_buckets is None or f"{config['repo_dir']}_vault.json" in touched_buckets:
            if final_list:
                r_title = config.get("title", config["repo_dir"].replace('-', ' ').title())
                manifest_ref[f"{config['repo_dir']}_vault.json"] = {
                    "files": [f"{config['repo_dir']}/{f}" for f in final_list],
                    "meta": {"title": r_title, "domain": config.get("domain", "Media Vault"), "desc": config.get("description", "Media vault assets.")}
                }
            else:
                if f"{config['repo_dir']}_vault.json" in manifest_ref:
                    del manifest_ref[f"{config['repo_dir']}_vault.json"]
        return True

    dirty = False
    sub_buckets = config.get("sub_buckets", [])
    if sub_buckets:
        buckets = {b["id"]: {"files": [], "cfg": b} for b in sub_buckets if not b.get("dynamic_split_prefix")}
        dynamic_files = {}
        managed_dirs = ctx.config.get("managed_dirs", []) + config.get("repo_managed_dirs", [])

        for filepath in final_list:
            b, module = resolve_file_bucket(filepath, sub_buckets)
            if b and module:
                if module not in dynamic_files: dynamic_files[module] = {"files": [], "cfg": b}
                dynamic_files[module]["files"].append(filepath)
            elif b:
                buckets[b["id"]]["files"].append(filepath)
            else:
                # Anti-Pattern Guard: Prevent unmatched managed OS directories from bleeding into the default context
                if any(filepath.startswith(d + '/') or f"/{d}/" in filepath for d in managed_dirs):
                    continue

                if "default_catch_all" not in buckets:
                    buckets["default_catch_all"] = {
                        "files": [], "cfg": {
                            "id": "catch_all", "title": config.get("title", config["repo_dir"]), 
                            "domain": config.get("domain", "Workspaces"), 
                            "out_file": config.get("out_file", f"{safe_r_dir}_context.txt")
                        }
                    }
                buckets["default_catch_all"]["files"].append(filepath)

        active_bucket_outputs = set()
        active_dynamic_outputs = set()

        for b_id, data in buckets.items():
            safe_out = data["cfg"].get("out_file", f"{safe_r_dir}_{b_id}_context.txt")
            if touched_buckets is None or safe_out in touched_buckets:
                if data["files"]:
                    active_bucket_outputs.add(safe_out)
                    b_title = data["cfg"].get("title", b_id.replace('_', ' ').title())
                    b_domain = data["cfg"].get("domain", config.get("domain", "Workspaces"))
                    b_desc = data["cfg"].get("description", f"Context payload for {b_title}.")
                    out_path = Path(paths["contexts_dir"]).joinpath(safe_out).as_posix()
                    manifest_entry = write_bucket(out_path, data["files"], b_title.upper(), b_domain, repo_path, config['repo_dir'], workspace_id, max_kb=max_kb)
                    manifest_ref[safe_out] = manifest_entry
                    dirty = True
                else:
                    if safe_out in manifest_ref:
                        del manifest_ref[safe_out]
                        dirty = True
                        out_path = Path(paths["contexts_dir"]).joinpath(safe_out).as_posix()
                        if os.path.exists(out_path):
                            try: os.remove(out_path)
                            except Exception: pass

        for module, data in dynamic_files.items():
            out_name = f"{module}_context.txt"
            if touched_buckets is None or out_name in touched_buckets:
                if data["files"]:
                    active_dynamic_outputs.add(out_name)
                    c = data["cfg"]
                    meta_map = c.get("meta_map", {})
                    meta = meta_map.get(module, {})
                    title = meta.get("title", module.replace('_', ' ').title())
                    domain = meta.get("domain", c.get("domain", "Dynamic Modules"))
                    desc = meta.get("description", c.get("description", f"Dynamically mapped logic and templates for {title}."))
                    out_path = Path(paths["contexts_dir"]).joinpath(out_name).as_posix()
                    manifest_entry = write_bucket(out_path, data["files"], title.upper(), domain, repo_path, config['repo_dir'], workspace_id, max_kb=max_kb)
                    manifest_ref[out_name] = manifest_entry
                    dirty = True

        if touched_buckets:
            for touched_b in touched_buckets:
                if touched_b.endswith('_context.txt') and touched_b not in active_bucket_outputs and touched_b not in active_dynamic_outputs:
                    if touched_b in manifest_ref:
                        del manifest_ref[touched_b]
                        dirty = True
                        out_path = Path(paths["contexts_dir"]).joinpath(touched_b).as_posix()
                        if os.path.exists(out_path):
                            try: os.remove(out_path)
                            except Exception: pass
    else:
        safe_out = config.get("out_file", f"{safe_r_dir}_context.txt")
        if touched_buckets is None or safe_out in touched_buckets:
            r_title = config.get("title", config["repo_dir"].replace('-', ' ').title())
            r_domain = config.get("domain", "Workspaces")
            r_desc = config.get("description", f"Context payload for {r_title}.")
            out_path = Path(paths["contexts_dir"]).joinpath(safe_out).as_posix()

            managed_dirs = ctx.config.get("managed_dirs", []) + config.get("repo_managed_dirs", [])
            filtered_list = [f for f in final_list if not any(f.startswith(d + '/') or f"/{d}/" in f for d in managed_dirs)]
            if filtered_list:
                manifest_entry = write_bucket(out_path, filtered_list, r_title, r_domain, repo_path, config['repo_dir'], workspace_id, max_kb=max_kb)
                manifest_ref[safe_out] = manifest_entry
                dirty = True
            else:
                if safe_out in manifest_ref:
                    del manifest_ref[safe_out]
                    dirty = True
                    if os.path.exists(out_path):
                        try: os.remove(out_path)
                        except Exception: pass

    return dirty
from insetu.hooks import hooks
@hooks.on('vfs_transaction_committed')
@hooks.on('post_file_save')
@hooks.on('post_file_delete')
def _surgically_update_manifest(workspace_id=None, files=None, filepath=None, **kwargs):
    """Surgically regenerates context payloads and updates the manifest only for touched buckets."""
    if not files and not filepath: return
    # Queue Coalescing Guardrail: Skip intermediate files if bulk mutations are actively draining
    if filepath:
        from insetu.routes_fs import _VFS_WRITE_QUEUE
        if not _VFS_WRITE_QUEUE.empty():
            return
        files = [filepath]
    # VFS BARRIER: Ensure all physical disk writes have settled before locking the compiler
    from insetu.routes_fs import _VFS_WRITE_QUEUE
    _VFS_WRITE_QUEUE.join()

    from insetu.app import get_compiler_lock
    with get_compiler_lock(workspace_id or "default"):
        from insetu.sdk import ExtensionContext
        from insetu.utils_core import load_json_file, save_json_file, get_safe_repo_id
        ctx = ExtensionContext('gather', workspace_id)
        paths = ctx.paths
        manifest = ctx.manifest
        cfg = ctx.config

        affected_repos = set()
        for f in files:
            parts = f.split('/', 1)
            if len(parts) > 0: affected_repos.add(parts[0])

        dirty = False
        all_touched_buckets = set()

        for repo_dir in affected_repos:
            repo_cfg = next((r for r in cfg.get("target_repos", []) if r.get("repo_dir") == repo_dir), None)
            if not repo_cfg or repo_cfg.get("exclude_from_context"): continue

            safe_r_dir = get_safe_repo_id(repo_dir)
            sub_buckets = repo_cfg.get("sub_buckets", [])
            touched_buckets = set()

            # Identify exactly which buckets the incoming files affect
            for filepath in files:
                if not filepath.startswith(repo_dir + '/'): continue
                rel_path = filepath[len(repo_dir)+1:]

                if sub_buckets:
                    b, module = resolve_file_bucket(rel_path, sub_buckets)
                    if b and module:
                        touched_buckets.add(f"{module}_context.txt")
                    elif b:
                        touched_buckets.add(b.get("out_file", f"{safe_r_dir}_{b['id']}_context.txt"))
                    else:
                        touched_buckets.add(repo_cfg.get("out_file", f"{safe_r_dir}_context.txt"))
                else:
                    touched_buckets.add(repo_cfg.get("out_file", f"{safe_r_dir}_context.txt"))

            all_touched_buckets.update(touched_buckets)
            # Compile ONLY the touched buckets for this repo using the DRY helper
            if _compile_repo_buckets(repo_cfg, paths, workspace_id, manifest, touched_buckets):
                dirty = True

        if dirty:
            from insetu.db import get_connection
            db_conn = get_connection("workers", workspace_id=workspace_id)
            for repo_dir in affected_repos:
                db_conn.execute("DELETE FROM nongit_fixtures WHERE repo_dir = ?", (repo_dir,))
            db_conn.commit()

            from insetu.routes_fs import _VFS_WRITE_QUEUE
            _VFS_WRITE_QUEUE.join()

            hooks.emit('compile_contexts', manifest=manifest, workspace_id=workspace_id, target_repos=list(affected_repos), touched_buckets=list(all_touched_buckets), is_full_sweep=False)
            ctx.save_manifest(manifest)

def generate_context_file(workspace_id=None, target_repos=None):
    from insetu.sdk import ExtensionContext
    ctx = ExtensionContext('gather', workspace_id)
    paths = ctx.paths
    # Pre-flight purge: destroy all stale contexts to prevent ghost files (excluding active ephemerals)
    from insetu.db import get_connection
    w_conn = get_connection("workers", workspace_id=workspace_id)
    w_conn.execute("""
        CREATE TABLE IF NOT EXISTS ephemeral_artifacts (
            id TEXT PRIMARY KEY,
            filepath TEXT,
            module_owner TEXT,
            created_at REAL,
            expires_at REAL
        )
    """)
    w_conn.commit()
    active_ephemerals = [row['filepath'] for row in w_conn.execute("SELECT filepath FROM ephemeral_artifacts").fetchall()]
    from insetu.context import VFSTransaction
    vfs = VFSTransaction(workspace_id)

    live_cfg = ctx.config
    manifest = {}
    for config in live_cfg.get("target_repos", []):
        if config.get("exclude_from_context"): continue
        if target_repos and config.get("repo_dir") not in target_repos: continue
        _compile_repo_buckets(config, paths, workspace_id, manifest)
    # --- EXTENSION HOOKS ---
    from insetu.hooks import hooks
    from insetu.routes_fs import execute_vfs_save, _VFS_WRITE_QUEUE
    _VFS_WRITE_QUEUE.join()

    sweep_payload = True if target_repos is None else target_repos
    hooks.emit('compile_contexts', manifest=manifest, workspace_id=workspace_id, is_full_sweep=sweep_payload)
    # Set Analysis: Prune only orphaned context files that were not regenerated
    valid_basenames = set(manifest.keys())
    for data in manifest.values():
        for chunk in data.get("meta", {}).get("chunks", []):
            valid_basenames.add(chunk)

    for ws_rel_path in vfs.walk(paths["contexts_dir"]):
        f_path = ctx.resolve_path(ws_rel_path)
        f_basename = os.path.basename(f_path)

        if f_path not in active_ephemerals and f_basename not in valid_basenames and f_basename != "manifest.json":
            try:
                from insetu.routes_fs import execute_vfs_delete
                execute_vfs_delete(workspace_id, ws_rel_path)
            except Exception:
                pass

    # Re-inject surviving Ephemeral Artifacts into the manifest so they persist through background compiles
    for f_path in active_ephemerals:
        if f_path.startswith(paths["contexts_dir"]):
            f_name = os.path.basename(f_path)
            size_bytes = os.path.getsize(f_path) if os.path.exists(f_path) else 0
            # Ensure it aligns with the new schema
            manifest[f_name] = {
                "files": [f"data/contexts/{f_name}"],
                "meta": {"type": "gather", "title": f"📦 {f_name.replace('.txt','')}", "domain": "Quick-Pack Clipboard", "desc": "Ad-hoc context payload.", "size_bytes": size_bytes}
            }

    manifest_out_path = Path(paths["contexts_dir"]).joinpath("manifest.json").as_posix()
    execute_vfs_save(workspace_id, manifest_out_path, json.dumps(manifest, indent=2), data={"is_absolute_artifact": True})

    # Block until the manifest and workflows are flushed so the UI can fetch them instantly
    _VFS_WRITE_QUEUE.join()
from insetu.workers import update_immediate_job_status, register_callback, submit_immediate_job

def _background_quick_pack(job_id, workspace_id, **kwargs):
    try:
        target_dir = kwargs.get('target_dir', '').strip()
        recursive = kwargs.get('recursive', False)
        specific_files = kwargs.get('specific_files', None)

        update_immediate_job_status(job_id, 'processing', "Sweeping files for Quick-Pack...", workspace_id=workspace_id)

        from insetu.utils_core import get_omniscient_workspace_files, get_workspace_physics
        from insetu.context import VFSTransaction
        repo = target_dir.split('/')[0]

        all_files = get_omniscient_workspace_files(workspace_id, [repo])
        matched_files = []
        target_prefix = target_dir + '/' if target_dir else ''

        for filename, rel_path in all_files:
            if not rel_path.startswith(target_prefix) and target_dir != repo: 
                continue
            if specific_files is not None:
                if rel_path in specific_files:
                    matched_files.append(rel_path)
                continue
            if not recursive:
                target_depth = target_dir.count('/')
                file_depth = rel_path.count('/')
                if file_depth > target_depth + (1 if target_dir else 0):
                    continue
            matched_files.append(rel_path)

        if not matched_files:
            update_immediate_job_status(job_id, 'failed', "No valid tracked files found in the specified path.", workspace_id=workspace_id)
            return

        update_immediate_job_status(job_id, 'processing', f"Packing {len(matched_files)} files...", workspace_id=workspace_id)

        _, ws_root, _ = get_workspace_physics(workspace_id)
        out_lines = []
        out_lines.append("="*60)
        out_lines.append(f"INSETU AD-HOC CONTEXT PAYLOAD ({target_dir})")
        out_lines.append("="*60)
        out_lines.append("")
        out_lines.append(generate_ascii_tree(matched_files))
        out_lines.append("\n")

        with VFSTransaction(workspace_id) as vfs:
            for rel_path in sorted(matched_files):
                try:
                    content = vfs.read(rel_path)
                    if content is not None:
                        out_lines.append(f"{'='*60}\n>>>NEW FILE :: {rel_path} | Ad-Hoc Payload\n{'='*60}\n\n{content}\n\n")
                    else:
                        out_lines.append(f"{'='*60}\n>>>NEW FILE :: {rel_path} | Ad-Hoc Payload\n{'='*60}\n\n[Error reading file: Not found]\n\n")
                except Exception as e:
                    out_lines.append(f"{'='*60}\n>>>NEW FILE :: {rel_path} | Ad-Hoc Payload\n{'='*60}\n\n[Error reading file: {str(e)}]\n\n")
            import time
            from insetu.sdk import ExtensionContext
            from insetu.utils_core import load_json_file, save_json_file
            ctx = ExtensionContext('gather', workspace_id)
            safe_name = target_dir.replace('/', '_').replace('\\', '_') if target_dir else 'workspace'
            filename = f"quick_pack_{int(time.time())}_{safe_name}.txt"
            paths = ctx.paths
            out_path = Path(paths["contexts_dir"]).joinpath(filename).as_posix()

            vfs.save(out_path, "\n".join(out_lines), data={"is_absolute_artifact": True})

        from insetu.routes_fs import _VFS_WRITE_QUEUE
        _VFS_WRITE_QUEUE.join()
        from insetu.workers import register_ephemeral_artifact
        register_ephemeral_artifact(out_path, "quick_pack", 86400, workspace_id=workspace_id)
        manifest = ctx.manifest
        size_bytes = os.path.getsize(out_path) if os.path.exists(out_path) else 0
        manifest[filename] = {
            "files": [f"data/contexts/{filename}"],
            "meta": {"type": "gather", "title": f"📦 {target_dir or 'Workspace'}", "domain": "Quick-Pack Clipboard", "desc": f"Ad-hoc context packed on {datetime.datetime.now().strftime('%Y-%m-%d')} (24h TTL)", "size_bytes": size_bytes}
        }
        ctx.save_manifest(manifest)

        update_immediate_job_status(job_id, 'completed', "Quick-Pack generated successfully.", artifact={"filename": filename}, workspace_id=workspace_id)
    except Exception as e:
        update_immediate_job_status(job_id, 'failed', f"Error generating Quick-Pack: {str(e)}", workspace_id=workspace_id)

register_callback("gather", "quick_pack_task", _background_quick_pack)
@gather_bp.route('quick-pack', methods=['POST'])
def api_gather_quick_pack(ctx):
    """Stateless generator for ephemeral, ad-hoc context payloads without disk pollution."""
    data = ctx.req.json or {}
    target_dir = data.get('target_dir', '').strip()

    if not target_dir:
        return jsonify({"error": "Target directory required."}), 400

    job_id = ctx.jobs.submit("quick_pack_task", **data)
    return jsonify({"status": "accepted", "job_id": job_id}), 202
@gather_bp.route('quick-pack/clear', methods=['POST'])
def api_gather_quick_pack_clear(ctx):
    import os
    from insetu.db import get_connection
    from insetu.utils_core import load_json_file, save_json_file

    conn = get_connection("workers", workspace_id=ctx.workspace_id)
    cursor = conn.execute("SELECT id, filepath FROM ephemeral_artifacts WHERE module_owner = 'quick_pack'")

    count = 0
    ephemeral_basenames = []
    from insetu.routes_fs import execute_vfs_delete
    from insetu.utils_core import get_workspace_physics
    _, ws_root, _ = get_workspace_physics(ctx.workspace_id)

    for row in cursor.fetchall():
        try:
            if os.path.exists(row['filepath']):
                try:
                    rel_path = os.path.relpath(row['filepath'], ws_root).replace('\\', '/')
                except ValueError:
                    rel_path = row['filepath']
                execute_vfs_delete(ctx.workspace_id, rel_path)
            ephemeral_basenames.append(os.path.basename(row['filepath']))
            conn.execute("DELETE FROM ephemeral_artifacts WHERE id=?", (row['id'],))
            count += 1
        except Exception: 
            pass
    conn.commit()

    manifest = ctx.manifest
    keys_to_remove = [k for k in manifest.keys() if k in ephemeral_basenames]
    if keys_to_remove:
        for k in keys_to_remove:
            del manifest[k]
        ctx.save_manifest(manifest)

    return jsonify({"status": "success", "cleared": count})
