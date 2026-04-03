import sqlite3, struct
from pathlib import Path

# Query MasterEquipmentLevel.db
db = Path(r'D:\Slime Isekai Memories Game Files\TextAsset\MasterEquipmentLevel.db')
conn = sqlite3.connect(str(db))
tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print('Tables in MasterEquipmentLevel.db:', [t[0] for t in tables])
for t in tables[:2]:
    cols = [c[1] for c in conn.execute(f'PRAGMA table_info({t[0]})').fetchall()]
    print(f'  {t[0]} cols:', cols)
    # Count rows and show max
    cnt = conn.execute(f'SELECT COUNT(*) FROM {t[0]}').fetchone()[0]
    print(f'  row count: {cnt}')
    # Show sample rows
    for row in conn.execute(f'SELECT * FROM {t[0]} LIMIT 3').fetchall():
        print(' ', row)
    # Show max level entries for group 43 and 73
    for gid in [43, 73]:
        rows = conn.execute(f'SELECT * FROM {t[0]} WHERE master_equipment_level_group_id=? ORDER BY level DESC LIMIT 3', (gid,)).fetchall()
        if rows:
            print(f'  Group {gid} top levels:', rows)
conn.close()
