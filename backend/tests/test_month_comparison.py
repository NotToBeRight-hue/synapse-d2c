"""Tests for the monthly feature in this OneDrive project."""
from collections.abc import Iterator
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.core.database import get_db
from app.core.security import hash_token
from app.models.schemas import Base, Brand, ApiToken

@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    with factory() as db:
        db.add_all([Brand(id=1, name='Test brand'), Brand(id=2, name='Other')])
        db.flush()
        db.add_all([ApiToken(brand_id=1, token_hash=hash_token('test-token')), ApiToken(brand_id=2, token_hash=hash_token('other-token'))])
        db.commit()
    def dependency():
        with factory() as db:
            yield db
    app.dependency_overrides[get_db] = dependency
    monkeypatch.setattr('app.main.initialize_database', lambda: None)
    try:
        with TestClient(app) as value:
            value.headers.update({'Authorization': 'Bearer test-token', 'X-Brand-ID': '1'})
            yield value
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def report(month, revenue=1000, spend=100):
    return {'reporting_month': month, 'meta': [{'sku': 'A', 'spend': spend, 'revenue': revenue}],
            'shopify': [{'sku': 'A', 'revenue': revenue, 'margin': 0.5}],
            'erp': [{'sku': 'A', 'stock_units': 600, 'daily_velocity': 20}]}


def test_daily_snapshot_preserved_latest_report_replaces(client):
    daily = report('2026-08')
    daily.pop('reporting_month')
    daily['budget'] = 1000
    source = client.post('/api/sync', json=daily)
    assert source.status_code == 200
    for payload in [report('2026-08'), report('2026-09', 2000, 200), report('2026-09', 3000, 300)]:
        assert client.post('/api/sync/monthly', json=payload).status_code == 200
    comparison = client.get('/api/sync/compare?month1=2026-08&month2=2026-09')
    assert comparison.status_code == 200
    data = comparison.json()
    assert data['month1']['totals']['contribution'] == 400
    assert data['month2']['totals']['contribution'] == 1200
    assert data['changes']['contribution'] == {'absolute': 800, 'percent': 200}
    assert data['month1']['products'][0]['stock_days'] == 30
    assert len(client.get('/api/sync/months').json()) == 2
    assert client.get('/api/sync/latest').json()['snapshot_id'] == source.json()['snapshot_id']


def test_zero_negative_missing_sku_and_inventory(client):
    first = report('2026-08', 0, 0)
    first['erp'] = []
    second = report('2026-09', 100, 100)
    second['meta'].append({'sku': 'B', 'spend': 20, 'revenue': 60})
    second['shopify'].append({'sku': 'B', 'revenue': 60, 'margin': 0.5})
    for payload in [first, second]:
        assert client.post('/api/sync/monthly', json=payload).status_code == 200
    data = client.get('/api/sync/compare?month1=2026-08&month2=2026-09').json()
    assert data['changes']['contribution']['percent'] is None
    assert data['month1']['totals']['roas'] is None
    assert data['month1']['products'][0]['inventory_data_missing']
    assert len(data['month2']['products']) == 2
    assert data['month2']['totals']['contribution'] == -40


def test_authenticated_brand_isolation_and_missing_month(client):
    client.post('/api/sync/monthly', json=report('2026-08'))
    assert client.get('/api/sync/compare?month1=2026-08&month2=2026-09').status_code == 404
    client.headers.update({'Authorization': 'Bearer other-token', 'X-Brand-ID': '2'})
    assert client.get('/api/sync/months').json() == []
    client.headers.clear()
    assert client.get('/api/sync/months').status_code == 401


@pytest.mark.parametrize('month', ['2026-13', '26-08', '0000-01'])
def test_invalid_reporting_month(client, month):
    assert client.post('/api/sync/monthly', json=report(month)).status_code == 422


def test_same_month_rejected_and_channel_totals(client):
    payload = report('2026-08')
    payload['google'] = [{'sku': 'A', 'spend': 50, 'revenue': 300}]
    client.post('/api/sync/monthly', json=payload)
    client.post('/api/sync/monthly', json=report('2026-09'))
    assert client.get('/api/sync/compare?month1=2026-08&month2=2026-08').status_code == 422
    data = client.get('/api/sync/compare?month1=2026-08&month2=2026-09').json()
    assert data['month1']['totals']['revenue'] == 1300
    assert len(data['month1']['products']) == 1
    assert data['month1']['products'][0]['stock_days'] == 30


def test_existing_routes_remain_registered():
    paths = app.openapi()['paths']
    for path in ['/api/simulate', '/api/optimize', '/api/diagnostics', '/api/execute', '/api/scenarios', '/api/sync', '/api/auth/me', '/api/sync/compare']:
        assert path in paths


def test_migrations_repeat_and_preserve_brand():
    from app.migrations import upgrade
    engine = create_engine('sqlite://')
    upgrade(engine)
    with engine.begin() as db:
        db.execute(text("INSERT INTO brands (id, name, created_at, provider_token_refs) VALUES (1, 'Retained', CURRENT_TIMESTAMP, '{}')"))
        db.execute(text('DROP TABLE monthly_reports'))
        db.execute(text('DELETE FROM schema_migrations WHERE version=2'))
    upgrade(engine)
    upgrade(engine)
    with engine.connect() as db:
        assert db.execute(text('SELECT name FROM brands WHERE id=1')).scalar() == 'Retained'
        assert db.execute(text('SELECT MAX(version) FROM schema_migrations')).scalar() == 2
    engine.dispose()
