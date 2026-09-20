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
| `auth` | model, repository, service, controller, dto, config, security |
| `tenant` | model, repository, service, controller, dto, security |
| `customer` | model, repository, service, controller, dto |
| `document` | model, repository, service, controller, dto |
| `transaction` | model, repository, service, controller, dto |
| `casemanagement` | model, repository, service, controller, dto |
| `audit` | model, repository, service, controller, dto |
| `risk` | model, repository, service, controller, dto |
| `admin` | service, controller, dto |
| `integration` | service, controller (uses domain DTOs) |
| `websocket` | service, config, dto |
| `common` | config, service, util |

Staff and bank channels share domain DTOs; `integration` is a thin API-key facade.
