# ⚡ Quick Start Guide - Deploy to VPS

เริ่มต้นใช้งานบน VPS ได้ใน 10 นาที!

---

## 📝 ข้อมูลที่ต้องเตรียม

- [ ] VPS IP Address: `_________________`
- [ ] SSH Username: `_________________`
- [ ] SSH Password/Key: `_________________`
- [ ] Domain (optional): `_________________`

---

## 🚀 3 ขั้นตอนเริ่มต้น

### 1️⃣ เชื่อมต่อ VPS และติดตั้งระบบ

```bash
# เชื่อมต่อ VPS
ssh root@YOUR_VPS_IP

# อัพเดทระบบ
apt update && apt upgrade -y

# ติดตั้ง Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# ติดตั้ง Python, PM2, Nginx
apt install -y python3 python3-pip nginx
npm install -g pm2

# สร้างโฟลเดอร์
mkdir -p /opt/bot-manager
cd /opt/bot-manager
```

---

### 2️⃣ อัพโหลดโปรเจค

**จากเครื่อง Mac ของคุณ:**

```bash
# บีบอัดโปรเจค
cd /Users/Macbook
tar -czf bot-manager.tar.gz \
    --exclude='Bot_Manager/node_modules' \
    --exclude='Bot_Manager/server/data' \
    --exclude='Bot_Manager/client/dist' \
    Bot_Manager/

# อัพโหลดไป VPS
scp bot-manager.tar.gz root@YOUR_VPS_IP:/opt/bot-manager/

# กลับไปที่ VPS แล้ว extract
ssh root@YOUR_VPS_IP
cd /opt/bot-manager
tar -xzf bot-manager.tar.gz --strip-components=1
rm bot-manager.tar.gz
```

---

### 3️⃣ ติดตั้งและเริ่มใช้งาน

**บน VPS:**

```bash
cd /opt/bot-manager

# ติดตั้ง dependencies
pip3 install websocket-client
cd server && npm install && cd ..
cd client && npm install && npm run build && cd ..

# สร้างฐานข้อมูล
mkdir -p server/data server/logs
cd server && npm run seed && cd ..

# ตั้งค่า environment
cp deploy/.env.production server/.env
nano server/.env
# แก้ไข:
#   FRONTEND_URL=http://YOUR_VPS_IP
#   JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# เริ่มต้นระบบด้วย PM2
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup

# ตั้งค่า Nginx
cp deploy/nginx.conf /etc/nginx/sites-available/bot-manager
nano /etc/nginx/sites-available/bot-manager
# แก้ไข: server_name YOUR_VPS_IP;

ln -s /etc/nginx/sites-available/bot-manager /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# เปิด firewall
ufw allow 'Nginx Full'
ufw enable
```

---

## ✅ ทดสอบการทำงาน

### เช็คสถานะ
```bash
pm2 status                    # Backend ต้องเป็น online
systemctl status nginx        # Nginx ต้อง running
```

### เปิดเว็บ
```
http://YOUR_VPS_IP
```

### Login
- Username: `admin`
- Password: `admin123`

---

## 🔧 คำสั่งที่ใช้บ่อย

```bash
# ดู logs
pm2 logs bot-manager-api
tail -f /opt/bot-manager/server/logs/*.log

# Restart
pm2 restart bot-manager-api
systemctl reload nginx

# Backup
bash /opt/bot-manager/deploy/backup.sh

# อัพเดทโค้ด (ทำจาก Mac แล้วอัพโหลดใหม่)
cd /opt/bot-manager
pm2 restart bot-manager-api
```

---

## ⚠️ Troubleshooting

### ❌ Backend ไม่ start
```bash
cd /opt/bot-manager/server
node server.js  # ทดสอบโดยตรง
```

### ❌ Nginx error
```bash
nginx -t
tail -f /var/log/nginx/error.log
```

### ❌ Bot ไม่รัน
```bash
pm2 logs bot-manager-api
ls -la /opt/bot-manager/server/data/  # เช็คว่ามี database
```

---

## 🎉 เสร็จแล้ว!

ตอนนี้ Bot Manager ของคุณรันบน VPS แล้ว!

**Next Steps:**
1. เปลี่ยนรหัสผ่าน admin
2. สร้าง Bot แรกของคุณ
3. ตั้ง SSL certificate (ถ้ามี domain)

---

## 📚 อ่านเพิ่มเติม

- Full Documentation: `deploy/README.md`
- SSL Setup: `sudo certbot --nginx -d your-domain.com`
- Monitoring: `pm2 monit`
