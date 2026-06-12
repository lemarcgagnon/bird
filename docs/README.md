# Documentation projet

Role: notes de travail, roadmap et securite. Ce dossier doit aider a reprendre rapidement l'etat du projet sans relire tout le code.

Fichiers importants:

- `reste-a-faire.md`: backlog detaille, etat des phases et prochaines etapes.
- `securizons.md`: analyse des surfaces d'attaque WASM/PHP et checklist securite.

Regles d'usage:

- Mettre a jour ces fichiers quand l'architecture change.
- Garder les statuts concrets: fait, restant, risque connu.
- Ne pas documenter une promesse comme livree tant que le code et les tests ne suivent pas.

Points de vigilance:

- Stripe est encore placeholder cote Checkout.
- La signature Stripe reelle, le rate limiting, le CSRF admin, la CSP et le sanitizer SVG complet restent a faire avant production.
- Le serveur PHP est maintenant le maitre pour compte/credits/admin/API; l'app/WASM est le client calcul.
