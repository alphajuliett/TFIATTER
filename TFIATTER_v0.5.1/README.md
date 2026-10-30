# Mise à jour v0.5.1 — followers jusqu’à 100 M

Depuis une v0.5.0 existante, applique uniquement :

```bash
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U tfiatter -d tfiatter < postgres/migrations/013_v051.sql
docker compose up --build -d nodered
```

Cette migration est non destructive et conserve les comptes créés manuellement. Le champ de création de compte accepte maintenant jusqu’à 100 000 000 abonnés. Les 60 000 premiers peuvent être matérialisés avec le pool de simulation ; le surplus est un compteur simulé afin d’éviter des dizaines de millions de lignes PostgreSQL.

# TFI@TTER v0.5.1

## Mise à jour v0.5.0 depuis v0.4.1

La migration v0.5.0 est **non destructive** : elle ne supprime ni ne réinitialise les comptes existants, notamment les comptes créés manuellement.

```bash
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U tfiatter -d tfiatter < postgres/migrations/012_v050.sql
docker compose up --build -d nodered
```

Puis effectuer `Ctrl+F5`. Voir aussi `INSTALL-v0.5.0.txt`.


## v0.5.0 — lecture publique, animation progressive et followers à la création

Nouveautés principales :

- le **fil Accueil est lisible sans compte** ; publication, like, ReTFI@T, citation, suivi, profils détaillés, notifications et messages restent protégés par connexion ;
- les réactions déclenchées depuis **Panneau Animation** arrivent progressivement pendant **60 secondes**, par vagues toutes les 2 secondes ;
- la cible de likes/ReTFI@Ts reste choisie aléatoirement dans le barème 1–10 ;
- le panneau Administration permet désormais de saisir **0 à 100 000 000 abonnés** lors de la création d’un compte ; jusqu’à 60 000 sont matérialisés comme relations `follows`, le surplus est simulé sans créer des millions de lignes ;
- à partir de 1 000, les compteurs utilisent le format compact : `1.0k`, `12.4k`, `60.0k`, puis `1.0M` ;
- la migration `012_v050.sql` est **non destructive** et ne réécrit pas les utilisateurs existants.

### Mise à jour depuis v0.4.1

```bash
docker compose exec -T postgres pg_dump -U tfiatter -d tfiatter > backup-avant-v050.sql
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U tfiatter -d tfiatter < postgres/migrations/012_v050.sql
docker compose up --build -d nodered
```

Puis effectuer `Ctrl + F5`.

### Installation neuve

```bash
cp .env.example .env
docker compose up --build -d
```

Les scripts d’initialisation appliquent le réseau de démonstration, le pool Animation puis le schéma v0.5.0.

## v0.4.1 — panneau Animation / rôle Entraîneur

Cette version introduisait le rôle **Entraîneur**, distinct du rôle Administrateur, ainsi que le panneau Animation et le pool de 60 500 comptes de réaction. Le barème 1 à 10 reste celui utilisé par la v0.5.0 ; seule l’arrivée des réactions est désormais progressive sur 60 secondes.

| Note | Likes | ReTFI@Ts | Niveau |
|---:|---:|---:|---|
| 1 | 0–25 | 0–5 | Hors-sujet total ou ratio |
| 2 | 25–80 | 5–15 | Coup d'épée dans l'eau |
| 3 | 80–200 | 15–40 | Écho de niche |
| 4 | 200–500 | 40–100 | Engagement tiède |
| 5 | 500–1 200 | 100–250 | Frappe standard |
| 6 | 1 200–2 500 | 250–600 | Traction algorithmique |
| 7 | 2 500–5 000 | 600–1 200 | La Polémique |
| 8 | 5 000–10 000 | 1 200–2 500 | Le bad buzz |
| 9 | 10 000–25 000 | 2 500–6 000 | Top tendance |
| 10 | 25 000–60 000 | 6 000–15 000 | Le Cas d'école (Masterclass) |

Les assets courants utilisent `app.js?v=0.5.1` et `style.css?v=0.5.1`.


## v0.4.0.3 — correctif fils de discussion et réponses

- le fil de discussion recharge désormais explicitement le **TFI@T d’origine** depuis PostgreSQL, même s’il n’était pas déjà présent dans le fil local du navigateur ;
- chaque auteur peut **modifier ou supprimer sa propre réponse** depuis le menu `...` ;
- les réponses modifiées affichent **Modifié** ;
- la suppression d’une réponse nettoie ses interactions et ses médias locaux ;
- migration `010_v0403.sql` ajoutant `updated_at` et `edited_at` à `comments`.

