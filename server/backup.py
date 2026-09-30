import sqlite3
from pathlib import Path
from datetime import datetime

root = Path('/home/pelican-reactions/data')
backups = root / 'backups'
backups.mkdir(exist_ok=True)
with sqlite3.connect(root / 'reactions.sqlite3') as source:
    with sqlite3.connect(backups / (datetime.now().strftime('%Y-%m-%d') + '.sqlite3')) as dest:
        source.backup(dest)
# Retain the last 14 daily snapshots; no user/project files are touched.
for old in sorted(backups.glob('????-??-??.sqlite3'))[:-14]:
    old.unlink()
