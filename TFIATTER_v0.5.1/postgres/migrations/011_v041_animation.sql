-- TFI@TTER v0.4.1 — rôle Entraîneur, panneau Animation et pool de réactions
-- Tous les comptes de simulation utilisent le mot de passe Demo1234!
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_trainer BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_reaction_bot BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_trainer_post BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS animation_scores (
  id BIGSERIAL PRIMARY KEY,
  trainer_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
  comment_id BIGINT REFERENCES comments(id) ON DELETE CASCADE,
  score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 10),
  likes_target INTEGER NOT NULL DEFAULT 0,
  retweets_target INTEGER NOT NULL DEFAULT 0,
  likes_added INTEGER NOT NULL DEFAULT 0,
  retweets_added INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((post_id IS NOT NULL AND comment_id IS NULL) OR (post_id IS NULL AND comment_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_animation_scores_post ON animation_scores(post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_animation_scores_comment ON animation_scores(comment_id) WHERE comment_id IS NOT NULL;

-- Compte de démonstration Entraîneur, distinct du rôle administrateur.
WITH pwd AS (SELECT crypt('Demo1234!', gen_salt('bf', 10)) AS h)
INSERT INTO users(username,display_name,email,password_hash,bio,location,is_admin,is_trainer,is_verified,is_active,is_reaction_bot)
SELECT 'entraineur','Entraîneur Démo','entraineur@tfiatter.local',pwd.h,
       'Compte de démonstration pour le panneau Animation.','',false,true,false,true,false
FROM pwd
ON CONFLICT (username) DO UPDATE SET
  password_hash=EXCLUDED.password_hash,
  is_trainer=true,
  is_active=true,
  is_reaction_bot=false;

-- Pool dédié permettant jusqu'à 60 000 likes uniques sur un même contenu.
-- 500 comptes de marge sont ajoutés pour absorber d'éventuelles collisions/interactions déjà présentes.
WITH pwd AS (SELECT crypt('Demo1234!', gen_salt('bf', 8)) AS h)
INSERT INTO users(username,display_name,email,password_hash,bio,location,website,is_admin,is_trainer,is_verified,is_active,is_reaction_bot,created_at,updated_at)
SELECT
  'simreact' || lpad(g::text,5,'0'),
  'Compte réaction ' || lpad(g::text,5,'0'),
  'simreact' || lpad(g::text,5,'0') || '@sim.tfiatter.local',
  pwd.h,
  '', '', '', false, false, false, true, true,
  now() - make_interval(days => (g % 900)::int), now()
FROM generate_series(1,60500) g CROSS JOIN pwd
ON CONFLICT (username) DO UPDATE SET
  is_reaction_bot=true,
  is_active=true,
  password_hash=EXCLUDED.password_hash;

CREATE INDEX IF NOT EXISTS idx_users_reaction_pool ON users(is_reaction_bot,id) WHERE is_reaction_bot=true;

INSERT INTO demo_seed_meta(seed_key) VALUES ('v0.4.1-animation-pool-60500') ON CONFLICT DO NOTHING;

COMMIT;
