# Nichoir16 License API historique

Mini backend FastAPI/SQLite cree pour tester l'autorisation avant la plateforme PHP.

Etat actuel: cette section est secondaire. Le serveur cible actif est `server-php/`, qui gere maintenant comptes, credits, admin, API, billing placeholder et webhook Stripe. Ne pas ajouter de nouvelle logique produit ici sans decision explicite.

## Structure

- `app/`: code FastAPI historique. Voir `app/README.md`.
- `requirements.txt`: dependances Python de ce prototype.

## Installer l'API

Depuis `/home/marc/Documents/nichoir16/server` :

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8018
```

SQLite creera automatiquement le fichier `nichoir16.db` dans ce dossier au premier demarrage.

## Creer l'utilisateur demo

```bash
curl -X POST http://127.0.0.1:8018/dev/bootstrap
```

Compte demo :

```text
demo@nichoir.local
demo1234
```

## Tester login + licence

```bash
curl -X POST http://127.0.0.1:8018/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@nichoir.local","password":"demo1234"}'
```

Ensuite utiliser le `access_token` retourne :

```bash
curl http://127.0.0.1:8018/license/status \
  -H 'Authorization: Bearer TOKEN_ICI'
```

## Role dans la migration WASM

Cette API ne remplace pas le WASM. Elle sert a autoriser l'utilisation :

1. Le navigateur charge l'app.
2. L'utilisateur se connecte.
3. L'API confirme que la licence est active.
4. L'app active les fonctions payantes.
5. Stripe remplacera plus tard la creation manuelle de licence.
