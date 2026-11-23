ALTER TABLE risk_settings ALTER COLUMN face_match_threshold SET DEFAULT 0.50;

-- Apply Sutura's requested policy to its existing tenant, without changing other tenants.
UPDATE risk_settings SET face_match_threshold = 0.50
WHERE tenant_id IN (SELECT id FROM tenants WHERE LOWER(code) = 'sutura');
