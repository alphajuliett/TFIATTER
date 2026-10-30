# Tutoriel Panneau Animation — TFI@TTER v0.4.1

## 1. Mettre à jour une v0.4.0.3

```bash
docker compose exec -T postgres \
  psql -v ON_ERROR_STOP=1 \
  -U tfiatter \
  -d tfiatter \
  < postgres/migrations/011_v041_animation.sql

docker compose up --build -d nodered
```

Recharge ensuite la page avec `Ctrl + F5`.

## 2. Tester le rôle Entraîneur

Compte fourni :

```text
Utilisateur : entraineur
Mot de passe : Demo1234!
```

Le bouton **Panneau Animation** apparaît dans la carte de profil.

## 3. Donner le rôle à un autre membre

1. Connecte-toi avec un administrateur.
2. Ouvre **Panneau d'administration**.
3. Recherche le membre.
4. Clique sur **Nommer entraîneur**.
5. Le membre voit le panneau Animation lors de son prochain rafraîchissement.

## 4. Noter un contenu

1. Ouvre **Panneau Animation**.
2. Filtre éventuellement les TFI@Ts/réponses.
3. Clique sur une note de **1 à 10**.
4. Confirme.
5. TFI@TTER choisit une cible aléatoire dans la fourchette et ajoute les interactions nécessaires.

Un contenu ne peut être noté qu'une seule fois.

## 5. Pool de réactions

La migration crée **60 500 comptes** marqués comme comptes de réaction. Ils sont de vrais utilisateurs PostgreSQL pour garantir l'unicité des likes/ReTFI@Ts, mais sont masqués de la recherche, des suggestions et de la liste normale d'administration.
