# Sutura's Sentinel tenant

The public frontend is https://sentinel.mamadoubah.tech. Staff sign in at
https://sentinel.mamadoubah.tech/desk/login with tenant code `sutura` and a Sentinel
staff username/password. The enabled deployment account is `admin` (ADMIN role).
Its password is kept in the private backend environment, never in this document.
Sutura customer and admin credentials do not sign in to Sentinel.

The Render Java API is https://sentinel-sutr.onrender.com. Sutura authenticates to
that API with its tenant service key in `X-Api-Key`; this key is not a dashboard
password or a browser credential. Sutura user IDs become tenant-scoped external
customer IDs, so staff in the `sutura` tenant can see those risk profiles, KYC
results, transactions and cases. That does not grant staff access to other tenants.

Sutura server configuration:

```
SUTURA_SENTINEL_BASE_URL=https://sentinel-sutr.onrender.com
SUTURA_SENTINEL_CONNECTED=true
SUTURA_SENTINEL_TENANT_CODE=sutura
SUTURA_SENTINEL_API_KEY=<private tenant key>
SUTURA_SENTINEL_WEBHOOK_SECRET=<private callback signing secret>
```

The deployed tenant sends signed callbacks to
`https://suturagambia.onrender.com/api/v1/webhooks/sentinel`. Sentinel's stored key
and callback secret must match Sutura's values. Changing bootstrap environment
variables does not rotate an existing account/key or reset its password.

Sentinel backend configuration:

```
SENTINEL_PUBLIC_BASE_URL=https://sentinel.mamadoubah.tech
CV_ML_BASE_URL=https://mamadoubah-sentinel-kyc.hf.space
TRANSACTION_ML_BASE_URL=https://mamadoubah-sentinel-fraud.hf.space
```

`SENTINEL_PUBLIC_BASE_URL` is the frontend origin used to generate `/kyc/<token>`
links. It must not be the Java API or ML Space URL. The Vercel project root must be
`frontend`; `frontend/vercel.json` proxies `/api/*` to Java and serves `index.html`
for browser routes such as `/desk/login` and `/kyc/<token>`. Asset files continue
to be served by Vercel. Relative API calls work through this proxy.

For direct browser API/WebSocket access, set these public Vercel build variables:

```
VITE_API_BASE_URL=https://sentinel-sutr.onrender.com
VITE_WS_URL=wss://sentinel-sutr.onrender.com/ws
```

Also allow `https://sentinel.mamadoubah.tech` in Sentinel's
`SENTINEL_CORS_ALLOWED_ORIGINS`. Browser build variables contain public origins
only; never put tenant API keys, passwords, JWT signing keys or callback secrets
in Vite configuration. Existing KYC links on the correct frontend domain work
after the routing fix; missing/expired sessions need a new verification session.
