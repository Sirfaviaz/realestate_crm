#!/usr/bin/env bash
# Start local PostgreSQL without Docker (Homebrew postgresql@14)
set -euo pipefail

PG_CTL="/opt/homebrew/opt/postgresql@14/bin/pg_ctl"
PG_DATA="/opt/homebrew/var/postgresql@14"
INITDB="/opt/homebrew/opt/postgresql@14/bin/initdb"
CREATEDB="/opt/homebrew/opt/postgresql@14/bin/createdb"
PSQL="/opt/homebrew/opt/postgresql@14/bin/psql"

# PG_VERSION is a file, not a directory
if [[ ! -f "$PG_DATA/PG_VERSION" ]]; then
  echo "Initializing PostgreSQL data directory..."
  mkdir -p "$PG_DATA"
  "$INITDB" -D "$PG_DATA"
fi

if ! "$PG_CTL" -D "$PG_DATA" status >/dev/null 2>&1; then
  echo "Starting PostgreSQL..."
  "$PG_CTL" -D "$PG_DATA" -l "$PG_DATA/server.log" start
  sleep 2
fi

if ! "$PSQL" -lqt | cut -d \| -f 1 | grep -qw realestate_crm; then
  echo "Creating database realestate_crm..."
  "$CREATEDB" realestate_crm
fi

echo "PostgreSQL ready on localhost:5432 (database: realestate_crm)"
