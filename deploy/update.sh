#!/usr/bin/env bash
set -euo pipefail
cd /opt/lliga && git pull -q
DOMAIN="$(grep SITE_URL /srv/lliga.env | sed 's#.*https://##')" docker compose -f deploy/docker-compose.prod.yml up -d --build
# Caddy keeps the old Caddyfile inode after git pull: recreate it so config changes apply
DOMAIN="$(grep SITE_URL /srv/lliga.env | sed 's#.*https://##')" docker compose -f deploy/docker-compose.prod.yml up -d --force-recreate caddy
docker image prune -f >/dev/null
