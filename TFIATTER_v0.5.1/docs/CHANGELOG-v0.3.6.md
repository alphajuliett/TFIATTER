# TFI@TTER v0.3.6

## Interactions sur les réponses

- Like/unlike d’une réponse.
- Republier/annuler la republication d’une réponse.
- Compteurs et état utilisateur sur chaque réponse.
- Les republications de réponses apparaissent dans le fil chronologique et les profils.
- Les réponses aimées apparaissent dans l’onglet J’aime.

## Citations

- Menu de republication inspiré de Twitter : **Republier** ou **Citer**.
- Citation d’un TFI@T ou d’une réponse.
- Le nouveau TFI@T peut contenir texte, médias, emoji et GIF GIPHY.
- Carte intégrée du contenu cité.
- Notifications de citation.

## Base de données

Migration : `postgres/migrations/008_v036.sql`.

Nouveaux objets : `comment_likes`, `comment_retweets`, `posts.quote_post_id`, `posts.quote_comment_id`.
