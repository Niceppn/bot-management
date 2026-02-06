# Deployment Workflow

> **Server**: `47.129.144.109` (Bitnami Apache on AWS Lightsail)
> **Updated**: 2026-02-06

---

## ⚠️ สรุป Path สำคัญ (อย่างงนะ!)

### Path ที่ Apache Serve จริง (ต้อง copy ไปทั้ง 2 ที่)

| Path | ใช้กับ | Config File |
|---|---|---|
| `/opt/bot-manager/dist/` | **HTTP** (port 80) | `bitnami.conf` → `DocumentRoot "/opt/bot-manager/dist/"` |
| `/opt/bitnami/apache/htdocs/` | **HTTPS** (port 443) | `bitnami-ssl.conf` → `DocumentRoot "/opt/bitnami/apache/htdocs/"` |

### Path ที่ ❌ ไม่ได้ Serve โดยตรง

| Path | หมายเหตุ |
|---|---|
| `/opt/bot-manager/client/dist/` | เป็นแค่ **output จาก `npm run build`** — ต้อง copy ออกไปอีกที |

### Flow การ Build → Deploy

```
npm run build
      ↓
/opt/bot-manager/client/dist/    ← build output (ไม่ได้ serve)
      ↓ copy ไป 2 ที่
      ├──→ /opt/bot-manager/dist/         ← HTTP  (port 80)
      └──→ /opt/bitnami/apache/htdocs/   ← HTTPS (port 443)
```

---

## Production Server Setup

**Frontend (Static Files):**
- HTTP: `/opt/bot-manager/dist/` (port 80)
- HTTPS: `/opt/bitnami/apache/htdocs/` (port 443)
- Served by: Bitnami Apache

**Backend API:**
- Location: `/opt/bot-manager/server/`
- Served by: Node.js via PM2 (port 3001)
- PM2 Path: `/opt/bitnami/node/bin/pm2`

**Python Bots:**
- Location: `/opt/bot-manager/bots/`
- V1: `collect_price.py` → SQLite `crypto_trades`
- V2: `collect_price_v2.py` → SQLite `crypto_trades_v2`

**Database:**
- SQLite: `/opt/bot-manager/server/data/bot_manager.db`

---

## Deploy Steps

### 1. Local → Push
```bash
git add .
git commit -m "Your message"
git push origin main
```

### 2. One-liner Deploy (ใช้คำสั่งเดียวจบ)
```bash
ssh bitnami@47.129.144.109 "cd /opt/bot-manager && git pull origin main && cd client && npm run build && sudo cp -r dist/* /opt/bot-manager/dist/ && sudo cp -r dist/* /opt/bitnami/apache/htdocs/ && cd .. && /opt/bitnami/node/bin/pm2 restart all"
```

### 3. Step-by-step (ถ้าต้อง debug)
```bash
# Pull code
ssh bitnami@47.129.144.109 "cd /opt/bot-manager && git pull origin main"

# Build frontend
ssh bitnami@47.129.144.109 "cd /opt/bot-manager/client && npm run build"

# Copy ไป HTTP path (port 80)
ssh bitnami@47.129.144.109 "sudo cp -r /opt/bot-manager/client/dist/* /opt/bot-manager/dist/"

# Copy ไป HTTPS path (port 443)
ssh bitnami@47.129.144.109 "sudo cp -r /opt/bot-manager/client/dist/* /opt/bitnami/apache/htdocs/"

# Restart backend
ssh bitnami@47.129.144.109 "/opt/bitnami/node/bin/pm2 restart all"
```

---

## Verify หลัง Deploy

```bash
# เช็ค HTTP
curl -s http://47.129.144.109/ | head -5

# เช็ค HTTPS
curl -sk https://47.129.144.109/ | head -5

# เช็ค PM2 status
ssh bitnami@47.129.144.109 "/opt/bitnami/node/bin/pm2 list"

# เช็ค build hash ตรงกัน
ssh bitnami@47.129.144.109 "ls /opt/bot-manager/dist/assets/ && echo '---' && ls /opt/bitnami/apache/htdocs/assets/"
```

---

## File Structure

```
/opt/bot-manager/                  ← Git repository
├── client/
│   └── dist/                     ← npm run build output (ไม่ได้ serve!)
├── server/
│   ├── server.js                 ← Node.js API (PM2)
│   └── data/bot_manager.db      ← SQLite database
├── bots/
│   ├── collect_price.py          ← V1 collector
│   └── collect_price_v2.py       ← V2 multi-stream collector
└── dist/                         ← ✅ HTTP serve path (port 80)

/opt/bitnami/apache/htdocs/       ← ✅ HTTPS serve path (port 443)
├── index.html
└── assets/
```

---

## Common Mistakes

| ❌ ผิด | ✅ ถูก |
|---|---|
| Copy ไปแค่ htdocs ที่เดียว | ต้อง copy ไป **ทั้ง 2 ที่** (dist + htdocs) |
| ลืม restart PM2 หลังแก้ server code | ใส่ `pm2 restart all` ตอนท้ายเสมอ |
| ใช้ `pm2` ตรงๆ (ไม่มี path) | ต้องใช้ `/opt/bitnami/node/bin/pm2` |
| Hard refresh ไม่เห็นผล | เช็คว่า copy ถูก path ทั้ง HTTP + HTTPS |