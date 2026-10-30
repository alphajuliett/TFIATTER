# TFI@TTER v0.3.3

## Profils

- Onglet **TFI@Ts** : publications et retweets du profil.
- Onglet **Réponses** : réponses/commentaires écrits par le profil, avec lien vers la conversation d’origine.
- Onglet **Médias** : publications et réponses du profil qui comportent des médias.
- Onglet **J’aime** : publications aimées par le profil.
- Polling 2 s conservé sur l’onglet actuellement ouvert.

## Publications

- Le menu `...` des TFI@Ts appartenant à l’utilisateur propose **Modifier** et **Supprimer**.
- La suppression demande confirmation puis retire immédiatement le TFI@T du fil et du profil.

## Accueil

- Le polling toutes les 2 secondes recharge silencieusement la liste du fil.
- Toute nouvelle publication ou tout nouveau retweet entrant dans le périmètre du fil apparaît automatiquement.

## Base de données

Aucune migration SQL supplémentaire n’est nécessaire depuis v0.3.2.
