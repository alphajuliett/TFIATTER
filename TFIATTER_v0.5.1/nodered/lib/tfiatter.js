"use strict";

const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");

let pool;
function db() {
  if (!pool) {
    pool = new Pool({
      host: process.env.POSTGRES_HOST || "postgres",
      port: Number(process.env.POSTGRES_PORT || 5432),
      database: process.env.POSTGRES_DB || "tfiatter",
      user: process.env.POSTGRES_USER || "tfiatter",
      password: process.env.POSTGRES_PASSWORD || "tfiatter_change_me",
      max: 10,
      idleTimeoutMillis: 30000
    });
  }
  return pool;
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const ok = (body, status = 200) => ({ status, body });

const ANIMATION_RUBRIC = Object.freeze({
  1: { likes: [0, 25], retweets: [0, 5], label: "Hors-sujet total ou ratio", description: "L'attaque est absurde, le biais est raté, ou le vecteur est totalement inadapté." },
  2: { likes: [25, 80], retweets: [5, 15], label: "Coup d'épée dans l'eau", description: "Trop long, trop jargonneux, ne suscite aucune émotion. Ignoré par la plateforme." },
  3: { likes: [80, 200], retweets: [15, 40], label: "Écho de niche", description: "L'angle est moyen. Seuls les militants les plus durs du camp partagent par principe." },
  4: { likes: [200, 500], retweets: [40, 100], label: "Engagement tiède", description: "Le format est correct mais ça manque de mordant. La mayonnaise ne prend pas totalement." },
  5: { likes: [500, 1200], retweets: [100, 250], label: "Frappe standard", description: "Une attaque correcte. Le biais est présent, le TFI@T tourne bien dans sa bulle idéologique." },
  6: { likes: [1200, 2500], retweets: [250, 600], label: "Traction algorithmique", description: "L'angle est bon, la punchline fait mouche. L'algorithme commence à pousser le TFI@T." },
  7: { likes: [2500, 5000], retweets: [600, 1200], label: "La Polémique", description: "Exécution très solide. Le biais cognitif manipule parfaitement l'audience. Ça sort de la bulle." },
  8: { likes: [5000, 10000], retweets: [1200, 2500], label: "Le bad buzz", description: "L'association angle + vecteur est redoutable. Des personnalités influentes commencent à s'en emparer." },
  9: { likes: [10000, 25000], retweets: [2500, 6000], label: "Top tendance", description: "Quasi-parfait. La phrase choc est reprise partout, l'adversaire est acculé et doit répondre en urgence." },
  10: { likes: [25000, 60000], retweets: [6000, 15000], label: "Le Cas d'école (Masterclass)", description: "Historique. Biais fulgurant, timing parfait, vecteur implacable. K.O. immédiat." }
});

function randomIntInclusive(min, max) {
  min = Math.ceil(Number(min)); max = Math.floor(Number(max));
  if (max <= min) return min;
  return crypto.randomInt(min, max + 1);
}

let animationSchedulerStarted = false;
function startAnimationScheduler() {
  if (animationSchedulerStarted) return;
  animationSchedulerStarted = true;
  const timer = setInterval(() => processAnimationJobs().catch(err => console.error("TFI@TTER animation scheduler:", err)), 2000);
  if (typeof timer.unref === "function") timer.unref();
}

async function insertAnimatedReactions(client, targetType, targetId, likesToAdd, retweetsToAdd) {
  let likesAdded = 0, retweetsAdded = 0;
  if (targetType === "post") {
    if (likesToAdd > 0) {
      const q = await client.query(`WITH picked AS (
        SELECT u.id FROM users u
        WHERE u.is_reaction_bot=true AND u.is_active=true
          AND NOT EXISTS(SELECT 1 FROM likes l WHERE l.user_id=u.id AND l.post_id=$1)
        ORDER BY md5(u.id::text || ':' || $1::text) LIMIT $2
      ), ins AS (
        INSERT INTO likes(user_id,post_id,created_at)
        SELECT id,$1,now() FROM picked ON CONFLICT DO NOTHING RETURNING 1
      ) SELECT count(*)::int c FROM ins`, [targetId, likesToAdd]);
      likesAdded = Number(q.rows[0]?.c || 0);
    }
    if (retweetsToAdd > 0) {
      const q = await client.query(`WITH picked AS (
        SELECT u.id FROM users u
        WHERE u.is_reaction_bot=true AND u.is_active=true
          AND NOT EXISTS(SELECT 1 FROM retweets r WHERE r.user_id=u.id AND r.post_id=$1)
        ORDER BY md5('r:' || u.id::text || ':' || $1::text) LIMIT $2
      ), ins AS (
        INSERT INTO retweets(user_id,post_id,created_at)
        SELECT id,$1,now() FROM picked ON CONFLICT DO NOTHING RETURNING 1
      ) SELECT count(*)::int c FROM ins`, [targetId, retweetsToAdd]);
      retweetsAdded = Number(q.rows[0]?.c || 0);
    }
  } else {
    if (likesToAdd > 0) {
      const q = await client.query(`WITH picked AS (
        SELECT u.id FROM users u
        WHERE u.is_reaction_bot=true AND u.is_active=true
          AND NOT EXISTS(SELECT 1 FROM comment_likes l WHERE l.user_id=u.id AND l.comment_id=$1)
        ORDER BY md5(u.id::text || ':c:' || $1::text) LIMIT $2
      ), ins AS (
        INSERT INTO comment_likes(user_id,comment_id,created_at)
        SELECT id,$1,now() FROM picked ON CONFLICT DO NOTHING RETURNING 1
      ) SELECT count(*)::int c FROM ins`, [targetId, likesToAdd]);
      likesAdded = Number(q.rows[0]?.c || 0);
    }
    if (retweetsToAdd > 0) {
      const q = await client.query(`WITH picked AS (
        SELECT u.id FROM users u
        WHERE u.is_reaction_bot=true AND u.is_active=true
          AND NOT EXISTS(SELECT 1 FROM comment_retweets r WHERE r.user_id=u.id AND r.comment_id=$1)
        ORDER BY md5('r:c:' || u.id::text || ':' || $1::text) LIMIT $2
      ), ins AS (
        INSERT INTO comment_retweets(user_id,comment_id,created_at)
        SELECT id,$1,now() FROM picked ON CONFLICT DO NOTHING RETURNING 1
      ) SELECT count(*)::int c FROM ins`, [targetId, retweetsToAdd]);
      retweetsAdded = Number(q.rows[0]?.c || 0);
    }
  }
  return { likesAdded, retweetsAdded };
}

async function processAnimationJobs() {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const lock = await client.query("SELECT pg_try_advisory_xact_lock(504050) AS locked");
    if (!lock.rows[0]?.locked) { await client.query("ROLLBACK"); return; }
    const jobs = await client.query(`SELECT id,post_id,comment_id,likes_target,retweets_target,likes_initial,retweets_initial,likes_added,retweets_added,started_at,completes_at
      FROM animation_scores
      WHERE completed_at IS NULL AND started_at IS NOT NULL AND completes_at IS NOT NULL
      ORDER BY started_at ASC LIMIT 20 FOR UPDATE SKIP LOCKED`);
    const now = Date.now();
    for (const job of jobs.rows) {
      const start = new Date(job.started_at).getTime();
      const end = new Date(job.completes_at).getTime();
      const fraction = end <= start ? 1 : Math.max(0, Math.min(1, (now - start) / (end - start)));
      const totalLikesToGenerate = Math.max(0, Number(job.likes_target) - Number(job.likes_initial));
      const totalRetweetsToGenerate = Math.max(0, Number(job.retweets_target) - Number(job.retweets_initial));
      const expectedLikes = fraction >= 1 ? totalLikesToGenerate : Math.floor(totalLikesToGenerate * fraction);
      const expectedRetweets = fraction >= 1 ? totalRetweetsToGenerate : Math.floor(totalRetweetsToGenerate * fraction);
      const needLikes = Math.max(0, expectedLikes - Number(job.likes_added || 0));
      const needRetweets = Math.max(0, expectedRetweets - Number(job.retweets_added || 0));
      const targetType = job.post_id ? "post" : "comment";
      const targetId = Number(job.post_id || job.comment_id);
      const added = await insertAnimatedReactions(client, targetType, targetId, needLikes, needRetweets);
      const newLikesAdded = Number(job.likes_added || 0) + added.likesAdded;
      const newRetweetsAdded = Number(job.retweets_added || 0) + added.retweetsAdded;
      const complete = fraction >= 1 && newLikesAdded >= totalLikesToGenerate && newRetweetsAdded >= totalRetweetsToGenerate;
      await client.query(`UPDATE animation_scores SET likes_added=$2,retweets_added=$3,completed_at=CASE WHEN $4 THEN now() ELSE completed_at END WHERE id=$1`,
        [Number(job.id), newLikesAdded, newRetweetsAdded, complete]);
    }
    await client.query("COMMIT");
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    throw e;
  } finally { client.release(); }
}

function publicUser(row) {
  return {
    id: Number(row.id),
    username: row.username,
    displayName: row.display_name,
    bio: row.bio || "",
    location: row.location || "",
    website: row.website || "",
    avatarUrl: row.avatar_url || null,
    bannerUrl: row.banner_url || null,
    createdAt: row.created_at,
    followersCount: Number(row.followers_count || 0),
    followingCount: Number(row.following_count || 0),
    postsCount: Number(row.posts_count || 0),
    isFollowing: Boolean(row.is_following),
    isAdmin: Boolean(row.is_admin),
    isTrainer: Boolean(row.is_trainer),
    isVerified: Boolean(row.is_verified),
    isActive: row.is_active !== false
  };
}

function tokenFor(user) {
  const secret = process.env.JWT_SECRET || "change-this-jwt-secret-before-public-use";
  return jwt.sign({ sub: String(user.id), username: user.username }, secret, { expiresIn: "7d" });
}

