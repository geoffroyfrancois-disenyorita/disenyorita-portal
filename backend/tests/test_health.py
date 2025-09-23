from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_dashboard_snapshot() -> None:
    response = client.get("/api/v1/dashboard")
    assert response.status_code == 200
    payload = response.json()
    assert "projects" in payload
    assert payload["projects"]["total_projects"] >= 1
