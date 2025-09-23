from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import get_settings
from .api.routes import (
    auth,
    clients,
    dashboard,
    financials,
    hr,
    marketing,
    monitoring,
    project_templates,
    projects,
    support,
)

settings = get_settings()

app = FastAPI(title=settings.project_name, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.api_v1_str)
app.include_router(dashboard.router, prefix=settings.api_v1_str)
app.include_router(projects.router, prefix=settings.api_v1_str)
app.include_router(project_templates.router, prefix=settings.api_v1_str)
app.include_router(clients.router, prefix=settings.api_v1_str)
app.include_router(financials.router, prefix=settings.api_v1_str)
app.include_router(support.router, prefix=settings.api_v1_str)
app.include_router(hr.router, prefix=settings.api_v1_str)
app.include_router(marketing.router, prefix=settings.api_v1_str)
app.include_router(monitoring.router, prefix=settings.api_v1_str)


@app.get("/")
def root() -> dict:
    return {"message": "Disenyorita & Isla unified platform API"}


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