function bearer(req) {
  const raw = req?.headers?.authorization || "";
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

let roleSchemaPromise = null;
async function ensureRoleSchema() {
  if (!roleSchemaPromise) {
    roleSchemaPromise = (async () => {
      const client = await db().connect();
      try {
        await client.query("BEGIN");
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_trainer BOOLEAN NOT NULL DEFAULT false`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_reaction_bot BOOLEAN NOT NULL DEFAULT false`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS simulated_followers_count BIGINT NOT NULL DEFAULT 0`);
        await client.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_trainer_post BOOLEAN NOT NULL DEFAULT false`);
        await client.query(`CREATE TABLE IF NOT EXISTS animation_scores (
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
        )`);
        await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_animation_scores_post ON animation_scores(post_id) WHERE post_id IS NOT NULL`);
        await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_animation_scores_comment ON animation_scores(comment_id) WHERE comment_id IS NOT NULL`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_reaction_pool ON users(is_reaction_bot,id) WHERE is_reaction_bot=true`);
        await client.query(`ALTER TABLE animation_scores ADD COLUMN IF NOT EXISTS likes_initial INTEGER NOT NULL DEFAULT 0`);
        await client.query(`ALTER TABLE animation_scores ADD COLUMN IF NOT EXISTS retweets_initial INTEGER NOT NULL DEFAULT 0`);
        await client.query(`ALTER TABLE animation_scores ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ`);
        await client.query(`ALTER TABLE animation_scores ADD COLUMN IF NOT EXISTS completes_at TIMESTAMPTZ`);
        await client.query(`ALTER TABLE animation_scores ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_animation_scores_pending ON animation_scores(completes_at,id) WHERE completed_at IS NULL`);
        await client.query("COMMIT");
        startAnimationScheduler();
      } catch (e) {
        await client.query("ROLLBACK"); throw e;
      } finally { client.release(); }
      return true;
    })().catch(err => { roleSchemaPromise = null; throw err; });
  }
  return roleSchemaPromise;
}

async function viewer(req, required = false) {
  await ensureRoleSchema();
  const token = bearer(req);
  if (!token) {
    if (required) throw new HttpError(401, "Connexion requise.");
    return null;
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "change-this-jwt-secret-before-public-use");
    const { rows } = await db().query(
      "SELECT id, username, is_admin, is_trainer, is_active FROM users WHERE id=$1 LIMIT 1",
      [Number(payload.sub)]
    );
    const u = rows[0];
    if (!u || !u.is_active) throw new HttpError(403, "Ce compte est désactivé.");
    return { id: Number(u.id), username: u.username, isAdmin: Boolean(u.is_admin), isTrainer: Boolean(u.is_trainer), isActive: true };
  } catch (e) {
    if (e instanceof HttpError) {
      if (required) throw e;
      return null;
    }
    if (required) throw new HttpError(401, "Session expirée ou invalide.");
    return null;
  }
}

async function adminViewer(req) {
  const v = await viewer(req, true);
  if (!v.isAdmin) throw new HttpError(403, "Accès administrateur requis.");
  return v;
}

async function trainerViewer(req) {
  const v = await viewer(req, true);
  if (!v.isTrainer) throw new HttpError(403, "Accès entraîneur requis.");
  return v;
}

function cleanUsername(value) {
  return String(value || "").trim().replace(/^@/, "").toLowerCase();
}

function cleanText(value, max) {
  const text = String(value || "").trim();
  if (Number.isFinite(max) && text.length > max) {
    throw new HttpError(400, `Le texte ne peut pas dépasser ${max} caractères.`);
  }
  return text;
}

function extensionFor(mime, original = "") {
  const known = {
    "image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp",
    "video/mp4": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov", "application/pdf": ".pdf"
  };
  return known[mime] || path.extname(original).slice(0, 8).toLowerCase() || ".bin";
}

const ALLOWED_MEDIA = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "video/mp4", "video/webm", "video/quicktime", "application/pdf"
]);

async function saveDataFile(item, folder = "media", imageOnly = false) {
  if (!item || typeof item.data !== "string") throw new HttpError(400, "Fichier invalide.");
  const match = item.data.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) throw new HttpError(400, "Format de fichier invalide.");
  const mime = match[1].toLowerCase();
  if (!ALLOWED_MEDIA.has(mime) || (imageOnly && !mime.startsWith("image/"))) {
    throw new HttpError(415, imageOnly ? "Seules les images sont autorisées ici." : "Type de média non pris en charge.");
  }
  const buffer = Buffer.from(match[2], "base64");
  const maxBytes = Number(process.env.MAX_UPLOAD_MB || 25) * 1024 * 1024;
  if (buffer.length > maxBytes) throw new HttpError(413, `Fichier trop volumineux (maximum ${process.env.MAX_UPLOAD_MB || 25} Mo).`);

  const now = new Date();
  const relativeDir = path.posix.join("uploads", folder, String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, "0"));
  const absoluteDir = path.join("/data/public", relativeDir);
  await fsp.mkdir(absoluteDir, { recursive: true });
  const filename = `${crypto.randomUUID()}${extensionFor(mime, item.name)}`;
  await fsp.writeFile(path.join(absoluteDir, filename), buffer);
  return { url: `/${relativeDir}/${filename}`, mimeType: mime, originalName: String(item.name || "fichier").slice(0, 180) };
}

function giphyMediaReference(item) {
  if (!item || item.provider !== "giphy") return null;
  const id = String(item.providerId || item.id || "").trim();
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new HttpError(400, "Référence GIPHY invalide.");
  return {
    url: `giphy:${id}`,
    mimeType: "image/giphy",
    originalName: cleanText(item.name || item.title || "GIF GIPHY", 180) || "GIF GIPHY"
  };
}

async function savePostMedia(client, postId, items) {
  const media = Array.isArray(items) ? items.slice(0, 4) : [];
  for (let i = 0; i < media.length; i++) {
    const saved = giphyMediaReference(media[i]) || await saveDataFile(media[i], "posts");
    await client.query(
      `INSERT INTO post_media(post_id, url, mime_type, original_name, sort_order) VALUES ($1,$2,$3,$4,$5)`,
      [postId, saved.url, saved.mimeType, saved.originalName, i]
    );
  }
}

async function saveCommentMedia(client, commentId, items) {
  const media = Array.isArray(items) ? items.slice(0, 4) : [];
  for (let i = 0; i < media.length; i++) {
    const saved = giphyMediaReference(media[i]) || await saveDataFile(media[i], "comments");
    await client.query(
      `INSERT INTO comment_media(comment_id, url, mime_type, original_name, sort_order) VALUES ($1,$2,$3,$4,$5)`,
      [commentId, saved.url, saved.mimeType, saved.originalName, i]
    );
  }
}

async function removeStoredFiles(urls) {
  for (const url of urls || []) {
    if (!String(url).startsWith("/uploads/")) continue;
    const absolute = path.resolve("/data/public", `.${url}`);
    if (!absolute.startsWith("/data/public/uploads/")) continue;
    try { await fsp.unlink(absolute); } catch (e) { if (e.code !== "ENOENT") console.warn("TFI@TTER: fichier non supprimé", absolute, e.message); }
  }
}

let messagingSchemaPromise = null;

async function ensureMessagingSchema() {
  if (!messagingSchemaPromise) {
    messagingSchemaPromise = (async () => {
      const client = await db().connect();
      try {
        await client.query("BEGIN");
        await client.query(`CREATE TABLE IF NOT EXISTS notifications (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          actor_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(24) NOT NULL,
          post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
          comment_id BIGINT REFERENCES comments(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          read_at TIMESTAMPTZ
        )`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at) WHERE read_at IS NULL`);
        await client.query(`CREATE TABLE IF NOT EXISTS direct_messages (
          id BIGSERIAL PRIMARY KEY,
          sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          recipient_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          read_at TIMESTAMPTZ,
          CONSTRAINT no_self_direct_message CHECK (sender_id <> recipient_id)
        )`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_dm_sender_created ON direct_messages(sender_id, created_at DESC)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_dm_recipient_created ON direct_messages(recipient_id, created_at DESC)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_dm_recipient_unread ON direct_messages(recipient_id, read_at) WHERE read_at IS NULL`);
        await client.query(`CREATE TABLE IF NOT EXISTS conversation_deletions (
          user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          other_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          hidden_before TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (user_id, other_user_id),
          CONSTRAINT no_self_conversation_deletion CHECK (user_id <> other_user_id)
        )`);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
      return true;
    })().catch(err => { messagingSchemaPromise = null; throw err; });
  }
  return messagingSchemaPromise;
}


let socialSchemaPromise = null;

async function ensureSocialSchema() {
  if (!socialSchemaPromise) {
    socialSchemaPromise = (async () => {
      await ensureMessagingSchema();
      const client = await db().connect();
      try {
        await client.query("BEGIN");
        await client.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS quote_post_id BIGINT REFERENCES posts(id) ON DELETE SET NULL`);
        await client.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS quote_comment_id BIGINT REFERENCES comments(id) ON DELETE SET NULL`);
        await client.query(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`);
        await client.query(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ`);
        await client.query(`CREATE TABLE IF NOT EXISTS comment_likes (
          user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          comment_id BIGINT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (user_id, comment_id)
        )`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id)`);
        await client.query(`CREATE TABLE IF NOT EXISTS comment_retweets (
          user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          comment_id BIGINT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (user_id, comment_id)
        )`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_comment_retweets_comment ON comment_retweets(comment_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_comment_retweets_user_created ON comment_retweets(user_id, created_at DESC)`);
        // Les versions <=0.3.5 limitaient les types de notification à quatre valeurs.
        await client.query(`ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check`);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally { client.release(); }
      return true;
    })().catch(err => { socialSchemaPromise = null; throw err; });
  }
  return socialSchemaPromise;
}

async function createNotification(queryable, { userId, actorId, type, postId = null, commentId = null }) {
  if (!userId || !actorId || Number(userId) === Number(actorId)) return;
  await ensureMessagingSchema();
  await queryable.query(
    `INSERT INTO notifications(user_id, actor_id, type, post_id, comment_id)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
    [userId, actorId, type, postId, commentId]
  );
}

async function serializeCommentsByIds(ids, viewerId) {
  if (!ids.length) return new Map();
  await ensureSocialSchema();
  const { rows } = await db().query(
    `SELECT c.id, c.post_id, c.content, c.created_at, c.updated_at, c.edited_at,
            u.id AS user_id, u.username, u.display_name, u.avatar_url, u.is_admin, u.is_trainer, u.is_verified,
            pu.username AS parent_username, pu.display_name AS parent_display_name,
            COALESCE((SELECT json_agg(json_build_object(
              'url', cm.url, 'mimeType', cm.mime_type, 'name', cm.original_name
            ) ORDER BY cm.sort_order) FROM comment_media cm WHERE cm.comment_id=c.id), '[]'::json) AS media,
            (SELECT count(*) FROM comment_likes cl WHERE cl.comment_id=c.id) AS like_count,
            (SELECT count(*) FROM comment_retweets cr WHERE cr.comment_id=c.id) AS retweet_count,
            CASE WHEN $1::bigint IS NULL THEN false ELSE EXISTS(
              SELECT 1 FROM comment_likes cl2 WHERE cl2.comment_id=c.id AND cl2.user_id=$1
            ) END AS liked_by_me,
            CASE WHEN $1::bigint IS NULL THEN false ELSE EXISTS(
              SELECT 1 FROM comment_retweets cr2 WHERE cr2.comment_id=c.id AND cr2.user_id=$1
            ) END AS retweeted_by_me
       FROM comments c
       JOIN users u ON u.id=c.user_id
       JOIN posts p ON p.id=c.post_id
       JOIN users pu ON pu.id=p.user_id
      WHERE c.id = ANY($2::bigint[])`,
    [viewerId || null, ids]
  );
  const map = new Map();
  for (const r of rows) {
    map.set(Number(r.id), {
      id: Number(r.id),
      content: r.content,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      editedAt: r.edited_at,
      edited: Boolean(r.edited_at),
      parentPostId: Number(r.post_id),
      author: {
        id: Number(r.user_id), username: r.username, displayName: r.display_name,
        avatarUrl: r.avatar_url || null, isAdmin: Boolean(r.is_admin), isTrainer: Boolean(r.is_trainer), isVerified: Boolean(r.is_verified)
      },
      replyingTo: { username: r.parent_username, displayName: r.parent_display_name },
      media: r.media || [],
      likeCount: Number(r.like_count), retweetCount: Number(r.retweet_count),
      likedByMe: Boolean(r.liked_by_me), retweetedByMe: Boolean(r.retweeted_by_me),
      ownedByMe: viewerId !== null && viewerId !== undefined && Number(r.user_id) === Number(viewerId),
      parentPost: null
    });
  }

  // v0.4.0 : une réponse transportée hors du fil de discussion inclut aussi son TFI@T parent.
  // On sérialise le parent sans ses citations afin d'éviter toute récursion commentaire -> post -> commentaire.
  const parentIds = [...new Set(rows.map(r => Number(r.post_id)).filter(Boolean))];
  const parentPosts = await serializePosts(parentIds, viewerId, false);
  for (const comment of map.values()) comment.parentPost = parentPosts.get(comment.parentPostId) || null;
  return map;
}

function commentAsEntry(comment, extras = {}) {
  if (!comment) return null;
  return {
    ...comment,
    entryType: "reply",
    replyId: Number(comment.id),
    id: `reply-${Number(comment.id)}`,
    ...extras
  };
}

async function serializePosts(ids, viewerId, includeQuotes = true) {
  if (!ids.length) return new Map();
  await ensureSocialSchema();
  const { rows } = await db().query(
    `SELECT p.id, p.content, p.created_at, p.updated_at, p.edited_at, p.quote_post_id, p.quote_comment_id, p.is_trainer_post,
            u.id AS user_id, u.username, u.display_name, u.avatar_url, u.is_admin, u.is_trainer, u.is_verified,
            COALESCE((SELECT json_agg(json_build_object(
              'url', pm.url, 'mimeType', pm.mime_type, 'name', pm.original_name
            ) ORDER BY pm.sort_order) FROM post_media pm WHERE pm.post_id=p.id), '[]'::json) AS media,
            (SELECT count(*) FROM likes l WHERE l.post_id=p.id) AS like_count,
            (SELECT count(*) FROM retweets r WHERE r.post_id=p.id) AS retweet_count,
            (SELECT count(*) FROM comments c WHERE c.post_id=p.id) AS comment_count,
            CASE WHEN $1::bigint IS NULL THEN false ELSE EXISTS(
              SELECT 1 FROM likes l2 WHERE l2.post_id=p.id AND l2.user_id=$1
            ) END AS liked_by_me,
            CASE WHEN $1::bigint IS NULL THEN false ELSE EXISTS(
              SELECT 1 FROM retweets r2 WHERE r2.post_id=p.id AND r2.user_id=$1
            ) END AS retweeted_by_me
       FROM posts p
       JOIN users u ON u.id=p.user_id
      WHERE p.id = ANY($2::bigint[])`,
    [viewerId || null, ids]
  );
  const map = new Map();
  for (const r of rows) {
    map.set(Number(r.id), {
      id: Number(r.id), content: r.content, createdAt: r.created_at, updatedAt: r.updated_at,
      editedAt: r.edited_at, edited: Boolean(r.edited_at), isTrainerPost: Boolean(r.is_trainer_post),
      quotePostId: r.quote_post_id ? Number(r.quote_post_id) : null,
      quoteCommentId: r.quote_comment_id ? Number(r.quote_comment_id) : null,
      author: {
        id: Number(r.user_id), username: r.username, displayName: r.display_name,
        avatarUrl: r.avatar_url || null, isAdmin: Boolean(r.is_admin), isTrainer: Boolean(r.is_trainer), isVerified: Boolean(r.is_verified)
      },
      media: r.media || [],
      likeCount: Number(r.like_count), retweetCount: Number(r.retweet_count), commentCount: Number(r.comment_count),
      likedByMe: Boolean(r.liked_by_me), retweetedByMe: Boolean(r.retweeted_by_me),
      ownedByMe: viewerId !== null && viewerId !== undefined && Number(r.user_id) === Number(viewerId),
      quote: null
    });
  }

  if (includeQuotes) {
    const quotePostIds = [...new Set(rows.map(r => r.quote_post_id ? Number(r.quote_post_id) : null).filter(Boolean))];
    const quoteCommentIds = [...new Set(rows.map(r => r.quote_comment_id ? Number(r.quote_comment_id) : null).filter(Boolean))];
    const [quotedPosts, quotedComments] = await Promise.all([
      serializePosts(quotePostIds, viewerId, false),
      serializeCommentsByIds(quoteCommentIds, viewerId)
    ]);
    for (const post of map.values()) {
      if (post.quotePostId && quotedPosts.has(post.quotePostId)) {
        post.quote = { type: "post", post: quotedPosts.get(post.quotePostId) };
      } else if (post.quoteCommentId && quotedComments.has(post.quoteCommentId)) {
        post.quote = { type: "comment", comment: quotedComments.get(post.quoteCommentId) };
      }
    }
  }
  return map;
}

async function register(msg) {
  const body = msg.payload || {};
  const username = cleanUsername(body.username);
  const displayName = cleanText(body.displayName || body.display_name, 50);
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new HttpError(400, "Le nom d'utilisateur doit contenir 3 à 20 caractères : lettres, chiffres ou _.");
  if (!displayName) throw new HttpError(400, "Le nom affiché est obligatoire.");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, "Adresse e-mail invalide.");
  if (password.length < 8) throw new HttpError(400, "Le mot de passe doit contenir au moins 8 caractères.");
  const hash = await bcrypt.hash(password, 12);
  try {
    const { rows } = await db().query(
      `INSERT INTO users(username, display_name, email, password_hash) VALUES ($1,$2,$3,$4)
       RETURNING id, username, display_name, email, created_at, is_admin, is_trainer, is_verified`,
      [username, displayName, email, hash]
    );
    const u = rows[0];
    return ok({ token: tokenFor(u), user: { id: Number(u.id), username: u.username, displayName: u.display_name, email: u.email, isAdmin: Boolean(u.is_admin), isTrainer: Boolean(u.is_trainer), isVerified: Boolean(u.is_verified) } }, 201);
  } catch (e) {
    if (e.code === "23505") throw new HttpError(409, "Ce nom d'utilisateur ou cet e-mail est déjà utilisé.");
    throw e;
  }
}

async function login(msg) {
  const body = msg.payload || {};
  const loginValue = String(body.login || "").trim().toLowerCase().replace(/^@/, "");
  const password = String(body.password || "");
  const { rows } = await db().query(
    `SELECT id, username, display_name, email, password_hash, is_admin, is_trainer, is_verified, is_active FROM users
     WHERE lower(username)=$1 OR lower(email)=$1 LIMIT 1`, [loginValue]
  );
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password, u.password_hash))) throw new HttpError(401, "Identifiants incorrects.");
  if (!u.is_active) throw new HttpError(403, "Ce compte a été désactivé par un administrateur.");
  return ok({ token: tokenFor(u), user: { id: Number(u.id), username: u.username, displayName: u.display_name, email: u.email, isAdmin: Boolean(u.is_admin), isTrainer: Boolean(u.is_trainer), isVerified: Boolean(u.is_verified) } });
}