Les volumes de démo massive restent ceux de la branche v0.4.0.x.

### Mise à jour depuis v0.4.0.2

```bash
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U tfiatter -d tfiatter < postgres/migrations/010_v0403.sql
docker compose up --build -d nodered
```

Force ensuite un rechargement navigateur avec `Ctrl + F5`. Le backend sait aussi ajouter automatiquement les deux colonnes manquantes, mais appliquer la migration explicitement garde le schéma versionné proprement.

Cette version transforme le jeu de démonstration en réseau déjà très actif :

- **3 200 comptes de démonstration**, tous avec le mot de passe `Demo1234!` ;
- graphe social dense et partiellement réciproque ;
- chaque compte certifié reçoit **au moins 1 200 abonnés** issus du jeu de démonstration ;
- **14 000 TFI@Ts supplémentaires** + **5 500 citations**, en plus des données des versions précédentes ;
- environ **22 000 réponses** supplémentaires ;
- environ **320 000 likes de TFI@Ts**, avec un second passage qui crée volontairement des publications virales ;
- environ **48 000 republications** ;
- environ **150 000 likes de réponses** et **18 000 republications de réponses** ;
- plusieurs milliers de médias : images, GIFs et vidéos ;
- le corpus v0.4.0.2 n’utilise pratiquement **aucun hashtag** ; les hashtags des anciens seeds connus sont nettoyés ;
- les réponses populaires peuvent maintenant remonter directement dans **Accueil** ;
- lorsqu’une réponse est affichée hors du fil de discussion, le **TFI@T original est affiché au-dessus** ;
- dans **Modifier le profil**, cliquer directement sur le rond de la photo de profil ouvre le sélecteur d’image.

Le volume exact peut être légèrement supérieur si la base contient déjà les données des versions précédentes. Le seed v0.4.0.2 est idempotent grâce à `demo_seed_meta`.

### Mise à jour depuis v0.3.9

Sur une base existante, applique le gros jeu de données :

```bash
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U tfiatter -d tfiatter < postgres/migrations/009_v040_noise.sql
```

Puis reconstruis Node-RED :

```bash
docker compose up --build -d nodered
```

Force ensuite le rechargement du navigateur avec `Ctrl + F5`.

Sur une **installation neuve**, `postgres/init/003_v040_noise.sql` injecte automatiquement la v0.4.0.2 après le schéma et le seed historique.

Quelques contrôles utiles :

```bash
docker compose exec -T postgres psql -U tfiatter -d tfiatter -c "SELECT count(*) FROM users WHERE email LIKE '%@tfiatter.local';"
docker compose exec -T postgres psql -U tfiatter -d tfiatter -c "SELECT count(*) FROM posts;"
docker compose exec -T postgres psql -U tfiatter -d tfiatter -c "SELECT count(*) FROM likes;"
docker compose exec -T postgres psql -U tfiatter -d tfiatter -c "SELECT count(*) FROM comments;"
```

Les assets utilisent `app.js?v=0.4.0.3` et `style.css?v=0.4.0.3`.

La liste exportée des comptes de démonstration se trouve dans `docs/demo-accounts-v0.4.csv`.

## Nouveautés v0.3.9

- la barre de recherche propose désormais en direct jusqu’à **8 profils correspondants** pendant la saisie, avec avatar, nom, @identifiant et certification ;
- cliquer sur une suggestion ouvre directement le profil ;
- appuyer sur **Entrée** ouvre une vraie page de recherche globale ;
- onglet **Top** : profils pertinents + publications/réponses classées par nombre d’interactions ;
- onglet **Latest** : contenus correspondants les plus récents en premier ;
- onglet **People** : uniquement les profils correspondants ;
- onglet **Media** : uniquement les publications/réponses contenant une image, un GIF ou une vidéo ;
- filtres latéraux **Tout le monde / Comptes suivis** et **Partout / Près de vous** ;
- le filtre « Près de vous » utilise la localisation textuelle du profil et est désactivé si le compte n’a pas renseigné de localisation ;
- les résultats de recherche sont eux aussi actualisés par le polling de **2 secondes** ;
- la recherche est effectuée côté PostgreSQL, et non en filtrant seulement les TFI@Ts déjà chargés dans le navigateur.

