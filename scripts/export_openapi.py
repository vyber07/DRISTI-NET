import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from apps.api.app.main import app

openapi = app.openapi()
out = REPO_ROOT / "packages" / "schemas" / "openapi.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(openapi, indent=2))
print(f"Exported OpenAPI schema to {out}")