async function me(msg) {
  const v = await viewer(msg.req, true);
  const { rows } = await db().query(
    `SELECT u.*,
      LEAST(100000000::bigint, (SELECT count(*) FROM follows f WHERE f.following_id=u.id) + COALESCE(u.simulated_followers_count,0)) followers_count,
      (SELECT count(*) FROM follows f WHERE f.follower_id=u.id) following_count,
      (SELECT count(*) FROM posts p WHERE p.user_id=u.id) posts_count,
      false is_following
     FROM users u WHERE u.id=$1`, [v.id]
  );
  if (!rows[0]) throw new HttpError(404, "Compte introuvable.");
  return ok({ user: publicUser(rows[0]) });
}

async function feed(msg) {
  const v = await viewer(msg.req, false);
  const viewerId = v?.id || null;
  await ensureSocialSchema();
  await processAnimationJobs();
  const mode = String(msg.req?.query?.mode || "home");
  const limit = Math.min(Math.max(Number(msg.req?.query?.limit || 40), 1), 80);
  const followingOnly = Boolean(viewerId && mode === "following");
  const params = followingOnly ? [viewerId, limit] : [limit];
  const scope = followingOnly
    ? `(actor_id=$1 OR actor_id IN (SELECT following_id FROM follows WHERE follower_id=$1))`
    : "true";
  const limitParam = followingOnly ? "$2" : "$1";
  const { rows } = await db().query(
    `WITH popular_replies AS (
      SELECT c.post_id, c.id AS comment_id, c.user_id AS actor_id,
             GREATEST(c.created_at, MAX(cl.created_at)) AS event_at,
             COUNT(*)::int AS popularity
      FROM comments c
      JOIN comment_likes cl ON cl.comment_id=c.id
      GROUP BY c.post_id,c.id,c.user_id,c.created_at
      HAVING COUNT(*) >= 20
      ORDER BY event_at DESC
      LIMIT 12
    ), events AS (
      SELECT p.id AS post_id, NULL::bigint AS comment_id, p.user_id AS actor_id, p.created_at AS event_at,
             'post'::text AS event_kind, NULL::bigint AS retweeter_id, NULL::int AS popularity
      FROM posts p
      UNION ALL
      SELECT r.post_id, NULL::bigint, r.user_id, r.created_at, 'post_retweet', r.user_id, NULL::int
      FROM retweets r JOIN users ruser ON ruser.id=r.user_id AND ruser.is_reaction_bot=false
      UNION ALL
      SELECT NULL::bigint, cr.comment_id, cr.user_id, cr.created_at, 'comment_retweet', cr.user_id, NULL::int
      FROM comment_retweets cr JOIN users cruser ON cruser.id=cr.user_id AND cruser.is_reaction_bot=false
      UNION ALL
      SELECT pr.post_id, pr.comment_id, pr.actor_id, pr.event_at, 'popular_comment', NULL::bigint, pr.popularity
      FROM popular_replies pr
    )
    SELECT e.*, ru.username AS retweeter_username, ru.display_name AS retweeter_display_name
      FROM events e LEFT JOIN users ru ON ru.id=e.retweeter_id
     WHERE ${scope}
     ORDER BY e.event_at DESC LIMIT ${limitParam}`, params
  );
  const postIds = [...new Set(rows.map(r => r.post_id ? Number(r.post_id) : null).filter(Boolean))];
  const commentIds = [...new Set(rows.map(r => r.comment_id ? Number(r.comment_id) : null).filter(Boolean))];
  const [posts, commentsMap] = await Promise.all([serializePosts(postIds, viewerId), serializeCommentsByIds(commentIds, viewerId)]);
  const items = rows.map(r => {
    const retweetedBy = r.retweeter_id ? { id: Number(r.retweeter_id), username: r.retweeter_username, displayName: r.retweeter_display_name } : null;
    if (r.event_kind === 'comment_retweet') {
      return commentAsEntry(commentsMap.get(Number(r.comment_id)), { eventAt: r.event_at, retweetedBy });
    }
    if (r.event_kind === 'popular_comment') {
      return commentAsEntry(commentsMap.get(Number(r.comment_id)), {
        eventAt: r.event_at,
        popularReply: true,
        popularity: Number(r.popularity || 0)
      });
    }
    const post = posts.get(Number(r.post_id));
    return post ? { ...post, eventAt: r.event_at, retweetedBy: r.event_kind === 'post_retweet' ? retweetedBy : null } : null;
  }).filter(Boolean);
  return ok({ items });
}

async function createPost(msg) {
  const v = await viewer(msg.req, true);
  const body = msg.payload || {};
  const content = cleanText(body.content);
  const media = Array.isArray(body.media) ? body.media : [];
  if (!content && media.length === 0) throw new HttpError(400, "Un TFI@T doit contenir du texte ou un média.");
  if (media.length > 4) throw new HttpError(400, "Maximum 4 médias par publication.");
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`INSERT INTO posts(user_id, content, is_trainer_post) VALUES ($1,$2,$3) RETURNING id`, [v.id, content, Boolean(v.isTrainer)]);
    const postId = Number(rows[0].id);
    await savePostMedia(client, postId, media);
    await client.query("COMMIT");
    const map = await serializePosts([postId], v.id);
    return ok({ post: map.get(postId) }, 201);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally { client.release(); }
}

async function updatePost(msg) {
  const v = await viewer(msg.req, true);
  const id = Number(msg.req?.params?.id);
  if (!id) throw new HttpError(400, "Publication invalide.");
  const content = cleanText(msg.payload?.content);
  const current = await db().query(
    `SELECT p.id, p.user_id, p.content,
       EXISTS(SELECT 1 FROM post_media pm WHERE pm.post_id=p.id) has_media
     FROM posts p WHERE p.id=$1`, [id]
  );
  if (!current.rowCount) throw new HttpError(404, "Publication introuvable.");
  const post = current.rows[0];
  if (Number(post.user_id) !== v.id) throw new HttpError(403, "Vous ne pouvez modifier que vos propres TFI@Ts.");
  if (!content && !post.has_media) throw new HttpError(400, "Un TFI@T sans média ne peut pas être vide.");
  if (content !== post.content) {
    await db().query(`UPDATE posts SET content=$2, updated_at=now(), edited_at=now() WHERE id=$1`, [id, content]);
  }
  const map = await serializePosts([id], v.id);
  return ok({ post: map.get(id) });
}