### Mise à jour depuis v0.3.8

Aucune migration PostgreSQL n’est nécessaire :

```bash
docker compose up --build -d nodered
```

Puis force le rechargement du navigateur :

```text
Ctrl + F5
```

Les assets utilisent `app.js?v=0.3.9` et `style.css?v=0.3.9`.


## Nouveautés v0.3.8

- **médias non rognés** : les images et GIF sont affichés intégralement avec un fond gris lorsque leur ratio ne remplit pas la largeur disponible ;
- les vidéos utilisent le même principe et s'ouvrent désormais dans un lecteur agrandi ;
- clic sur une **image, vidéo, GIF ou PDF** : ouverture dans une visionneuse modale interne à TFI@TTER, sans nouvel onglet ;
- le profil utilise désormais le **même pin géographique SVG** que l'outil de localisation du composer ;
- retour d'une carte **Tendances** sous les Suggestions, alimentée par les hashtags réellement présents dans les TFI@Ts et réponses récentes ;
- tendances actualisées par le polling de **2 secondes** ;
- le réseau est maintenant **privé hors connexion** : fil, profils, réponses, suggestions, abonnés/abonnements, tendances et configuration GIPHY nécessitent une session valide ;
- lorsqu'on est déconnecté, seule une page d'accueil Connexion / Inscription est affichée ;
- les API de contenu renvoient `401 Connexion requise` sans jeton valide.

### Mise à jour depuis v0.3.6

Aucune migration PostgreSQL n'est nécessaire. Remplace les fichiers puis reconstruis Node-RED :

```bash
docker compose up --build -d nodered
```

Puis force le rechargement du navigateur :

```text
Ctrl + F5
```

Les assets utilisent `app.js?v=0.3.8` et `style.css?v=0.3.8`.

> Note : les fichiers déjà téléversés conservent des URL UUID dans `/uploads`. L'interface et les API sociales exigent désormais une authentification ; si tu veux à terme protéger également l'accès HTTP direct à chaque fichier `/uploads/...`, il faudra faire passer les médias par une route authentifiée plutôt que par le serveur statique Node-RED.

## Nouveautés v0.3.6

- les **réponses/commentaires peuvent maintenant être likés** ;
- les réponses peuvent être **republiées** comme un TFI@T ;
- les republications de réponses remontent dans le fil Accueil et dans l’onglet **TFI@Ts** du profil du compte qui republie ;
- le bouton de republication ouvre désormais le choix **Republier / Citer** sur les TFI@Ts et les réponses ;
- une **citation** crée un nouveau TFI@T contenant le message de l’utilisateur et une carte du TFI@T ou de la réponse citée ;
- le composer de citation accepte texte illimité, pièces jointes, emojis et GIF GIPHY ;
- l’onglet **J’aime** des profils inclut maintenant les réponses aimées en plus des TFI@Ts ;
- notifications ajoutées pour les likes de réponses, republications de réponses et citations ;
- le polling de 2 secondes prend naturellement en compte ces nouvelles interactions.

### Mise à jour depuis v0.3.5

Cette version ajoute deux tables d’interactions et deux références de citation dans `posts`. Sur une base existante :

```bash
docker compose exec -T postgres psql -U tfiatter -d tfiatter < postgres/migrations/008_v036.sql
docker compose up --build -d nodered
```

La migration est idempotente et ne supprime aucune publication, réponse, like ou republication existante. Le backend sait également créer automatiquement les colonnes/tables v0.3.6 manquantes à la première utilisation. Fais ensuite `Ctrl+F5` pour charger `app.js?v=0.3.6`.


## Nouveautés v0.3.5

- menu d’**emojis** dans le composer principal et dans les réponses ;
- insertion de l’emoji à la position exacte du curseur ;
- bouton **GIF** dans le composer et dans les réponses ;
- recherche et GIF populaires via **GIPHY** ;
- aperçu du GIF avant publication ;
- les GIF apparaissent ensuite comme de vrais médias dans le fil, les profils et les fils de réponses ;
- les GIF GIPHY ne sont pas recopiés dans le volume d’uploads : TFI@TTER conserve seulement leur identifiant ;
- attribution **Powered By GIPHY** intégrée au sélecteur ;
- aucune migration PostgreSQL nécessaire depuis v0.3.4.

### Mise à jour depuis v0.3.4

Renseigne d’abord une clé Web GIPHY dans `.env` :

