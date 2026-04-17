# Local Database Setup

You have two options for your local database. Read both before deciding.

---

## Option A — Use the Railway database directly (simplest)

The `.env.local.example` file already contains the Railway connection string.
If you copy it into `.env.local` unchanged, your local server will read and
write from the same database as production.

**When this is fine:**
- You are the only developer
- You are testing features that need real data already in the database
- You want the simplest possible setup

**When this is risky:**
- You are testing destructive operations (deleting submissions, schema changes)
- You are running automated tests that create many fake records
- You want a true sandbox where mistakes can't affect clients

If Option A is good enough for you, there is nothing to install. Skip to the
"Run the schema migration" section below.

---

## Option B — Create a fully local database (safest)

This keeps your local machine and Railway completely separate. Nothing you do
locally can touch the live database.

### 1. Install Postgres on your Mac

If you don't have Postgres installed:

```
brew install postgresql@16
```

Start it and make it start automatically on login:

```
brew services start postgresql@16
```

Verify it is running:

```
psql --version
```

### 2. Create the local database

```
psql postgres -c "CREATE DATABASE wellspring_local;"
```

### 3. Update DATABASE_URL in .env.local

Replace the Railway connection string with your local one:

```
DATABASE_URL=postgresql://localhost:5432/wellspring_local
```

If your local Postgres requires a username and password, the format is:

```
DATABASE_URL=postgresql://YOUR_MAC_USERNAME:@localhost:5432/wellspring_local
```

To find your Mac username, run:

```
whoami
```

---

## Run the schema migration

This creates the `submissions` and `promo_codes` tables. It is safe to run
multiple times — it uses `CREATE TABLE IF NOT EXISTS`, so it will not
overwrite existing data.

Make sure your `.env.local` has the correct `DATABASE_URL`, then run:

```
node --env-file=.env.local db/migrate.js
```

Or using the npm script:

```
npm run migrate
```

Wait, the migrate script uses `.env` not `.env.local`. Run the node command
directly as shown above, or temporarily copy your `DATABASE_URL` into `.env`.

Expected output:

```
Migration complete — schema is up to date.
```

---

## Import existing data from submissions.json (optional)

If you have records in `data/submissions.json` from before the Postgres
migration and want to load them into your database:

```
node --env-file=.env.local db/import-existing.js
```

This script uses `ON CONFLICT DO NOTHING`, so it is safe to run multiple times.
Records that already exist in the database are skipped, not overwritten.

Expected output:

```
Found 4 record(s) in submissions.json.
  Inserted : 1776277502782 — Walmart Foundation
  Skipped  : 1776278064451 — already exists
  ...
Done. Inserted: 2 | Skipped: 2 | Failed: 0
```

If you see any `Failed` entries, check the error message — it usually means a
field value is too long for a column constraint, or the database connection
failed.

---

## Verify everything is working

Start the local server:

```
npm run dev:watch
```

Open http://localhost:3000/admin in your browser. If you see the admin
dashboard (it will ask for a password — use `localadmin`), the database
connection is working. If submissions are listed, the import worked.
