-- Add receipt_token to checks for guest QR receipt links
ALTER TABLE checks ADD COLUMN IF NOT EXISTS receipt_token UUID DEFAULT gen_random_uuid();
UPDATE checks SET receipt_token = gen_random_uuid() WHERE receipt_token IS NULL;
ALTER TABLE checks ALTER COLUMN receipt_token SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS checks_receipt_token_idx ON checks(receipt_token);
