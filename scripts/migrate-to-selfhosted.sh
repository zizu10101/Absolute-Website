#!/usr/bin/env bash
# migrate-to-selfhosted.sh
# Copies hosted Supabase (PostgreSQL 17) → self-hosted Supabase on a VPS (PostgreSQL 15).
# Safe to rerun (public schema is fully replaced each run).
set -euo pipefail

# ── Helpers ───────────────────────────────────────────────────────────────────
die()   { echo "ERROR: $*" >&2; exit 1; }
log()   { echo "[$(date '+%H:%M:%S')] $*"; }
T_STEP=0
step()  { echo; echo "══════ $* ══════"; T_STEP=$(date +%s); }
done_() { log "done ($(( $(date +%s) - T_STEP ))s)"; }

# URL-encode each path segment (not the slashes between them)
urlencode_path() {
  python3 -c "
import sys
from urllib.parse import quote
print('/'.join(quote(s, safe='') for s in sys.argv[1].split('/')))
" "$1"
}

# ── Required env vars ─────────────────────────────────────────────────────────
: "${SRC_DB_URL:?SRC_DB_URL not set}"
: "${DST_DB_URL:?DST_DB_URL not set}"
: "${SRC_SUPABASE_URL:?SRC_SUPABASE_URL not set}"
: "${SRC_SERVICE_KEY:?SRC_SERVICE_KEY not set}"
: "${DST_SUPABASE_URL:?DST_SUPABASE_URL not set}"
: "${DST_SERVICE_KEY:?DST_SERVICE_KEY not set}"

# ── Tool check ────────────────────────────────────────────────────────────────
for t in pg_dump psql curl jq python3; do
  command -v "$t" >/dev/null 2>&1 || die "Required tool not found: $t (install it first)"
done

# ── Safety: refuse if SRC and DST point at the same host ─────────────────────
_host() { python3 -c "import sys; from urllib.parse import urlparse; print(urlparse(sys.argv[1]).hostname)" "$1"; }
SRC_HOST=$(_host "$SRC_DB_URL")
DST_HOST=$(_host "$DST_DB_URL")
log "Source DB:      $SRC_HOST"
log "Destination DB: $DST_HOST"
[[ "$SRC_HOST" == "$DST_HOST" ]] && die "SRC_DB_URL and DST_DB_URL point at the same host ($SRC_HOST). Aborting."

# Refuse to target hosted Supabase as the destination
[[ "$DST_HOST" == *"supabase.co"* ]] && \
  die "DST_DB_URL points at hosted Supabase ($DST_HOST). Set DST_DB_URL to your self-hosted VPS."
[[ "$DST_HOST" == *"pooler.supabase.com"* ]] && \
  die "DST_DB_URL points at a Supabase pooler ($DST_HOST). Set DST_DB_URL to your self-hosted VPS."

# ── Require destination user = supabase_admin ─────────────────────────────────
DST_USER=$(psql -v ON_ERROR_STOP=1 "$DST_DB_URL" -At -c "SELECT current_user;" 2>&1) || \
  die "Cannot connect to destination DB: $DST_USER"
[[ "$DST_USER" != "supabase_admin" ]] && \
  die "DST_DB_URL must authenticate as supabase_admin (got: $DST_USER). Update the connection string credentials."

# ── Confirmation before any destructive write ─────────────────────────────────
echo
echo "WARNING: This will TRUNCATE auth.users and DROP + RECREATE public on:"
echo "  $DST_HOST"
echo -n "Type the destination host to confirm: "
read -r CONFIRM_HOST < /dev/tty
[[ "$CONFIRM_HOST" != "$DST_HOST" ]] && die "Confirmation '$CONFIRM_HOST' does not match '$DST_HOST'. Aborting."

# ── Constants ─────────────────────────────────────────────────────────────────
readonly OLD_HOST="nvyfktdhzhujeltkbgrz.supabase.co"
readonly NEW_HOST="${NEW_HOST:-db.edgedbs.com}"
readonly OLD_BASE="https://${OLD_HOST}/storage/v1/object/public/media/"
readonly NEW_BASE="https://${NEW_HOST}/storage/v1/object/public/media/"
readonly BUCKET="media"

