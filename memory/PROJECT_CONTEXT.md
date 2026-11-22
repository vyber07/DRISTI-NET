# DRISTI-NET project context

## Purpose and boundaries

DRISTI-NET is a case and digital-evidence review prototype. Project guidance describes relationship discovery as candidate generation for authorized human review. The repository contains synthetic demonstration data and documents; demo records are not real case evidence. This note does not assert production readiness, legal compliance, or operational suitability.

## Technologies identified in the repository

- API: Python with FastAPI, organized under `apps/api/app/` into routes, services, models, and authentication code.
- Persistence: SQLAlchemy models and Alembic migrations. Configuration supports local development and documents database alternatives; actual service availability depends on deployment configuration.
- Web client: React and TypeScript with Vite under `apps/web/`; the frontend includes graph-oriented views and shared UI components.
- Evidence and processing: upload, pipeline, scanner, resolution, and graph service modules; synthetic fixtures under `data/synthetic/`; and a worker entry point under `workers/`.
- Operations: Make targets, Docker Compose/infrastructure configuration, and deployment documentation are present. Their existence does not prove a running production deployment.

## Main project areas

- `apps/api/`: API application, schemas/models, routes, services, tests, and database migrations.
- `apps/web/`: browser application, pages/routes, components, and web tests/build configuration.
- `data/synthetic/`: synthetic demo, golden, corrupt-input, and scale fixtures.
- `workers/`: background processing entry point(s).
- `docs/`, `audit/`, `operations/`, `security/`, `government/`, and frontend-specific documentation: project context, status, operational guidance, and review material.
- Root configuration and infrastructure files: dependency/build/test commands and local service configuration.

See [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md) for system diagrams, data authority, capabilities and evidence boundaries, configuration map, documented scale limits, and a clearly labeled scale-up path. See [MEMORY_INDEX.md](MEMORY_INDEX.md) for what is included and excluded from this local memory folder.

## Intended processing shape reflected in code organization

The module layout indicates an evidence flow involving ingestion, scanning, integrity references, extraction, candidate resolution, graph construction, and human review. Each stage must be judged from its implementation and test results; a directory, configuration value, or documentation statement alone is not proof that an end-to-end deployment is connected or operational.

## Language and safety constraints from repository guidance

Use terms such as “candidate relationship,” “possible bridge,” “review priority,” and “integrity reference.” Do not describe a relationship as proof of wrongdoing or imply that an integrity reference establishes legal chain of custody. Preserve human review and the distinction between demonstrated behavior, MVP targets, and roadmap items.

## Snapshot contents and limits

`source_snapshot/` is a byte-for-byte copy of the repository's Git-tracked working-tree files at the time this snapshot was created. It intentionally excludes Git internals, untracked files, ignored runtime data, and secrets. The repository's tracked environment examples are included; actual environment files are not included. This summary is an orientation note, not a substitute for the source files.
