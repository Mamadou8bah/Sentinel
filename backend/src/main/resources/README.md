# Resources

Config Spring Boot loads from the classpath. Product: bank compliance system of record (`docs/product-vision.md`).

## What’s here

| Path | Purpose |
|------|---------|
| `application.yml` | Postgres, JWT, springdoc, actuator; **Flyway off**; JPA `ddl-auto: update` |
| `application-h2.yml` | Profile `h2` for local smoke without Docker |
| `db/migration/V1__init.sql` | **Reference only** (not applied) — canonical SQL sketch of the model |

Schema is created/updated by Hibernate from JPA entities. Demo data (`demo-bank`, staff users, risk settings) comes from `DataSeeder`.

`users` = bank staff. `customers` = bank’s clients.
