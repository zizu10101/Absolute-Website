# Self-hosted Supabase Migration

Copies the live hosted Supabase project to a self-hosted Supabase instance on a VPS.
The script is **idempotent** — safe to rerun for rehearsals and final cutover.

## Prerequisites

Install these on the machine that runs the script (your laptop or the VPS):

| Tool | Needed for |
|---|---|
| `pg_dump` / `psql` | Schema + data dump and restore |
| `curl` | Storage API calls |
| `jq` | JSON parsing |
| `python3` | Host extraction from DB URLs |
| `file` (libmagic) | MIME-type detection during upload |

**Postgres client version must be ≥ source server version.**
Supabase hosted runs PostgreSQL 15 as of 2026. If your VPS pg_dump is older, install
the matching version first:

```bash
# Debian/Ubuntu example
sudo apt install postgresql-client-15
```

The script checks this and aborts if the client is too old.

## Environment Variables

Export these before running. Never hardcode them.

```bash
# Source — hosted Supabase (session pooler URL, port 5432)
export SRC_DB_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"
export SRC_SUPABASE_URL="https://nvyfktdhzhujeltkbgrz.supabase.co"
export SRC_SERVICE_KEY="eyJ..."   # service_role key from hosted project Settings → API

# Destination — self-hosted Supabase on VPS
export DST_DB_URL="postgresql://postgres:[password]@db.edgedbs.com:5432/postgres"
export DST_SUPABASE_URL="https://db.edgedbs.com"
export DST_SERVICE_KEY="eyJ..."   # service_role key from self-hosted project Settings → API
```

> **SRC_DB_URL must use the session pooler** (port 5432, not 6543).
> `pg_dump` requires a persistent session connection; transaction mode (6543) will fail.

## Running

```bash
# Make executable once
chmod +x scripts/migrate-to-selfhosted.sh

# Run (from repo root)
bash scripts/migrate-to-selfhosted.sh 2>&1 | tee migration-$(date +%F).log
```

The script prints timings for each of the six steps and aborts on the first error.
A complete run with ~2000 storage files typically takes 10–20 minutes depending on
network speed between hosted Supabase and your VPS.

## What the Script Does

| Step | Action |
|---|---|
| 0 | Verifies pg_dump client version ≥ source server version |
| 1 | `pg_dump --schema=public` — schema + data + grants + RLS policies |
| 2 | `pg_dump --data-only` for `auth.users` and `auth.identities` (preserves staff logins) |
| 3 | On destination: `DROP SCHEMA public CASCADE`, recreate, restore dump; restore auth with triggers suppressed |
| 4 | Recursively lists the `media` bucket via Storage API, downloads each file, uploads to destination |
| 5 | Rewrites `nvyfktdhzhujeltkbgrz.supabase.co` → `db.edgedbs.com` in all `text`, `varchar`, `jsonb`, and `text[]` columns; reports which columns are affected before changing them |
| 6 | Row-count comparison per table, assert 0 remaining old-host URLs, HTTP spot-check of one image |

## After a Successful Run

1. Update app environment variables to point at the new instance:
   - `VITE_SUPABASE_URL` → `https://db.edgedbs.com`
   - `VITE_SUPABASE_ANON_KEY` → anon key from self-hosted project
   - Any server-side `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` references in `server.ts`
2. Update `GOOGLE_SHEET_ID` in the destination's `settings` table if needed.
3. Do a smoke-test login and a full POS transaction on the destination before switching DNS.

## Postgres Version Note

`pg_dump` uses a binary protocol that is **forward-compatible** (a newer client can always
dump an older server) but **not backward-compatible** (an older client cannot dump a newer
server). Rule: **pg_dump client version ≥ source server version ≥ destination server version**.

If source is v15 and your destination self-hosted Supabase is v14, the script will warn
but continue — the dump will likely restore fine for the features this project uses, but
any v15-only SQL features in the schema would fail. Matching versions is safest.
