# TFI@TTER v0.5.1

- Le champ **Nombre d’abonnés** du panneau Administration accepte désormais de 0 à **100 000 000**.
- Jusqu’à 60 000 abonnements peuvent rester matérialisés par de vraies relations `follows`; le surplus est conservé dans `users.simulated_followers_count`.
- Les compteurs de followers affichés dans les profils, suggestions, recherche et administration additionnent les abonnements réels et simulés.
- Les followers élevés utilisent le rendu compact (`1.0M`, `25.4M`, `100.0M`).
- Migration `013_v051.sql` non destructive : aucun compte existant n’est supprimé ni réinitialisé.