```env
GIPHY_WEB_API_KEY=votre_cle_web_giphy
GIPHY_RATING=pg-13
GIPHY_LANG=fr
```

Puis reconstruis Node-RED :

```bash
docker compose up --build -d nodered
```

Aucune migration SQL n’est nécessaire. Fais ensuite un rechargement forcé du navigateur (`Ctrl+F5`) afin de charger `app.js?v=0.3.5`.

## Nouveautés v0.3.4

- **Messagerie réparée automatiquement** : Node-RED vérifie/crée au besoin les tables `notifications`, `direct_messages` et `conversation_deletions`.
- Migration idempotente `postgres/migrations/007_v034.sql` fournie pour réparer explicitement un volume existant.
- Le menu **…** des TFI@Ts appartenant au membre connecté utilise désormais une information d’appartenance fournie par l’API (`ownedByMe`) et expose **Modifier / Supprimer**.
- Le fil **Accueil** est désormais un fil chronologique global : les dernières publications et retweets apparaissent au polling suivant (2 secondes).
- Les compteurs **Abonnements** et **Abonnés** sont cliquables sur les profils et ouvrent la liste correspondante.
- L’onglet de navigation **Moments** a été supprimé.

### Mise à jour depuis v0.3.3

Après remplacement des fichiers :

```bash
docker compose exec -T postgres psql -U tfiatter -d tfiatter < postgres/migrations/007_v034.sql
docker compose up --build -d nodered
```

La migration est sans destruction de données. Le backend sait également créer les tables de messagerie manquantes à la première requête, mais appliquer `007_v034.sql` reste recommandé pour remettre explicitement le schéma au propre.

Fais ensuite un rechargement forcé du navigateur (`Ctrl+F5`) afin de charger `app.js?v=0.3.4`.


TFI@TTER est un réseau social de type Twitter construit avec **Node-RED + PostgreSQL**, avec une interface desktop inspirée du Twitter de 2018.


## Nouveautés v0.3.3

- **suppression de ses propres TFI@Ts depuis le menu `...`** en haut à droite de chaque publication, avec confirmation ;
- menu de suppression disponible aussi lorsque la publication est affichée depuis un profil ;
- profil utilisateur découpé en quatre vrais onglets : **TFI@Ts**, **Réponses**, **Médias** et **J’aime** ;
- l’onglet **Réponses** affiche les réponses écrites par l’utilisateur et indique le compte auquel il répond ;
- bouton **Voir la conversation** depuis une réponse pour ouvrir le TFI@T d’origine et son fil de réponses ;
- l’onglet **Médias** agrège les TFI@Ts et réponses de l’utilisateur contenant une image, une vidéo, un PDF ou une autre pièce jointe gérée ;
- l’onglet **J’aime** affiche les TFI@Ts aimés par l’utilisateur ;
- les quatre onglets sont également actualisés automatiquement quand le profil reste ouvert ;
- le fil **Accueil** récupère les nouveautés toutes les **2 secondes** et réaffiche automatiquement les nouvelles publications/retweets correspondant au fil de l’utilisateur ;
- aucune action « Actualiser » n’est nécessaire pour voir arriver un nouveau TFI@T.

### Mise à jour v0.3.2 → v0.3.3

Aucune migration PostgreSQL n’est nécessaire : cette version réutilise les tables `posts`, `comments`, `comment_media`, `post_media` et `likes` existantes.

Après remplacement des fichiers du projet :

```bash
docker compose up --build -d nodered
```

Recharge ensuite l’onglet TFI@TTER dans le navigateur pour charger le JavaScript v0.3.3.


## Nouveautés v0.3.2

- **suppression des discussions privées** depuis la liste Messages ou l'en-tête d'une conversation ;
- confirmation avant suppression ;
- la suppression est **locale au compte** : elle masque l'historique pour l'utilisateur qui supprime sans l'effacer chez l'autre participant ;
- si un nouveau message est envoyé après la suppression, la conversation réapparaît avec uniquement les nouveaux messages ;
- les anciens messages reçus masqués ne restent pas comptabilisés comme non lus ;
- polling 2 secondes conservé pour la liste des discussions et la conversation ouverte.

### Migration v0.3.1 → v0.3.2

Cette version ajoute une petite table PostgreSQL. Sur une base existante :

```bash
docker compose exec -T postgres psql -U tfiatter -d tfiatter < postgres/migrations/006_v032.sql
docker compose up --build -d nodered
```

