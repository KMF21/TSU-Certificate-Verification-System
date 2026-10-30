#!/usr/bin/env bash
# Runs the migrations, sample seed and SQL tests against a scratch Postgres 16+.
# Usage: PGHOST=... PGPORT=... supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
P="psql -v ON_ERROR_STOP=1 -q -U ${PGUSER:-postgres}"
$P -d postgres -c "drop database if exists tsutest" -c "create database tsutest" >/dev/null
$P -d tsutest -f supabase/tests/00_supabase_stub.sql >/dev/null
for f in supabase/migrations/*.sql; do $P -d tsutest -f "$f" >/dev/null 2>&1 || { $P -d tsutest -f "$f"; exit 1; }; done
$P -d tsutest -f supabase/seed/sample_records.sql >/dev/null
$P -d tsutest -f supabase/tests/10_register_test.sql | grep -E "PASSED"
