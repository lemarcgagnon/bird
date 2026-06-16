# Nichoir16 historical FastAPI license API

This folder is the old FastAPI/SQLite prototype used to test login and license authorization before the PHP platform existed.

Current status: secondary reference only. The active backend is `server-php/`, which now owns accounts, credits, admin, public pages, API, billing, Stripe, tickets, contact email and deployment.

## Structure

- `app/`: FastAPI prototype code. See `app/README.md`.
- `.env.example`: optional local development example for this historical prototype only.
- `requirements.txt`: Python dependencies for this prototype.

## Local use if needed

Copy `.env.example` to `.env` only when you need to override the defaults from `app/settings.py`. This is for the historical prototype, not for the PHP/Namecheap production app.

```bash
cd /home/marc/Documents/nichoir16/server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Optional `.env` for dev bootstrap:

```text
ALLOW_DEV_BOOTSTRAP=true
CORS_ORIGINS=http://127.0.0.1:8016
DATABASE_URL=sqlite:///./nichoir16.db
```

Start the prototype:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8018
```

SQLite creates `nichoir16.db` in this folder on first startup.

## Endpoints

- `GET /health`
- `POST /dev/bootstrap` when `ALLOW_DEV_BOOTSTRAP=true`
- `POST /auth/login`
- `GET /license/status` with a bearer token

The prototype may define local bootstrap credentials in `settings.py`. Treat them as development-only and do not copy them into production docs, public assets or release artifacts.

## Boundary

Do not add new product logic here unless the project explicitly reactivates this FastAPI prototype. New account, billing, credit and export authorization work belongs in `server-php/`.
