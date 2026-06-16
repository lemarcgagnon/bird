# Historical FastAPI app

Role: old FastAPI/SQLite license API used to prototype authorization before the PHP platform.

Current status:

- Secondary reference only.
- The active backend is `server-php/`.
- Do not add product behavior here without an explicit decision to revive this prototype.

Files:

- `main.py`: FastAPI app with health, optional dev bootstrap, login and license status endpoints.
- `models.py`: SQLAlchemy tables for users, sessions and licenses.
- `database.py`: SQLAlchemy engine/session setup using `DATABASE_URL`.
- `security.py`: password hashing and token helpers.
- `settings.py`: Pydantic settings loaded from environment or optional `.env`.

Useful command:

```bash
cd server
ALLOW_DEV_BOOTSTRAP=true uvicorn app.main:app --reload --host 127.0.0.1 --port 8018
```

The current WASM/PHP app does not call this API.
