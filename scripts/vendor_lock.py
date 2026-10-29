"""
Vendor lockfile for the sutram/yenVUI build that inSetu commits under insetu/static/vendor/.

The vendored files are committed, so they already pin what a release ships. This module records
where they came from (sutram version and commit, whether the source tree was dirty) and a content
hash, so a hand edit, a half-finished vendor run, or a stale leftover file is caught by tests.

Standard library only (Python 3.10+). Used by vendor_sutram.sh and by tests/unit/test_vendor_lock.py.

    python3 scripts/vendor_lock.py sync  <sutram_root> <vendor_root>   # vendor, prune, write the lock
    python3 scripts/vendor_lock.py check <vendor_root>                 # verify files against the lock
"""
import filecmp
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

LOCK_FILENAME = "sutram.lock.json"
SUTRAM_REPO_URL = "https://github.com/Callosemic/sutram"

# (source path inside the sutram repo, destination path inside insetu/static/vendor)
BUILD_MAP: Tuple[Tuple[str, str], ...] = (
    ("sutram/js", "sutram/js"),
    ("yenvui/js", "yenvui/js"),
    ("yenvui/css", "yenvui/css"),
)


def tree_digest(vendor_root: Path) -> Tuple[str, int]:
    """Returns (sha256, file_count) over every file under the BUILD_MAP destinations, keyed by relative path."""
    hasher = hashlib.sha256()
    count = 0
    for _src_rel, dest_rel in BUILD_MAP:
        dest = vendor_root / dest_rel
        if not dest.is_dir():
            continue
        for item in sorted(p for p in dest.rglob("*") if p.is_file()):
            rel = item.relative_to(vendor_root).as_posix()
            hasher.update(rel.encode("utf-8") + b"\0" + hashlib.sha256(item.read_bytes()).hexdigest().encode("ascii") + b"\n")
            count += 1
    return hasher.hexdigest(), count


def read_sutram_version(sutram_root: Path) -> Optional[str]:
    """Reads [project].version from sutram's pyproject.toml without tomllib (Python 3.10 has none)."""
    pyproject = sutram_root / "pyproject.toml"
    if not pyproject.is_file():
        return None
    in_project = False
    for line in pyproject.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped.startswith("["):
            in_project = stripped == "[project]"
            continue
        match = re.match(r'version\s*=\s*"([^"]+)"', stripped)
        if in_project and match:
            return match.group(1)
    return None


def read_git_state(sutram_root: Path) -> Tuple[Optional[str], bool]:
    """Returns (HEAD commit, dirty) for the vendored paths, or (None, False) when sutram_root is not a git checkout."""
    try:
        commit = subprocess.run(
            ["git", "-C", str(sutram_root), "rev-parse", "HEAD"],
            capture_output=True, text=True, check=True, timeout=30,
        ).stdout.strip()
        status = subprocess.run(
            ["git", "-C", str(sutram_root), "status", "--porcelain", "--", *(src for src, _dest in BUILD_MAP)],
            capture_output=True, text=True, check=True, timeout=30,
        ).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return None, False
    return commit or None, bool(status)


def _minify(code: str, loader: str, esbuild_bin: Optional[str]) -> str:
    if not esbuild_bin:
        return code
    res = subprocess.run(
        [esbuild_bin, f"--loader={loader}", "--target=es2022", "--minify"],
        input=code, capture_output=True, text=True, timeout=120,
    )
    if res.returncode != 0:
        raise RuntimeError(f"esbuild syntax error ({loader}):\n{res.stderr}")
    return res.stdout


