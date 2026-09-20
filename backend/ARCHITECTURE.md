# Backend package architecture

Each domain module uses **nested layer folders**:

```
customer/
  model/          # JPA entities + enums
  repository/     # Spring Data
  service/        # business logic
  controller/     # REST
  dto/            # request/response records
```

Some modules also have `config/`, `security/`, or `util/` for cross-cutting pieces.

| Package | Nested folders |
|---------|----------------|
| `auth` | model, repository, service, controller, dto, security |
| `tenant` | model, repository, service, controller, dto, security |
| `customer` | model, repository, service (`CustomerService`, `KycService`), controller, dto |
| `document` | model, repository, service, controller, dto |
| `transaction` | model, repository, service, controller, dto |
| `casemanagement` | model, repository, service, controller, dto |
| `audit` | model, repository, service, controller, dto |
| `risk` | model, repository, service, controller, dto |
| `admin` | service, controller, dto |
| `integration` | service, controller (uses domain DTOs) |
| `websocket` | service, config, security, dto |
| `common` | config, service, util, exception |

## Security channels

| Channel | Auth | Notes |
|---------|------|--------|
| Staff REST | JWT (`tenantCode` + username/password login) | Claims include `tenantId`, `tenantCode`, `uid`, `role` |
| Bank integration | `X-Api-Key` on `/api/integration/**` | JWT filter skipped on this path |
| WebSocket STOMP | Bearer JWT on CONNECT | Subscribe only to `/topic/tenants.{tenantId}.cases` |

Staff and bank channels share domain DTOs; `integration` is a thin API-key facade.

Hosted KYC: bank starts a session → customer opens `/kyc/{publicToken}` → public `/api/kyc/hosted/**` (no JWT / API key).
