import json
from apps.api.app.main import app
from pathlib import Path

openapi = app.openapi()
out = Path("packages/schemas/openapi.json")
out.write_text(json.dumps(openapi, indent=2))
print(f"Exported OpenAPI schema to {out}")
