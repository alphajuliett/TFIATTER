-- TFI@TTER v0.4.0 — jeu de démonstration massif et interactif
-- Idempotent via demo_seed_meta. Mot de passe des comptes de démonstration : Demo1234!
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Rattrapage minimal si le volume provient d'une version ancienne.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS quote_post_id BIGINT REFERENCES posts(id) ON DELETE SET NULL;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS quote_comment_id BIGINT REFERENCES comments(id) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS comment_likes (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_id BIGINT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, comment_id)
);
CREATE TABLE IF NOT EXISTS comment_retweets (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_id BIGINT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, comment_id)
);
CREATE TABLE IF NOT EXISTS comment_media (
  id BIGSERIAL PRIMARY KEY,
  comment_id BIGINT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  original_name VARCHAR(180) NOT NULL DEFAULT 'fichier',
  sort_order SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS demo_seed_meta (
  seed_key TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retweets_created ON retweets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comment_retweets_created ON comment_retweets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comment_likes_created ON comment_likes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at DESC);

-- 1) Compléter le réseau jusqu'à 3 200 comptes de démonstration.
DO $$
DECLARE
  demo_hash text := crypt('Demo1234!', gen_salt('bf', 12));
  first_names text[] := ARRAY[
    'Amina','Hiroshi','Lucía','Kwame','Noura','Pavel','Thandiwe','João','Meilin','Arjun','Fatou','Dmytro','Sofia','Omar','Yuna','Mateo','Inès','Samuel','Zeynep','Ilya',
    'Chloé','Idris','Priya','Lars','Aïssatou','Diego','Hana','Niko','Leïla','Chen','Amara','Viktor','Salma','Tomas','Rania','Kenji','Maya','Noah','Elena','Bilal',
    'Camila','Youssef','Nadia','Rafael','Anika','Moussa','Eva','David','Nina','Malik','Aya','Jonas','Mina','Arthur','Lina','Said','Marta','Adem','Ruth','Gabriel'
  ];
  first_keys text[] := ARRAY[
    'amina','hiro','lucia','kwame','noura','pavel','thandi','joao','meilin','arjun','fatou','dmytro','sofia','omar','yuna','mateo','ines','samuel','zeynep','ilya',
    'chloe','idris','priya','lars','aissatou','diego','hana','niko','leila','chen','amara','viktor','salma','tomas','rania','kenji','maya','noah','elena','bilal',
    'camila','youssef','nadia','rafael','anika','moussa','eva','david','nina','malik','aya','jonas','mina','arthur','lina','said','marta','adem','ruth','gabriel'
  ];
  last_names text[] := ARRAY[
    'Benali','Sato','Morales','Mensah','Haddad','Novak','Dlamini','Silva','Zhang','Patel','Diop','Koval','Rossi','Farouk','Kim','Romero','Laurent','Okafor','Demir','Petrov',
    'Dubois','Diallo','Nair','Andersen','Traoré','Santos','Tanaka','Jovanović','Bensaïd','Wang','Ndiaye','Horvat','Mansour','Kowalski','Gomes','Ibrahim','Müller','Martin','Kaya','Fernández',
    'Costa','Abdallah','Moretti','Owusu','Pereira','Nguyen','Brown','Yilmaz','Smirnov','Cohen','López','Bauer','Sow','Ramos','Park','Meyer','Kone','Ivanov','Bennett','Ali'
  ];
  bios text[] := ARRAY[
    'Photo, musique et petits bouts de quotidien.','Développement, automatisation et café.','Journaliste indépendant, curieux de tout.','Études, sport et beaucoup de lecture.',
    'Design, produits numériques et typographie.','Cartes, transports et villes.','Cinéma, photographie et voyages.','Cuisine maison, amis et bonnes adresses.',
    'Actualité internationale et géopolitique.','Science, espace et curiosités.','Football, course et week-ends dehors.','Livres, histoire et musées.',
    'Économie, entreprises et technologies.','Nature, randonnée et météo.','Jeux vidéo, hardware et culture web.','Langues, voyages et rencontres.',
    'Musique live, radio et podcasts.','Art, illustration et culture.','Compte personnel, opinions personnelles.','Des idées, des liens et parfois des photos.'
  ];
  locations text[] := ARRAY[
    'Paris, France','Lyon, France','Nancy, France','Dakar, Sénégal','Abidjan, Côte d’Ivoire','Bamako, Mali','Niamey, Niger','Ouagadougou, Burkina Faso','Lagos, Nigeria','Nairobi, Kenya',
    'Tunis, Tunisie','Rabat, Maroc','Beyrouth, Liban','Istanbul, Türkiye','Berlin, Allemagne','Bruxelles, Belgique','Madrid, Espagne','Lisbonne, Portugal','Varsovie, Pologne','Rome, Italie',
    'Montréal, Canada','New York, États-Unis','São Paulo, Brésil','Mexico, Mexique','Tokyo, Japon','Osaka, Japon','Séoul, Corée du Sud','Delhi, Inde','Singapore','Sydney, Australie'
  ];
  gs integer;
  fi integer;
  li integer;
  uname text;
  avatar text;
