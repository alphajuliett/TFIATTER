-- TFI@TTER v0.5.1 — audiences simulées jusqu’à 100 millions
-- Migration NON DESTRUCTIVE : aucun utilisateur, abonnement ou contenu existant n’est supprimé.
BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS simulated_followers_count BIGINT NOT NULL DEFAULT 0;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_simulated_followers_count_check;

ALTER TABLE users
  ADD CONSTRAINT users_simulated_followers_count_check
  CHECK (simulated_followers_count >= 0 AND simulated_followers_count <= 100000000);

INSERT INTO demo_seed_meta(seed_key) VALUES ('v0.5.1-followers-100m') ON CONFLICT DO NOTHING;

COMMIT;
