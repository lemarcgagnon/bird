# Documentation projet

Role: notes de travail, roadmap et securite. Ce dossier doit aider a reprendre rapidement l'etat du projet sans relire tout le code.

Fichiers importants:

- `admin-hig.md`: conventions HIG du back-office PHP pour normaliser `/admin` par domaine.
- `admin-refonte-etat.md`: etat concret du chantier admin, livrables faits et limites connues.
- `admin-refonte-plan.md`: ordre de travail restant pour terminer la refonte `/admin`.
- `reste-a-faire.md`: backlog detaille, etat des phases et prochaines etapes.
- `securizons.md`: analyse des surfaces d'attaque WASM/PHP et checklist securite.

Regles d'usage:

- Mettre a jour ces fichiers quand l'architecture change.
- Garder les statuts concrets: fait, restant, risque connu.
- Ne pas documenter une promesse comme livree tant que le code et les tests ne suivent pas.

Points de vigilance:

- Stripe Checkout/portail/factures sont maintenant branches cote PHP, avec signature webhook quand le secret Stripe est configure.
- La config DB cPanel/MySQL est branchee dans `/admin` > `Reglages`; SQLite reste le mode local par defaut.
- Les exports admin de base sont disponibles en CSV, Excel compatible `.xls` et JSON depuis `/admin` > `Exports`.
- Les logs admin sont maintenant exportables en CSV, Excel compatible `.xls`, JSON et SQL depuis `/admin` > `Logs`, avec filtres rapides et avances.
- `/admin` suit maintenant une grille HIG active: detail en modal, clic direct sur l element principal des listes, badges metier et separation nette par domaine.
- Le rate limiting, le CSRF admin, la CSP et le sanitizer SVG complet restent a faire avant production.
- Le script de packaging/installation cPanel reste a creer avant copie finale sur serveur.
- Le serveur PHP est maintenant le maitre pour compte/credits/admin/API; l'app/WASM est le client calcul.