BEGIN
  IF EXISTS (SELECT 1 FROM demo_seed_meta WHERE seed_key='v0.4-users-3200') THEN
    RETURN;
  END IF;

  FOR gs IN 201..3200 LOOP
    fi := ((gs * 17) % array_length(first_names,1)) + 1;
    li := ((gs * 29) % array_length(last_names,1)) + 1;
    uname := first_keys[fi] || '_' || lpad(gs::text,4,'0');
    avatar := format('https://randomuser.me/api/portraits/%s/%s.jpg', CASE WHEN gs % 2=0 THEN 'women' ELSE 'men' END, (gs * 7) % 100);
    INSERT INTO users(username,display_name,email,password_hash,bio,location,website,avatar_url,banner_url,is_admin,is_verified,is_active,created_at,updated_at)
    VALUES (
      uname,
      first_names[fi] || ' ' || last_names[li],
      uname || '@tfiatter.local',
      demo_hash,
      bios[((gs * 11) % array_length(bios,1)) + 1],
      locations[((gs * 13) % array_length(locations,1)) + 1],
      CASE WHEN gs % 19=0 THEN 'https://example.com/' || uname ELSE '' END,
      avatar,
      CASE WHEN gs % 113=0 THEN 'https://picsum.photos/seed/banner-' || gs || '/1500/500' ELSE NULL END,
      false,
      (gs % 113 = 0),
      true,
      now() - make_interval(days => (gs * 31) % 1800),
      now()
    ) ON CONFLICT (username) DO NOTHING;
  END LOOP;

  INSERT INTO demo_seed_meta(seed_key) VALUES ('v0.4-users-3200') ON CONFLICT DO NOTHING;
END $$;

-- Tous les comptes de démonstration ont le même mot de passe demandé.
-- Le hash bcrypt n'est calculé qu'une seule fois pour éviter 3 200 calculs coûteux.
DO $$
DECLARE demo_hash text := crypt('Demo1234!', gen_salt('bf', 12));
BEGIN
  UPDATE users SET password_hash=demo_hash, is_active=true WHERE email LIKE '%@tfiatter.local';
END $$;

-- Garder très peu de hashtags : nettoyage uniquement des hashtags des anciens seeds connus.
UPDATE posts p SET content = btrim(replace(replace(replace(replace(replace(replace(p.content,
  '#NodeRED',''),'#PostgreSQL',''),'#OpenSource',''),'#tech',''),'#photo',''),'#quotidien',''))
FROM users u
WHERE p.user_id=u.id AND u.email LIKE '%@tfiatter.local'
  AND (p.content LIKE '%#NodeRED%' OR p.content LIKE '%#PostgreSQL%' OR p.content LIKE '%#OpenSource%' OR p.content LIKE '%#tech%' OR p.content LIKE '%#photo%' OR p.content LIKE '%#quotidien%');

-- 2) Graphe social dense et partiellement réciproque.
WITH mark AS (
  INSERT INTO demo_seed_meta(seed_key) VALUES ('v0.4-mutual-follows') ON CONFLICT DO NOTHING RETURNING 1
), us AS (
  SELECT id,row_number() OVER (ORDER BY id) rn,count(*) OVER () cnt
  FROM users WHERE is_active=true AND email LIKE '%@tfiatter.local'
), offsets AS (
  SELECT x FROM generate_series(-8,8) x WHERE x<>0
)
INSERT INTO follows(follower_id,following_id,created_at)
SELECT a.id,b.id,now()-make_interval(days => ((a.rn*5+abs(o.x)*7)::int % 260))
FROM us a CROSS JOIN offsets o
JOIN us b ON b.rn = (((a.rn - 1 + o.x + a.cnt) % a.cnt) + 1)
WHERE a.id<>b.id AND EXISTS(SELECT 1 FROM mark)
ON CONFLICT DO NOTHING;