La migration **ne supprime aucun message existant**.


## Nouveautés v0.3.1

- **polling automatique toutes les 2 secondes** ;
- actualisation silencieuse du fil d’actualité ;
- actualisation des compteurs de notifications et de messages non lus ;
- actualisation de la page Notifications ;
- actualisation de la liste des conversations et de la conversation privée ouverte ;
- actualisation des réponses/commentaires lorsqu’une fenêtre de discussion est ouverte ;
- actualisation d’un profil affiché et de ses publications ;
- actualisation des suggestions de comptes ;
- actualisation des données du panneau administrateur lorsqu’il est ouvert ;
- préservation du brouillon de message privé, du focus et de la position de lecture pendant le polling ;
- protection anti-chevauchement : un nouveau cycle ne démarre pas si le précédent n’est pas terminé.

**Aucune migration PostgreSQL n’est nécessaire pour passer de v0.3 à v0.3.1.** Il suffit de reconstruire/redémarrer le conteneur Node-RED après remplacement des fichiers.

## Nouveautés v0.3

- **200 profils de démonstration** sur une installation neuve : `alice`, `karim`, `lucie` + 197 profils aux noms très variés ;
- tous les comptes de démonstration utilisent le mot de passe `Demo1234!` ;
- environ **1 000 TFI@Ts** supplémentaires répartis sur ces comptes ;
- bruit social de démonstration : abonnements, likes, retweets et réponses ;
- photos de profil de démonstration variées via `randomuser.me` ;
- vraie page **Notifications** : likes, retweets, réponses et nouveaux abonnés ;
- compteurs de notifications non lues dans la barre supérieure ;
- vraie page **Messages** avec liste des conversations, messages privés texte et compteur de non-lus ;
- bouton **Message privé** depuis un profil ;
- plusieurs conversations de démonstration sont préchargées pour `alice` ;
- bouton **Se déconnecter** dans la carte de profil ;
- suppression de la carte des anciennes tendances dans l'interface ;
- l'API de tendances ne contient plus de tendances fictives de secours ;
- l'écran de connexion n'affiche plus les identifiants d'`alice` ;
- migration `005_v03.sql` pour mettre à jour une base existante sans la supprimer.

La v0.3 conserve les fonctions des versions précédentes : publications sans limite applicative de caractères, médias, retweets, likes, réponses, édition avec mention **Modifié**, suppression, profils, abonnements, avatars, certification par coche bleue et panneau d'administration.

## Mise à jour depuis v0.3

Aucune modification de schéma SQL n’est nécessaire. Après avoir remplacé les fichiers du projet :

```bash
docker compose up --build -d nodered
```

Le navigateur utilisera ensuite le polling de 2 secondes après rechargement de la page.

## Stack

- Node-RED 5.0.1 : API et serveur HTTP ;
- PostgreSQL 17 ;
- HTML/CSS/JavaScript sans framework ;
- Docker Compose.

## Installation neuve

Depuis le dossier du projet :

```bash
cp .env.example .env
```

Édite `.env` et change au minimum :

```env
POSTGRES_PASSWORD=un_mot_de_passe_long_et_aleatoire
JWT_SECRET=une_chaine_aleatoire_d_au_moins_32_caracteres
```

Puis :

```bash
docker compose up --build -d
```

Ouvre :

- TFI@TTER : `http://localhost:1880`
- Node-RED : `http://localhost:1880/red`
- santé API : `http://localhost:1880/api/health`

## Comptes de démonstration

Tous les comptes générés utilisent :

```text
Demo1234!
```

Quelques comptes connus :

| Compte | Rôle |
|---|---|
| `alice` | administratrice + certifiée |
| `karim` | membre |
| `lucie` | membre |

Les 197 autres comptes sont générés avec des identifiants du type `amina_004`, `hiroshi_005`, etc. Ils sont visibles dans le fil, les suggestions, les notifications, les messages et le panneau d'administration.

La liste complète des 200 comptes se trouve dans `docs/demo-accounts.csv`.

**Les identifiants de démonstration ne sont volontairement plus affichés sur l'écran de connexion.**

## Jeu de démonstration

Une installation neuve contient approximativement :

- 200 comptes ;
- 1 000 TFI@Ts de bruit, en plus des quelques publications historiques ;
- 1 600 abonnements ;
- 2 600 likes ;
- 420 retweets ;
- 260 réponses ;
- 90 messages privés de démonstration ;
- des notifications dérivées des interactions.

