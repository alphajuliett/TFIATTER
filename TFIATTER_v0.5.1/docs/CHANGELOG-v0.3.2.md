# TFI@TTER v0.3.2

## Messagerie

- Ajout d'un bouton corbeille sur chaque discussion.
- Ajout d'un bouton de suppression dans l'en-tête de la conversation ouverte.
- Confirmation utilisateur avant suppression.
- Suppression locale : l'autre participant conserve ses messages.
- Une conversation supprimée réapparaît si un nouveau message arrive, sans restaurer l'ancien historique masqué.
- Nettoyage du compteur de non-lus pour les messages masqués.

## Base de données

Migration : `postgres/migrations/006_v032.sql`.
Elle crée `conversation_deletions` et ne détruit aucune donnée existante.