WITH mark AS (
  INSERT INTO demo_seed_meta(seed_key) VALUES ('v0.4-extra-follows') ON CONFLICT DO NOTHING RETURNING 1
), us AS (
  SELECT id,row_number() OVER (ORDER BY id) rn,count(*) OVER () cnt
  FROM users WHERE is_active=true AND email LIKE '%@tfiatter.local'
)
INSERT INTO follows(follower_id,following_id,created_at)
SELECT a.id,b.id,now()-make_interval(days => ((a.rn*11+k*3)::int % 220))
FROM us a CROSS JOIN generate_series(1,18) k
JOIN us b ON b.rn = ((((a.rn*37 + k*131) - 1) % a.cnt) + 1)
WHERE a.id<>b.id AND EXISTS(SELECT 1 FROM mark)
ON CONFLICT DO NOTHING;

-- Chaque compte certifié reçoit au moins 1 200 abonnés issus des comptes de démonstration.
WITH mark AS (
  INSERT INTO demo_seed_meta(seed_key) VALUES ('v0.4-verified-followers') ON CONFLICT DO NOTHING RETURNING 1
), verified AS (
  SELECT id FROM users WHERE is_active=true AND is_verified=true
)
INSERT INTO follows(follower_id,following_id,created_at)
SELECT followers.id, v.id, now()-make_interval(days => ((followers.id+v.id)::int % 180))
FROM verified v
CROSS JOIN LATERAL (
  SELECT u.id
  FROM users u
  WHERE u.is_active=true AND u.email LIKE '%@tfiatter.local' AND u.id<>v.id
  ORDER BY md5(u.id::text || ':' || v.id::text)
  LIMIT 1200
) followers
WHERE EXISTS(SELECT 1 FROM mark)
ON CONFLICT DO NOTHING;

