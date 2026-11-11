# Single-container prototype image (API + built UI). Not verified on the development machine (no Docker there).
FROM node:22-slim AS web
WORKDIR /web
COPY apps/web/package*.json ./
RUN npm ci --no-audit --no-fund
COPY apps/web .
RUN npm run build

FROM python:3.11-slim
WORKDIR /app
# S4-07: core runtime plus selected optional feature sets. Default keeps every feature (same behaviour as before the
# split); for a smaller image without NER/OCR: --build-arg EXTRAS="kafka ledger".
ARG EXTRAS="ml kafka ledger"
COPY apps/api/requirements*.txt apps/api/constraints.txt apps/api/
# constraints.txt pins the versions the test suite passed with (unpinned ranges drifted: fastapi/starlette differed
# between environments, and web3 broke against eth-typing 6).
RUN pip install --no-cache-dir -c apps/api/constraints.txt -r apps/api/requirements.txt \
 && for e in $EXTRAS; do pip install --no-cache-dir -c apps/api/constraints.txt -r "apps/api/requirements-$e.txt"; done
COPY . .
COPY --from=web /web/dist apps/web/dist
RUN python3 data/synthetic/generate.py
ENV DRISHTI_STORAGE_ROOT=/data
# SEC-19: don't run the application process as root. /data is created (not just referenced) here,
# before the volume mount, so a fresh named volume inherits this ownership instead of root's.
RUN useradd --system --create-home --home-dir /home/appuser --shell /usr/sbin/nologin appuser \
 && mkdir -p /data \
 && chown -R appuser:appuser /app /data
USER appuser
EXPOSE 8000
CMD ["python3", "-m", "uvicorn", "apps.api.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
