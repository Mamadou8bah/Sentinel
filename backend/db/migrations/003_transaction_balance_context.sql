-- First-assessment pre-debit balance snapshot; retries reuse the stored decision.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS available_balance NUMERIC(19,4);
