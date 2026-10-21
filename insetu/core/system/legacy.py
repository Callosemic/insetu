import os
import shutil
from pathlib import Path
from insetu.core.sdk import (
    hooks,
    StoreManager,
    recover_corrupt_databases,
    migrate_legacy_sqlite_paths,
)
from insetu.core.utils_core import (
    get_all_workspace_ids,
    get_tenant_control_dir,
    get_workspace_physics,
    load_json_config,
    save_json_config,
)

LEGACY_MIGRATION_VERSION = 2
def move_tree_contents(src_dir: Path, dst_dir: Path):
    """Recursively merges files from src_dir into dst_dir and removes empty source directories."""
    if not src_dir.exists() or not src_dir.is_dir():
        return
    try:
        if src_dir.resolve() == dst_dir.resolve():
            return
    except Exception:
        if src_dir.as_posix() == dst_dir.as_posix():
            return
    os.makedirs(dst_dir.as_posix(), exist_ok=True)
    for item in os.listdir(src_dir.as_posix()):
        s_item = src_dir.joinpath(item)
        d_item = dst_dir.joinpath(item)
        if s_item.is_dir():
            move_tree_contents(s_item, d_item)
        else:
            if not d_item.exists() or (s_item.stat().st_size > d_item.stat().st_size):
                shutil.copy2(s_item.as_posix(), d_item.as_posix())
            try:
                os.remove(s_item.as_posix())
            except Exception:
                pass
    try:
        if not os.listdir(src_dir.as_posix()):
            os.rmdir(src_dir.as_posix())
    except Exception:
        pass
@hooks.on('system_boot', priority=4)
def split_system_json(**kwargs):
    """Splits legacy system.json into daemon host.json and multi-tenant workspaces.json."""
    base_dir = Path(get_tenant_control_dir("default"))
    sys_path = base_dir.joinpath("system.json")
    host_path = base_dir.joinpath("host.json")
    ws_path = base_dir.joinpath("workspaces.json")
    existing_ws_data = load_json_config(ws_path.as_posix(), {}) if ws_path.exists() else {}
    if sys_path.exists():
        try:
            data = load_json_config(sys_path.as_posix(), {})
            sys_workspaces = data.pop("workspaces", {})
            existing_workspaces = existing_ws_data.get("workspaces", {}) if isinstance(existing_ws_data, dict) and not existing_ws_data.get("_deprecated") else {}
            merged_workspaces = {"default": {"config_path": "config.json"}, **existing_workspaces, **(sys_workspaces if isinstance(sys_workspaces, dict) else {})}
            active_ws = data.pop("active_workspace", None) or existing_ws_data.get("active_workspace", "default")
            save_json_config(ws_path.as_posix(), {"workspaces": merged_workspaces, "active_workspace": active_ws}, workspace_id="default")
            if data:
                host_data = load_json_config(host_path.as_posix(), {}) if host_path.exists() else {}
                host_data.update(data)
                save_json_config(host_path.as_posix(), host_data, workspace_id="default")
            try: os.remove(sys_path.as_posix())
            except Exception: pass
        except Exception:
            pass
    elif ws_path.exists() and existing_ws_data.get("_deprecated"):
        save_json_config(ws_path.as_posix(), {"workspaces": {"default": {"config_path": "config.json"}}, "active_workspace": "default"}, workspace_id="default")