-- 3) 14 000 TFI@Ts supplémentaires, quasiment sans hashtags.
WITH mark AS (
  INSERT INTO demo_seed_meta(seed_key) VALUES ('v0.4-base-posts-14000') ON CONFLICT DO NOTHING RETURNING 1
), us AS (
  SELECT id,row_number() OVER (ORDER BY id) rn,count(*) OVER () cnt
  FROM users WHERE is_active=true AND email LIKE '%@tfiatter.local'
), g AS (SELECT generate_series(1,14000) n), corpus AS (
  SELECT
    ARRAY[
      'Matin tranquille, café chaud et quelques mails à traiter.','Je pensais sortir dix minutes, la balade a finalement duré deux heures.','Quelqu’un a une bonne recommandation de livre pour ce week-end ?',
      'Journée très productive, ce qui était loin d’être gagné au réveil.','La lumière ce soir est incroyable.','Je redécouvre un album que je n’avais pas écouté depuis des années.',
      'Petite pause avant de reprendre.','Le train est étonnamment à l’heure aujourd’hui.','Je viens enfin de terminer ce dossier qui traînait depuis trop longtemps.','Le meilleur moment de la journée : rentrer et ne plus avoir d’agenda.',
      'Je teste une nouvelle organisation de travail cette semaine.','Il pleut depuis ce matin mais la ville a un charme particulier comme ça.','Une idée de recette simple pour ce soir ?','Je découvre un quartier que je connaissais à peine.',
      'Je viens de passer vingt minutes à chercher un fichier qui était sous mes yeux.','Question du soir : film, série ou documentaire ?','La playlist aléatoire vient de ressortir un morceau oublié.','Le marché du dimanche matin reste une valeur sûre.',
      'Ce petit projet perso prend beaucoup plus de temps que prévu, mais ça avance.','Un bon café et une carte ouverte sur l’écran : programme parfait.','J’ai rangé mon bureau. On verra combien de temps ça tient.','Beaucoup de réunions aujourd’hui, peu de temps pour travailler.',
      'Rien de spectaculaire aujourd’hui, juste une bonne journée.','Je crois que mon téléphone connaît mieux mes habitudes que moi.','Une heure bien concentrée vaut parfois une demi-journée entière.','Quel match hier soir, impossible de décrocher avant la fin.',
      'Je prépare un trajet pour le mois prochain et j’ai déjà dix onglets de cartes ouverts.','C’est fou comme une photo peut ramener des souvenirs très précis.','La météo donne envie de rester à l’intérieur avec un livre.','Je teste un nouvel appareil photo ce week-end.',
      'Les transports étaient presque fluides ce matin. Presque.','Je découvre encore des fonctions utiles dans un logiciel que j’utilise depuis des mois.','Pause déjeuner beaucoup trop tardive.','Working from a quiet café today. Surprisingly productive.',
      'Small walk after work. Best decision of the day.','Hoy toca cocinar algo sencillo y desconectar un rato.','Bom dia. Café pronto, janela aberta, dia começando.','今日は少しゆっくり。コーヒーを飲みながら読書。',
      'Je pensais avoir une idée brillante, puis j’ai relu mes notes.','La ville est vraiment différente très tôt le matin.','J’ai besoin d’une nouvelle playlist pour travailler.','Le café de cet endroit est meilleur que dans mon souvenir.',
      'Je prends enfin le temps de trier mes photos. Mauvaise idée : il y en a des milliers.','Encore une journée où la batterie externe sauve la situation.','Le retour à pied valait clairement mieux que le métro.','Je me suis lancé dans un rangement qui était censé durer quinze minutes.',
      'Il y a des jours où tout avance sans résistance. Profitons-en.','Je note ici pour ne pas oublier : vérifier ça demain matin.','Je viens de découvrir une petite librairie incroyable.','Une conversation intéressante peut complètement changer une journée.',
      'Quelqu’un utilise encore un réveil classique plutôt que son téléphone ?','Je n’avais pas prévu de cuisiner autant ce soir.','La terrasse était une excellente idée malgré le vent.','Lecture du soir terminée beaucoup trop tard.',
      'Je teste un nouveau trajet pour éviter les travaux.','Le son de la pluie sur les fenêtres, c’est quand même quelque chose.','Je ne sais pas qui avait besoin de lire ça, mais sauvegardez vos fichiers.','Le niveau de batterie est devenu mon principal indicateur de stress.',
      'J’ai retrouvé une vieille photo dans mes archives.','Parfois il suffit de changer de pièce pour retrouver de la concentration.','Journée calme sur le papier, beaucoup moins dans la réalité.','Je commence enfin ce livre acheté il y a six mois.'
    ]::text[] a,
    ARRAY['',' ☕',' 🙂',' 👀',' 📚',' 🎧',' 📷',' ✨',' 😅',' 👍',' 🌧️',' 🚆']::text[] e
)
INSERT INTO posts(user_id,content,created_at,updated_at)
SELECT u.id,
       corpus.a[((g.n*23)%array_length(corpus.a,1))+1] || corpus.e[((g.n*7)%array_length(corpus.e,1))+1],
       now()-make_interval(mins => ((g.n*97)%129600)::int),
       now()-make_interval(mins => ((g.n*97)%129600)::int)
FROM g
JOIN us u ON u.rn=((((g.n*53)-1)%u.cnt)+1)
CROSS JOIN corpus
WHERE EXISTS(SELECT 1 FROM mark);

