# TFI@TTER v0.4.0.3

- Le endpoint `GET /api/posts/:id/comments` renvoie aussi le TFI@T d’origine afin qu’il soit toujours visible en tête du fil de discussion.
- Ajout de `PATCH /api/comments/:id` pour modifier sa propre réponse.
- Ajout de `DELETE /api/comments/:id` pour supprimer sa propre réponse.
- Menu `...` sur les réponses appartenant à l’utilisateur avec Modifier / Supprimer.
- Les réponses modifiées affichent la mention « Modifié ».
- Ajout de `comments.updated_at` et `comments.edited_at` via `010_v0403.sql` et auto-réparation du schéma côté Node-RED.