@hooks.on('system_boot', priority=5)
def migrate_physical_sandboxes(**kwargs):
    """Domain-agnostic kernel migration: consolidates SQLite databases into .insetu/cache/db/ and heals .gitignore."""
    for ws_id in get_all_workspace_ids():
        base_dir = Path(get_tenant_control_dir(ws_id))
        cache_db_dir = base_dir.joinpath("cache", "db")
        data_root_dir = base_dir.joinpath("data")
        os.makedirs(cache_db_dir.as_posix(), exist_ok=True)
        os.makedirs(data_root_dir.as_posix(), exist_ok=True)

        watermark_path = base_dir.joinpath("cache", "migration_state.json").as_posix()
        wm_data = load_json_config(watermark_path, {})
        if wm_data.get("version", 0) >= LEGACY_MIGRATION_VERSION and not base_dir.joinpath("ext").exists():
            continue

        # 1. Heal .insetu/.gitignore so data/ is never blocked from version control
        gitignore_p = base_dir.joinpath(".gitignore")
        if gitignore_p.exists():
            try:
                gi_text = gitignore_p.read_text(encoding="utf-8")
                if "\ndata/\n" in f"\n{gi_text}\n":
                    lines = [l for l in gi_text.splitlines() if l.strip() != "data/"]
                    if "cache/" not in lines:
                        lines.insert(1 if lines else 0, "cache/")
                    gitignore_p.write_text("\n".join(lines) + "\n", encoding="utf-8")
            except Exception:
                pass

        # 2. Sweep legacy .insetu/ext/*/db/ and .insetu/data/*.db into .insetu/cache/db/
        ext_base = base_dir.joinpath("ext")
        if ext_base.exists() and ext_base.is_dir():
            for ext_name in os.listdir(ext_base.as_posix()):
                ext_dir = ext_base.joinpath(ext_name)
                if not ext_dir.is_dir():
                    continue
                for db_cand_dir in [ext_dir.joinpath("db"), ext_dir, ext_dir.joinpath("data")]:
                    if db_cand_dir.exists() and db_cand_dir.is_dir():
                        for item in os.listdir(db_cand_dir.as_posix()):
                            if ".db" in item:
                                src_db = db_cand_dir.joinpath(item)
                                dst_db = cache_db_dir.joinpath(item)
                                if src_db.is_file():
                                    if item.endswith(".db"):
                                        for sidecar in [f"{item}-wal", f"{item}-shm"]:
                                            sp = cache_db_dir.joinpath(sidecar)
                                            if sp.exists():
                                                try: os.remove(sp.as_posix())
                                                except Exception: pass
                                    if not dst_db.exists() or (src_db.stat().st_size > dst_db.stat().st_size):
                                        shutil.copy2(src_db.as_posix(), dst_db.as_posix())
                                    try: os.remove(src_db.as_posix())
                                    except Exception: pass
                for sub in ["db", "data"]:
                    sp = ext_dir.joinpath(sub)
                    if sp.exists() and sp.is_dir() and not os.listdir(sp.as_posix()):
                        try: os.rmdir(sp.as_posix())
                        except Exception: pass
                if ext_dir.exists() and not os.listdir(ext_dir.as_posix()):
                    try: os.rmdir(ext_dir.as_posix())
                    except Exception: pass

        for item in os.listdir(data_root_dir.as_posix()):
            p = data_root_dir.joinpath(item)
            if p.is_file() and ".db" in item:
                dst = cache_db_dir.joinpath(item)
                if not dst.exists() or (p.stat().st_size > dst.stat().st_size):
                    shutil.copy2(p.as_posix(), dst.as_posix())
                try: os.remove(p.as_posix())
                except Exception: pass
        # 3. Self-Healing DB Recovery inside .insetu/cache/db/
        recover_corrupt_databases(ws_id)

        # 4. Migrate legacy extension store definitions into .insetu/data/<ext>/ via StoreManager SSOT
        for ext_name, filenames in [("flow", ["workflows.json"]), ("editor", ["preferences.json"])]:
            store_mgr = StoreManager(ws_id, ext_name=ext_name)
            for fname in filenames:
                store_mgr._resolve_store_path(fname)
        # 5. Sanitize legacy tracker paths and dead out_file references in config.json
        try:
            cfg_path, _ = get_workspace_physics(ws_id)
            if os.path.exists(cfg_path):
                cfg_data = load_json_config(cfg_path, {})
                changed_cfg = False

                if cfg_data.get("managed_dirs") == [".tracker"]:
                    cfg_data["managed_dirs"] = [".insetu-data"]
                    changed_cfg = True

                for r_cfg in (cfg_data.get("target_repos") or []):
                    if not isinstance(r_cfg, dict): continue
                    if "out_file" in r_cfg:
                        del r_cfg["out_file"]
                        changed_cfg = True
                    if r_cfg.get("archive_type") == "prompt-library":
                        r_cfg["archive_type"] = "repo"
                        changed_cfg = True
                    if ".tracker/" in (r_cfg.get("ignore_exceptions") or []):
                        r_cfg["ignore_exceptions"] = [x for x in r_cfg["ignore_exceptions"] if x != ".tracker/"]
                        if ".insetu-data/" not in r_cfg["ignore_exceptions"]:
                            r_cfg["ignore_exceptions"].append(".insetu-data/")
                        changed_cfg = True
                    for sb in (r_cfg.get("sub_buckets") or []):
                        if isinstance(sb, dict) and "out_file" in sb:
                            del sb["out_file"]
                            changed_cfg = True

                if changed_cfg:
                    save_json_config(cfg_path, cfg_data, workspace_id=ws_id)
        except Exception:
            pass

        # 6. Migrate legacy <repo>/.tracker directories into <repo>/.insetu-data/tracker
        try:
            cfg_path, ws_root = get_workspace_physics(ws_id)
            raw_cfg = load_json_config(cfg_path, {})
            migrated_tracker = False
            for repo_cfg in (raw_cfg.get("target_repos") or []):
                if not isinstance(repo_cfg, dict):
                    continue
                r_dir = repo_cfg.get("repo_dir")
                if not r_dir:
                    continue
                p_path = repo_cfg.get("physical_path")
                r_path = Path(os.path.abspath(os.path.expanduser(p_path))) if p_path else Path(ws_root).joinpath(r_dir).resolve()
                legacy_tr = r_path.joinpath(".tracker")
                new_tr = r_path.joinpath(".insetu-data", "tracker")
                if legacy_tr.exists() and legacy_tr.is_dir():
                    move_tree_contents(legacy_tr, new_tr)
                    migrated_tracker = True
            if migrated_tracker:
                migrate_legacy_sqlite_paths(
                    ws_id, "tracker", "tracker_tickets", "filepath", "/.tracker/", "/.insetu-data/tracker/"
                )
        except Exception:
            pass

        try:
            save_json_config(watermark_path, {"version": LEGACY_MIGRATION_VERSION}, workspace_id=ws_id)
        except Exception:
            pass