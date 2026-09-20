-- Sentinel: multi-tenant system of record (bank compliance platform)

CREATE TABLE tenants (
    id              BIGSERIAL PRIMARY KEY,
    code            VARCHAR(64)  NOT NULL UNIQUE,
    name            VARCHAR(255) NOT NULL,
    enabled         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO tenants (code, name) VALUES ('demo-bank', 'Demo Bank');

CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT       NOT NULL REFERENCES tenants(id),
    username        VARCHAR(64)  NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(32)  NOT NULL,
    enabled         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, username)
);

CREATE INDEX idx_users_tenant ON users(tenant_id);

CREATE TABLE refresh_tokens (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT       NOT NULL REFERENCES users(id),
    token_hash      VARCHAR(128) NOT NULL UNIQUE,
    expires_at      TIMESTAMPTZ  NOT NULL,
    revoked         BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

CREATE TABLE customers (
    id                          BIGSERIAL PRIMARY KEY,
    tenant_id                   BIGINT       NOT NULL REFERENCES tenants(id),
    name                        VARCHAR(255) NOT NULL,
    dob                         DATE,
    id_number                   VARCHAR(512),
    external_customer_id        VARCHAR(128),
    reference_signature_url     VARCHAR(1024),
    kyc_status                  VARCHAR(32)  NOT NULL DEFAULT 'PENDING',
    face_match_score            DOUBLE PRECISION,
    liveness_score              DOUBLE PRECISION,
    risk_score                  INTEGER      NOT NULL DEFAULT 0,
    created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE UNIQUE INDEX uq_customers_tenant_external
    ON customers(tenant_id, external_customer_id)
    WHERE external_customer_id IS NOT NULL;

CREATE TABLE documents (
    id                          BIGSERIAL PRIMARY KEY,
    tenant_id                   BIGINT       NOT NULL REFERENCES tenants(id),
    customer_id                 BIGINT       NOT NULL REFERENCES customers(id),
    type                        VARCHAR(32)  NOT NULL,
    ocr_extracted_data          JSONB,
    signature_match_status      VARCHAR(32)  NOT NULL DEFAULT 'PENDING',
    signature_match_score       DOUBLE PRECISION,
    tampering_score             DOUBLE PRECISION,
    fraud_risk_score            DOUBLE PRECISION,
    field_consistency_flags     JSONB,
    image_url                   VARCHAR(1024),
    status                      VARCHAR(32)  NOT NULL DEFAULT 'PENDING',
    created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_customer ON documents(customer_id);
CREATE INDEX idx_documents_tenant ON documents(tenant_id);

CREATE TABLE transactions (
    id                          BIGSERIAL PRIMARY KEY,
    tenant_id                   BIGINT         NOT NULL REFERENCES tenants(id),
    customer_id                 BIGINT         NOT NULL REFERENCES customers(id),
    external_transaction_id     VARCHAR(128),
    amount                      NUMERIC(19, 4) NOT NULL,
    currency                    VARCHAR(8)     NOT NULL DEFAULT 'GMD',
    occurred_at                 TIMESTAMPTZ    NOT NULL,
    channel                     VARCHAR(64),
    location                    VARCHAR(255),
    anomaly_score               DOUBLE PRECISION,
    flagged                     BOOLEAN        NOT NULL DEFAULT FALSE,
    recommendation              VARCHAR(32)
);

CREATE INDEX idx_transactions_customer ON transactions(customer_id);
CREATE INDEX idx_transactions_tenant ON transactions(tenant_id);
CREATE UNIQUE INDEX uq_transactions_tenant_external
    ON transactions(tenant_id, external_transaction_id)
    WHERE external_transaction_id IS NOT NULL;

CREATE TABLE cases (
    id                      BIGSERIAL PRIMARY KEY,
    tenant_id               BIGINT       NOT NULL REFERENCES tenants(id),
    customer_id             BIGINT       NOT NULL REFERENCES customers(id),
    related_document_id     BIGINT       REFERENCES documents(id),
    status                  VARCHAR(32)  NOT NULL DEFAULT 'OPEN',
    risk_score_at_creation  INTEGER      NOT NULL,
    explanation             TEXT         NOT NULL,
    assigned_to_id          BIGINT       REFERENCES users(id),
    decision                VARCHAR(32),
    decision_note           TEXT,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cases_customer ON cases(customer_id);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_tenant ON cases(tenant_id);

CREATE TABLE audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT       NOT NULL REFERENCES tenants(id),
    user_id         BIGINT       REFERENCES users(id),
    action          VARCHAR(128) NOT NULL,
    entity_type     VARCHAR(64)  NOT NULL,
    entity_id       VARCHAR(64)  NOT NULL,
    before_state    JSONB,
    after_state     JSONB,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);

CREATE TABLE risk_settings (
    id                          BIGSERIAL PRIMARY KEY,
    tenant_id                   BIGINT           NOT NULL UNIQUE REFERENCES tenants(id),
    kyc_weight                  DOUBLE PRECISION NOT NULL DEFAULT 0.35,
    document_weight             DOUBLE PRECISION NOT NULL DEFAULT 0.40,
    transaction_weight          DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    signature_match_threshold   DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    face_match_threshold        DOUBLE PRECISION NOT NULL DEFAULT 0.80,
    tampering_threshold         DOUBLE PRECISION NOT NULL DEFAULT 0.50,
    anomaly_threshold           DOUBLE PRECISION NOT NULL DEFAULT 0.70,
    auto_flag_risk_score        INTEGER          NOT NULL DEFAULT 60,
    updated_at                  TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

INSERT INTO risk_settings (tenant_id)
SELECT id FROM tenants WHERE code = 'demo-bank';

CREATE TABLE kyc_sessions (
    id                      BIGSERIAL PRIMARY KEY,
    tenant_id               BIGINT       NOT NULL REFERENCES tenants(id),
    external_customer_id    VARCHAR(128) NOT NULL,
    customer_id             BIGINT       REFERENCES customers(id),
    status                  VARCHAR(32)  NOT NULL DEFAULT 'PENDING',
    challenge_id            VARCHAR(64)  NOT NULL,
    liveness_hint           VARCHAR(128),
    public_token            VARCHAR(64)  NOT NULL UNIQUE,
    expires_at              TIMESTAMPTZ  NOT NULL,
    return_url              VARCHAR(1024),
    explanation             TEXT,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kyc_sessions_tenant ON kyc_sessions(tenant_id);
CREATE INDEX idx_kyc_sessions_token ON kyc_sessions(public_token);
