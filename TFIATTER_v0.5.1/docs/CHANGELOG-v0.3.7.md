# TFI@TTER v0.3.7

- médias affichés avec `object-fit: contain` et fond gris, sans recadrage central ;
- visionneuse modale intégrée pour images, GIF, vidéos et PDF ;
- icône de localisation de profil remplacée par le pin SVG commun ;
- tendances dynamiques sous Suggestions, calculées sur les hashtags des TFI@Ts et réponses ;
- polling des tendances toutes les 2 secondes ;
- écran invité fermé : aucun fil/profil/contenu visible sans connexion ;
- endpoints `feed`, `comments`, `profile`, `profile posts`, `followers/following`, `suggestions`, `trends` et `giphy config` protégés par authentification ;
- aucune migration SQL requise depuis v0.3.6.
