#!/usr/bin/env bash
set -euo pipefail

if [ ! -f pnpm-lock.yaml ]; then
  echo "pnpm-lock.yaml not found; install dependencies with pnpm install" >&2
fi

pnpm install
cp -n .env.example .env.local 2>/dev/null || true
