# Frontend Application

Next.js 14 dashboard providing the unified portal interface for the Disenyorita & Isla platform. Pages map to the core modules
(Projects, CRM, Finance, Support, HR, Marketing, Monitoring) and pull data from the FastAPI backend.

## Getting started

```bash
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_BASE` to the deployed backend URL. Defaults to `http://localhost:8000/api/v1` for local development.

## Quality checks

```bash
npm run lint
npm run typecheck
```
