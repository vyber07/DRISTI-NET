"""DRISTI-NET Packaging Script.

Generates the three specified packages:
1. reviewer_package.zip
2. engineering_package.zip
3. ai_context_package.zip
"""
import os
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

def create_zip(name, includes, excludes):
    os.chdir(REPO_ROOT)
    cmd = ["zip", "-r", name] + includes
    for exc in excludes:
        cmd.extend(["-x", exc])
    print(f"Running: {' '.join(cmd)}")
    subprocess.run(cmd, check=True)

def main():
    print("Generating REVIEWER PACKAGE...")
    create_zip("reviewer_package.zip", 
               ["docs/", "audit/", "reports/", "README.md", "PROJECT_STATUS.md"],
               ["*.git*", "*.venv*", "*__pycache__*"])
               
    print("Generating ENGINEERING PACKAGE...")
    create_zip("engineering_package.zip",
               ["apps/", "workers/", "scripts/", "infrastructure/", "packages/", "policy/", "tests/", "docker-compose.yml", "Dockerfile", "Makefile", "requirements.txt", ".env.example"],
               ["*.git*", "*.venv*", "*node_modules*", "*__pycache__*", "*.pytest_cache*", "storage/*", "releases/*", "*.tar.gz", "*.zip"])
               
    print("Generating AI CONTEXT PACKAGE...")
    create_zip("ai_context_package.zip",
               ["AGENTS.md", "CLAUDE.md", "docs/", "audit/", "TASK_BOARD.md", "PROJECT_STATUS.md"],
               ["*.git*", "*.venv*", "*__pycache__*"])
               
    print("All packages generated successfully.")

if __name__ == "__main__":
    main()
