# Backend API

FastAPI application serving as the unified API for the Disenyorita & Isla operations platform. The service exposes read-focused endpoints backed by an in-memory store that mirrors the data structures described in the project specification. It is intended as a foundation that can be extended with a persistent database and production-ready authentication.

## Getting started

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Testing

```bash
pytest
```