async function deletePostRecord(id, requester, adminOverride = false) {
  const client = await db().connect();
  let files = [];
  try {
    await client.query("BEGIN");
    const found = await client.query("SELECT id,user_id FROM posts WHERE id=$1 FOR UPDATE", [id]);
    if (!found.rowCount) throw new HttpError(404, "Publication introuvable.");
    if (!adminOverride && Number(found.rows[0].user_id) !== requester.id) {
      throw new HttpError(403, "Vous ne pouvez supprimer que vos propres TFI@Ts.");
    }
    const media = await client.query(
      `SELECT url FROM post_media WHERE post_id=$1
       UNION ALL
       SELECT cm.url FROM comment_media cm JOIN comments c ON c.id=cm.comment_id WHERE c.post_id=$1`, [id]
    );
    files = media.rows.map(r => r.url);
    await client.query("DELETE FROM posts WHERE id=$1", [id]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally { client.release(); }
  await removeStoredFiles(files);
}

async function deletePost(msg) {
  const v = await viewer(msg.req, true);
  const id = Number(msg.req?.params?.id);
  if (!id) throw new HttpError(400, "Publication invalide.");
  await deletePostRecord(id, v, false);
  return ok({ deleted: true, id });
}

async function toggleLike(msg) {
  const v = await viewer(msg.req, true);
  const id = Number(msg.req?.params?.id);
  if (!id) throw new HttpError(400, "Publication invalide.");
  const exists = await db().query("SELECT user_id FROM posts WHERE id=$1", [id]);
  if (!exists.rowCount) throw new HttpError(404, "Publication introuvable.");
  const ownerId = Number(exists.rows[0].user_id);
  const current = await db().query("SELECT 1 FROM likes WHERE user_id=$1 AND post_id=$2", [v.id, id]);
  let liked;
  if (current.rowCount) {
    await db().query("DELETE FROM likes WHERE user_id=$1 AND post_id=$2", [v.id, id]);
    await db().query("DELETE FROM notifications WHERE user_id=$1 AND actor_id=$2 AND type='like' AND post_id=$3", [ownerId, v.id, id]);
    liked = false;
  } else {
    await db().query("INSERT INTO likes(user_id, post_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [v.id, id]);
    await createNotification(db(), { userId: ownerId, actorId: v.id, type: "like", postId: id });
    liked = true;
  }
  const count = await db().query("SELECT count(*)::int c FROM likes WHERE post_id=$1", [id]);
  return ok({ liked, count: Number(count.rows[0].c) });
}

async function toggleRetweet(msg) {
  const v = await viewer(msg.req, true);
  const id = Number(msg.req?.params?.id);
  if (!id) throw new HttpError(400, "Publication invalide.");
  const exists = await db().query("SELECT user_id FROM posts WHERE id=$1", [id]);
  if (!exists.rowCount) throw new HttpError(404, "Publication introuvable.");
  const ownerId = Number(exists.rows[0].user_id);
  const current = await db().query("SELECT 1 FROM retweets WHERE user_id=$1 AND post_id=$2", [v.id, id]);
  let retweeted;
  if (current.rowCount) {
    await db().query("DELETE FROM retweets WHERE user_id=$1 AND post_id=$2", [v.id, id]);
    await db().query("DELETE FROM notifications WHERE user_id=$1 AND actor_id=$2 AND type='retweet' AND post_id=$3", [ownerId, v.id, id]);
    retweeted = false;
  } else {
    await db().query("INSERT INTO retweets(user_id, post_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [v.id, id]);
    await createNotification(db(), { userId: ownerId, actorId: v.id, type: "retweet", postId: id });
    retweeted = true;
  }
  const count = await db().query("SELECT count(*)::int c FROM retweets WHERE post_id=$1", [id]);
  return ok({ retweeted, count: Number(count.rows[0].c) });
}

async function comments(msg) {
  const id = Number(msg.req?.params?.id);
  if (!id) throw new HttpError(400, "Publication invalide.");
  const v = await viewer(msg.req, false);
  await processAnimationJobs();
  await ensureSocialSchema();
  const [exists, rows] = await Promise.all([
    db().query("SELECT id FROM posts WHERE id=$1", [id]),
    db().query("SELECT id FROM comments WHERE post_id=$1 ORDER BY created_at ASC", [id])
  ]);
  if (!exists.rowCount) throw new HttpError(404, "Publication introuvable.");
  const ids = rows.rows.map(r => Number(r.id));
  const [map, postMap] = await Promise.all([
    serializeCommentsByIds(ids, v?.id || null),
    serializePosts([id], v?.id || null)
  ]);
  return ok({ post: postMap.get(id) || null, items: ids.map(cid => map.get(cid)).filter(Boolean) });
}

async function addComment(msg) {
  const v = await viewer(msg.req, true);
  const postId = Number(msg.req?.params?.id);
  const body = msg.payload || {};
  const content = cleanText(body.content);
  const media = Array.isArray(body.media) ? body.media : [];
  if (!postId) throw new HttpError(400, "Publication invalide.");
  if (!content && media.length === 0) throw new HttpError(400, "Le commentaire est vide.");
  if (media.length > 4) throw new HttpError(400, "Maximum 4 médias par commentaire.");
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const post = await client.query("SELECT user_id FROM posts WHERE id=$1", [postId]);
    if (!post.rowCount) throw new HttpError(404, "Publication introuvable.");
    const { rows } = await client.query("INSERT INTO comments(post_id,user_id,content) VALUES ($1,$2,$3) RETURNING id", [postId, v.id, content]);
    const commentId = Number(rows[0].id);
    await saveCommentMedia(client, commentId, media);
    await createNotification(client, { userId: Number(post.rows[0].user_id), actorId: v.id, type: "comment", postId, commentId });
    await client.query("COMMIT");
    const map = await serializeCommentsByIds([commentId], v.id);
    return ok({ comment: map.get(commentId) }, 201);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally { client.release(); }
}


async function updateComment(msg) {
  const v = await viewer(msg.req, true);
  await ensureSocialSchema();
  const id = Number(msg.req?.params?.id);
  if (!id) throw new HttpError(400, "Réponse invalide.");
  const content = cleanText(msg.payload?.content);
  const current = await db().query(
    `SELECT c.id, c.user_id, c.content,
       EXISTS(SELECT 1 FROM comment_media cm WHERE cm.comment_id=c.id) has_media
     FROM comments c WHERE c.id=$1`, [id]
  );
  if (!current.rowCount) throw new HttpError(404, "Réponse introuvable.");
  const comment = current.rows[0];
  if (Number(comment.user_id) !== Number(v.id)) throw new HttpError(403, "Vous ne pouvez modifier que vos propres réponses.");
  if (!content && !comment.has_media) throw new HttpError(400, "Une réponse sans média ne peut pas être vide.");
  if (content !== comment.content) {
    await db().query(`UPDATE comments SET content=$2, updated_at=now(), edited_at=now() WHERE id=$1`, [id, content]);
  }
  const map = await serializeCommentsByIds([id], v.id);
  return ok({ comment: map.get(id) });
}

async function deleteComment(msg) {
  const v = await viewer(msg.req, true);
  await ensureSocialSchema();
  const id = Number(msg.req?.params?.id);
  if (!id) throw new HttpError(400, "Réponse invalide.");
  const client = await db().connect();
  let files = [];
  let postId = null;
  try {
    await client.query("BEGIN");
    const found = await client.query("SELECT id,user_id,post_id FROM comments WHERE id=$1 FOR UPDATE", [id]);
    if (!found.rowCount) throw new HttpError(404, "Réponse introuvable.");
    if (Number(found.rows[0].user_id) !== Number(v.id)) throw new HttpError(403, "Vous ne pouvez supprimer que vos propres réponses.");
    postId = Number(found.rows[0].post_id);
    const media = await client.query("SELECT url FROM comment_media WHERE comment_id=$1", [id]);
    files = media.rows.map(r => r.url);
    await client.query("DELETE FROM comments WHERE id=$1", [id]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally { client.release(); }
  await removeStoredFiles(files);
  return ok({ deleted: true, id, postId });
}

async function toggleCommentLike(msg) {
  const v = await viewer(msg.req, true);
  await ensureSocialSchema();
  const id = Number(msg.req?.params?.id);
  if (!id) throw new HttpError(400, "Réponse invalide.");
  const found = await db().query("SELECT user_id,post_id FROM comments WHERE id=$1", [id]);
  if (!found.rowCount) throw new HttpError(404, "Réponse introuvable.");
  const ownerId = Number(found.rows[0].user_id), postId = Number(found.rows[0].post_id);
  const current = await db().query("SELECT 1 FROM comment_likes WHERE user_id=$1 AND comment_id=$2", [v.id,id]);
  let liked;
  if (current.rowCount) {
    await db().query("DELETE FROM comment_likes WHERE user_id=$1 AND comment_id=$2", [v.id,id]);
    await db().query("DELETE FROM notifications WHERE user_id=$1 AND actor_id=$2 AND type='comment_like' AND comment_id=$3", [ownerId,v.id,id]);
    liked = false;
  } else {
    await db().query("INSERT INTO comment_likes(user_id,comment_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [v.id,id]);
    await createNotification(db(), { userId: ownerId, actorId: v.id, type: "comment_like", postId, commentId: id });
    liked = true;
  }
  const count = await db().query("SELECT count(*)::int c FROM comment_likes WHERE comment_id=$1", [id]);
  return ok({ liked, count:Number(count.rows[0].c) });
}

async function toggleCommentRetweet(msg) {
  const v = await viewer(msg.req, true);
  await ensureSocialSchema();
  const id = Number(msg.req?.params?.id);
  if (!id) throw new HttpError(400, "Réponse invalide.");
  const found = await db().query("SELECT user_id,post_id FROM comments WHERE id=$1", [id]);
  if (!found.rowCount) throw new HttpError(404, "Réponse introuvable.");
  const ownerId = Number(found.rows[0].user_id), postId = Number(found.rows[0].post_id);
  const current = await db().query("SELECT 1 FROM comment_retweets WHERE user_id=$1 AND comment_id=$2", [v.id,id]);
  let retweeted;
  if (current.rowCount) {
    await db().query("DELETE FROM comment_retweets WHERE user_id=$1 AND comment_id=$2", [v.id,id]);
    await db().query("DELETE FROM notifications WHERE user_id=$1 AND actor_id=$2 AND type='comment_retweet' AND comment_id=$3", [ownerId,v.id,id]);
    retweeted = false;
  } else {
    await db().query("INSERT INTO comment_retweets(user_id,comment_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [v.id,id]);
    await createNotification(db(), { userId: ownerId, actorId: v.id, type: "comment_retweet", postId, commentId: id });
    retweeted = true;
  }
  const count = await db().query("SELECT count(*)::int c FROM comment_retweets WHERE comment_id=$1", [id]);
  return ok({ retweeted, count:Number(count.rows[0].c) });
}

async function createQuote(msg, kind) {
  const v = await viewer(msg.req, true);
  await ensureSocialSchema();
  const targetId = Number(msg.req?.params?.id);
  const body = msg.payload || {};
  const content = cleanText(body.content);
  const media = Array.isArray(body.media) ? body.media : [];
  if (!targetId) throw new HttpError(400, "Contenu cité invalide.");
  if (!content) throw new HttpError(400, "Ajoutez un message à votre citation.");
  if (media.length > 4) throw new HttpError(400, "Maximum 4 médias par publication.");
  const target = kind === "post"
    ? await db().query("SELECT id,user_id FROM posts WHERE id=$1", [targetId])
    : await db().query("SELECT id,user_id,post_id FROM comments WHERE id=$1", [targetId]);
  if (!target.rowCount) throw new HttpError(404, kind === "post" ? "Publication introuvable." : "Réponse introuvable.");
  const ownerId = Number(target.rows[0].user_id);
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const q = kind === "post"
      ? await client.query("INSERT INTO posts(user_id,content,quote_post_id,is_trainer_post) VALUES ($1,$2,$3,$4) RETURNING id", [v.id,content,targetId,Boolean(v.isTrainer)])
      : await client.query("INSERT INTO posts(user_id,content,quote_comment_id,is_trainer_post) VALUES ($1,$2,$3,$4) RETURNING id", [v.id,content,targetId,Boolean(v.isTrainer)]);
    const postId = Number(q.rows[0].id);
    await savePostMedia(client, postId, media);
    await createNotification(client, { userId: ownerId, actorId: v.id, type: "quote", postId, commentId: kind === "comment" ? targetId : null });
    await client.query("COMMIT");
    const map = await serializePosts([postId], v.id);
    return ok({ post: map.get(postId) }, 201);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally { client.release(); }
}

async function quotePost(msg) { return createQuote(msg, "post"); }
async function quoteComment(msg) { return createQuote(msg, "comment"); }

async function profile(msg) {
  const v = await viewer(msg.req, true);
  const username = cleanUsername(msg.req?.params?.username);
  const { rows } = await db().query(
    `SELECT u.*,
      LEAST(100000000::bigint, (SELECT count(*) FROM follows f WHERE f.following_id=u.id) + COALESCE(u.simulated_followers_count,0)) followers_count,
      (SELECT count(*) FROM follows f WHERE f.follower_id=u.id) following_count,
      (SELECT count(*) FROM posts p WHERE p.user_id=u.id) posts_count,
      CASE WHEN $2::bigint IS NULL THEN false ELSE EXISTS(
        SELECT 1 FROM follows fx WHERE fx.follower_id=$2 AND fx.following_id=u.id
      ) END is_following
     FROM users u WHERE lower(u.username)=lower($1) AND u.is_active=true LIMIT 1`, [username, v?.id || null]
  );
  if (!rows[0]) throw new HttpError(404, "Profil introuvable.");
  return ok({ user: publicUser(rows[0]) });
}

async function serializeProfileReplies(userId, viewerId, { mediaOnly = false, limit = 80 } = {}) {
  await ensureSocialSchema();
  const { rows } = await db().query(
    `SELECT c.id FROM comments c
      WHERE c.user_id=$1
        AND ($2::boolean=false OR EXISTS(SELECT 1 FROM comment_media cm2 WHERE cm2.comment_id=c.id))
      ORDER BY c.created_at DESC LIMIT $3`,
    [userId, Boolean(mediaOnly), limit]
  );
  const ids = rows.map(r => Number(r.id));
  const map = await serializeCommentsByIds(ids, viewerId);
  return ids.map(id => commentAsEntry(map.get(id))).filter(Boolean);
}

async function profilePosts(msg) {
  const v = await viewer(msg.req, true);
  await ensureSocialSchema();
  const username = cleanUsername(msg.req?.params?.username);
  const tab = String(msg.req?.query?.tab || "tweets").toLowerCase();
  if (!["tweets", "replies", "media", "likes"].includes(tab)) throw new HttpError(400, "Onglet de profil invalide.");

  const userResult = await db().query(
    "SELECT id, username, display_name FROM users WHERE lower(username)=lower($1) AND is_active=true",
    [username]
  );
  if (!userResult.rowCount) throw new HttpError(404, "Profil introuvable.");
  const userId = Number(userResult.rows[0].id);
  const canonicalUsername = userResult.rows[0].username;
  const displayName = userResult.rows[0].display_name;
  const viewerId = v?.id || null;

  if (tab === "replies") return ok({ tab, items: await serializeProfileReplies(userId, viewerId, { limit:80 }) });

  if (tab === "likes") {
    const { rows } = await db().query(
      `SELECT 'post'::text kind, l.post_id AS target_id, l.created_at liked_at FROM likes l WHERE l.user_id=$1
       UNION ALL
       SELECT 'comment', cl.comment_id, cl.created_at FROM comment_likes cl WHERE cl.user_id=$1
       ORDER BY liked_at DESC LIMIT 80`, [userId]
    );
    const postIds=[...new Set(rows.filter(r=>r.kind==='post').map(r=>Number(r.target_id)))];
    const commentIds=[...new Set(rows.filter(r=>r.kind==='comment').map(r=>Number(r.target_id)))];
    const [postsMap,commentsMap]=await Promise.all([serializePosts(postIds,viewerId),serializeCommentsByIds(commentIds,viewerId)]);
    return ok({ tab, items: rows.map(r => r.kind==='post' ? postsMap.get(Number(r.target_id)) : commentAsEntry(commentsMap.get(Number(r.target_id)))).filter(Boolean) });
  }

  if (tab === "media") {
    const [postRows, replies] = await Promise.all([
      db().query(`SELECT p.id AS post_id,p.created_at AS event_at FROM posts p
                   WHERE p.user_id=$1 AND EXISTS(SELECT 1 FROM post_media pm WHERE pm.post_id=p.id)
                   ORDER BY p.created_at DESC LIMIT 80`, [userId]),
      serializeProfileReplies(userId, viewerId, { mediaOnly:true, limit:80 })
    ]);
    const ids=postRows.rows.map(r=>Number(r.post_id));
    const map=await serializePosts(ids,viewerId);
    const authoredPosts=postRows.rows.map(r=>map.get(Number(r.post_id)) ? {...map.get(Number(r.post_id)),eventAt:r.event_at}:null).filter(Boolean);
    const items=[...authoredPosts,...replies].sort((a,b)=>new Date(b.eventAt||b.createdAt)-new Date(a.eventAt||a.createdAt)).slice(0,80);
    return ok({tab,items});
  }

  const { rows } = await db().query(
    `SELECT 'post'::text kind,p.id target_id,p.created_at event_at,false is_retweet FROM posts p WHERE p.user_id=$1
     UNION ALL
     SELECT 'post',r.post_id,r.created_at,true FROM retweets r WHERE r.user_id=$1
     UNION ALL
     SELECT 'comment',cr.comment_id,cr.created_at,true FROM comment_retweets cr WHERE cr.user_id=$1
     ORDER BY event_at DESC LIMIT 80`, [userId]
  );
  const postIds=[...new Set(rows.filter(r=>r.kind==='post').map(r=>Number(r.target_id)))];
  const commentIds=[...new Set(rows.filter(r=>r.kind==='comment').map(r=>Number(r.target_id)))];
  const [postsMap,commentsMap]=await Promise.all([serializePosts(postIds,viewerId),serializeCommentsByIds(commentIds,viewerId)]);
  const retweeter={id:userId,username:canonicalUsername,displayName};
  return ok({ tab, items: rows.map(r => {
    if (r.kind==='comment') return commentAsEntry(commentsMap.get(Number(r.target_id)), {eventAt:r.event_at,retweetedBy:retweeter});
    const post=postsMap.get(Number(r.target_id));
    return post ? {...post,eventAt:r.event_at,retweetedBy:r.is_retweet?retweeter:null}:null;
  }).filter(Boolean) });
}

async function profileConnections(msg, kind) {
  const v = await viewer(msg.req, true);
  const username = cleanUsername(msg.req?.params?.username);
  const target = await db().query(
    "SELECT id,username,display_name FROM users WHERE lower(username)=lower($1) AND is_active=true LIMIT 1",
    [username]
  );
  if (!target.rowCount) throw new HttpError(404, "Profil introuvable.");
  const targetId = Number(target.rows[0].id);
  const viewerId = v?.id || null;
  const join = kind === "followers"
    ? "JOIN follows f ON f.follower_id=u.id"
    : "JOIN follows f ON f.following_id=u.id";
  const where = kind === "followers" ? "f.following_id=$1" : "f.follower_id=$1";
  const { rows } = await db().query(
    `SELECT u.id,u.username,u.display_name,u.bio,u.location,u.website,u.avatar_url,u.banner_url,u.created_at,u.is_admin,u.is_verified,u.is_active,
            LEAST(100000000::bigint, (SELECT count(*) FROM follows ff WHERE ff.following_id=u.id) + COALESCE(u.simulated_followers_count,0)) followers_count,
            (SELECT count(*) FROM follows ff WHERE ff.follower_id=u.id) following_count,
            (SELECT count(*) FROM posts p WHERE p.user_id=u.id) posts_count,
            CASE WHEN $2::bigint IS NULL THEN false ELSE EXISTS(
              SELECT 1 FROM follows fx WHERE fx.follower_id=$2 AND fx.following_id=u.id
            ) END is_following,
            f.created_at AS relation_created_at
       FROM users u ${join}
      WHERE ${where} AND u.is_active=true
      ORDER BY f.created_at DESC, u.display_name ASC
      LIMIT 250`,
    [targetId, viewerId]
  );
  return ok({
    kind,
    profile: { id: targetId, username: target.rows[0].username, displayName: target.rows[0].display_name },
    items: rows.map(publicUser)
  });
}

async function profileFollowers(msg) { return profileConnections(msg, "followers"); }
async function profileFollowing(msg) { return profileConnections(msg, "following"); }

async function toggleFollow(msg) {
  const v = await viewer(msg.req, true);
  const username = cleanUsername(msg.req?.params?.username);
  const target = await db().query("SELECT id FROM users WHERE lower(username)=lower($1) AND is_active=true", [username]);
  if (!target.rowCount) throw new HttpError(404, "Profil introuvable.");
  const targetId = Number(target.rows[0].id);
  if (targetId === v.id) throw new HttpError(400, "Vous ne pouvez pas vous suivre vous-même.");
  const current = await db().query("SELECT 1 FROM follows WHERE follower_id=$1 AND following_id=$2", [v.id, targetId]);
  let following;
  if (current.rowCount) {
    await db().query("DELETE FROM follows WHERE follower_id=$1 AND following_id=$2", [v.id, targetId]);
    await db().query("DELETE FROM notifications WHERE user_id=$1 AND actor_id=$2 AND type='follow'", [targetId, v.id]);
    following = false;
  } else {
    await db().query("INSERT INTO follows(follower_id,following_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [v.id, targetId]);
    await createNotification(db(), { userId: targetId, actorId: v.id, type: "follow" });
    following = true;
  }
  const count = await db().query(`SELECT LEAST(100000000::bigint, (SELECT count(*) FROM follows WHERE following_id=$1) + COALESCE((SELECT simulated_followers_count FROM users WHERE id=$1),0)) AS c`, [targetId]);
  return ok({ following, followersCount: Number(count.rows[0].c) });
}

async function updateMe(msg) {
  const v = await viewer(msg.req, true);
  const body = msg.payload || {};
  const displayName = cleanText(body.displayName, 50);
  const bio = cleanText(body.bio, 160);
  const location = cleanText(body.location, 60);
  const website = cleanText(body.website, 160);
  let avatarUrl = null, bannerUrl = null;
  if (body.avatar?.data) avatarUrl = (await saveDataFile(body.avatar, "avatars", true)).url;
  if (body.banner?.data) bannerUrl = (await saveDataFile(body.banner, "banners", true)).url;
  const { rows } = await db().query(
    `UPDATE users SET display_name=COALESCE(NULLIF($2,''), display_name), bio=$3, location=$4, website=$5,
       avatar_url=COALESCE($6, avatar_url), banner_url=COALESCE($7, banner_url), updated_at=now()
     WHERE id=$1 RETURNING username`,
    [v.id, displayName, bio, location, website, avatarUrl, bannerUrl]
  );
  return profile({ req: { params: { username: rows[0].username }, headers: msg.req.headers } });
}

async function suggestions(msg) {
  const v = await viewer(msg.req, false);
  const { rows } = await db().query(
    `SELECT u.id,u.username,u.display_name,u.avatar_url,u.bio,u.is_admin,u.is_verified,
      LEAST(100000000::bigint, (SELECT count(*) FROM follows f WHERE f.following_id=u.id) + COALESCE(u.simulated_followers_count,0)) followers_count
     FROM users u
     WHERE u.is_active=true AND u.is_reaction_bot=false AND ($1::bigint IS NULL OR u.id<>$1)
       AND ($1::bigint IS NULL OR NOT EXISTS(SELECT 1 FROM follows x WHERE x.follower_id=$1 AND x.following_id=u.id))
     ORDER BY followers_count DESC, u.created_at DESC LIMIT 5`, [v?.id || null]
  );
  return ok({ items: rows.map(r => ({
    id: Number(r.id), username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url || null,
    bio: r.bio || "", followersCount: Number(r.followers_count), isAdmin: Boolean(r.is_admin), isVerified: Boolean(r.is_verified)
  })) });
}

async function trends(msg) {
  await viewer(msg.req, false);
  const { rows } = await db().query(`
    SELECT content FROM (
      SELECT content, created_at FROM posts
      UNION ALL
      SELECT content, created_at FROM comments
    ) activity
    ORDER BY created_at DESC
    LIMIT 2000
  `);
  const counts = new Map();
  for (const r of rows) {
    for (const m of String(r.content || "").matchAll(/(^|\s)#([\p{L}\p{N}_]{2,40})/gu)) {
      const raw = m[2];
      const key = raw.toLocaleLowerCase("fr-FR");
      const current = counts.get(key) || { name: `#${raw}`, count: 0 };
      current.count += 1;
      counts.set(key, current);
    }
  }
  const items = [...counts.values()].sort((a,b) => b.count-a.count || a.name.localeCompare(b.name, "fr")).slice(0,10);
  return ok({ items });
}

async function notifications(msg) {
  const v = await viewer(msg.req, true);
  await ensureMessagingSchema();
  const limit = Math.min(Math.max(Number(msg.req?.query?.limit || 80), 1), 120);
  const { rows } = await db().query(
    `SELECT n.id,n.type,n.post_id,n.comment_id,n.created_at,n.read_at,
            a.id actor_id,a.username,a.display_name,a.avatar_url,a.is_admin,a.is_verified,
            p.content post_content
       FROM notifications n
       JOIN users a ON a.id=n.actor_id
       LEFT JOIN posts p ON p.id=n.post_id
      WHERE n.user_id=$1
      ORDER BY n.created_at DESC LIMIT $2`, [v.id, limit]
  );
  const count = await db().query("SELECT count(*)::int c FROM notifications WHERE user_id=$1 AND read_at IS NULL", [v.id]);
  return ok({ unreadCount: Number(count.rows[0].c), items: rows.map(r => ({
    id:Number(r.id), type:r.type, postId:r.post_id ? Number(r.post_id) : null, commentId:r.comment_id ? Number(r.comment_id) : null,
    createdAt:r.created_at, read:Boolean(r.read_at), postSnippet:String(r.post_content || "").slice(0,220),
    actor:{ id:Number(r.actor_id), username:r.username, displayName:r.display_name, avatarUrl:r.avatar_url || null, isAdmin:Boolean(r.is_admin), isVerified:Boolean(r.is_verified) }
  })) });
}

async function markNotificationsRead(msg) {
  const v = await viewer(msg.req, true);
  await ensureMessagingSchema();
  await db().query("UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE user_id=$1 AND read_at IS NULL", [v.id]);
  return ok({ read: true });
}

async function navCounts(msg) {
  const v = await viewer(msg.req, true);
  await ensureMessagingSchema();
  const { rows } = await db().query(
    `SELECT
      (SELECT count(*) FROM notifications WHERE user_id=$1 AND read_at IS NULL)::int notifications,
      (SELECT count(*) FROM direct_messages WHERE recipient_id=$1 AND read_at IS NULL)::int messages`, [v.id]
  );
  return ok({ notifications:Number(rows[0].notifications), messages:Number(rows[0].messages) });
}

async function messageConversations(msg) {
  const v = await viewer(msg.req, true);
  await ensureMessagingSchema();
  const { rows } = await db().query(
    `WITH mine AS (
       SELECT dm.*, CASE WHEN dm.sender_id=$1 THEN dm.recipient_id ELSE dm.sender_id END other_id
       FROM direct_messages dm
       LEFT JOIN conversation_deletions cd
         ON cd.user_id=$1
        AND cd.other_user_id=CASE WHEN dm.sender_id=$1 THEN dm.recipient_id ELSE dm.sender_id END
       WHERE (dm.sender_id=$1 OR dm.recipient_id=$1)
         AND (cd.hidden_before IS NULL OR dm.created_at > cd.hidden_before)
     ), ranked AS (
       SELECT m.*,
              row_number() OVER (PARTITION BY other_id ORDER BY created_at DESC,id DESC) rn,
              count(*) FILTER (WHERE recipient_id=$1 AND read_at IS NULL) OVER (PARTITION BY other_id) unread_count
       FROM mine m
     )
     SELECT r.other_id,r.content,r.created_at,r.sender_id,r.unread_count,
            u.username,u.display_name,u.avatar_url,u.is_admin,u.is_verified
       FROM ranked r JOIN users u ON u.id=r.other_id
      WHERE r.rn=1 AND u.is_active=true
      ORDER BY r.created_at DESC LIMIT 80`, [v.id]
  );
  return ok({ items: rows.map(r => ({
    user:{ id:Number(r.other_id), username:r.username, displayName:r.display_name, avatarUrl:r.avatar_url || null, isAdmin:Boolean(r.is_admin), isVerified:Boolean(r.is_verified) },
    lastMessage:r.content, lastAt:r.created_at, sentByMe:Number(r.sender_id)===v.id, unreadCount:Number(r.unread_count)
  })) });
}

async function messageThread(msg) {
  const v = await viewer(msg.req, true);
  await ensureMessagingSchema();
  const username = cleanUsername(msg.req?.params?.username);
  const target = await db().query("SELECT id,username,display_name,avatar_url,is_admin,is_verified FROM users WHERE lower(username)=lower($1) AND is_active=true", [username]);
  if (!target.rowCount) throw new HttpError(404, "Destinataire introuvable.");
  const u = target.rows[0], targetId = Number(u.id);
  if (targetId === v.id) throw new HttpError(400, "Choisissez un autre membre pour cette conversation.");
  const hidden = await db().query("SELECT hidden_before FROM conversation_deletions WHERE user_id=$1 AND other_user_id=$2", [v.id,targetId]);
  const hiddenBefore = hidden.rowCount ? hidden.rows[0].hidden_before : null;
  await db().query(
    "UPDATE direct_messages SET read_at=COALESCE(read_at,now()) WHERE sender_id=$1 AND recipient_id=$2 AND read_at IS NULL AND ($3::timestamptz IS NULL OR created_at > $3)",
    [targetId, v.id, hiddenBefore]
  );
  const { rows } = await db().query(
    `SELECT id,sender_id,recipient_id,content,created_at,read_at
       FROM direct_messages
      WHERE ((sender_id=$1 AND recipient_id=$2) OR (sender_id=$2 AND recipient_id=$1))
        AND ($3::timestamptz IS NULL OR created_at > $3)
      ORDER BY created_at DESC,id DESC LIMIT 120`, [v.id,targetId,hiddenBefore]
  );
  return ok({ user:{ id:targetId, username:u.username, displayName:u.display_name, avatarUrl:u.avatar_url || null, isAdmin:Boolean(u.is_admin), isVerified:Boolean(u.is_verified) },
    items: rows.reverse().map(r => ({ id:Number(r.id), senderId:Number(r.sender_id), recipientId:Number(r.recipient_id), content:r.content, createdAt:r.created_at, read:Boolean(r.read_at), mine:Number(r.sender_id)===v.id })) });
}

async function deleteConversation(msg) {
  const v = await viewer(msg.req, true);
  await ensureMessagingSchema();
  const username = cleanUsername(msg.req?.params?.username);
  const target = await db().query("SELECT id,username FROM users WHERE lower(username)=lower($1)", [username]);
  if (!target.rowCount) throw new HttpError(404, "Conversation introuvable.");
  const targetId = Number(target.rows[0].id);
  if (targetId === v.id) throw new HttpError(400, "Conversation invalide.");

  const client = await db().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO conversation_deletions(user_id,other_user_id,hidden_before)
       VALUES ($1,$2,now())
       ON CONFLICT (user_id,other_user_id) DO UPDATE SET hidden_before=EXCLUDED.hidden_before`,
      [v.id,targetId]
    );
    // Les messages reçus et désormais masqués ne doivent plus alimenter le compteur de non-lus.
    await client.query(
      "UPDATE direct_messages SET read_at=COALESCE(read_at,now()) WHERE sender_id=$1 AND recipient_id=$2 AND read_at IS NULL",
      [targetId,v.id]
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  return ok({ deleted:true, username:target.rows[0].username, localOnly:true });
}

async function sendMessage(msg) {
  const v = await viewer(msg.req, true);
  await ensureMessagingSchema();
  const username = cleanUsername(msg.req?.params?.username);
  const content = cleanText(msg.payload?.content);
  if (!content) throw new HttpError(400, "Le message est vide.");
  const target = await db().query("SELECT id FROM users WHERE lower(username)=lower($1) AND is_active=true", [username]);
  if (!target.rowCount) throw new HttpError(404, "Destinataire introuvable.");
  const targetId = Number(target.rows[0].id);
  if (targetId === v.id) throw new HttpError(400, "Vous ne pouvez pas vous envoyer un message à vous-même.");
  const { rows } = await db().query(
    "INSERT INTO direct_messages(sender_id,recipient_id,content) VALUES ($1,$2,$3) RETURNING id,created_at",
    [v.id,targetId,content]
  );
  return ok({ message:{ id:Number(rows[0].id), senderId:v.id, recipientId:targetId, content, createdAt:rows[0].created_at, mine:true, read:false } }, 201);
}

async function adminOverview(msg) {
  await adminViewer(msg.req);
  await ensureSocialSchema();
  const { rows } = await db().query(
    `SELECT
      (SELECT count(*) FROM users WHERE is_reaction_bot=false)::int users,
      (SELECT count(*) FROM users WHERE is_active=true AND is_reaction_bot=false)::int active_users,
      (SELECT count(*) FROM users WHERE is_admin=true AND is_active=true AND is_reaction_bot=false)::int admins,
      (SELECT count(*) FROM users WHERE is_trainer=true AND is_active=true AND is_reaction_bot=false)::int trainers,
      (SELECT count(*) FROM users WHERE is_verified=true AND is_active=true AND is_reaction_bot=false)::int verified,
      (SELECT count(*) FROM users WHERE is_reaction_bot=true)::int simulation_accounts,
      (SELECT count(*) FROM posts)::int posts,
      (SELECT count(*) FROM comments)::int comments,
      (SELECT count(*) FROM likes)+(SELECT count(*) FROM comment_likes) AS likes,
      (SELECT count(*) FROM retweets)+(SELECT count(*) FROM comment_retweets) AS retweets`
  );
  return ok({ stats: rows[0] });
}

async function adminUsers(msg) {
  const v = await adminViewer(msg.req);
  const q = String(msg.req?.query?.q || "").trim().slice(0, 80);
  const { rows } = await db().query(
    `SELECT u.id,u.username,u.display_name,u.email,u.created_at,u.is_admin,u.is_trainer,u.is_verified,u.is_active,
      (SELECT count(*) FROM posts p WHERE p.user_id=u.id)::int posts_count,
      LEAST(100000000::bigint, (SELECT count(*) FROM follows f WHERE f.following_id=u.id) + COALESCE(u.simulated_followers_count,0))::bigint followers_count
     FROM users u
     WHERE u.is_reaction_bot=false AND ($1='' OR u.username ILIKE '%'||$1||'%' OR u.display_name ILIKE '%'||$1||'%' OR u.email ILIKE '%'||$1||'%')
     ORDER BY (u.email LIKE '%@tfiatter.local') ASC, u.is_admin DESC, u.is_trainer DESC, u.created_at DESC LIMIT 500`, [q]
  );
  return ok({ viewerId: v.id, items: rows.map(r => ({
    id: Number(r.id), username: r.username, displayName: r.display_name, email: r.email,
    createdAt: r.created_at, isAdmin: Boolean(r.is_admin), isTrainer: Boolean(r.is_trainer), isVerified: Boolean(r.is_verified), isActive: Boolean(r.is_active),
    postsCount: Number(r.posts_count), followersCount: Number(r.followers_count)
  })) });
}

async function adminCreateUser(msg) {
  await adminViewer(msg.req);
  const body = msg.payload || {};
  const username = cleanUsername(body.username);
  const displayName = cleanText(body.displayName || body.display_name, 50);
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const followersRaw = body.followersCount === undefined || body.followersCount === "" ? 0 : Number(body.followersCount);
  if (!Number.isInteger(followersRaw) || followersRaw < 0 || followersRaw > 100000000) throw new HttpError(400, "Le nombre d’abonnés doit être un entier compris entre 0 et 100 000 000.");
  const followersRequested = followersRaw;
  if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new HttpError(400, "Le nom d'utilisateur doit contenir 3 à 20 caractères : lettres, chiffres ou _.");
  if (!displayName) throw new HttpError(400, "Le nom affiché est obligatoire.");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, "Adresse e-mail invalide.");
  if (password.length < 8) throw new HttpError(400, "Le mot de passe doit contenir au moins 8 caractères.");
  const hash = await bcrypt.hash(password, 12);
  let avatarUrl = null;
  try {
    if (body.avatar?.data) avatarUrl = (await saveDataFile(body.avatar, "avatars", true)).url;
    const client = await db().connect();
    let u;
    try {
      await client.query("BEGIN");
      const created = await client.query(
        `INSERT INTO users(username, display_name, email, password_hash, avatar_url, is_admin, is_trainer, is_verified, is_active, simulated_followers_count)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0)
         RETURNING id,username,display_name,email,avatar_url,is_admin,is_trainer,is_verified,is_active,created_at`,
        [username, displayName, email, hash, avatarUrl, Boolean(body.isAdmin), Boolean(body.isTrainer), Boolean(body.isVerified), body.isActive !== false]
      );
      u = created.rows[0];
      if (followersRequested > 0) {
        // Jusqu'à 60 000 abonnements sont matérialisés avec de vrais comptes de simulation.
        // Le surplus est stocké dans simulated_followers_count afin de pouvoir représenter
        // des audiences allant jusqu'à 100 millions sans créer 100 millions de lignes SQL.
        const pool = await client.query(`SELECT count(*)::int c FROM users WHERE id<>$1 AND is_active=true AND (is_reaction_bot=true OR email LIKE '%@tfiatter.local')`, [Number(u.id)]);
        const materializedFollowers = Math.min(followersRequested, Number(pool.rows[0].c || 0), 60000);
        if (materializedFollowers > 0) {
          await client.query(`INSERT INTO follows(follower_id,following_id,created_at)
            SELECT id,$1,now() - ((random()*86400)::int * interval '1 second')
            FROM users
            WHERE id<>$1 AND is_active=true AND (is_reaction_bot=true OR email LIKE '%@tfiatter.local')
            ORDER BY md5(id::text || ':' || $1::text) LIMIT $2
            ON CONFLICT DO NOTHING`, [Number(u.id), materializedFollowers]);
        }
        const actualCount = await client.query(`SELECT count(*)::bigint c FROM follows WHERE following_id=$1`, [Number(u.id)]);
        const syntheticFollowers = Math.max(0, followersRequested - Number(actualCount.rows[0].c || 0));
        await client.query(`UPDATE users SET simulated_followers_count=$2 WHERE id=$1`, [Number(u.id), syntheticFollowers]);
      }
      await client.query("COMMIT");
    } catch (e) {
      try { await client.query("ROLLBACK"); } catch {}
      throw e;
    } finally { client.release(); }
    return ok({ user: { id:Number(u.id), username:u.username, displayName:u.display_name, email:u.email, avatarUrl:u.avatar_url || null, isAdmin:Boolean(u.is_admin), isTrainer:Boolean(u.is_trainer), isVerified:Boolean(u.is_verified), isActive:Boolean(u.is_active), createdAt:u.created_at, postsCount:0, followersCount:followersRequested } }, 201);
  } catch (e) {
    if (avatarUrl) await removeStoredFiles([avatarUrl]);
    if (e.code === "23505") throw new HttpError(409, "Ce nom d'utilisateur ou cet e-mail est déjà utilisé.");
    throw e;
  }
}

async function adminUpdateUser(msg) {
  const v = await adminViewer(msg.req);
  const targetId = Number(msg.req?.params?.id);
  if (!targetId) throw new HttpError(400, "Membre invalide.");
  const body = msg.payload || {};
  const found = await db().query("SELECT id,username,is_admin,is_trainer,is_verified,is_active FROM users WHERE id=$1", [targetId]);
  if (!found.rowCount) throw new HttpError(404, "Membre introuvable.");
  const target = found.rows[0];

  if (targetId === v.id && (body.isAdmin === false || body.isActive === false)) {
    throw new HttpError(400, "Vous ne pouvez pas retirer vos propres droits administrateur ni désactiver votre propre compte depuis ce panneau.");
  }

  const newAdmin = typeof body.isAdmin === "boolean" ? body.isAdmin : Boolean(target.is_admin);
  const newTrainer = typeof body.isTrainer === "boolean" ? body.isTrainer : Boolean(target.is_trainer);
  const newVerified = typeof body.isVerified === "boolean" ? body.isVerified : Boolean(target.is_verified);
  const newActive = typeof body.isActive === "boolean" ? body.isActive : Boolean(target.is_active);
  if (!newActive && newAdmin) throw new HttpError(400, "Retirez d'abord le rôle administrateur avant de désactiver ce membre.");

  await db().query("UPDATE users SET is_admin=$2,is_trainer=$3,is_verified=$4,is_active=$5,updated_at=now() WHERE id=$1", [targetId, newAdmin, newTrainer, newVerified, newActive]);
  return ok({ user: { id: targetId, username: target.username, isAdmin: newAdmin, isTrainer: newTrainer, isVerified: newVerified, isActive: newActive } });
}

async function adminPosts(msg) {
  await adminViewer(msg.req);
  const limit = Math.min(Math.max(Number(msg.req?.query?.limit || 60), 1), 150);
  const { rows } = await db().query("SELECT id FROM posts ORDER BY created_at DESC LIMIT $1", [limit]);
  const ids = rows.map(r => Number(r.id));
  const map = await serializePosts(ids, null);
  return ok({ items: ids.map(id => map.get(id)).filter(Boolean) });
}

async function adminDeletePost(msg) {
  const v = await adminViewer(msg.req);
  const id = Number(msg.req?.params?.id);
  if (!id) throw new HttpError(400, "Publication invalide.");
  await deletePostRecord(id, v, true);
  return ok({ deleted: true, id });
}

async function giphyConfig(msg) {
  await viewer(msg.req, true);
  const apiKey = String(process.env.GIPHY_WEB_API_KEY || "").trim();
  const allowedRatings = new Set(["g", "pg", "pg-13", "r"]);
  const requestedRating = String(process.env.GIPHY_RATING || "pg-13").toLowerCase();
  const rating = allowedRatings.has(requestedRating) ? requestedRating : "pg-13";
  const lang = String(process.env.GIPHY_LANG || "fr").trim().toLowerCase().slice(0, 2) || "fr";
  return ok({ enabled: Boolean(apiKey), apiKey, rating, lang });
}


async function searchSuggestions(msg) {
  const v = await viewer(msg.req, true);
  const q = String(msg.req?.query?.q || "").trim().replace(/^@/, "").slice(0, 80);
  if (!q) return ok({ items: [] });
  const { rows } = await db().query(
    `SELECT u.id,u.username,u.display_name,u.bio,u.location,u.website,u.avatar_url,u.banner_url,u.created_at,u.is_admin,u.is_verified,u.is_active,
      LEAST(100000000::bigint, (SELECT count(*) FROM follows f WHERE f.following_id=u.id) + COALESCE(u.simulated_followers_count,0)) followers_count,
      (SELECT count(*) FROM follows f WHERE f.follower_id=u.id) following_count,
      (SELECT count(*) FROM posts p WHERE p.user_id=u.id) posts_count,
      EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=$2 AND f.following_id=u.id) is_following
     FROM users u
     WHERE u.is_active=true AND u.is_reaction_bot=false
       AND (u.username ILIKE '%'||$1||'%' OR u.display_name ILIKE '%'||$1||'%')
     ORDER BY
       CASE
         WHEN lower(u.username)=lower($1) THEN 0
         WHEN lower(u.display_name)=lower($1) THEN 1
         WHEN lower(u.username) LIKE lower($1)||'%' THEN 2
         WHEN lower(u.display_name) LIKE lower($1)||'%' THEN 3
         ELSE 4
       END,
       u.is_verified DESC,
       followers_count DESC,
       u.display_name ASC
     LIMIT 8`, [q, v.id]
  );
  return ok({ items: rows.map(publicUser) });
}

async function search(msg) {
  const v = await viewer(msg.req, true);
  const rawQuery = String(msg.req?.query?.q || "").trim().slice(0, 120);
  if (!rawQuery) return ok({ query: "", tab: "top", people: [], items: [], filters: { people: "anyone", location: "anywhere", viewerLocation: "", nearbyAvailable: false } });

  const allowedTabs = new Set(["top", "latest", "people", "media"]);
  const allowedPeople = new Set(["anyone", "following"]);
  const allowedLocation = new Set(["anywhere", "nearby"]);
  const tab = allowedTabs.has(String(msg.req?.query?.tab || "").toLowerCase()) ? String(msg.req.query.tab).toLowerCase() : "top";
  const peopleMode = allowedPeople.has(String(msg.req?.query?.people || "").toLowerCase()) ? String(msg.req.query.people).toLowerCase() : "anyone";
  const locationMode = allowedLocation.has(String(msg.req?.query?.location || "").toLowerCase()) ? String(msg.req.query.location).toLowerCase() : "anywhere";
  const limit = Math.min(Math.max(Number(msg.req?.query?.limit || 50), 1), 80);
  const personTerm = rawQuery.replace(/^@/, "");

  const viewerRow = await db().query("SELECT location FROM users WHERE id=$1", [v.id]);
  const viewerLocation = String(viewerRow.rows[0]?.location || "").trim();
  const nearbyAvailable = Boolean(viewerLocation);

  const commonUserFilter = `
    AND ($3::text <> 'following' OR EXISTS(SELECT 1 FROM follows fx WHERE fx.follower_id=$2 AND fx.following_id=u.id))
    AND ($4::text <> 'nearby' OR ($5::text <> '' AND u.location <> '' AND (
      lower(u.location)=lower($5) OR lower(u.location) LIKE '%'||lower($5)||'%' OR lower($5) LIKE '%'||lower(u.location)||'%'
    )))`;

  let people = [];
  if (tab === "top" || tab === "people") {
    const peopleLimit = tab === "people" ? Math.min(limit, 60) : 4;
    const { rows } = await db().query(
      `SELECT u.id,u.username,u.display_name,u.bio,u.location,u.website,u.avatar_url,u.banner_url,u.created_at,u.is_admin,u.is_verified,u.is_active,
        LEAST(100000000::bigint, (SELECT count(*) FROM follows f WHERE f.following_id=u.id) + COALESCE(u.simulated_followers_count,0)) followers_count,
        (SELECT count(*) FROM follows f WHERE f.follower_id=u.id) following_count,
        (SELECT count(*) FROM posts p WHERE p.user_id=u.id) posts_count,
        EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=$2 AND f.following_id=u.id) is_following
       FROM users u
       WHERE u.is_active=true AND u.is_reaction_bot=false
         AND (u.username ILIKE '%'||$1||'%' OR u.display_name ILIKE '%'||$1||'%')
         ${commonUserFilter}
       ORDER BY
         CASE
           WHEN lower(u.username)=lower($1) THEN 0
           WHEN lower(u.display_name)=lower($1) THEN 1
           WHEN lower(u.username) LIKE lower($1)||'%' THEN 2
           WHEN lower(u.display_name) LIKE lower($1)||'%' THEN 3
           ELSE 4
         END,
         u.is_verified DESC,
         followers_count DESC,
         u.display_name ASC
       LIMIT $6`, [personTerm, v.id, peopleMode, locationMode, viewerLocation, peopleLimit]
    );
    people = rows.map(publicUser);
  }

  let items = [];
  if (tab !== "people") {
    const mediaOnly = tab === "media";
    const sortSql = tab === "top" ? "interaction_score DESC, created_at DESC" : "created_at DESC";
    const { rows } = await db().query(
      `WITH matches AS (
        SELECT 'post'::text kind, p.id::bigint post_id, NULL::bigint comment_id, p.created_at,
          ((SELECT count(*) FROM likes l WHERE l.post_id=p.id) +
           (SELECT count(*) FROM retweets r WHERE r.post_id=p.id) +
           (SELECT count(*) FROM comments c0 WHERE c0.post_id=p.id))::bigint interaction_score
        FROM posts p JOIN users u ON u.id=p.user_id
        WHERE u.is_active=true
          AND (p.content ILIKE '%'||$1||'%' OR u.username ILIKE '%'||$6||'%' OR u.display_name ILIKE '%'||$6||'%')
          ${commonUserFilter}
          AND ($7::boolean=false OR EXISTS(
            SELECT 1 FROM post_media pm WHERE pm.post_id=p.id AND (pm.mime_type LIKE 'image/%' OR pm.mime_type LIKE 'video/%')
          ))
        UNION ALL
        SELECT 'comment'::text kind, NULL::bigint post_id, c.id::bigint comment_id, c.created_at,
          ((SELECT count(*) FROM comment_likes cl WHERE cl.comment_id=c.id) +
           (SELECT count(*) FROM comment_retweets cr WHERE cr.comment_id=c.id))::bigint interaction_score
        FROM comments c JOIN users u ON u.id=c.user_id
        WHERE u.is_active=true
          AND (c.content ILIKE '%'||$1||'%' OR u.username ILIKE '%'||$6||'%' OR u.display_name ILIKE '%'||$6||'%')
          ${commonUserFilter}
          AND ($7::boolean=false OR EXISTS(
            SELECT 1 FROM comment_media cm WHERE cm.comment_id=c.id AND (cm.mime_type LIKE 'image/%' OR cm.mime_type LIKE 'video/%')
          ))
      )
      SELECT * FROM matches ORDER BY ${sortSql} LIMIT $8`,
      [rawQuery, v.id, peopleMode, locationMode, viewerLocation, personTerm, mediaOnly, limit]
    );

    const postIds = [...new Set(rows.map(r => r.post_id ? Number(r.post_id) : null).filter(Boolean))];
    const commentIds = [...new Set(rows.map(r => r.comment_id ? Number(r.comment_id) : null).filter(Boolean))];
    const [postsMap, commentsMap] = await Promise.all([
      serializePosts(postIds, v.id),
      serializeCommentsByIds(commentIds, v.id)
    ]);
    items = rows.map(r => {
      const base = r.kind === "comment"
        ? commentAsEntry(commentsMap.get(Number(r.comment_id)))
        : postsMap.get(Number(r.post_id));
      return base ? { ...base, searchScore: Number(r.interaction_score || 0) } : null;
    }).filter(Boolean);
  }

  return ok({
    query: rawQuery,
    tab,
    people,
    items,
    filters: { people: peopleMode, location: locationMode, viewerLocation, nearbyAvailable }
  });
}


async function trainerOverview(msg) {
  const v = await trainerViewer(msg.req);
  await processAnimationJobs();
  await ensureRoleSchema();
  const { rows } = await db().query(`SELECT
    (SELECT count(*) FROM users WHERE is_reaction_bot=true AND is_active=true)::int reaction_pool,
    (SELECT count(*) FROM animation_scores)::int scored_total,
    (SELECT count(*) FROM animation_scores WHERE trainer_id=$1)::int scored_by_me,
    (SELECT count(*) FROM animation_scores WHERE created_at >= date_trunc('day', now()))::int scored_today`, [v.id]);
  return ok({
    stats: rows[0],
    rubric: Object.entries(ANIMATION_RUBRIC).map(([score, r]) => ({ score:Number(score), label:r.label, description:r.description, likesMin:r.likes[0], likesMax:r.likes[1], retweetsMin:r.retweets[0], retweetsMax:r.retweets[1] }))
  });
}

async function trainerTargets(msg) {
  const v = await trainerViewer(msg.req);
  await processAnimationJobs();
  await ensureRoleSchema();
  await ensureSocialSchema();
  const q = String(msg.req?.query?.q || '').trim().slice(0,120);
  const kind = ['all','post','comment'].includes(String(msg.req?.query?.kind || 'all')) ? String(msg.req.query.kind || 'all') : 'all';
  const limit = Math.min(Math.max(Number(msg.req?.query?.limit || 80), 10), 160);
  const perType = Math.max(20, Math.ceil(limit / (kind === 'all' ? 2 : 1)));
  let postRows = [], commentRows = [];
  if (kind !== 'comment') {
    const r = await db().query(`SELECT p.id,p.created_at,s.score,s.likes_target,s.retweets_target,s.likes_added,s.retweets_added,s.created_at score_created_at,
      tu.username trainer_username,tu.display_name trainer_display_name
      FROM posts p JOIN users u ON u.id=p.user_id
      LEFT JOIN animation_scores s ON s.post_id=p.id
      LEFT JOIN users tu ON tu.id=s.trainer_id
      WHERE u.is_active=true AND u.is_reaction_bot=false
        AND ($1='' OR p.content ILIKE '%'||$1||'%' OR u.username ILIKE '%'||$1||'%' OR u.display_name ILIKE '%'||$1||'%')
      ORDER BY p.created_at DESC LIMIT $2`, [q, perType]);
    postRows = r.rows;
  }
  if (kind !== 'post') {
    const r = await db().query(`SELECT c.id,c.created_at,s.score,s.likes_target,s.retweets_target,s.likes_added,s.retweets_added,s.created_at score_created_at,
      tu.username trainer_username,tu.display_name trainer_display_name
      FROM comments c JOIN users u ON u.id=c.user_id
      LEFT JOIN animation_scores s ON s.comment_id=c.id
      LEFT JOIN users tu ON tu.id=s.trainer_id
      WHERE u.is_active=true AND u.is_reaction_bot=false
        AND ($1='' OR c.content ILIKE '%'||$1||'%' OR u.username ILIKE '%'||$1||'%' OR u.display_name ILIKE '%'||$1||'%')
      ORDER BY c.created_at DESC LIMIT $2`, [q, perType]);
    commentRows = r.rows;
  }
  const postIds = postRows.map(r=>Number(r.id));
  const commentIds = commentRows.map(r=>Number(r.id));
  const [postsMap,commentsMap] = await Promise.all([serializePosts(postIds,v.id),serializeCommentsByIds(commentIds,v.id)]);
  const makeScore = r => r.score ? {
    score:Number(r.score), likesTarget:Number(r.likes_target), retweetsTarget:Number(r.retweets_target), likesAdded:Number(r.likes_added), retweetsAdded:Number(r.retweets_added),
    createdAt:r.score_created_at, trainer:r.trainer_username ? {username:r.trainer_username,displayName:r.trainer_display_name} : null
  } : null;
  const items = [
    ...postRows.map(r=>({targetType:'post',targetId:Number(r.id),createdAt:r.created_at,item:postsMap.get(Number(r.id)),rating:makeScore(r)})),
    ...commentRows.map(r=>({targetType:'comment',targetId:Number(r.id),createdAt:r.created_at,item:commentAsEntry(commentsMap.get(Number(r.id))),rating:makeScore(r)}))
  ].filter(x=>x.item).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,limit);
  return ok({items});
}

async function trainerRate(msg) {
  const v = await trainerViewer(msg.req);
  await ensureRoleSchema();
  await ensureSocialSchema();
  await processAnimationJobs();
  const body = msg.payload || {};
  const targetType = body.targetType === 'comment' ? 'comment' : body.targetType === 'post' ? 'post' : '';
  const targetId = Number(body.targetId);
  const score = Number(body.score);
  if (!targetType || !targetId) throw new HttpError(400,'Contenu à noter invalide.');
  if (!Number.isInteger(score) || score < 1 || score > 10) throw new HttpError(400,'La note doit être comprise entre 1 et 10.');
  const rubric = ANIMATION_RUBRIC[score];
  const client = await db().connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1), (($2::bigint % 2147483647)::int))`, [targetType,targetId]);
    const scoreCheck = targetType === 'post'
      ? await client.query('SELECT id FROM animation_scores WHERE post_id=$1 LIMIT 1',[targetId])
      : await client.query('SELECT id FROM animation_scores WHERE comment_id=$1 LIMIT 1',[targetId]);
    if (scoreCheck.rowCount) throw new HttpError(409,'Ce contenu a déjà été noté dans le panneau Animation.');

    const target = targetType === 'post'
      ? await client.query(`SELECT p.id,p.user_id FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=$1 AND u.is_reaction_bot=false`,[targetId])
      : await client.query(`SELECT c.id,c.user_id FROM comments c JOIN users u ON u.id=c.user_id WHERE c.id=$1 AND u.is_reaction_bot=false`,[targetId]);
    if (!target.rowCount) throw new HttpError(404,'Contenu introuvable.');

    const pool = await client.query(`SELECT count(*)::int c FROM users WHERE is_reaction_bot=true AND is_active=true`);
    if (Number(pool.rows[0].c) < 60000) throw new HttpError(503,'Le pool de simulation doit contenir au moins 60 000 comptes. Appliquez la migration v0.4.1.');

    let currentLikes=0,currentRetweets=0;
    if (targetType === 'post') {
      const c = await client.query(`SELECT (SELECT count(*) FROM likes WHERE post_id=$1)::int likes,(SELECT count(*) FROM retweets WHERE post_id=$1)::int retweets`,[targetId]);
      currentLikes=Number(c.rows[0].likes); currentRetweets=Number(c.rows[0].retweets);
    } else {
      const c = await client.query(`SELECT (SELECT count(*) FROM comment_likes WHERE comment_id=$1)::int likes,(SELECT count(*) FROM comment_retweets WHERE comment_id=$1)::int retweets`,[targetId]);
      currentLikes=Number(c.rows[0].likes); currentRetweets=Number(c.rows[0].retweets);
    }

    const chooseTarget = (range,current) => {
      const [min,max] = range;
      if (current >= max) return current;
      return randomIntInclusive(Math.max(min,current),max);
    };
    const likesTarget = chooseTarget(rubric.likes,currentLikes);
    const retweetsTarget = chooseTarget(rubric.retweets,currentRetweets);

    if (targetType === 'post') await client.query(`INSERT INTO animation_scores(trainer_id,post_id,score,likes_target,retweets_target,likes_initial,retweets_initial,likes_added,retweets_added,started_at,completes_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,0,0,now(),now()+interval '60 seconds')`,[v.id,targetId,score,likesTarget,retweetsTarget,currentLikes,currentRetweets]);
    else await client.query(`INSERT INTO animation_scores(trainer_id,comment_id,score,likes_target,retweets_target,likes_initial,retweets_initial,likes_added,retweets_added,started_at,completes_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,0,0,now(),now()+interval '60 seconds')`,[v.id,targetId,score,likesTarget,retweetsTarget,currentLikes,currentRetweets]);
    await client.query('COMMIT');
    return ok({score,label:rubric.label,description:rubric.description,durationSeconds:60,scheduled:true,
      likes:{before:currentLikes,target:likesTarget,added:0,total:currentLikes},
      retweets:{before:currentRetweets,target:retweetsTarget,added:0,total:currentRetweets}});
  } catch(e) {
    await client.query('ROLLBACK'); throw e;
  } finally { client.release(); }
}

async function health() {
  const result = await db().query("SELECT now() server_time");
  return ok({ ok: true, service: "TFI@TTER", version: "0.5.0", database: "PostgreSQL", serverTime: result.rows[0].server_time });
}

module.exports = {
  HttpError, register, login, me, feed, createPost, updatePost, deletePost,
  toggleLike, toggleRetweet, comments, addComment, updateComment, deleteComment, toggleCommentLike, toggleCommentRetweet, quotePost, quoteComment, profile, profilePosts, profileFollowers, profileFollowing,
  toggleFollow, updateMe, suggestions, trends,
  notifications, markNotificationsRead, navCounts, messageConversations, messageThread, deleteConversation, sendMessage,
  adminOverview, adminUsers, adminCreateUser, adminUpdateUser, adminPosts, adminDeletePost,
  trainerOverview, trainerTargets, trainerRate,
  giphyConfig, searchSuggestions, search, health
};
