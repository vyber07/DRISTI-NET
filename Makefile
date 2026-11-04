.PHONY: setup data seed api web build-web test e2e clean db-upgrade db-revision test-unit test-integration test-infra-local test-stack-infra test-stack deploy deploy-down deploy-logs deploy-status deploy-restart
PY ?= $(shell if [ -f .venv311/bin/python ]; then echo .venv311/bin/python; else echo python3; fi)
# `source scripts/env.sh` first on hosts that need the user-space Node/ClamAV/Chromium libs.
setup:
	$(PY) -m pip install -q -c apps/api/constraints.txt -r apps/api/requirements-dev.txt -r apps/api/requirements-ml.txt -r apps/api/requirements-kafka.txt -r apps/api/requirements-ledger.txt
	cd apps/web && npm install --no-audit --no-fund
data:
	$(PY) data/synthetic/generate.py
seed: data
	$(PY) -m apps.api.app.seed
api:
	$(PY) -m uvicorn apps.api.app.main:app --reload --port 8000
web:
	cd apps/web && npm run dev
build-web:
	cd apps/web && npm run build
test: test-unit
e2e:  ## needs a running server on :8000 and `playwright install chromium`
	NO_PROXY=localhost,127.0.0.1 $(PY) -m pytest tests/e2e -q
setup-host:  ## one-time: Playwright Chromium
	$(PY) -m pip install -q playwright && $(PY) -m playwright install chromium
freshclam:  ## refresh ClamAV signatures for the user-space install (see scripts/env.sh)
	freshclam --config-file=$$HOME/.cache/drishti/clamav/freshclam.conf --user=$$(id -un)
redis-up:  ## start the user-space Redis build for login-throttle (see scripts/env.sh, TASK_BOARD.md Phase 4)
	mkdir -p $$HOME/.cache/drishti/redis/data
	$$HOME/.cache/drishti/redis/bin/redis-server --port 6379 --daemonize yes \
		--dir $$HOME/.cache/drishti/redis/data --logfile $$HOME/.cache/drishti/redis/redis.log --save ""
	$$HOME/.cache/drishti/redis/bin/redis-cli -p 6379 ping
redis-down:  ## stop the user-space Redis build
	$$HOME/.cache/drishti/redis/bin/redis-cli -p 6379 shutdown nosave || true
clean:  ## DEF-075: deletes the local DB and all evidence -- on the demo host that is the live demo's data
	@test "$(CONFIRM)" = 1 || { echo 'refusing: make clean deletes storage/*.db and evidence; re-run with CONFIRM=1'; exit 2; }
	rm -rf storage/*.db storage/*.db-shm storage/*.db-wal storage/quarantine storage/accepted storage/derived
db-upgrade:  ## apply Alembic migrations to whatever DRISHTI_DATABASE_URL points at (no-op for sqlite; the app applies them automatically on startup too)
	cd apps/api && $(PY) -m alembic upgrade head
db-revision:  ## autogenerate a new migration from model changes; review the diff before committing
	cd apps/api && $(PY) -m alembic revision --autogenerate -m "$(msg)"

test-unit:
	$(PY) -m pytest apps/api/app/tests -q -k "not test_real_clamav_application_scan"

test-integration:
	$(PY) -m pytest apps/api/app/tests -q

test-infra-local:
	$(PY) tests/infrastructure/test_infrastructure.py

test-stack-infra:
	docker compose exec -T api bash -c "python3 tests/infrastructure/test_infrastructure.py"

test-stack:  ## Full Compose stack + live test suite in a SEPARATE project (default dristi-ctest). Needs ENV_FILE with test secrets.
	@test "$(STACK_IS_DISPOSABLE)" = 1 || { echo 'refusing: only for a disposable stack (STACK_IS_DISPOSABLE=1 ENV_FILE=path)'; exit 2; }
	@test -n "$(ENV_FILE)" || { echo 'set ENV_FILE to a test env file (POSTGRES_PASSWORD, NEO4J_PASSWORD, MINIO_ROOT_PASSWORD, DRISHTI_SECRET_KEY); never the deployment .env'; exit 2; }
	set -e; C="docker compose -p $${STACK_PROJECT:-dristi-ctest} --env-file $(ENV_FILE)"; \
	$$C up -d --build --wait --wait-timeout 900; \
	$$C exec -T postgres sh -c 'createdb -U drishti drishti_test 2>/dev/null || true'; \
	$$C run --rm --no-deps -T -e REQUIRE_LIVE_TESTS=1 -e DRISHTI_ALLOW_NEO4J_WIPE=1 -e DRISHTI_KAFKA_BOOTSTRAP_SERVERS= \
	  -e DRISHTI_S3_BUCKET=drishti-test -e DRISHTI_TEST_MINIO_ENDPOINT=http://minio:9000 -e DRISHTI_TEST_NEO4J_URI=bolt://neo4j:7687 \
	  -e DRISHTI_TEST_REDIS_URL=redis://redis:6379/0 -e DRISHTI_SCANNER_MODE=clamav api sh -c \
	  'export DRISHTI_DATABASE_URL="$${DRISHTI_DATABASE_URL%/drishti}/drishti_test"; pip install -q -c apps/api/constraints.txt -r apps/api/requirements-dev.txt && python3 -m pytest apps/api/app/tests -q'
	@echo "stack left running for inspection; stop with: docker compose -p $${STACK_PROJECT:-dristi-ctest} down"

# --- Production deployment (port 80, no port suffix in URL) ---
# Requires a .env file (see .env.example). Served by nginx → uvicorn.
# Containers restart automatically on crash or server reboot (restart: unless-stopped).
# On first run after a server reboot the systemd unit 'dristinet.service' starts the stack.
deploy:  ## Start the full production stack (port 80 via nginx). Create .env first.
	docker compose up -d

deploy-down:  ## Stop the full production stack (preserves data volumes)
	docker compose stop

deploy-restart:  ## Rolling restart of all services without wiping data
	docker compose restart

deploy-logs:  ## Tail logs from all containers (Ctrl-C to stop)
	docker compose logs -f

deploy-status:  ## Show health and port of every service
	docker compose ps
	@echo ""
	@echo "--- Health check (port 80) ---"
	@curl -s http://localhost/api/v1/health || echo "API not yet ready"
