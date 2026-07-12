#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt
else
  source .venv/bin/activate
fi
export $(grep -v '^#' .env 2>/dev/null | xargs) 2>/dev/null || true
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
