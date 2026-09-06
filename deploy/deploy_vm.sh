#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# RAIL-BLOC — one-shot deployment for the Oracle Always-Free ARM VM
# Run as root (sudo) on the VM AFTER: git clone + .env filled + DuckDNS set.
#   cd /opt/rail-bloc && sudo bash deploy/deploy_vm.sh
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail

echo "── [1/5] Docker install (aarch64) ──────────────────────────────"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi
docker version --format '{{.ServerVersion}}' >/dev/null

echo "── [2/5] DuckDNS IP updater (cron, har 5 min) ───────────────────"
if [[ -n "${DUCKDNS_TOKEN:-}" && -n "${CADDY_ACME_DOMAIN:-}" ]]; then
  SUB="${CADDY_ACME_DOMAIN%%.*}"
  (crontab -l 2>/dev/null | grep -v duckdns || true;
   echo "*/5 * * * * curl -s \"https://www.duckdns.org/update?domains=${SUB}&token=${DUCKDNS_TOKEN}&ip=\" >/dev/null"
  ) | crontab -
  curl -s "https://www.duckdns.org/update?domains=${SUB}&token=${DUCKDNS_TOKEN}&ip=" >/dev/null
  echo "DuckDNS updated: ${CADDY_ACME_DOMAIN} -> $(curl -s ifconfig.me)"
else
  echo "WARN: DUCKDNS_TOKEN/CADDY_ACME_DOMAIN export nahi hue — skip (Caddy phir bhi IP pe chalega)"
fi

echo "── [3/5] Firewall: sirf 80/443 + SSH ────────────────────────────"
if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH >/dev/null 2>&1 || true
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  yes | ufw enable >/dev/null 2>&1 || true
  ufw status | head -5
fi
echo "NOTE: Oracle Console me bhi Security List / NSG me 80+443 inbound rules honi chahiye."

echo "── [4/5] Build + up (migrate -> seed -> api/worker/beat) ────────"
docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d --build

echo "── [5/5] Health wait ────────────────────────────────────────────"
for i in $(seq 1 30); do
  if docker compose -f deploy/docker-compose.prod.yml ps | grep -q "api.*healthy"; then
    echo "API healthy ✓"
    break
  fi
  sleep 5
done
docker compose -f deploy/docker-compose.prod.yml ps
echo ""
echo "Deployment complete. Verify:"
echo "  curl https://${CADDY_ACME_DOMAIN:-railbloc-api.duckdns.org}/health"
echo "  Frontend: https://railbloc.vercel.app  (Vercel rewrites /api/* here)"
