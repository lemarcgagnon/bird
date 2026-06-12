# Scripts PHP

Scripts utilitaires pour le backend PHP local/cPanel.

## Dataset demo

```bash
php server-php/scripts/seed_demo_dataset.php
```

Le script est idempotent pour les comptes demo connus: il supprime puis recree ces comptes et leurs donnees liees dans la DB active. En local, c'est SQLite; en cPanel, ce sera MySQL si `server-php/data/db-config.php` ou `NICHOIR_DB_*` pointe vers MySQL.

Ne pas executer sur une base de production contenant de vrais clients.

Comptes crees:

- `demo@nichoir.local`
- `lea.client@nichoir.local`
- `bob.client@nichoir.local`
- `noemie.suspendue@nichoir.local`
- `atelier@nichoir.local`

Mot de passe pour tous: `password123`.

Donnees incluses: clients actifs/suspendus, abonnements, paiements/factures demo, exports, credits, tickets ouverts/fermes, fils de messages support et notifications email tickets.
