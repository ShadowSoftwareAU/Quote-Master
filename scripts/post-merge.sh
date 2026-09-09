#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter @workspace/db push
if command -v psql >/dev/null 2>&1; then
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f lib/db/drizzle/0014_parametric_trade_templates.sql
else
  pnpm --filter @workspace/scripts run reconcile-parametric-templates
fi
