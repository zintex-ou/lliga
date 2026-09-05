#!/usr/bin/env bash
# One-shot installer for a fresh Ubuntu server.  Usage:  bash install.sh lliga.example.com
set -euo pipefail
DOMAIN="${1:?usage: install.sh <domain>}"
REPO="${REPO:-https://github.com/zintex-ou/lliga.git}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q && apt-get install -y -q ca-certificates curl git ufw
if ! command -v docker >/dev/null; then curl -fsSL https://get.docker.com -o /tmp/get-docker.sh && sh /tmp/get-docker.sh </dev/null; fi
ufw allow OpenSSH >/dev/null; ufw allow 80 >/dev/null; ufw allow 443 >/dev/null; ufw --force enable >/dev/null
mkdir -p /srv/lliga-data
if [ ! -f /srv/lliga.env ]; then
  ADMIN_PW="$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | cut -c1-12)"
  cat >/srv/lliga.env <<ENV
AUTH_SECRET=$(openssl rand -hex 32)
ADMIN_EMAIL=admin@lliga.local
ADMIN_PASSWORD=$ADMIN_PW
SITE_URL=https://$DOMAIN
ENV
  chmod 600 /srv/lliga.env
fi
if [ -d /opt/lliga/.git ]; then git -C /opt/lliga pull -q; else git clone -q "$REPO" /opt/lliga; fi
cd /opt/lliga/deploy
DOMAIN="$DOMAIN" docker compose -f docker-compose.prod.yml up -d --build
echo "----------------------------------------------"
echo "Site:  https://$DOMAIN"
echo "Admin: admin@lliga.local / $(grep ADMIN_PASSWORD /srv/lliga.env | cut -d= -f2)"
echo "Update later:  bash /opt/lliga/deploy/update.sh"