Les scripts sont idempotents grâce à `demo_seed_meta` : relancer une migration ne doit pas recréer les 1 000 mêmes publications.

### Photos de profil de démonstration

Les profils générés utilisent des URLs d'avatars `randomuser.me`. Une connexion Internet est donc nécessaire pour afficher ces photos de démonstration. Les avatars téléversés manuellement par les utilisateurs restent, eux, stockés localement dans le volume Docker `uploads_data`.

## Notifications

La barre supérieure affiche un badge sur **Notifications** lorsqu'il existe des événements non lus.

Types pris en charge :

- nouveau follower ;
- like de TFI@T ;
- republication de TFI@T ;
- réponse à une publication ;
- like de réponse ;
- republication de réponse ;
- citation.

Routes :

```text
GET  /api/notifications
POST /api/notifications/read
GET  /api/nav-counts
```

## Messages privés

Clique sur **Messages** dans la barre supérieure. La page comporte :

- les conversations à gauche ;
- le fil de messages à droite ;
- un champ `@utilisateur` pour commencer une nouvelle conversation ;
- un compteur de messages non lus ;
- un bouton Message directement sur les profils des autres membres.

Routes :

```text
GET  /api/messages
GET  /api/messages/:username
POST /api/messages/:username
```

La v0.3 gère les messages privés **texte/liens**. Les pièces jointes privées ne sont pas encore implémentées.

## Déconnexion

Une fois connecté, le bouton **Se déconnecter** apparaît dans la carte de profil de la colonne gauche.

TFI@TTER utilise actuellement des JWT stateless. La déconnexion supprime le JWT du navigateur. Un token copié ailleurs reste techniquement valable jusqu'à son expiration ; une future version peut ajouter une liste de révocation serveur si nécessaire.

## Administration

`alice` est administratrice initiale. Un administrateur peut :

- créer un compte ;
- fournir une photo lors de la création ;
- certifier/décertifier un compte ;
- nommer ou rétrograder un administrateur ;
- désactiver/réactiver un compte ;
- consulter les statistiques ;
- supprimer une publication par modération.

La certification et le rôle administrateur restent deux attributs indépendants.

## Migration depuis ta v0.2.1 actuelle

**Ne supprime pas le volume PostgreSQL.**

D'abord sauvegarde si tu as des données importantes :

```bash
docker compose exec -T postgres pg_dump -U tfiatter -d tfiatter > avant_v03.sql
```

Ensuite :

```bash
docker compose up -d postgres
docker compose exec -T postgres psql -U tfiatter -d tfiatter < postgres/migrations/005_v03.sql
docker compose up --build -d
```

Le script v0.3 :

- ajoute `notifications`, `direct_messages` et `demo_seed_meta` ;
- crée les profils et le bruit de démonstration ;
- remet `alice`, `karim` et `lucie` sur le mot de passe `Demo1234!` ;
- attribue une photo de démonstration à ces trois comptes.

## Si ta base est encore partiellement en v0.1

La migration `005_v03.sql` est volontairement **auto-rattrapante** : elle recrée également les colonnes `is_admin`, `is_verified`, `is_active`, `updated_at` et `edited_at` si elles manquent. Cela correspond notamment au cas où une ancienne base PostgreSQL a été conservée dans le volume Docker.

Tu peux donc exécuter directement :

```bash
docker compose up -d postgres
docker compose exec -T postgres psql -U tfiatter -d tfiatter < postgres/migrations/005_v03.sql
docker compose up --build -d
```

Les migrations `003_v02.sql` et `004_v021.sql` restent fournies pour historique, mais ne sont plus obligatoires avant `005_v03.sql`.

Pour vérifier ensuite :

```bash
docker compose exec -T postgres psql -U tfiatter -d tfiatter -c "SELECT count(*) AS users FROM users;"
docker compose exec -T postgres psql -U tfiatter -d tfiatter -c "SELECT count(*) AS posts FROM posts;"
docker compose exec -T postgres psql -U tfiatter -d tfiatter -c "SELECT username,is_admin,is_verified,is_active FROM users WHERE username='alice';"
```

Sur une base essentiellement de démonstration, le premier compteur devrait être au moins proche de 200 et le second supérieur à 1 000.

## Réinitialisation complète

Uniquement si tu n'as aucune donnée à conserver :

