# Local application containers

From this repository's root, with Docker Compose installed:

```powershell
Copy-Item .env.example .env  # Only when .env does not already exist
docker compose --profile app up --build -d
docker compose --profile app logs -f backend cv-ml transaction-ml
```

Dashboard: http://localhost:5173. Backend: http://localhost:8080.
The dashboard proxies API requests and WebSocket events to the backend.
The app profile starts PostgreSQL and both Python services, disables Java ML
stubs, and preserves uploads and liveness challenges in named volumes.
Production dashboard builds disable automatic fallback to demo data.

The default profile still starts only PostgreSQL. `--profile inference` starts
the Python services alongside PostgreSQL without the Java API or dashboard.

This is a **local development stack**: database credentials, signing keys and
seeded staff accounts use development defaults. Do not expose it publicly.
The backend image runs as an unprivileged user. Build contexts exclude local
environment files, dependencies, uploads and generated build outputs.

Transaction scoring defaults to rules. To use an existing trained artifact,
set these in `.env` and recreate the transaction service:

```dotenv
TRANSACTION_ML_MODE=trained
TRANSACTION_ML_MODEL_ARTIFACT=paysim-v3/model.joblib
```

Artifacts are mounted read-only from each service's `artifacts` directory.
PaySim metrics are simulator results, not evidence of real payment accuracy.
Identity verification remains unavailable until all required identity model
artifacts pass the service's loading and evaluation gates. A healthy process
does not mean that identity models are loaded; inspect `/health` before testing.

Stop without deleting stored data:

```powershell
docker compose --profile app down
```

The backend includes its own Maven wrapper and can be tested independently of
Sutura using `./mvnw.cmd test` (run from `backend` on Windows).

