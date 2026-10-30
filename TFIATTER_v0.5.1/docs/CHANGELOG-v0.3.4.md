# TFI@TTER v0.3.4

## Correctifs

- Réparation automatique du schéma de messagerie pour éviter l’erreur HTTP 500 quand `conversation_deletions` manque.
- Menu `...` fiabilisé avec `ownedByMe` renvoyé par l’API.
- Accueil trié chronologiquement sur les nouveautés globales et rafraîchi toutes les 2 secondes.

## Fonctions

- Liste des abonnés d’un profil.
- Liste des abonnements d’un profil.
- Suppression de l’onglet Moments.
- Deux nouvelles routes : `GET /api/profile/:username/followers` et `GET /api/profile/:username/following`.
