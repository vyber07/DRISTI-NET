import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

# DEF-081: importing the app runs init_db() against DRISHTI_DATABASE_URL, which defaults to storage/drishti.db --
# the live demo's database on the demo host. Generating a schema needs no data: always use a throwaway store.
import os  # noqa: E402
import tempfile  # noqa: E402

_tmp = tempfile.mkdtemp(prefix="drishti-openapi-")
os.environ["DRISHTI_STORAGE_ROOT"] = _tmp
os.environ["DRISHTI_DATABASE_URL"] = f"sqlite:///{_tmp}/schema.db"
os.environ.setdefault("DRISHTI_SCANNER_MODE", "testgate")
for _k in ("DRISHTI_NEO4J_URI", "DRISHTI_S3_ENDPOINT_URL", "DRISHTI_KAFKA_BOOTSTRAP_SERVERS"):
    os.environ.pop(_k, None)

from apps.api.app.main import app  # noqa: E402

openapi = app.openapi()
out = REPO_ROOT / "packages" / "schemas" / "openapi.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(openapi, indent=2))
print(f"Exported OpenAPI schema to {out}")
