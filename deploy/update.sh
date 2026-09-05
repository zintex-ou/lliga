#!/usr/bin/env bash
set -euo pipefail
cd /opt/lliga && git pull -q
DOMAIN="$(grep SITE_URL /srv/lliga.env | sed 's#.*https://##')" docker compose -f deploy/docker-compose.prod.yml up -d --build
docker image prune -f >/dev/null
