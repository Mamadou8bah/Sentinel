-- Repair the initial deployment through a transaction-mode pooler, where
-- Flyway's session search_path could be lost before V1 executed.
-- Keep V1 unchanged: it has already been applied in deployed databases.
-- ALTER TABLE SET SCHEMA preserves rows, owned sequences, indexes and FK links.
DO $repair$
DECLARE
  expected record;
  actual_columns text[];
BEGIN
  FOR expected IN
    SELECT * FROM (VALUES
      ('audit_logs', ARRAY['action','after_state','before_state','created_at','entity_id','entity_type','id','tenant_id','user_id']::text[]),
      ('cases', ARRAY['assigned_to_id','created_at','customer_id','decision','decision_note','explanation','external_transaction_id','id','related_document_id','related_transaction_id','risk_score_at_creation','status','tenant_id','updated_at']::text[]),
      ('customers', ARRAY['created_at','dob','external_customer_id','face_match_score','id','id_number','kyc_status','liveness_score','name','reference_signature_url','risk_score','tenant_id']::text[]),
      ('documents', ARRAY['created_at','customer_id','field_consistency_flags','fraud_risk_score','id','image_url','ocr_extracted_data','signature_match_score','signature_match_status','status','tampering_score','tenant_id','type']::text[]),
      ('kyc_sessions', ARRAY['challenge_id','created_at','customer_id','expires_at','explanation','external_customer_id','id','liveness_hint','public_token','return_url','status','tenant_id','updated_at']::text[]),
      ('refresh_tokens', ARRAY['created_at','expires_at','id','revoked','token_hash','user_id']::text[]),
      ('risk_settings', ARRAY['anomaly_threshold','auto_flag_risk_score','document_weight','face_match_threshold','id','kyc_weight','signature_match_threshold','tampering_threshold','tenant_id','transaction_weight','updated_at']::text[]),
      ('tenant_api_keys', ARRAY['created_at','enabled','id','key_hash','key_prefix','last_used_at','name','tenant_id']::text[]),
      ('tenants', ARRAY['code','created_at','enabled','id','name','webhook_signing_secret','webhook_url']::text[]),
      ('transactions', ARRAY['amount','anomaly_score','available_balance','case_id','channel','counterparty','currency','customer_id','explanation','external_transaction_id','flagged','id','location','occurred_at','recommendation','rule_flags','shap_top_features','tenant_id','transaction_type']::text[]),
      ('users', ARRAY['created_at','enabled','id','password_hash','role','tenant_id','username']::text[]),
      ('webhook_deliveries', ARRAY['attempts','created_at','delivered_at','event_id','id','next_attempt_at','payload','tenant_id']::text[])
    ) AS tables_to_check(table_name, columns)
  LOOP
    IF to_regclass(format('%I.%I', 'sentinel', expected.table_name)) IS NOT NULL THEN
      CONTINUE; -- Normal fresh deployments already have the correct schema.
    END IF;
    SELECT array_agg(a.attname::text ORDER BY a.attname)
      INTO actual_columns
      FROM pg_catalog.pg_attribute a
      WHERE a.attrelid = to_regclass(format('%I.%I', 'public', expected.table_name))
        AND a.attnum > 0 AND NOT a.attisdropped;
    IF actual_columns IS DISTINCT FROM expected.columns THEN
      RAISE EXCEPTION 'Cannot repair Sentinel table %: expected table is missing or public table has a different definition', expected.table_name;
    END IF;
    EXECUTE format('ALTER TABLE %I.%I SET SCHEMA %I', 'public', expected.table_name, 'sentinel');
  END LOOP;
END
$repair$;
