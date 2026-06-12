# App FastAPI historique

Role: ancienne API de licence FastAPI/SQLite utilisee pour prototyper l'autorisation avant la plateforme PHP.

Etat actuel:

- Cette section est secondaire.
- Le serveur PHP dans `server-php/` est maintenant la cible principale pour comptes, credits, admin, API et Stripe.
- Ne pas ajouter de nouvelle logique produit ici sans decision explicite.

Fichiers importants:

- `main.py`: endpoints FastAPI de health, bootstrap dev, login et statut licence.
- `models.py`: tables SQLAlchemy de l'ancienne API.
- `database.py`: session SQLite SQLAlchemy.
- `security.py`: hash mot de passe et tokens.
- `settings.py`: configuration de cette API.

Usage si necessaire:

```bash
cd server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8018
```
