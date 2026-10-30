# TFI@TTER v0.5.0

- Fil Accueil accessible en lecture sans connexion.
- Les actions restent protégées par authentification.
- Réactions du panneau Animation étalées progressivement sur 60 secondes.
- Création administrative d’un compte avec 0 à 60 000 abonnés de simulation matérialisés dans `follows`.
- Compteurs de likes et ReTFI@Ts abrégés à partir de 1 000 (`1.0k`, `12.4k`, etc.).
- Migration `012_v050.sql` non destructive : aucun compte existant n’est supprimé, réinitialisé ou remplacé.
