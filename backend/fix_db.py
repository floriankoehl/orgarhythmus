"""
Fix database schema to match current models.
The DB has columns from a different migration branch that need renaming.
"""
import sqlite3

conn = sqlite3.connect('db.sqlite3')
c = conn.cursor()

# 1. Fix api_dimension: rename created_by_id -> owner_id, drop extra columns
c.execute("PRAGMA table_info(api_dimension)")
dim_cols = {r[1] for r in c.fetchall()}
print(f"api_dimension columns before: {dim_cols}")

if 'created_by_id' in dim_cols and 'owner_id' not in dim_cols:
    print("Renaming api_dimension.created_by_id -> owner_id")
    c.execute("ALTER TABLE api_dimension RENAME COLUMN created_by_id TO owner_id")

# 2. Fix api_category: rename created_by_id -> owner_id if needed
c.execute("PRAGMA table_info(api_category)")
cat_cols = {r[1] for r in c.fetchall()}
print(f"\napi_category columns before: {cat_cols}")

if 'created_by_id' in cat_cols and 'owner_id' not in cat_cols:
    print("Renaming api_category.created_by_id -> owner_id")
    c.execute("ALTER TABLE api_category RENAME COLUMN created_by_id TO owner_id")
elif 'owner_id' not in cat_cols:
    print("Adding api_category.owner_id")
    c.execute("ALTER TABLE api_category ADD COLUMN owner_id INTEGER REFERENCES auth_user(id) ON DELETE SET NULL")

# 3. Check api_idea has owner_id
c.execute("PRAGMA table_info(api_idea)")
idea_cols = {r[1] for r in c.fetchall()}
print(f"\napi_idea columns: {idea_cols}")
if 'owner_id' not in idea_cols:
    print("Adding api_idea.owner_id")
    c.execute("ALTER TABLE api_idea ADD COLUMN owner_id INTEGER REFERENCES auth_user(id) ON DELETE SET NULL")

# 4. Check api_legendtype has dimension_id
c.execute("PRAGMA table_info(api_legendtype)")
lt_cols = {r[1] for r in c.fetchall()}
print(f"\napi_legendtype columns: {lt_cols}")
if 'dimension_id' not in lt_cols:
    print("Adding api_legendtype.dimension_id")
    c.execute("ALTER TABLE api_legendtype ADD COLUMN dimension_id INTEGER REFERENCES api_dimension(id) ON DELETE CASCADE")

# 5. Ensure adoption tables exist
c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='api_usercategoryadoption'")
if not c.fetchone():
    print("\nCreating api_usercategoryadoption")
    c.execute("""CREATE TABLE api_usercategoryadoption (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        adopted_at TEXT NOT NULL,
        category_id INTEGER NOT NULL REFERENCES api_category(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
        UNIQUE(user_id, category_id)
    )""")

c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='api_userdimensionadoption'")
if not c.fetchone():
    print("\nCreating api_userdimensionadoption")
    c.execute("""CREATE TABLE api_userdimensionadoption (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        adopted_at TEXT NOT NULL,
        dimension_id INTEGER NOT NULL REFERENCES api_dimension(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
        UNIQUE(user_id, dimension_id)
    )""")

conn.commit()

# Verify
print("\n=== AFTER FIX ===")
for table in ['api_dimension', 'api_category', 'api_idea', 'api_legendtype']:
    c.execute(f"PRAGMA table_info({table})")
    cols = [r[1] for r in c.fetchall()]
    print(f"{table}: {cols}")

c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'api_user%adoption'")
print(f"Adoption tables: {[r[0] for r in c.fetchall()]}")

conn.close()
print("\nDone! Now run: python manage.py migrate --fake")
