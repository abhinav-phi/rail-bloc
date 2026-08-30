from fastapi.testclient import TestClient

from apps.api.main import app


def test_metrics_endpoint_exposes_runtime_metrics():
    client = TestClient(app)
    response = client.get('/metrics')

    assert response.status_code == 200
    assert 'railbloc_requests_total' in response.text
    assert 'railbloc_outbox_pending' in response.text
