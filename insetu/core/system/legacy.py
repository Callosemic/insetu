import os
import shutil
from pathlib import Path
from akasa.hooks import hooks
from akasa.utils import get_all_workspace_ids, get_tenant_control_dir

@hooks.on('system_boot', priority=5)
def migrate_physical_sandboxes(**kwargs):
    """Phase 3 Data Sovereignty: Safely migrate legacy directories into explicit extension sandboxes across all workspaces."""
    for ws_id in get_all_workspace_ids():
        base_dir = Path(get_tenant_control_dir(ws_id))

        # 1. Migrate legacy prompts
        legacy_prompts = base_dir.joinpath("prompts")
        new_prompts = base_dir.joinpath("ext", "prompts", "data")
        if legacy_prompts.exists() and legacy_prompts.is_dir():
            os.makedirs(new_prompts.parent, exist_ok=True)
            if not new_prompts.exists():
                shutil.move(legacy_prompts.as_posix(), new_prompts.as_posix())

        # 2. Migrate legacy data directory contents
        legacy_data = base_dir.joinpath("data")
        if legacy_data.exists() and legacy_data.is_dir():
            # Domain directories
            for domain, ext_name in [("contexts", "gather"), ("diffs", "git"), ("workflows", "flow")]:
                legacy_domain = legacy_data.joinpath(domain)
                new_domain = base_dir.joinpath("ext", ext_name, "data", domain)
                if legacy_domain.exists() and legacy_domain.is_dir() and not new_domain.exists():
                    os.makedirs(new_domain.parent, exist_ok=True)
                    shutil.move(legacy_domain.as_posix(), new_domain.as_posix())

            # Stranded files (.db, .db-wal, .db-shm, and .log files)
            for item in os.listdir(legacy_data.as_posix()):
                old_path = legacy_data.joinpath(item)
                if not old_path.is_file():
                    continue

                if ".db" in item:
                    ext_name = item.split(".db")[0]
                    target_dir = base_dir.joinpath("ext", ext_name, "db")
                elif item.startswith("cronic_"):
                    ext_name = "cronic"
                    target_dir = base_dir.joinpath("ext", ext_name, "data")
                elif item.startswith("manifest_"):
                    ext_name = "gather"
                    target_dir = base_dir.joinpath("ext", ext_name, "data")
                else:
                    continue
                os.makedirs(target_dir.as_posix(), exist_ok=True)
                new_path = target_dir.joinpath(item)

                if old_path.exists():
                    if item.endswith(".db"):
                        for sidecar in [f"{item}-wal", f"{item}-shm"]:
                            sidecar_p = target_dir.joinpath(sidecar)
                            if sidecar_p.exists():
                                try: os.remove(sidecar_p.as_posix())
                                except Exception: pass

                    if not new_path.exists() or (old_path.stat().st_size > new_path.stat().st_size):
                        shutil.copy2(old_path.as_posix(), new_path.as_posix())
                    try:
                        os.remove(old_path.as_posix())
                    except Exception:
                        pass

            # Clean up legacy data folder if empty
            try:
                if not os.listdir(legacy_data.as_posix()):
                    os.rmdir(legacy_data.as_posix())
            except Exception:
                pass

        # 3. Sweep ext/ directory for misplaced database files sitting in ext/{name}/ or ext/{name}/data/
        ext_base = base_dir.joinpath("ext")
        if ext_base.exists() and ext_base.is_dir():
            for ext_name in os.listdir(ext_base.as_posix()):
                ext_dir = ext_base.joinpath(ext_name)
                if not ext_dir.is_dir():
                    continue

                target_db_dir = ext_dir.joinpath("db")
                wrong_dirs = [ext_dir, ext_dir.joinpath("data")]

                for wrong_dir in wrong_dirs:
                    if wrong_dir.exists() and wrong_dir.is_dir() and wrong_dir.as_posix() != target_db_dir.as_posix():
                        for item in os.listdir(wrong_dir.as_posix()):
                            if ".db" in item:
                                os.makedirs(target_db_dir.as_posix(), exist_ok=True)
                                src_file = wrong_dir.joinpath(item)
                                dest_file = target_db_dir.joinpath(item)
                                if src_file.exists():
                                    if item.endswith(".db"):
                                        for sidecar in [f"{item}-wal", f"{item}-shm"]:
                                            sidecar_p = target_db_dir.joinpath(sidecar)
                                            if sidecar_p.exists():
                                                try: os.remove(sidecar_p.as_posix())
                                                except Exception: pass

                                    if not dest_file.exists() or (src_file.stat().st_size > dest_file.stat().st_size):
                                        shutil.copy2(src_file.as_posix(), dest_file.as_posix())
                                    try:
                                        os.remove(src_file.as_posix())
                                    except Exception:
                                        pass

        # 4. Self-Healing DB Recovery: Recover rows from .corrupt_* backup files into active databases
        if ext_base.exists() and ext_base.is_dir():
            import sqlite3
            for ext_name in os.listdir(ext_base.as_posix()):
                db_dir = ext_base.joinpath(ext_name, "db")
                if not db_dir.exists() or not db_dir.is_dir():
                    continue

                target_db_path = db_dir.joinpath(f"{ext_name}.db").as_posix()
                if not os.path.exists(target_db_path):
                    continue

                corrupt_files = [f for f in os.listdir(db_dir.as_posix()) if f.startswith(f"{ext_name}.db.corrupt_")]
                for c_file in corrupt_files:
                    c_path = db_dir.joinpath(c_file).as_posix()
                    try:
                        conn = sqlite3.connect(target_db_path)
                        conn.execute(f"ATTACH DATABASE '{c_path}' AS corrupt_db")
                        cursor = conn.execute("SELECT name FROM corrupt_db.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
                        tables = [r[0] for r in cursor.fetchall()]

                        recovered_any = False
                        for tbl in tables:
                            try:
                                count = conn.execute(f"SELECT COUNT(*) FROM main.{tbl}").fetchone()[0]
                                if count == 0:
                                    conn.execute(f"INSERT OR IGNORE INTO main.{tbl} SELECT * FROM corrupt_db.{tbl}")
                                    conn.commit()
                                    if conn.changes() > 0:
                                        recovered_any = True
                                        print(f"✨ [Legacy Recovery] Restored {conn.changes()} rows for '{tbl}' in {ext_name}.db from {c_file}")
                            except Exception:
                                pass

                        conn.execute("DETACH DATABASE corrupt_db")
                        conn.close()

                        if recovered_any:
                            try:
                                os.remove(c_path)
                            except Exception:
                                pass
                    except Exception as e:
                        print(f"⚠️ [Legacy Recovery] Could not recover from {c_file}: {e}")