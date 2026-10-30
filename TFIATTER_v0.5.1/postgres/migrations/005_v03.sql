-- Migration TFI@TTER v0.2.1 -> v0.3 (idempotente)
-- Ajoute notifications, messages privés et jeu de démonstration dense.
-- Compatibilité : cette migration peut aussi rattraper directement une base v0.1 incomplètement migrée.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE posts ALTER COLUMN content TYPE TEXT;
ALTER TABLE comments ALTER COLUMN content TYPE TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE posts ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
UPDATE users SET is_admin=true,is_verified=true,is_active=true WHERE username='alice';

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('like','retweet','comment','follow')),
  post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
  comment_id BIGINT REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_event
  ON notifications(user_id, actor_id, type, COALESCE(post_id,0), COALESCE(comment_id,0));

CREATE TABLE IF NOT EXISTS direct_messages (
  id BIGSERIAL PRIMARY KEY,
  sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  CONSTRAINT no_self_message CHECK (sender_id <> recipient_id)
);
CREATE INDEX IF NOT EXISTS idx_dm_sender_created ON direct_messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_recipient_created ON direct_messages(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_recipient_unread ON direct_messages(recipient_id, read_at) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS demo_seed_meta (
  seed_key TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Les trois comptes historiques restent des comptes de démonstration et utilisent tous Demo1234!.
UPDATE users
SET password_hash = crypt('Demo1234!', gen_salt('bf', 12)),
    avatar_url = CASE username
      WHEN 'alice' THEN 'https://randomuser.me/api/portraits/women/1.jpg'
      WHEN 'karim' THEN 'https://randomuser.me/api/portraits/men/2.jpg'
      WHEN 'lucie' THEN 'https://randomuser.me/api/portraits/women/3.jpg'
      ELSE avatar_url END,
    is_active = true
WHERE username IN ('alice','karim','lucie');

UPDATE posts SET content='Bienvenue sur TFI@TTER 👋 La v0.3 ajoute du bruit de démonstration, les notifications, les messages privés et la déconnexion.', updated_at=now(), edited_at=NULL WHERE content LIKE 'Bienvenue sur TFI@TTER%';

-- 197 comptes supplémentaires : avec alice/karim/lucie, une installation neuve contient 200 profils de démonstration.
DO $$
DECLARE
  first_names text[] := ARRAY[
    'Amina','Hiroshi','Lucía','Kwame','Noura','Pavel','Thandiwe','João','Meilin','Arjun',
    'Fatou','Dmytro','Sofia','Omar','Yuna','Mateo','Inès','Samuel','Zeynep','Ilya',
    'Chloé','Idris','Priya','Lars','Aïssatou','Diego','Hana','Niko','Leïla','Chen',
    'Amara','Viktor','Salma','Tomas','Rania','Kenji','Mila','Bilal','Valentina','Sékou'
  ];
  first_keys text[] := ARRAY[
    'amina','hiroshi','lucia','kwame','noura','pavel','thandiwe','joao','meilin','arjun',
    'fatou','dmytro','sofia','omar','yuna','mateo','ines','samuel','zeynep','ilya',
    'chloe','idris','priya','lars','aissatou','diego','hana','niko','leila','chen',
    'amara','viktor','salma','tomas','rania','kenji','mila','bilal','valentina','sekou'
  ];
  last_names text[] := ARRAY[
    'Hassan','Tanaka','García','Mensah','Haddad','Novak','Ndlovu','Silva','Wang','Patel',
    'Diallo','Kovalenko','Rossi','Benali','Kim','Alvarez','Dubois','Okafor','Kaya','Petrov',
    'Martin','Keita','Sharma','Andersen','Sow','Romero','Sato','Jovanović','Mansour','Li',
    'Traoré','Horvat','Rahman','Costa','El Masri','Nakamura','Popescu','Bouzid','Fernández','Camara'
  ];
  bios text[] := ARRAY[
    'Café, photos et vie quotidienne.','Développement, données et logiciels libres.','Étudiant·e, lecture et musique.','Journal de bord sans prétention.',
    'Sport, voyages et beaucoup trop de playlists.','Architecture, villes et transports.','Cinéma, séries et photographie.','Cuisine maison et bonnes adresses.',
    'Actualité internationale et cartes.','Science, espace et curiosités.','Design, typographie et produits numériques.','Football, running et week-ends dehors.',
    'Livres, histoire et musées.','Entrepreneuriat, économie et tech.','Nature, randonnée et météo.','Jeux vidéo, hardware et culture web.',
    'Langues, voyages et rencontres.','Musique live et radio.','Art, illustration et culture.','Compte personnel — opinions diverses.'
  ];
  locations text[] := ARRAY[
    'Paris, France','Dakar, Sénégal','Tokyo, Japon','Montréal, Canada','Bruxelles, Belgique','Lagos, Nigeria','Lisbonne, Portugal','Séoul, Corée du Sud','Beyrouth, Liban','Berlin, Allemagne',
    'Nairobi, Kenya','Madrid, Espagne','Istanbul, Türkiye','São Paulo, Brésil','Delhi, Inde','Tunis, Tunisie','Varsovie, Pologne','Abidjan, Côte d’Ivoire','Osaka, Japon','Mexico, Mexique'
  ];
  demo_hash text := crypt('Demo1234!', gen_salt('bf', 12));
  gs integer;
  fi integer;
  li integer;
  uname text;
  avatar text;
BEGIN
  FOR gs IN 4..200 LOOP
    fi := ((gs - 4) % array_length(first_names,1)) + 1;
    li := (((gs - 4) * 7) % array_length(last_names,1)) + 1;
    uname := first_keys[fi] || '_' || lpad(gs::text,3,'0');
    avatar := format('https://randomuser.me/api/portraits/%s/%s.jpg', CASE WHEN gs % 2 = 0 THEN 'women' ELSE 'men' END, (gs - 1) % 100);
    INSERT INTO users(username,display_name,email,password_hash,bio,location,avatar_url,is_admin,is_verified,is_active,created_at)
    VALUES (
      uname,
      first_names[fi] || ' ' || last_names[li],
      uname || '@tfiatter.local',
      demo_hash,
      bios[((gs * 3) % array_length(bios,1)) + 1],
      locations[((gs * 5) % array_length(locations,1)) + 1],
      avatar,
      false,
      (gs % 31 = 0),
      true,
      now() - make_interval(days => (gs * 13) % 900)
    )
    ON CONFLICT (username) DO NOTHING;
  END LOOP;
END $$;

-- Environ 1000 TFI@Ts de démonstration, ajoutés une seule fois.
WITH mark AS (
  INSERT INTO demo_seed_meta(seed_key) VALUES ('v0.3-posts-1000')
  ON CONFLICT DO NOTHING RETURNING 1
),
u AS (
  SELECT id, row_number() OVER (ORDER BY id) rn, count(*) OVER () cnt
  FROM users WHERE is_active=true
),
g AS (SELECT generate_series(1,1000) n),
base AS (
  SELECT ARRAY[
    'Matin calme, café fort et une longue liste de choses à faire.',
    'Quelqu’un a une bonne recommandation de livre pour ce week-end ?',
    'La lumière ce soir est incroyable. J’aurais dû prendre mon appareil photo.',
    'Je teste une nouvelle routine de travail : notifications coupées pendant deux heures.',
    'Petite victoire du jour : enfin terminé ce dossier qui traînait depuis une semaine.',
    'Il pleut depuis ce matin et pourtant la ville a un certain charme comme ça.',
    'Retour de train. Batterie à 8 %, café à 100 %.',
    'Je découvre un quartier que je connaissais à peine. Très bonne surprise.',
    'Les meilleures idées arrivent toujours au moment où on n’a rien pour les noter.',
    'Pause déjeuner beaucoup trop tardive, mais ça valait le coup.',
    'Nouveau clavier au bureau. Le bruit des touches va finir par rendre mes collègues fous.',
    'Je viens de passer vingt minutes à chercher un fichier qui était sur mon bureau.',
    'Aujourd’hui : lecture, marche et aucun agenda. Ça fait du bien.',
    'Un bon café et une carte ouverte sur l’écran : programme de la soirée.',
    'Je ne pensais pas passer autant de temps sur ce petit projet perso.',
    'Le train est à l’heure. Événement suffisamment rare pour être signalé.',
    'Question du soir : plutôt film, série ou documentaire ?',
    'La playlist aléatoire vient de ressortir un morceau oublié depuis dix ans.',
    'Le marché du dimanche matin reste une valeur sûre.',
    'Je crois que mon téléphone connaît mieux mes habitudes que moi.',
    'Working from a quiet café today. Surprisingly productive.',
    'Small walk after work. Best decision of the day.',
    'Hoy toca cocinar algo sencillo y desconectar un rato.',
    'Bom dia. Café pronto, janela aberta, dia começando.',
    '今日は少しゆっくり。コーヒーを飲みながら読書。',
    'Un ciel parfaitement dégagé ce matin. Ça change tout.',
    'Premier essai avec PostgreSQL aujourd’hui : très propre une fois les habitudes prises.',
    'Node-RED est vraiment pratique pour visualiser rapidement les flux d’une API.',
    'J’ai rangé mon bureau. Je donne vingt-quatre heures avant le retour du chaos.',
    'Toujours impressionné par la quantité de choses qu’on peut apprendre en une heure bien concentrée.',
    'Quel match hier soir. Impossible de décrocher avant la fin.',
    'Je prépare un trajet pour le mois prochain. Les cartes sont déjà ouvertes partout.',
    'C’est fou comme une simple photo peut ramener des souvenirs très précis.',
    'Journée réunions. Demain, j’espère pouvoir réellement travailler.',
    'Une idée de recette simple avec ce qu’on trouve au fond d’un placard ?',
    'Rien de spectaculaire aujourd’hui, juste une bonne journée.',
    'Je viens de mettre à jour mon profil. Cette photo restera probablement six mois.',
    'Le réseau est calme ce soir. Parfait pour lire un peu.',
    'Ce projet prend forme plus vite que prévu. Prochaine étape : nettoyer les détails.',
    'Je pensais faire une pause de dix minutes. Une heure plus tard…'
  ]::text[] t
)
INSERT INTO posts(user_id,content,created_at,updated_at)
SELECT u.id,
       base.t[((g.n * 11) % array_length(base.t,1)) + 1]
       || CASE WHEN g.n % 17 = 0 THEN ' #tech' WHEN g.n % 23 = 0 THEN ' #photo' WHEN g.n % 29 = 0 THEN ' #quotidien' ELSE '' END,
       now() - make_interval(hours => (g.n * 13) % 720, mins => (g.n * 17) % 60),
       now() - make_interval(hours => (g.n * 13) % 720, mins => (g.n * 17) % 60)
FROM g
JOIN u ON u.rn = (((g.n * 37) - 1) % u.cnt) + 1
CROSS JOIN base
WHERE EXISTS (SELECT 1 FROM mark);

-- Abonnements de démonstration : environ 8 par compte.
WITH mark AS (
  INSERT INTO demo_seed_meta(seed_key) VALUES ('v0.3-follows')
  ON CONFLICT DO NOTHING RETURNING 1
), us AS (
  SELECT id,row_number() OVER (ORDER BY id) rn,count(*) OVER () cnt FROM users WHERE is_active=true
)
INSERT INTO follows(follower_id,following_id,created_at)
SELECT a.id,b.id,now()-make_interval(days => ((a.rn*3+k*5)::int % 120))
FROM us a CROSS JOIN generate_series(1,8) k CROSS JOIN us b
WHERE b.rn = (((a.rn + k*17) - 1) % a.cnt) + 1
  AND a.id<>b.id AND EXISTS(SELECT 1 FROM mark)
ON CONFLICT DO NOTHING;

-- Likes de démonstration.
WITH mark AS (
  INSERT INTO demo_seed_meta(seed_key) VALUES ('v0.3-likes') ON CONFLICT DO NOTHING RETURNING 1
), us AS (
  SELECT id,row_number() OVER (ORDER BY id) rn,count(*) OVER () cnt FROM users WHERE is_active=true
), ps AS (
  SELECT id,row_number() OVER (ORDER BY id) rn,count(*) OVER () cnt FROM posts
), g AS (SELECT generate_series(1,2600) n)
INSERT INTO likes(user_id,post_id,created_at)
SELECT u.id,p.id,now()-make_interval(hours => (g.n*7)%650)
FROM g
JOIN us u ON u.rn=(((g.n*19)-1)%u.cnt)+1
JOIN ps p ON p.rn=(((g.n*43)-1)%p.cnt)+1
WHERE EXISTS(SELECT 1 FROM mark)
ON CONFLICT DO NOTHING;

-- Retweets de démonstration.
WITH mark AS (
  INSERT INTO demo_seed_meta(seed_key) VALUES ('v0.3-retweets') ON CONFLICT DO NOTHING RETURNING 1
), us AS (
  SELECT id,row_number() OVER (ORDER BY id) rn,count(*) OVER () cnt FROM users WHERE is_active=true
), ps AS (
  SELECT id,user_id,row_number() OVER (ORDER BY id) rn,count(*) OVER () cnt FROM posts
), g AS (SELECT generate_series(1,420) n)
INSERT INTO retweets(user_id,post_id,created_at)
SELECT u.id,p.id,now()-make_interval(hours => (g.n*11)%600)
FROM g
JOIN us u ON u.rn=(((g.n*23)-1)%u.cnt)+1
JOIN ps p ON p.rn=(((g.n*47)-1)%p.cnt)+1
WHERE u.id<>p.user_id AND EXISTS(SELECT 1 FROM mark)
ON CONFLICT DO NOTHING;

-- Réponses de démonstration.
WITH mark AS (
  INSERT INTO demo_seed_meta(seed_key) VALUES ('v0.3-comments') ON CONFLICT DO NOTHING RETURNING 1
), us AS (
  SELECT id,row_number() OVER (ORDER BY id) rn,count(*) OVER () cnt FROM users WHERE is_active=true
), ps AS (
  SELECT id,row_number() OVER (ORDER BY id) rn,count(*) OVER () cnt FROM posts
), g AS (SELECT generate_series(1,260) n), replies AS (
  SELECT ARRAY[
    'Je suis assez d’accord.','Pas faux du tout.','Ça me donne envie de tester.','Merci pour le partage !','Même constat ici.',
    'Intéressant, je n’avais pas vu ça comme ça.','Très bonne idée.','Ça résume bien la journée.','Je note pour plus tard.','Exactement !',
    'Tu recommandes quoi pour commencer ?','Ça mérite clairement un deuxième café.','J’ai eu la même expérience récemment.','Belle photo mentale 😄','Bon courage pour la suite.'
  ]::text[] r
)
INSERT INTO comments(post_id,user_id,content,created_at)
SELECT p.id,u.id,replies.r[((g.n*5)%array_length(replies.r,1))+1],now()-make_interval(hours => (g.n*9)%500)
FROM g
JOIN us u ON u.rn=(((g.n*13)-1)%u.cnt)+1
JOIN ps p ON p.rn=(((g.n*31)-1)%p.cnt)+1
CROSS JOIN replies
WHERE EXISTS(SELECT 1 FROM mark);

-- Quelques conversations privées, notamment pour Alice.
WITH mark AS (
  INSERT INTO demo_seed_meta(seed_key) VALUES ('v0.3-direct-messages') ON CONFLICT DO NOTHING RETURNING 1
), alice AS (
  SELECT id FROM users WHERE username='alice'
), others AS (
  SELECT id,row_number() OVER (ORDER BY id) rn FROM users WHERE username<>'alice' AND is_active=true LIMIT 40
), g AS (SELECT generate_series(1,90) n), texts AS (
  SELECT ARRAY[
    'Salut ! Tu as vu les dernières modifications du réseau ?',
    'Je t’envoie ça ici plutôt que dans le fil public.',
    'Merci pour ton message, je regarde ça dans la soirée.',
    'Tu peux me confirmer que tu as bien reçu ?',
    'Oui, parfait pour moi.',
    'Je reviens vers toi demain matin.',
    'Petite question : tu as deux minutes ?',
    'Super, merci !',
    'Je viens de tester, ça fonctionne chez moi.',
    'On garde ça en privé pour le moment.'
  ]::text[] t
)
INSERT INTO direct_messages(sender_id,recipient_id,content,created_at,read_at)
SELECT CASE WHEN g.n%2=0 THEN o.id ELSE a.id END,
       CASE WHEN g.n%2=0 THEN a.id ELSE o.id END,
       texts.t[((g.n*3)%array_length(texts.t,1))+1],
       now()-make_interval(hours => (g.n*4)%240),
       CASE WHEN g.n%9=0 THEN NULL ELSE now()-make_interval(hours => GREATEST(((g.n*4)%240)-1,0)) END
FROM g CROSS JOIN alice a CROSS JOIN others o CROSS JOIN texts
WHERE o.rn=((g.n-1)%40)+1 AND EXISTS(SELECT 1 FROM mark);

-- Notifications initiales dérivées d’un échantillon des interactions.
WITH mark AS (
  INSERT INTO demo_seed_meta(seed_key) VALUES ('v0.3-notifications') ON CONFLICT DO NOTHING RETURNING 1
)
INSERT INTO notifications(user_id,actor_id,type,post_id,created_at,read_at)
SELECT p.user_id,l.user_id,'like',l.post_id,l.created_at,CASE WHEN l.created_at < now()-interval '2 days' THEN l.created_at+interval '4 hours' END
FROM likes l JOIN posts p ON p.id=l.post_id
WHERE l.user_id<>p.user_id AND EXISTS(SELECT 1 FROM mark)
ON CONFLICT DO NOTHING;

INSERT INTO notifications(user_id,actor_id,type,post_id,created_at,read_at)
SELECT p.user_id,r.user_id,'retweet',r.post_id,r.created_at,CASE WHEN r.created_at < now()-interval '2 days' THEN r.created_at+interval '3 hours' END
FROM retweets r JOIN posts p ON p.id=r.post_id
WHERE r.user_id<>p.user_id
ON CONFLICT DO NOTHING;

INSERT INTO notifications(user_id,actor_id,type,post_id,comment_id,created_at,read_at)
SELECT p.user_id,c.user_id,'comment',c.post_id,c.id,c.created_at,CASE WHEN c.created_at < now()-interval '2 days' THEN c.created_at+interval '2 hours' END
FROM comments c JOIN posts p ON p.id=c.post_id
WHERE c.user_id<>p.user_id
ON CONFLICT DO NOTHING;

INSERT INTO notifications(user_id,actor_id,type,created_at,read_at)
SELECT f.following_id,f.follower_id,'follow',f.created_at,CASE WHEN f.created_at < now()-interval '2 days' THEN f.created_at+interval '2 hours' END
FROM follows f
ON CONFLICT DO NOTHING;
