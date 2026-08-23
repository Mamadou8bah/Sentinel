# Tenant module

**Owns:** bank institutions on the multi-tenant platform (`tenants` table).

Each staff user, customer, document, transaction, case, audit row, and risk_settings row belongs to one `Tenant`. Demo seed: `demo-bank` (via `DataSeeder`; Flyway is off).