-- 4) Réponses nombreuses.
WITH mark AS (
  INSERT INTO demo_seed_meta(seed_key) VALUES ('v0.4-comments-22000') ON CONFLICT DO NOTHING RETURNING 1
), us AS (
  SELECT id,row_number() OVER (ORDER BY id) rn,count(*) OVER () cnt FROM users WHERE is_active=true AND email LIKE '%@tfiatter.local'
), ps AS (
  SELECT p.id,p.user_id,row_number() OVER (ORDER BY p.id) rn,count(*) OVER () cnt
  FROM posts p JOIN users u ON u.id=p.user_id WHERE u.email LIKE '%@tfiatter.local'
), g AS (SELECT generate_series(1,22000) n), replies AS (
  SELECT ARRAY[
    'Je suis assez d’accord.','Pas faux du tout.','Même constat ici.','Merci pour le partage !','Je note ça.','Ça me donne envie de tester.','Exactement.','Très bonne idée.','Je n’avais pas vu ça comme ça.',
    'Ça résume bien la journée.','Tu recommandes quoi pour commencer ?','J’ai eu la même expérience récemment.','Je valide complètement.','Ça mérite clairement un deuxième café.','Je vais regarder ça.',
    'C’est drôle, je me suis fait exactement la même réflexion.','Pas certain de partager cet avis, mais intéressant.','Tu as une source ou un lien là-dessus ?','Ça dépend vraiment du contexte.','Je garde l’idée pour plus tard.',
    'Oui, et ça change beaucoup de choses.','Je pensais être le seul à faire ça.','Très juste.','Ça me rappelle une discussion récente.','Je suis curieux de voir la suite.','Bon courage pour la suite !','Même problème chez moi.',
    'Je confirme, ça fonctionne plutôt bien.','Ça vaut le coup d’essayer.','Tu m’as convaincu.','Je vais tester ce week-end.','La photo est superbe.','Le timing est parfait.','C’est exactement le genre de détail qui fait la différence.',
    'Pas bête du tout.','Je ne suis pas totalement convaincu.','Ça se discute.','Merci, je cherchais justement ça.','Ça fait plaisir à lire.','Le genre de message simple mais efficace.'
  ]::text[] r
)
INSERT INTO comments(post_id,user_id,content,created_at)
SELECT p.id,u.id,replies.r[((g.n*19)%array_length(replies.r,1))+1],
       LEAST(now()-make_interval(mins => ((g.n*7)%120)::int), GREATEST(p_created.created_at + make_interval(mins => ((g.n*13)%2400)::int), now()-interval '90 days'))
FROM g
JOIN us u ON u.rn=((((g.n*71)-1)%u.cnt)+1)
JOIN ps p ON p.rn=((((g.n*43)-1)%p.cnt)+1)
JOIN posts p_created ON p_created.id=p.id
CROSS JOIN replies
WHERE u.id<>p.user_id AND EXISTS(SELECT 1 FROM mark);

-- 5) 5 500 citations (nouveaux TFI@Ts liés à des messages originaux).
WITH mark AS (
  INSERT INTO demo_seed_meta(seed_key) VALUES ('v0.4-quotes-5500') ON CONFLICT DO NOTHING RETURNING 1
), us AS (
  SELECT id,row_number() OVER (ORDER BY id) rn,count(*) OVER () cnt FROM users WHERE is_active=true AND email LIKE '%@tfiatter.local'
), ps AS (
  SELECT p.id,p.user_id,row_number() OVER (ORDER BY p.id) rn,count(*) OVER () cnt
  FROM posts p JOIN users u ON u.id=p.user_id WHERE u.email LIKE '%@tfiatter.local' AND p.quote_post_id IS NULL AND p.quote_comment_id IS NULL
), g AS (SELECT generate_series(1,5500) n), quotes AS (
  SELECT ARRAY[
    'C’est exactement ça.','À lire, le point est intéressant.','Je partage ça ici parce que la discussion vaut le détour.','Pas totalement d’accord, mais le sujet mérite qu’on s’y arrête.',
    'Ça résume assez bien ce que je pensais.','Je garde ça ici.','Le détail important est là.','Intéressant de voir les réactions sur ce sujet.','Je n’aurais pas mieux formulé.',
    'Voilà une perspective que je trouve utile.','Je partage sans forcément approuver tout le message.','Ça me fait penser à une discussion d’hier.','À méditer.','Je suis curieux de savoir ce que vous en pensez.',
    'Ce passage mérite d’être repris.','Je reviens là-dessus parce que c’est pertinent.','On en parle peu, pourtant le point est important.','Je mets ça de côté pour plus tard.'
  ]::text[] q
)
INSERT INTO posts(user_id,content,created_at,updated_at,quote_post_id)
SELECT u.id,quotes.q[((g.n*11)%array_length(quotes.q,1))+1],
       now()-make_interval(mins => ((g.n*37)%86400)::int),
       now()-make_interval(mins => ((g.n*37)%86400)::int),
       p.id
FROM g
JOIN us u ON u.rn=((((g.n*59)-1)%u.cnt)+1)
JOIN ps p ON p.rn=((((g.n*83)-1)%p.cnt)+1)
CROSS JOIN quotes
WHERE u.id<>p.user_id AND EXISTS(SELECT 1 FROM mark);

