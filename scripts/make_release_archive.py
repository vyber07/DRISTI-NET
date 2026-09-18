"""Build a release archive of the repository and record its SHA-256 (reports/release-checklist.md's
last item). Excludes everything already git-ignored (storage/, node_modules/, __pycache__/, .venv/,
build caches, *.db, .env) plus VCS metadata and build output that's regenerable from source.

Run: python3 -m scripts.make_release_archive

IMPORTANT scope note this script prints and writes into the checklist: if the working tree has
uncommitted changes, the resulting archive is a *working-tree snapshot*, not an official tagged release
-- this script never commits on its own initiative (per this project's own git-safety convention: commits
happen only when a human asks for them). Cut the actual release archive after committing and reviewing,
then re-run this script to record the real hash.
"""
from __future__ import annotations

import hashlib
import subprocess
import tarfile
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
RELEASES_DIR = REPO_ROOT / "releases"  # gitignored -- the archive itself is never committed

EXCLUDE_DIR_NAMES = {".git", ".claude", "node_modules", "__pycache__", ".venv", "venv", ".pytest_cache", ".ruff_cache",
                     "storage", "dist", "releases"}
EXCLUDE_SUFFIXES = {".db", ".pyc"}
EXCLUDE_EXACT_NAMES = {".env", "DRISTINET_export.zip"}


def should_include(path: Path) -> bool:
    parts = set(path.relative_to(REPO_ROOT).parts)
    if parts & EXCLUDE_DIR_NAMES:
        return False
    if path.suffix in EXCLUDE_SUFFIXES:
        return False
    return path.name not in EXCLUDE_EXACT_NAMES


def git_is_clean() -> bool:
    r = subprocess.run(["git", "-C", str(REPO_ROOT), "status", "--porcelain"], capture_output=True, text=True, check=False)
    return r.returncode == 0 and r.stdout.strip() == ""


def git_head() -> str:
    r = subprocess.run(["git", "-C", str(REPO_ROOT), "rev-parse", "--short", "HEAD"], capture_output=True, text=True, check=False)
    return r.stdout.strip() if r.returncode == 0 else "unknown"


def main() -> None:
    RELEASES_DIR.mkdir(exist_ok=True)
    clean = git_is_clean()
    head = git_head()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    tag = "clean" if clean else "working-tree-snapshot"
    archive_path = RELEASES_DIR / f"drishti-net-{head}-{tag}-{stamp}.tar.gz"

    checklist_path = REPO_ROOT / "reports" / "release-checklist.md"
    original_text = checklist_path.read_text()
    marker = "Release hash: `"
    if marker in original_text:
        before, _ = original_text.split(marker, 1)
        checklist_path.write_text(before.rstrip("\n") + "\n")
    
    with tarfile.open(archive_path, "w:gz") as tar:
        for path in sorted(REPO_ROOT.rglob("*")):
            if path.is_file() and should_include(path):
                tar.add(path, arcname=str(path.relative_to(REPO_ROOT)))

    digest = hashlib.sha256()
    with open(archive_path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    sha = digest.hexdigest()
    size_mb = round(archive_path.stat().st_size / (1024 * 1024), 2)

    print(f"Archive: {archive_path}")
    print(f"Size: {size_mb} MiB")
    print(f"SHA-256: {sha}")
    print(f"Working tree clean at commit: {clean} (HEAD {head})")
    if not clean:
        print("NOTE: working tree has uncommitted changes -- this is a working-tree snapshot, not an "
              "official tagged release. Commit and review first, then re-run to record the real release hash.")

    text = checklist_path.read_text()
    note = ("" if clean else
            " **(working-tree snapshot — uncommitted changes present at build time; not an official "
            "tagged release; re-run after committing and reviewing)**")
    new_block = (f"Release hash: `{sha}`{note}\n"
                 f"(archive: `{archive_path.name}`, {size_mb} MiB, built {stamp} from HEAD {head})\n")
    text = text.rstrip("\n") + "\n\n" + new_block
    checklist_path.write_text(text)
    print(f"Updated {checklist_path.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
