"""Small, same-contract reaction API; run behind Apache, never on a public port."""
import hashlib
import json
import os
import re
import sqlite3
import time
from pathlib import Path

from flask import Flask, jsonify, request
from werkzeug.exceptions import HTTPException

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 2048
DB = os.environ.get('PELICAN_DB', '/home/pelican-reactions/data/reactions.sqlite3')
WORKS = json.loads(Path(__file__).with_name('works.json').read_text())
REACTIONS = 'like love clap laugh wow sweat-smile sweat cry think fire eyes skull smile grin rolling-laugh joy wink cool heart-eyes party facepalm shrug upside-down neutral unamused eye-roll pleading sob angry scream sleep robot poop thumbs-down hundred rocket'.split()
ORIGINS = {'https://isayrhythm.github.io'}
UUID = re.compile(r'^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$', re.I)

def connect():
    db = sqlite3.connect(DB, timeout=5)
    db.execute('PRAGMA busy_timeout=5000')
    return db

def initialize():
    with connect() as db:
        db.execute('PRAGMA journal_mode=WAL')
        db.executescript('''
          CREATE TABLE IF NOT EXISTS votes(visitor TEXT, work TEXT, reaction TEXT,
            PRIMARY KEY(visitor,work,reaction)) WITHOUT ROWID;
          CREATE TABLE IF NOT EXISTS counts(work TEXT, reaction TEXT, total INTEGER CHECK(total>=0),
            PRIMARY KEY(work,reaction)) WITHOUT ROWID;
          CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY, minute INTEGER, total INTEGER) WITHOUT ROWID;
        ''')

def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()

def limited(visitor=None):
    minute = int(time.time()) // 60
    # Apache overwrites this header. Backend is bound to loopback only.
    ip = request.headers.get('X-Pelican-IP', request.remote_addr or '')
    buckets = [('global', 1200), ('ip:' + digest(ip), 180)]
    if visitor:
        buckets.append(('visitor:' + visitor, 60))
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        db.execute('DELETE FROM limits WHERE minute < ?', (minute - 2,))
        for key, maximum in buckets:
            row = db.execute('SELECT minute,total FROM limits WHERE key=?', (key,)).fetchone()
            if row and row[0] == minute and row[1] >= maximum:
                return True
        for key, _ in buckets:
            db.execute('''INSERT INTO limits VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET
              total=CASE WHEN minute=excluded.minute THEN total+1 ELSE 1 END,
              minute=excluded.minute''', (key, minute))
    return False

@app.after_request
def headers(response):
    origin = request.headers.get('Origin', '')
    if origin in ORIGINS or re.fullmatch(r'http://(localhost|127\.0\.0\.1)(:\d+)?', origin):
        response.headers['Access-Control-Allow-Origin'] = origin
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Max-Age'] = '86400'
    response.headers['Vary'] = 'Origin'
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    if response.status_code == 429:
        response.headers['Retry-After'] = str(60 - int(time.time()) % 60)
    return response

@app.errorhandler(Exception)
def error(exc):
    if isinstance(exc, HTTPException):
        return jsonify(error=exc.name), exc.code
    app.logger.error('Reaction request failed: %s', type(exc).__name__)
    return jsonify(error='表情服务暂时不可用'), 503

@app.route('/health', methods=['GET'])
def health():
    if limited():
        return jsonify(error='请求过于频繁，请一分钟后再试'), 429
    with connect() as db:
        db.execute('SELECT 1').fetchone()
    return jsonify(ok=True, service='pelican-benchmark-reactions')

@app.route('/reactions', methods=['GET', 'POST', 'OPTIONS'])
def reactions():
    origin = request.headers.get('Origin', '')
    if origin not in ORIGINS and not re.fullmatch(r'http://(localhost|127\.0\.0\.1)(:\d+)?', origin):
        return jsonify(error='Origin not allowed'), 403
    if request.method == 'OPTIONS':
        if limited():
            return jsonify(error='请求过于频繁，请一分钟后再试'), 429
        return '', 204
    # Rate-limit even malformed requests before parsing input.
    if limited():
        return jsonify(error='请求过于频繁，请一分钟后再试'), 429
    payload = request.get_json() if request.method == 'POST' else request.args
    if not isinstance(payload, dict) and request.method == 'POST':
        return jsonify(error='Invalid JSON'), 400
    visitor_id = payload.get('visitorId', '')
    if not isinstance(visitor_id, str) or not UUID.fullmatch(visitor_id):
        return jsonify(error='Invalid visitor ID'), 400
    visitor = digest(visitor_id)
    # Visitor bucket only: global/IP already charged above.
    minute = int(time.time()) // 60
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        key = 'visitor:' + visitor
        row = db.execute('SELECT minute,total FROM limits WHERE key=?', (key,)).fetchone()
        if row and row[0] == minute and row[1] >= 60:
            return jsonify(error='请求过于频繁，请一分钟后再试'), 429
        db.execute('''INSERT INTO limits VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET
          total=CASE WHEN minute=excluded.minute THEN total+1 ELSE 1 END,
          minute=excluded.minute''', (key, minute))
    if request.method == 'POST':
        work, reaction, active = payload.get('workId'), payload.get('reaction'), payload.get('active')
        if work not in WORKS or reaction not in REACTIONS or type(active) is not bool:
            return jsonify(error='Invalid reaction'), 400
        with connect() as db:
            db.execute('BEGIN IMMEDIATE')
            exists = db.execute('SELECT 1 FROM votes WHERE visitor=? AND work=? AND reaction=?', (visitor, work, reaction)).fetchone()
            if bool(exists) != active:
                if active:
                    db.execute('INSERT INTO votes VALUES(?,?,?)', (visitor, work, reaction))
                    db.execute('''INSERT INTO counts VALUES(?,?,1) ON CONFLICT(work,reaction)
                      DO UPDATE SET total=total+1''', (work, reaction))
                else:
                    db.execute('DELETE FROM votes WHERE visitor=? AND work=? AND reaction=?', (visitor, work, reaction))
                    db.execute('UPDATE counts SET total=total-1 WHERE work=? AND reaction=?', (work, reaction))
    ids = [payload['workId']] if request.method == 'POST' else WORKS
    result = {work: {'counts': dict.fromkeys(REACTIONS, 0), 'selected': []} for work in ids}
    with connect() as db:
        db.execute('BEGIN')
        for work, reaction, total in db.execute('SELECT work,reaction,total FROM counts'):
            if work in result and reaction in REACTIONS:
                result[work]['counts'][reaction] = total
        for work, reaction in db.execute('SELECT work,reaction FROM votes WHERE visitor=?', (visitor,)):
            if work in result and reaction in REACTIONS:
                result[work]['selected'].append(reaction)
    if request.method == 'POST':
        return jsonify(workId=payload['workId'], **result[payload['workId']])
    return jsonify(works=result)

initialize()