-- 6) Médias : plusieurs milliers d'images, GIFs et vidéos.
WITH mark AS (
  INSERT INTO demo_seed_meta(seed_key) VALUES ('v0.4-images-3200') ON CONFLICT DO NOTHING RETURNING 1
), ps AS (
  SELECT p.id,row_number() OVER (ORDER BY p.id DESC) rn,count(*) OVER () cnt
  FROM posts p JOIN users u ON u.id=p.user_id WHERE u.email LIKE '%@tfiatter.local'
), g AS (SELECT generate_series(1,3200) n)
INSERT INTO post_media(post_id,url,mime_type,original_name,sort_order)
SELECT p.id,'https://picsum.photos/seed/tfiatter-'||p.id||'/1200/800','image/jpeg','photo-'||p.id||'.jpg',0
FROM g JOIN ps p ON p.rn=((((g.n*47)-1)%p.cnt)+1)
WHERE EXISTS(SELECT 1 FROM mark);

WITH mark AS (
  INSERT INTO demo_seed_meta(seed_key) VALUES ('v0.4-gifs-900') ON CONFLICT DO NOTHING RETURNING 1
), ps AS (
  SELECT p.id,row_number() OVER (ORDER BY p.id DESC) rn,count(*) OVER () cnt
  FROM posts p JOIN users u ON u.id=p.user_id WHERE u.email LIKE '%@tfiatter.local'
), g AS (SELECT generate_series(1,900) n), gifs AS (
  SELECT ARRAY['3o7aD2saalBwwftBIY','ICOgUNjpvO0PC','26ufdipQqU2lhNA4g','l0HlBO7eyXzSZkJri','xT9IgG50Fb7Mi0prBC','13CoXDiaCcCoyk','111ebonMs90YLu','5GoVLqeAOo6PK']::text[] ids
)
INSERT INTO post_media(post_id,url,mime_type,original_name,sort_order)
SELECT p.id,'https://media.giphy.com/media/'||gifs.ids[((g.n*5)%array_length(gifs.ids,1))+1]||'/giphy.gif','image/gif','giphy.gif',1
FROM g JOIN ps p ON p.rn=((((g.n*61)-1)%p.cnt)+1) CROSS JOIN gifs
WHERE EXISTS(SELECT 1 FROM mark);

WITH mark AS (
  INSERT INTO demo_seed_meta(seed_key) VALUES ('v0.4-videos-420') ON CONFLICT DO NOTHING RETURNING 1
), ps AS (
  SELECT p.id,row_number() OVER (ORDER BY p.id DESC) rn,count(*) OVER () cnt
  FROM posts p JOIN users u ON u.id=p.user_id WHERE u.email LIKE '%@tfiatter.local'
), g AS (SELECT generate_series(1,420) n), vids AS (
  SELECT ARRAY[
    'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4'
  ]::text[] urls
)
INSERT INTO post_media(post_id,url,mime_type,original_name,sort_order)
SELECT p.id,vids.urls[((g.n*3)%array_length(vids.urls,1))+1],'video/mp4','video-demo.mp4',2
FROM g JOIN ps p ON p.rn=((((g.n*89)-1)%p.cnt)+1) CROSS JOIN vids
WHERE EXISTS(SELECT 1 FROM mark);

-- Médias dans des réponses également.
WITH mark AS (
  INSERT INTO demo_seed_meta(seed_key) VALUES ('v0.4-comment-media') ON CONFLICT DO NOTHING RETURNING 1
), cs AS (
  SELECT c.id,row_number() OVER (ORDER BY c.id DESC) rn,count(*) OVER () cnt
  FROM comments c JOIN users u ON u.id=c.user_id WHERE u.email LIKE '%@tfiatter.local'
), g AS (SELECT generate_series(1,850) n)
INSERT INTO comment_media(comment_id,url,mime_type,original_name,sort_order)
SELECT c.id,
       CASE WHEN g.n%5=0 THEN 'https://media.giphy.com/media/ICOgUNjpvO0PC/giphy.gif' ELSE 'https://picsum.photos/seed/reply-'||c.id||'/1000/700' END,
       CASE WHEN g.n%5=0 THEN 'image/gif' ELSE 'image/jpeg' END,
       CASE WHEN g.n%5=0 THEN 'reaction.gif' ELSE 'photo-reponse.jpg' END,0