# ── Temp workspace ────────────────────────────────────────────────────────────
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
log "Work dir: $WORK"

# ═══════════════════════════════════════════════════════════════════════════════
step "Postgres version check"
# ═══════════════════════════════════════════════════════════════════════════════
SRC_PG=$(psql -v ON_ERROR_STOP=1 "$SRC_DB_URL" -At -c "SELECT current_setting('server_version_num')::int / 10000;")
DST_PG=$(psql -v ON_ERROR_STOP=1 "$DST_DB_URL" -At -c "SELECT current_setting('server_version_num')::int / 10000;")
CLIENT_PG=$(pg_dump --version | grep -oP '\d+' | head -1)
log "Source server:        PostgreSQL $SRC_PG"
log "Destination server:   PostgreSQL $DST_PG"
log "pg_dump client:       PostgreSQL $CLIENT_PG"

# pg_dump 17+ required: source is 17.6; a lower-version client cannot read newer format.
(( CLIENT_PG < 17 )) && \
  die "pg_dump client (v${CLIENT_PG}) must be v17+ to dump a PostgreSQL 17.6 source. Install postgresql-client-17."

(( DST_PG < SRC_PG )) && \
  log "WARN: destination (v${DST_PG}) < source (v${SRC_PG}). transaction_timeout lines will be stripped from dumps."
done_

# ═══════════════════════════════════════════════════════════════════════════════
step "Step 1 — pg_dump public schema (schema + data + grants + RLS)"
# ═══════════════════════════════════════════════════════════════════════════════
# --no-owner        : skip ALTER TABLE ... OWNER TO (roles may differ on dst)
# --no-privileges   is NOT set, so GRANT/REVOKE statements ARE included
# RLS policies and ENABLE ROW LEVEL SECURITY are always dumped by default
pg_dump \
  --schema=public \
  --no-owner \
  --format=plain \
  --file="$WORK/public.sql" \
  "$SRC_DB_URL"
# SET transaction_timeout was introduced in PG17; PG15 destination does not recognise it
grep -v 'SET transaction_timeout' "$WORK/public.sql" > "$WORK/public_clean.sql"
mv "$WORK/public_clean.sql" "$WORK/public.sql"
# The script already issues CREATE SCHEMA public in step 3b; drop the duplicate
sed -i '/^CREATE SCHEMA public;/d' "$WORK/public.sql"
log "Dump size: $(du -sh "$WORK/public.sql" | cut -f1)"
done_

# ═══════════════════════════════════════════════════════════════════════════════
step "Step 2 — Dump auth.users + auth.identities (data only)"
# ═══════════════════════════════════════════════════════════════════════════════
# Data only — the auth schema structure already exists on self-hosted Supabase.
# These two tables are sufficient to preserve staff logins and passwords.
pg_dump \
  --data-only \
  --table='auth.users' \
  --table='auth.identities' \
  --format=plain \
  --file="$WORK/auth_data.sql" \
  "$SRC_DB_URL"
grep -v 'SET transaction_timeout' "$WORK/auth_data.sql" > "$WORK/auth_clean.sql"
mv "$WORK/auth_clean.sql" "$WORK/auth_data.sql"
log "Auth dump size: $(du -sh "$WORK/auth_data.sql" | cut -f1)"
done_

# ═══════════════════════════════════════════════════════════════════════════════
step "Step 3 — Restore into destination"
# ═══════════════════════════════════════════════════════════════════════════════

# -- 3a: Auth first (before public, so FK refs from public → auth work) --------
log "Truncating auth.users + auth.identities on destination..."
psql -v ON_ERROR_STOP=1 "$DST_DB_URL" <<'SQL'
SET session_replication_role = replica;
TRUNCATE auth.identities CASCADE;
TRUNCATE auth.users CASCADE;
SET session_replication_role = DEFAULT;
SQL

log "Restoring auth.users + auth.identities (triggers suppressed)..."
# session_replication_role = replica disables FK/row triggers so inserts don't
# fire invite emails or other side-effects.
# Requires superuser; self-hosted Supabase's supabase_admin has that.
{
  echo "SET session_replication_role = replica;"
  cat "$WORK/auth_data.sql"
  echo "SET session_replication_role = DEFAULT;"
} | psql -v ON_ERROR_STOP=1 "$DST_DB_URL"