```bash
docker compose down -v
docker compose up --build -d
```

`down -v` détruit toute la base et les médias stockés dans les volumes.

## API principale

### Authentification

```text
POST  /api/register
POST  /api/login
GET   /api/me
PATCH /api/me
```

### TFI@Ts

```text
GET    /api/feed
POST   /api/posts
PATCH  /api/posts/:id
DELETE /api/posts/:id
POST   /api/posts/:id/like
POST   /api/posts/:id/retweet
POST   /api/posts/:id/quote
GET    /api/posts/:id/comments
POST   /api/posts/:id/comments
POST   /api/comments/:id/like
POST   /api/comments/:id/retweet
POST   /api/comments/:id/quote
```

### Profils

```text
GET  /api/profile/:username
GET  /api/profile/:username/posts
POST /api/profile/:username/follow
GET  /api/suggestions
GET  /api/trends
```

`/api/trends` est conservée pour compatibilité, mais la carte Tendances a été retirée de l'interface et l'API ne crée plus de hashtags fictifs lorsque la base n'en contient pas.

### Administration

```text
GET    /api/admin/overview
GET    /api/admin/users
POST   /api/admin/users
PATCH  /api/admin/users/:id
GET    /api/admin/posts
DELETE /api/admin/posts/:id
```

### v0.3

```text
GET  /api/notifications
POST /api/notifications/read
GET  /api/nav-counts
GET  /api/messages
GET  /api/messages/:username
POST /api/messages/:username
```

Il y a **31 routes HTTP Node-RED** dans `flows.json`.

## Architecture

```text
Navigateur
   |
   v
Node-RED :1880
   |-- frontend statique /data/public
   |-- 31 routes /api/* dans flows.json
   |-- logique métier /data/lib/tfiatter.js
   |
   v
PostgreSQL :5432
```

## Arborescence

```text
TFIATTER_v0.3/
├── docker-compose.yml
├── .env.example
├── README.md
├── docs/
├── nodered/
│   ├── Dockerfile
│   ├── package.json
│   ├── settings.js
│   ├── flows.json
│   └── lib/tfiatter.js
├── postgres/
│   ├── init/
│   │   ├── 001_schema.sql
│   │   └── 002_demo.sql
│   └── migrations/
│       ├── 003_v02.sql
│       ├── 004_v021.sql
│       └── 005_v03.sql
└── public/
    ├── index.html
    └── assets/
        ├── app.js
        └── style.css
```

## Médias publics

Types pris en charge pour les TFI@Ts/réponses : JPEG, PNG, GIF, WebP, MP4, WebM, MOV/QuickTime et PDF.

Les fichiers téléversés sont stockés sous `/data/public/uploads` dans le volume `uploads_data`.

## Sauvegarde

```bash
docker compose exec -T postgres pg_dump -U tfiatter -d tfiatter > tfiatter_backup.sql
```

## Logs

```bash
docker compose logs -f nodered
docker compose logs -f postgres
```


## Emojis et GIF GIPHY (v0.3.5)

TFI@TTER propose un sélecteur d’emojis dans le composer principal et dans les réponses. L’emoji est inséré exactement à la position du curseur.

Pour activer la recherche de GIF :

1. Créez une clé API **Web** dans le portail développeur GIPHY.
2. Ouvrez `.env` et renseignez :

```env
GIPHY_WEB_API_KEY=votre_cle_web_giphy
GIPHY_RATING=pg-13
GIPHY_LANG=fr
```

3. Reconstruisez Node-RED :

```bash
docker compose up --build -d nodered
```

La recherche est effectuée directement depuis le navigateur vers l’API GIPHY. TFI@TTER ne télécharge pas et ne met pas en cache les fichiers GIPHY : seule la référence du GIF est enregistrée dans PostgreSQL. Le sélecteur affiche l’attribution « Powered By GIPHY ».

Si `GIPHY_WEB_API_KEY` reste vide, le réseau fonctionne normalement ; seul le sélecteur GIF indique que GIPHY n’est pas configuré.

## Sécurité avant exposition Internet

Avant de publier TFI@TTER sur Internet : change les secrets par défaut, protège `/red`, place le service derrière HTTPS, ajoute du rate limiting, des sauvegardes et une analyse des fichiers téléversés. Les 3 200 comptes de démonstration v0.4.0.2 partagent volontairement un même mot de passe et ne doivent pas être conservés tels quels sur une instance réellement publique.
