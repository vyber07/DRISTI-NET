.PHONY: setup data seed api web build-web test e2e clean db-upgrade db-revision test-unit test-integration test-infra-local test-stack-infra test-stack
PY=python3
# `source scripts/env.sh` first on hosts that need the user-space Node/ClamAV/Chromium libs.
setup:
	$(PY) -m pip install -q -r apps/api/requirements.txt
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
clean:
	rm -rf storage/*.db storage/quarantine storage/accepted storage/derived
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

test-stack:
	set -e; trap 'docker compose down' EXIT; \
	docker compose down -v; \
	docker compose build --no-cache; \
	docker compose up -d --wait; \
	docker compose exec -T api bash -c "python3 tests/infrastructure/test_infrastructure.py"; \
	docker compose exec -T api bash -c "REQUIRE_LIVE_TESTS=1 python3 -m pytest apps/api/app/tests -q"
