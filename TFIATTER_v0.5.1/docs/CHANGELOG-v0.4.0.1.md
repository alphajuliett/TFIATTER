# TFI@TTER v0.4.0.1

Correctif du seed massif v0.4.0 : le calcul de sélection des publications pendant la génération des 320 000 likes pouvait dépasser la plage INTEGER PostgreSQL (`g.n * 7919`). Le calcul utilise désormais BIGINT avant multiplication.

Aucune migration supplémentaire n’est nécessaire : si `009_v040_noise.sql` a échoué avec `integer out of range`, la transaction v0.4.0 a été annulée et il suffit de relancer le fichier corrigé.