# -- 3b: Drop and recreate public schema --------------------------------------
log "Dropping and recreating public schema on destination..."
psql -v ON_ERROR_STOP=1 "$DST_DB_URL" <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
SQL

log "Restoring public schema..."
psql -v ON_ERROR_STOP=1 --single-transaction "$DST_DB_URL" < "$WORK/public.sql"

log "Reloading PostgREST schema cache..."
psql -v ON_ERROR_STOP=1 "$DST_DB_URL" -c "NOTIFY pgrst, 'reload schema';"
done_

# ═══════════════════════════════════════════════════════════════════════════════
step "Step 4 — Storage bucket migration (${BUCKET})"
# ═══════════════════════════════════════════════════════════════════════════════

# Ensure destination bucket exists as public (409 if already exists — ignore)
curl -sf -X POST \
  "${DST_SUPABASE_URL}/storage/v1/bucket" \
  -H "Authorization: Bearer ${DST_SERVICE_KEY}" \
  -H "apikey: ${DST_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"${BUCKET}\",\"name\":\"${BUCKET}\",\"public\":true}" \
  -o /dev/null 2>/dev/null || true

# Apply storage policies (idempotent — DROP IF EXISTS before each CREATE)
psql -v ON_ERROR_STOP=1 "$DST_DB_URL" <<'SQL'
DROP POLICY IF EXISTS "media public select" ON storage.objects;
CREATE POLICY "media public select"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'media');

DROP POLICY IF EXISTS "media public insert" ON storage.objects;
CREATE POLICY "media public insert"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'media');

DROP POLICY IF EXISTS "media service_role insert" ON storage.objects;
CREATE POLICY "media service_role insert"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'media');

DROP POLICY IF EXISTS "media service_role update" ON storage.objects;
CREATE POLICY "media service_role update"
  ON storage.objects FOR UPDATE
  TO service_role
  USING (bucket_id = 'media');

DROP POLICY IF EXISTS "media service_role delete" ON storage.objects;
CREATE POLICY "media service_role delete"
  ON storage.objects FOR DELETE
  TO service_role
  USING (bucket_id = 'media');
SQL
log "Storage policies applied."

# list_bucket <supabase_url> <service_key> <output_file>
# Iterative BFS: avoids recursive bash subshells losing stdout.
list_bucket() {
  local supabase_url="$1" service_key="$2" target_file="$3"
  : > "$WORK/queue"
  echo "" >> "$WORK/queue"
  : > "$target_file"

  while [[ -s "$WORK/queue" ]]; do
    prefix=$(head -n1 "$WORK/queue")
    tail -n +2 "$WORK/queue" > "$WORK/queue.tmp" && mv "$WORK/queue.tmp" "$WORK/queue"

    offset=0
    while true; do
      resp=$(curl -sf -X POST \
        "${supabase_url}/storage/v1/object/list/${BUCKET}" \
        -H "Authorization: Bearer ${service_key}" \
        -H "apikey: ${service_key}" \
        -H "Content-Type: application/json" \
        -d "{\"prefix\":\"${prefix}\",\"limit\":1000,\"offset\":${offset},\"sortBy\":{\"column\":\"name\",\"order\":\"asc\"}}")

      count=$(printf '%s' "$resp" | jq 'length')
      (( count == 0 )) && break

      printf '%s' "$resp" | jq -r --arg p "$prefix" \
        '.[] | select(.id == null) | $p + .name + "/"' >> "$WORK/queue"
      printf '%s' "$resp" | jq -r --arg p "$prefix" \
        '.[] | select(.id != null) | $p + .name' >> "$target_file"

      (( count < 1000 )) && break
      offset=$(( offset + 1000 ))
    done
  done
}

log "Listing all files in source bucket..."
list_bucket "$SRC_SUPABASE_URL" "$SRC_SERVICE_KEY" "$WORK/files.txt"
SRC_N=$(wc -l < "$WORK/files.txt" | tr -d ' ')
log "Source bucket: $SRC_N objects"

