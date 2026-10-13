#!/usr/bin/env bash
# Runs the migrations and SQL tests against a scratch Postgres 16.
# Usage: PGHOST=... PGPORT=... supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
P="psql -v ON_ERROR_STOP=1 -q -U ${PGUSER:-postgres}"
$P -d postgres -c "drop database if exists tsutest" -c "create database tsutest" >/dev/null
$P -d tsutest -f supabase/tests/00_supabase_stub.sql >/dev/null
for f in supabase/migrations/*.sql; do $P -d tsutest -f "$f" >/dev/null; done
$P -d tsutest -f supabase/tests/10_workflow_test.sql | grep -E "PASSED"
$P -d tsutest -f supabase/tests/20_reference_test.sql | grep -E "PASSED"
