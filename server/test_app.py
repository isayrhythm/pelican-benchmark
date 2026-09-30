"""Isolated SQLite tests; no production votes are changed."""
import os
import tempfile
import uuid

with tempfile.TemporaryDirectory(prefix='pelican-test-') as folder:
    os.environ['PELICAN_DB'] = os.path.join(folder, 'test.sqlite3')
    from app import app, WORKS
    client = app.test_client()
    headers = {'Origin': 'https://isayrhythm.github.io', 'X-Pelican-IP': 'test'}
    visitor = str(uuid.uuid4())
    url = '/reactions?visitorId=' + visitor
    response = client.get(url, headers=headers)
    assert response.status_code == 200
    assert response.headers['Access-Control-Allow-Origin'] == headers['Origin']
    assert len(response.json['works']) == 19
    payload = dict(visitorId=visitor, workId=WORKS[0], reaction='sweat-smile', active=True)
    for _ in range(3):
        response = client.post('/reactions', json=payload, headers=headers)
        assert response.status_code == 200
        assert response.json['counts']['sweat-smile'] == 1
    second = dict(payload, visitorId=str(uuid.uuid4()))
    assert client.post('/reactions', json=second, headers=headers).json['counts']['sweat-smile'] == 2
    payload['active'] = False
    for _ in range(2):
        assert client.post('/reactions', json=payload, headers=headers).json['counts']['sweat-smile'] == 1
    assert client.get(url, headers=headers).json['works'][WORKS[0]]['selected'] == []
    assert client.get(url, headers={'Origin': 'https://evil.invalid'}).status_code == 403
    assert client.post('/reactions', data='x' * 3000, content_type='application/json', headers=headers).status_code == 413
    assert client.post('/reactions', json=dict(payload, workId='unknown'), headers=headers).status_code == 400
    assert client.options('/reactions', headers=headers).status_code == 204
    visitor2 = str(uuid.uuid4())
    statuses = [client.get('/reactions?visitorId=' + visitor2, headers=headers).status_code for _ in range(61)]
    assert statuses[:60] == [200] * 60 and statuses[60] == 429
    print('PASS: contract, persistence, idempotence, cancellation, CORS, body bounds, allowlist, visitor limit')
