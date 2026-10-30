-- Migration TFI@TTER v0.2 -> v0.2.1 (idempotente)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;
-- Alice sert de compte officiel de démonstration. La certification reste ensuite pilotable depuis l'administration.
UPDATE users SET is_verified=true WHERE username='alice';