FROM g JOIN cs c ON c.rn=((((g.n*73)-1)%c.cnt)+1)
WHERE EXISTS(SELECT 1 FROM mark);

-- 7) Des centaines de milliers de likes sur les TFI@Ts.
WITH mark AS (
  INSERT INTO demo_seed_meta(seed_key) VALUES ('v0.4-likes-320k') ON CONFLICT DO NOTHING RETURNING 1
), us AS (
  SELECT id,row_number() OVER (ORDER BY id) rn,count(*) OVER () cnt FROM users WHERE is_active=true AND email LIKE '%@tfiatter.local'
), ps AS (
  SELECT p.id,row_number() OVER (ORDER BY p.id) rn,count(*) OVER () cnt FROM posts p JOIN users u ON u.id=p.user_id WHERE u.email LIKE '%@tfiatter.local'
), g AS (SELECT generate_series(1,320000) n)
INSERT INTO likes(user_id,post_id,created_at)
SELECT u.id,p.id,now()-make_interval(mins => ((g.n*17)%120000)::int)
FROM g
JOIN us u ON u.rn=((((g.n*101)-1)%u.cnt)+1)
JOIN ps p ON p.rn=(((((g.n::bigint)*7919)-1)%p.cnt)+1)
WHERE EXISTS(SELECT 1 FROM mark)
ON CONFLICT DO NOTHING;

-- Booster volontairement 120 publications pour créer de vrais contenus viraux.
WITH mark AS (
  INSERT INTO demo_seed_meta(seed_key) VALUES ('v0.4-viral-post-likes') ON CONFLICT DO NOTHING RETURNING 1
), viral AS (
  SELECT p.id,row_number() OVER (ORDER BY p.created_at DESC) vrn
  FROM posts p JOIN users u ON u.id=p.user_id
  WHERE u.email LIKE '%@tfiatter.local'
  ORDER BY (p.id*37)%997, p.created_at DESC LIMIT 120
), fans AS (
  SELECT id,row_number() OVER (ORDER BY id) rn FROM users WHERE is_active=true AND email LIKE '%@tfiatter.local'
)
INSERT INTO likes(user_id,post_id,created_at)
SELECT f.id,v.id,now()-make_interval(mins => ((f.rn+v.vrn)*3 % 50000)::int)
FROM viral v JOIN fans f ON f.rn <= (650 + (v.vrn % 850))
WHERE EXISTS(SELECT 1 FROM mark)
ON CONFLICT DO NOTHING;

-- 8) Republications massives.
WITH mark AS (
  INSERT INTO demo_seed_meta(seed_key) VALUES ('v0.4-retweets-48000') ON CONFLICT DO NOTHING RETURNING 1
), us AS (
  SELECT id,row_number() OVER (ORDER BY id) rn,count(*) OVER () cnt FROM users WHERE is_active=true AND email LIKE '%@tfiatter.local'
), ps AS (
  SELECT p.id,p.user_id,row_number() OVER (ORDER BY p.id) rn,count(*) OVER () cnt FROM posts p JOIN users u ON u.id=p.user_id WHERE u.email LIKE '%@tfiatter.local'
), g AS (SELECT generate_series(1,48000) n)
INSERT INTO retweets(user_id,post_id,created_at)
SELECT u.id,p.id,now()-make_interval(mins => ((g.n*31)%110000)::int)
FROM g
JOIN us u ON u.rn=((((g.n*149)-1)%u.cnt)+1)
JOIN ps p ON p.rn=((((g.n*3571)-1)%p.cnt)+1)
WHERE u.id<>p.user_id AND EXISTS(SELECT 1 FROM mark)
ON CONFLICT DO NOTHING;

