# 🚀 RAIL-BLOC — Deployment Guide (₹0, SIH final submission)

**Architecture:**
```
Judge/anyone ──► https://railbloc.vercel.app          (frontend, static export)
                        │  vercel.json rewrites /api/*
                        ▼
             https://railbloc-api.duckdns.org       (Caddy auto-HTTPS)
                        │  reverse_proxy api:8000
                        ▼
             Oracle Always-Free ARM VM (Ubuntu)
             ├─ FastAPI api (uvicorn)
             ├─ Celery worker + beat
             ├─ PostgreSQL 16 + PostGIS (internal-only)
             └─ Redis 7.2 (internal-only, password)
```

**Cost: ₹0/month.** Laptop-independent — VM 24/7 chalta hai.

---

## STEP 0 — 🔧 (main ne kar diya) Repo-side artifacts

- `apps/api/Dockerfile` + `apps/workers/Dockerfile`: or-tools ARM fallback (PyPI path Oracle aarch64 ke liye, wheels campus x86 ke liye)
- `apps/web/.npmrc`: `legacy-peer-deps=true` (Vercel install ke liye)
- `apps/web/vercel.json`: `/api/*` → `https://railbloc-api.duckdns.org/api/*` rewrite
- `deploy/docker-compose.prod.yml`: full prod stack, **sirf 80/443 public**, baaki internal
- `deploy/Caddyfile` + `deploy/.env.prod.example` + `deploy/deploy_vm.sh`

---

## STEP 1 — 🙋 TU: Oracle signup + VM launch (~30-45 min)

1. https://signup.cloudflare.com nahi — **https://cloud.oracle.com** → "Start for free"
   - Home region: **Mumbai (ap-1-mumbai-1)** ya Hyderabad
   - Card verification mandatory (charge nahi hota, ₹1-2 temp hold)
2. Console → **Compute → Instances → Create Instance**
   - Name: `rail-bloc`
   - Image: **Ubuntu 22.04** (canonical)
   - Shape: **VM.Standard.A1.Flex** → 2 OCPU, **12 GB RAM**
   - SSH keys: apni public key add karo (ya "Generate a key pair" → private key download)
   - Boot volume: 60 GB (default 47 se badha ke — free me included)
3. **Networking**: "Assign a public IPv4" ON. Security list me inbound rules: **TCP 22, 80, 443**
4. Connect: `ssh ubuntu@<PUBLIC_IP>`

⚠️ "Out of capacity" error aaye → AD change karke retry / thodi der baad retry. Signup rejection ho → alag card/region se retry. **Fail hota rahe to bol — fallback tunnel plan hai.**

## STEP 2 — 🙋 TU: DuckDNS (~2 min)

1. https://www.duckdns.org → GitHub se login
2. Subdomain banao: **`railbloc-api`** (exact yahi naam, vercel.json isi pe point karta hai)
3. Token copy kar (page pe dikhta hai) — Step 3 me lagega

## STEP 3 — 🔧 Main: VM pe deploy (VM ready hone ke baad)

Tere paas jab VM + SSH ho, mujhe bol — main ye karunga (ya ye script de dunga jo tu chalegi):

```bash
sudo apt update && sudo apt install -y git
sudo mkdir -p /opt/rail-bloc && sudo chown ubuntu /opt/rail-bloc
cd /opt/rail-bloc
git clone https://github.com/abhinav-phi/rail-bloc.git .
cp deploy/.env.prod.example .env
nano .env                       # 🔧 wale sab fields fill (generate commands file me hain)
export DUCKDNS_TOKEN=<tera-token> CADDY_ACME_DOMAIN=railbloc-api.duckdns.org
sudo bash deploy/deploy_vm.sh
```

Script karega: docker install → DuckDNS IP update cron → firewall (80/443) → build → migrate → seed → api/worker/beat healthy.

## STEP 4 — 🙋 TU: Vercel (~15 min) — `railbloc.vercel.app`

1. https://vercel.com → **GitHub se sign-in**
2. **Add New… → Project** → repo `abhinav-phi/rail-bloc` import
3. **Configure:**
   - Project Name: **`railbloc`** ← exact (tabhi `railbloc.vercel.app` milega)
   - Root Directory: **`apps/web`**
   - Framework Preset: Next.js (auto) — build `npm run build`, output `out`
4. Deploy → **`railbloc.vercel.app` live**

`vercel.json` ka rewrite `/api/*` ko backend pe bhej dega — **code me kuch change nahi karna pada**.

## STEP 5 — ✅ Main: end-to-end verification

- `https://railbloc.vercel.app` → login persona → dashboard KPIs → monthly plans → approvals 10-check → ledger `chain_ok=true` → STALE cycle
- `https://railbloc-api.duckdns.org/health` → `{"status":"ok","db":true}`
- **SSE check**: dashboard LIVE pill green (Vercel rewrite streaming)

---

## 🔐 Security checklist (VM pe)

- Postgres/Redis: **internal-only** (koi host port nahi)
- Firewall: sirf 22/80/443
- `JWT_SECRET` + saare passwords: `.env` me fresh-generated
- Login: rate-limited (5/min)
- HTTPS: Let's Encrypt auto-renew (Caddy)

## 🧯 Troubleshooting

| Symptom | Fix |
|---|---|
| Build fail: "unsupported wheel" | ARM fallback path active hai? Dockerfile updated hai? `git pull` karke rebuild |
| `railbloc-api.duckdns.org` cert fail | Port 80 Oracle security list me open hai? DuckDNS IP update hua? `sudo bash deploy/deploy_vm.sh` dobara |
| Vercel pe API 502 | Oracle VM chal raha hai? `docker compose ps` — api healthy? Caddy logs: `docker compose -f deploy/docker-compose.prod.yml logs caddy` |
| Vercel pe SSE buffering | vercel.json rewrite direct duckdns pe hai — Caddy `flush_interval -1` already; phir bhi issue ho to bol, direct-origin fallback |
| Oracle "Out of capacity" | AD/region change, retry — ya mujhe bol, Plan B tunnel pe wapas |
