-- TFI@TTER v0.3.6
-- Likes/republications des réponses + publications citées.

ALTER TABLE posts ADD COLUMN IF NOT EXISTS quote_post_id BIGINT REFERENCES posts(id) ON DELETE SET NULL;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS quote_comment_id BIGINT REFERENCES comments(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS comment_likes (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_id BIGINT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, comment_id)
);
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id);

CREATE TABLE IF NOT EXISTS comment_retweets (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_id BIGINT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, comment_id)
);
CREATE INDEX IF NOT EXISTS idx_comment_retweets_comment ON comment_retweets(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_retweets_user_created ON comment_retweets(user_id, created_at DESC);

-- Les anciennes versions limitaient les types de notifications par CHECK.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('like','retweet','comment','follow','comment_like','comment_retweet','quote'));