-- 9) Likes et republications sur les réponses : certaines deviennent très populaires.
WITH mark AS (
  INSERT INTO demo_seed_meta(seed_key) VALUES ('v0.4-comment-likes-150k') ON CONFLICT DO NOTHING RETURNING 1
), us AS (
  SELECT id,row_number() OVER (ORDER BY id) rn,count(*) OVER () cnt FROM users WHERE is_active=true AND email LIKE '%@tfiatter.local'
), cs AS (
  SELECT c.id,row_number() OVER (ORDER BY c.id) rn,count(*) OVER () cnt FROM comments c JOIN users u ON u.id=c.user_id WHERE u.email LIKE '%@tfiatter.local'
), g AS (SELECT generate_series(1,150000) n)
INSERT INTO comment_likes(user_id,comment_id,created_at)
SELECT u.id,c.id,now()-make_interval(mins => ((g.n*23)%100000)::int)
FROM g
JOIN us u ON u.rn=((((g.n*107)-1)%u.cnt)+1)
JOIN cs c ON c.rn=((((g.n*3527)-1)%c.cnt)+1)
WHERE EXISTS(SELECT 1 FROM mark)
ON CONFLICT DO NOTHING;

WITH mark AS (
  INSERT INTO demo_seed_meta(seed_key) VALUES ('v0.4-viral-comment-likes') ON CONFLICT DO NOTHING RETURNING 1
), viral AS (
  SELECT c.id,row_number() OVER (ORDER BY c.created_at DESC) vrn
  FROM comments c JOIN users u ON u.id=c.user_id WHERE u.email LIKE '%@tfiatter.local'
  ORDER BY (c.id*41)%881, c.created_at DESC LIMIT 180
), fans AS (
  SELECT id,row_number() OVER (ORDER BY id) rn FROM users WHERE is_active=true AND email LIKE '%@tfiatter.local'
)
INSERT INTO comment_likes(user_id,comment_id,created_at)
SELECT f.id,v.id,now()-make_interval(mins => ((f.rn+v.vrn)*5 % 40000)::int)
FROM viral v JOIN fans f ON f.rn <= (350 + (v.vrn % 650))
WHERE EXISTS(SELECT 1 FROM mark)
ON CONFLICT DO NOTHING;

WITH mark AS (
  INSERT INTO demo_seed_meta(seed_key) VALUES ('v0.4-comment-retweets-18000') ON CONFLICT DO NOTHING RETURNING 1
), us AS (
  SELECT id,row_number() OVER (ORDER BY id) rn,count(*) OVER () cnt FROM users WHERE is_active=true AND email LIKE '%@tfiatter.local'
), cs AS (
  SELECT c.id,c.user_id,row_number() OVER (ORDER BY c.id) rn,count(*) OVER () cnt FROM comments c JOIN users u ON u.id=c.user_id WHERE u.email LIKE '%@tfiatter.local'
), g AS (SELECT generate_series(1,18000) n)
INSERT INTO comment_retweets(user_id,comment_id,created_at)
SELECT u.id,c.id,now()-make_interval(mins => ((g.n*29)%95000)::int)
FROM g
JOIN us u ON u.rn=((((g.n*167)-1)%u.cnt)+1)
JOIN cs c ON c.rn=((((g.n*2089)-1)%c.cnt)+1)
WHERE u.id<>c.user_id AND EXISTS(SELECT 1 FROM mark)
ON CONFLICT DO NOTHING;

-- 10) Un peu de bruit dans les notifications des comptes de démo, sans dupliquer toutes les centaines de milliers d'interactions.
WITH mark AS (
  INSERT INTO demo_seed_meta(seed_key) VALUES ('v0.4-notification-noise') ON CONFLICT DO NOTHING RETURNING 1
)
INSERT INTO notifications(user_id,actor_id,type,post_id,created_at)
SELECT p.user_id,l.user_id,'like',l.post_id,l.created_at
FROM likes l JOIN posts p ON p.id=l.post_id JOIN users owner ON owner.id=p.user_id
WHERE owner.email LIKE '%@tfiatter.local' AND l.user_id<>p.user_id AND EXISTS(SELECT 1 FROM mark)
ORDER BY l.created_at DESC LIMIT 12000
ON CONFLICT DO NOTHING;

COMMIT;

-- Contrôles utiles après migration :
-- SELECT count(*) FROM users WHERE email LIKE '%@tfiatter.local';
-- SELECT min(c) FROM (SELECT count(*) c FROM follows f JOIN users u ON u.id=f.following_id WHERE u.is_verified GROUP BY u.id) x;
-- SELECT count(*) FROM posts;
-- SELECT count(*) FROM likes;
-- SELECT count(*) FROM retweets;
-- SELECT count(*) FROM comments;
-- SELECT count(*) FROM comment_likes;
