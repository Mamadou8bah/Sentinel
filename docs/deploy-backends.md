# Deploy the Sentinel backend on Render

Use **`render-backend.yaml`** when deploying only the API. The existing
`render-free.yaml` also includes the desk frontend and expects configured ML
services; it is an alternative deployment, not an additional Blueprint to apply.

1. Create Sutura's backend Blueprint first. It provisions the shared PostgreSQL
   database and Sutura's Key Value cache. Keep the repositories separate.
2. Create a Sentinel Blueprint from this repo, with path `render-backend.yaml`.
   Fill `SPRING_DATASOURCE_URL=jdbc:postgresql://HOST:5432/DATABASE`,
   `SPRING_DATASOURCE_USERNAME` and `SPRING_DATASOURCE_PASSWORD` using Sutura's
   PostgreSQL connection details. Credentials belong in the separate fields, not
   embedded in the URL. Sentinel migrates its own **`sentinel` schema**;
   Sutura uses `public`. Never run automatic adoption on an old database.
3. Use `.env.example` as the single settings reference. Generate the private
   `.env.render` with the preparation command from the parent workspace; it
   selects Render defaults instead of copying local development credentials:

   ```powershell
   python sutura/server/deployment/prepare-render.py --sutura-url https://YOUR-SUTURA-API.onrender.com --sentinel-url https://YOUR-SENTINEL-API.onrender.com
   ```

   The command creates matching private environment files for both APIs,
   preserves existing secrets and prints only missing variable names. Use
   `--check` for a read-only preflight. Import Sentinel's file into its Render
   service's Environment settings. Do not commit it or share its credentials.
4. Set exact HTTPS desk/frontend origins in `SENTINEL_CORS_ALLOWED_ORIGINS` and
   the hosted KYC frontend origin in `SENTINEL_PUBLIC_BASE_URL`. Update
   `SENTINEL_BOOTSTRAP_WEBHOOK_URL` to the Sutura API origin plus
   `/api/v1/webhooks/sentinel`.
5. With bootstrap enabled, supply its tenant code, admin username/password, API
   key and webhook secret from the private file. Sutura must have the matching
   tenant code, API key and signing secret. Bootstrap creates a new tenant only;
   it never resets an existing tenant. Disable bootstrap and remove its admin
   password after the first successful deployment. Retain your encryption key
   and integration secrets.
6. Wait for `/actuator/health` to report `UP`. The Blueprint uses Docker, Java 17
   and the `render` profile, binds `PORT`, and applies Flyway migrations.

## Hugging Face is deferred

`SENTINEL_ML_ENABLED=false` allows the API to start before ML hosting exists.
Inference endpoints return **503**; they never return successful synthetic
decisions. This also prevents Sutura operations that require a successful risk
decision. When both authenticated HF services are running, set their HTTPS
origins in `CV_ML_BASE_URL` and `TRANSACTION_ML_BASE_URL`, supply their shared
`ML_SERVICE_API_KEY`, then set `SENTINEL_ML_ENABLED=true` and redeploy.

Do not treat Java API health as proof that ML models are available or evaluated.
Free Render filesystem uploads are ephemeral and its free PostgreSQL expires
after 30 days. Durable evidence storage and database backups are required before
relying on the hosted system for real customer records. See
[Render limits](https://render.com/docs/free).


## Neon schema isolation

Use Neon's direct database endpoint (disable Connection pooling in its connection
settings) for this Java service. Hikari already limits the service to three
connections. Flyway relies on session state when executing the original schema
migration; transaction pooling can discard that state between statements.
Hibernate also explicitly qualifies tables with its `sentinel` default schema.

V2 repairs an initial V1 deployment whose tables landed in `public`. It moves only
missing Sentinel tables whose column names exactly match the original migration,
preserving their rows, owned sequences, indexes and foreign keys. It leaves
existing `sentinel` tables untouched and aborts on incompatible public tables.
Do not change V1, delete Flyway history, or enable Hibernate schema updates.
Update Render's datasource URL to the direct endpoint before redeploying.