def sync(sutram_root: Path, vendor_root: Path, source: str = "sibling") -> Dict[str, object]:
    """Vendors sutram into vendor_root, deletes files sutram no longer has, and writes the lock. Returns the lock."""
    sutram_root = sutram_root.resolve()
    vendor_root = vendor_root.resolve()
    esbuild_bin = shutil.which("esbuild")
    print(f"\n{'-' * 50}\n🚀 INSETU VENDORIZER: Building Sutram & yenVUI\n{'-' * 50}")
    if not esbuild_bin:
        print("  └─ ⚠️  'esbuild' not found in PATH; falling back to unminified copy.")

    for src_rel, dest_rel in BUILD_MAP:
        src_path = sutram_root / src_rel
        dest_path = vendor_root / dest_rel
        print(f"\n📦 Mapping: /{src_rel} -> /{dest_rel}")
        if not src_path.is_dir():
            raise FileNotFoundError(f"Source directory not found in sutram checkout: {src_rel}")
        dest_path.mkdir(parents=True, exist_ok=True)

        expected = set()
        for item in sorted(p for p in src_path.rglob("*") if p.is_file()):
            rel_path = item.relative_to(src_path)
            expected.add(rel_path.as_posix())
            target_item = dest_path / rel_path
            target_item.parent.mkdir(parents=True, exist_ok=True)
            if item.suffix in (".js", ".css"):
                out_text = _minify(item.read_text(encoding="utf-8"), "js" if item.suffix == ".js" else "css", esbuild_bin)
                if target_item.exists() and target_item.read_text(encoding="utf-8") == out_text:
                    continue
                target_item.write_text(out_text, encoding="utf-8")
                print(f"  └─ ✅ {'Minified' if esbuild_bin else 'Synced  '} | {rel_path.as_posix()}")
            else:
                if target_item.exists() and filecmp.cmp(item, target_item, shallow=False):
                    continue
                shutil.copy2(item, target_item)
                print(f"  └─ ✅ Copied     | {rel_path.as_posix()}")

        for stale in sorted(p for p in dest_path.rglob("*") if p.is_file()):
            if stale.relative_to(dest_path).as_posix() not in expected:
                stale.unlink()
                print(f"  └─ 🗑️  Removed    | {stale.relative_to(dest_path).as_posix()} (no longer in sutram)")
        for empty_dir in sorted((p for p in dest_path.rglob("*") if p.is_dir()), reverse=True):
            if not any(empty_dir.iterdir()):
                empty_dir.rmdir()

    commit, dirty = read_git_state(sutram_root)
    digest, file_count = tree_digest(vendor_root)
    lock = {
        "sutram": {
            "repo": SUTRAM_REPO_URL,
            "version": read_sutram_version(sutram_root),
            "commit": commit,
            "dirty": dirty,
            "source": source,
            "minified": bool(esbuild_bin),
            "paths": [dest for _src, dest in BUILD_MAP],
            "files": file_count,
            "sha256": digest,
        }
    }
    (vendor_root / LOCK_FILENAME).write_text(json.dumps(lock, indent=2) + "\n", encoding="utf-8")
    entry = lock["sutram"]
    print(f"\n🔒 Locked sutram {entry['version']} @ {(commit or 'unknown')[:12]}{' (dirty)' if dirty else ''}: {file_count} files")
    if dirty:
        print("  └─ ⚠️  The sutram checkout has uncommitted changes; commit them so this build can be reproduced.")
    print("\n🎉 Sutram & yenVUI vendorization complete!\n")
    return lock


def check(vendor_root: Path, strict: bool = False) -> List[str]:
    """Returns a list of problems with the vendored files against the lock (empty when they match)."""
    lock_path = vendor_root / LOCK_FILENAME
    if not lock_path.is_file():
        return [f"{LOCK_FILENAME} is missing; run scripts/vendor_sutram.sh to vendor sutram and write it."]
    entry = json.loads(lock_path.read_text(encoding="utf-8")).get("sutram") or {}
    digest, file_count = tree_digest(vendor_root)
    problems = []
    if file_count != entry.get("files"):
        problems.append(f"vendored file count is {file_count}, lock says {entry.get('files')}")
    if digest != entry.get("sha256"):
        problems.append("vendored file contents do not match the lock (hand edit, partial vendor run, or stale file)")
    if not entry.get("commit"):
        problems.append("lock has no sutram commit; vendor from a git checkout of sutram")
    if entry.get("dirty"):
        dirty_msg = "sutram.lock.json was built from a dirty sutram working tree (uncommitted changes)"
        if strict:
            problems.append(dirty_msg)
        else:
            print(f"⚠️  [vendor_lock] Warning: {dirty_msg}. Allowed for local dev/testing.")
    return problems


def main(argv: List[str]) -> int:
    if len(argv) >= 3 and argv[0] == "sync":
        source = argv[3] if len(argv) > 3 else "sibling"
        sync(Path(argv[1]), Path(argv[2]), source=source)
        return 0
    if len(argv) >= 2 and argv[0] == "check":
        strict = "--strict" in argv[2:]
        problems = check(Path(argv[1]), strict=strict)
        for problem in problems:
            print(f"❌ {problem}")
        if not problems:
            print("✅ Vendored sutram matches sutram.lock.json")
        return 1 if problems else 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
