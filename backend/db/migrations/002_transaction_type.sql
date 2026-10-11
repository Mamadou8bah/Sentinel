-- Optional pre-transaction context; existing callers remain valid without it.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(32);