UPLOADED=0
FAILED=0
while IFS= read -r fpath; do
  local_file="$WORK/blob"
  rm -f "$local_file" "$WORK/headers"

  encoded=$(urlencode_path "$fpath")

  http_code=$(curl -sf -D "$WORK/headers" \
    -H "Authorization: Bearer ${SRC_SERVICE_KEY}" \
    -H "apikey: ${SRC_SERVICE_KEY}" \
    "${SRC_SUPABASE_URL}/storage/v1/object/authenticated/${BUCKET}/${encoded}" \
    -o "$local_file" -w "%{http_code}" 2>/dev/null || echo "000")

  if [[ "$http_code" != "200" ]] || [[ ! -s "$local_file" ]]; then
    log "WARN: download failed — $fpath (HTTP $http_code)"
    FAILED=$(( FAILED + 1 ))
    continue
  fi

  mime=$(grep -i '^content-type:' "$WORK/headers" 2>/dev/null | head -1 | sed 's/^[^:]*: *//; s/[[:space:]]*$//')
  mime="${mime:-application/octet-stream}"

  upload_code=$(curl -sS -X POST \
    "${DST_SUPABASE_URL}/storage/v1/object/${BUCKET}/${encoded}" \
    -H "Authorization: Bearer ${DST_SERVICE_KEY}" \
    -H "apikey: ${DST_SERVICE_KEY}" \
    -H "Content-Type: ${mime}" \
    -H "x-upsert: true" \
    --data-binary "@${local_file}" \
    -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")

  if [[ "$upload_code" != "200" ]]; then
    log "WARN: upload failed — $fpath (HTTP $upload_code)"
    FAILED=$(( FAILED + 1 ))
    continue
  fi

  UPLOADED=$(( UPLOADED + 1 ))
  (( UPLOADED % 100 == 0 )) && log "  Progress: $UPLOADED / $SRC_N uploaded..."
done < "$WORK/files.txt"

log "Storage result: source=$SRC_N  uploaded=$UPLOADED  failed=$FAILED"
(( FAILED > 0 )) && die "$FAILED file(s) failed to transfer."

log "Verifying destination bucket object count..."
list_bucket "$DST_SUPABASE_URL" "$DST_SERVICE_KEY" "$WORK/dst_files.txt"
DST_BUCKET_N=$(wc -l < "$WORK/dst_files.txt" | tr -d ' ')
log "Bucket object counts: source=$SRC_N  destination=$DST_BUCKET_N"
[[ "$SRC_N" != "$DST_BUCKET_N" ]] && \
  die "Bucket count mismatch: source=$SRC_N destination=$DST_BUCKET_N."
done_

# ═══════════════════════════════════════════════════════════════════════════════
step "Step 5 — Rewrite stored image URLs in destination"
# ═══════════════════════════════════════════════════════════════════════════════

# Collect all text/varchar/jsonb/text[]/varchar[] columns in public schema
psql -v ON_ERROR_STOP=1 "$DST_DB_URL" -At -c "
SELECT table_name, column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (  data_type IN ('text', 'character varying', 'jsonb')
      OR (data_type = 'ARRAY' AND udt_name IN ('_text', '_varchar')) )
ORDER BY table_name, column_name;
" > "$WORK/cols.tsv"

log "Scanning which columns contain old host (${OLD_HOST})..."
TOTAL_TO_REWRITE=0
while IFS='|' read -r tbl col dtype udt; do
  n=$(psql -v ON_ERROR_STOP=1 "$DST_DB_URL" -At -c \
    "SELECT COUNT(*) FROM public.\"${tbl}\" WHERE \"${col}\"::text LIKE '%${OLD_HOST}%';")
  if (( n > 0 )); then
    log "  WILL UPDATE: ${tbl}.${col} (${dtype}) — ${n} row(s)"
    TOTAL_TO_REWRITE=$(( TOTAL_TO_REWRITE + n ))
  fi
done < "$WORK/cols.tsv"
log "Total rows to rewrite: $TOTAL_TO_REWRITE"

log "Applying rewrites..."
while IFS='|' read -r tbl col dtype udt; do
  if [[ "$dtype" == "jsonb" ]]; then
    # Cast to text, replace, cast back
    psql -v ON_ERROR_STOP=1 "$DST_DB_URL" -c "
      UPDATE public.\"${tbl}\"
      SET \"${col}\" = REPLACE(\"${col}\"::text, '${OLD_BASE}', '${NEW_BASE}')::jsonb
      WHERE \"${col}\"::text LIKE '%${OLD_HOST}%';"

  elif [[ "$dtype" == "ARRAY" && ( "$udt" == "_text" || "$udt" == "_varchar" ) ]]; then
    # Unnest, replace each element, re-aggregate
    psql -v ON_ERROR_STOP=1 "$DST_DB_URL" -c "
      UPDATE public.\"${tbl}\"
      SET \"${col}\" = ARRAY(
        SELECT REPLACE(e, '${OLD_BASE}', '${NEW_BASE}') FROM unnest(\"${col}\") e
      )
      WHERE \"${col}\"::text LIKE '%${OLD_HOST}%';"

  else
    # Plain text / varchar
    psql -v ON_ERROR_STOP=1 "$DST_DB_URL" -c "
      UPDATE public.\"${tbl}\"
      SET \"${col}\" = REPLACE(\"${col}\", '${OLD_BASE}', '${NEW_BASE}')
      WHERE \"${col}\" LIKE '%${OLD_HOST}%';"
  fi
done < "$WORK/cols.tsv"
done_

# ═══════════════════════════════════════════════════════════════════════════════
step "Step 6 — Verification"
# ═══════════════════════════════════════════════════════════════════════════════

log "Row counts — source vs destination:"
psql -v ON_ERROR_STOP=1 "$SRC_DB_URL" -At -c "
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;" > "$WORK/tables.txt"

MISMATCHES=0
while IFS= read -r tbl; do
  src_n=$(psql -v ON_ERROR_STOP=1 "$SRC_DB_URL" -At -c "SELECT COUNT(*) FROM public.\"${tbl}\";")
  dst_n=$(psql -v ON_ERROR_STOP=1 "$DST_DB_URL" -At -c "SELECT COUNT(*) FROM public.\"${tbl}\";")
  if [[ "$src_n" == "$dst_n" ]]; then
    printf "  %-45s src=%-8s dst=%-8s ✓\n" "$tbl" "$src_n" "$dst_n"
  else
    printf "  %-45s src=%-8s dst=%-8s ✗ MISMATCH\n" "$tbl" "$src_n" "$dst_n"
    MISMATCHES=$(( MISMATCHES + 1 ))
  fi
done < "$WORK/tables.txt"
(( MISMATCHES > 0 )) && die "$MISMATCHES table(s) have mismatched row counts."

log "Remaining old-host URLs in destination:"
REMAINING=0
while IFS='|' read -r tbl col dtype udt; do
  n=$(psql -v ON_ERROR_STOP=1 "$DST_DB_URL" -At -c \
    "SELECT COUNT(*) FROM public.\"${tbl}\" WHERE \"${col}\"::text LIKE '%${OLD_HOST}%';")
  if (( n > 0 )); then
    log "  STILL OLD: ${tbl}.${col} — ${n} row(s)"
    REMAINING=$(( REMAINING + n ))
  fi
done < "$WORK/cols.tsv"

if (( REMAINING == 0 )); then
  log "  No old-host URLs remaining. ✓"
else
  die "${REMAINING} row(s) still contain the old storage host — URL rewrite incomplete."
fi

log "Spot-check: fetching one image from destination storage..."
SAMPLE=$(psql -v ON_ERROR_STOP=1 "$DST_DB_URL" -At -c \
  "SELECT image FROM products WHERE image LIKE '%${NEW_HOST}%' LIMIT 1;")
if [[ -n "$SAMPLE" ]]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$SAMPLE" --max-time 10 || echo "err")
  log "  GET $SAMPLE"
  log "  HTTP $HTTP"
  [[ "$HTTP" != "200" ]] && log "  WARN: image not reachable. Check the bucket's public policy on the destination."
else
  log "  No rewritten image URL found in products.image to spot-check."
fi
done_

echo
log "Migration complete."
echo
echo "Next steps:"
echo "  1. Update VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env / Vercel config"
echo "     to point at ${DST_SUPABASE_URL}."
echo "  2. Update DST_SUPABASE_URL / DST_SERVICE_KEY in server.ts env if used."
echo "  3. Run the app against the destination and do a smoke-test login."
