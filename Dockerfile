# Single-container prototype image (API + built UI). Not verified on the development machine (no Docker there).
FROM node:22-slim AS web
WORKDIR /web
COPY apps/web/package*.json ./
RUN npm ci --no-audit --no-fund
COPY apps/web .
RUN npm run build

FROM python:3.11-slim
WORKDIR /app
COPY apps/api/requirements.txt apps/api/requirements.txt
RUN pip install --no-cache-dir -r apps/api/requirements.txt
COPY . .
COPY --from=web /web/dist apps/web/dist
RUN python3 data/synthetic/generate.py
ENV DRISHTI_STORAGE_ROOT=/data
EXPOSE 8000
CMD ["sh", "-c", "cd apps/api && python3 -m alembic upgrade head && cd ../.. && python3 -m apps.api.app.seed --ingest && python3 -m uvicorn apps.api.app.main:app --host 0.0.0.0 --port 8000"]
