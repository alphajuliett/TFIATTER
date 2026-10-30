-- TFI@TTER v0.3.2
-- Suppression d'une discussion uniquement pour l'utilisateur qui effectue l'action.

CREATE TABLE IF NOT EXISTS conversation_deletions (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  other_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hidden_before TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, other_user_id),
  CONSTRAINT no_self_conversation_deletion CHECK (user_id <> other_user_id)
);
