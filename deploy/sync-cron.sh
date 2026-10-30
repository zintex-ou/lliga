#!/usr/bin/env bash
# Pull data from the old league site into the DB. Usage: sync-cron.sh horaris|resultats|golejadors|all
set -euo pipefail
cd /opt/lliga
docker compose -f deploy/docker-compose.prod.yml exec -T web node node_modules/tsx/dist/cli.mjs seed/sync.ts "${1:-all}" 2>&1 | tee -a /var/log/lliga-sync.log
