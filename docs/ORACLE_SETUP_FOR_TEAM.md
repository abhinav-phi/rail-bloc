# 🚀 RAIL-BLOC — Oracle VM Setup (dost ke liye step-by-step)

Bhai, ye 6 steps kar — total ~35 min. Har step ka result text me note karta ja.

---

## STEP 1 — Oracle Account Signup (~10 min)

1. Browser me: **https://cloud.oracle.com** → **"Start for free"**
2. Details bhar:
   - **Country**: India
   - **First/Last name**: apna
   - **Email**: apna (verify hoga)
3. **Cloud account name**: `railbloc-team` jaisa kuch (ye hi login ID banega)
4. **Password** set karo (note kar lena)
5. **Home region**: `Mumbai (ap-1-mumbai-1)` — select karo (ya Hyderabad)
6. **Payment verification**:
   - Card type: **Credit Card** (debit bhi chalega agar CVV + international enabled)
   - Card details + billing address
   - ₹1-2 ka **temporary hold** lagega, 2-3 din me refund — koi actual charge nahi
7. Email verify → **Start my free trial** pe click

✅ **Done when**: Oracle Cloud Console dashboard khul jaye (dark blue UI).

---

## STEP 2 — VM Launch (~10 min)

Console me: hamburger menu (☰ top-left) → **Compute → Instances → Create Instance**

| Field | Value |
|---|---|
| Name | `rail-bloc` |
| Image | **Ubuntu 22.04** (Canonical) — "Change image" se select karo |
| Availability domain | AD-1 (default) |
| Shape | **VM.Standard.A1.Flex** → **2 OCPU**, **12 GB RAM** |
| Boot volume | **60 GB** (default 47 se badhao — slider) |
| SSH Keys | **"Paste a public key"** select karo aur YE paste karo: |

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAiEj/CHbJ4OFmEtIuEZPux5cQ9G4qF16Xjf9Q6UdR8u railbloc-oracle-vm
```

Networking (default rehne do, bas ye check karo):
- ✅ "Assign a public IPv4 address" **ON**

**Create** pe click.

⚠️ Agar **"Out of capacity"** error aaye: Availability Domain ko AD-2/AD-3 me change karke retry. 2-3 baar lag sakta hai, patience.

✅ **Done when**: Instance state = **RUNNING** (green). **Public IP address** copy kar le (page pe right side dikhega).

---

## STEP 3 — Firewall: ports 80/443 kholna (~3 min)

Instance page pe hi: **Subnet** link pe click (Virtual cloud network ke andar) → **Security List** → **Add Ingress Rules**:

**Rule 1 (HTTP):**
- Source CIDR: `0.0.0.0/0`
- IP Protocol: **TCP**
- Destination Port: **80**

**Rule 2 (HTTPS):**
- Source CIDR: `0.0.0.0/0`
- IP Protocol: **TCP**
- Destination Port: **443**

✅ Done.

---

## STEP 4 — DuckDNS (~2 min)

1. **https://www.duckdns.org** → **"Login with GitHub"** (apna GitHub)
2. Pehli baar login pe token ban jayega — **copy kar le** (top of page pe "token" likha hai)
3. "add domain" box me type karo: **`railbloc-api`** → **"add"** button
4. Confirm: `railbloc-api.duckdns.org` list me aa jaye

✅ Done. **Token note kar le.**

---

## STEP 5 — Mujhe ye 3 cheezein bhej (~1 min)

Message me bhej:
1. **VM Public IP** (e.g. `152.67.x.x`)
2. **DuckDNS token** (wo long string)
3. Confirmation ki instance RUNNING hai

---

## STEP 6 — Baaki sab main karunga 😎

Main SSH se connect hoke:
- Docker + compose install
- Repo clone + build (ARM-compatible)
- Caddy auto-HTTPS (`railbloc-api.duckdns.org` pe Let's Encrypt cert)
- Poora stack live: API + Celery worker + beat + Postgres/PostGIS + Redis
- E2E verify (login → dashboard → monthly → approvals → ledger)
- Vercel frontend connect

**Total time from "instance RUNNING" to "app live on HTTPS": ~20 min.**

---

## Quick checklist (copy karle)

- [ ] Oracle signup done, dashboard khula
- [ ] VM.Standard.A1.Flex 2 OCPU / 12GB RAM Ubuntu 22.04 instance RUNNING
- [ ] SSH public key paste kiya (wo ed25519 wala)
- [ ] Security List: 80 + 443 inbound rules added
- [ ] Public IP noted
- [ ] DuckDNS `railbloc-api` + token noted
- [ ] Mujhe IP + token bhej diya
