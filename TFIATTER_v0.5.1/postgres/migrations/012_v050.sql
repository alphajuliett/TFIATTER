-- TFI@TTER v0.5.0 — lecture publique du fil, animation progressive et followers à la création
-- Migration NON DESTRUCTIVE : aucun compte existant n'est supprimé ou réinitialisé.
BEGIN;

ALTER TABLE animation_scores ADD COLUMN IF NOT EXISTS likes_initial INTEGER NOT NULL DEFAULT 0;
ALTER TABLE animation_scores ADD COLUMN IF NOT EXISTS retweets_initial INTEGER NOT NULL DEFAULT 0;
ALTER TABLE animation_scores ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE animation_scores ADD COLUMN IF NOT EXISTS completes_at TIMESTAMPTZ;
ALTER TABLE animation_scores ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Les notations des anciennes versions avaient déjà généré toutes leurs réactions.
UPDATE animation_scores
   SET likes_initial = GREATEST(likes_target - likes_added, 0),
       retweets_initial = GREATEST(retweets_target - retweets_added, 0),
       started_at = COALESCE(started_at, created_at),
       completes_at = COALESCE(completes_at, created_at),
       completed_at = COALESCE(completed_at, created_at)
 WHERE started_at IS NULL OR completes_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_animation_scores_pending
  ON animation_scores(completes_at, id)
  WHERE completed_at IS NULL;

INSERT INTO demo_seed_meta(seed_key) VALUES ('v0.5.0-features') ON CONFLICT DO NOTHING;

COMMIT;
