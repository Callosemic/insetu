import os
import shutil
import sqlite3
from pathlib import Path
from akasa.hooks import hooks
from akasa.utils import get_all_workspace_ids, get_tenant_control_dir

def move_tree_contents(src_dir: Path, dst_dir: Path):
    """Recursively merges files from src_dir into dst_dir and removes empty source directories."""
    if not src_dir.exists() or not src_dir.is_dir():
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


@hooks.on('system_boot', priority=5)
def migrate_physical_sandboxes(**kwargs):
    """Domain-agnostic kernel migration: consolidates SQLite databases into .insetu/cache/db/ and heals .gitignore."""
    for ws_id in get_all_workspace_ids():
        base_dir = Path(get_tenant_control_dir(ws_id))
        cache_db_dir = base_dir.joinpath("cache", "db")
        data_root_dir = base_dir.joinpath("data")
        os.makedirs(cache_db_dir.as_posix(), exist_ok=True)
        os.makedirs(data_root_dir.as_posix(), exist_ok=True)

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
        if cache_db_dir.exists() and cache_db_dir.is_dir():
            for item in os.listdir(cache_db_dir.as_posix()):
                if ".db.corrupt_" in item:
                    ext_name = item.split(".db.corrupt_")[0]
                    target_db_path = cache_db_dir.joinpath(f"{ext_name}.db").as_posix()
                    c_path = cache_db_dir.joinpath(item).as_posix()
                    if not os.path.exists(target_db_path):
                        continue
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
                                        print(f"✨ [Legacy Recovery] Restored {conn.changes()} rows for '{tbl}' in {ext_name}.db from {item}")
                            except Exception:
                                pass
                        conn.execute("DETACH DATABASE corrupt_db")
                        conn.close()
                        if recovered_any:
                            try: os.remove(c_path)
                            except Exception: pass
                    except Exception as e:
                        print(f"⚠️ [Legacy Recovery] Could not recover from {item}: {e}")