-- TFI@TTER v0.3.4
-- Migration de réparation idempotente : fiabilise Notifications/Messages
-- sur les volumes PostgreSQL issus des versions précédentes.

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(24) NOT NULL,
  post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
  comment_id BIGINT REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS direct_messages (
  id BIGSERIAL PRIMARY KEY,
  sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  CONSTRAINT no_self_direct_message CHECK (sender_id <> recipient_id)
);
CREATE INDEX IF NOT EXISTS idx_dm_sender_created ON direct_messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_recipient_created ON direct_messages(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_recipient_unread ON direct_messages(recipient_id, read_at) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS conversation_deletions (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  other_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hidden_before TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, other_user_id),
  CONSTRAINT no_self_conversation_deletion CHECK (user_id <> other_user_id)
);
