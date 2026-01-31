# 🤖 Auto Setup - One Command Deploy!

Setup ทุกอย่างด้วยคำสั่งเดียว - ไม่ต้องทำอะไรเลย!

---

## ⚡ วิธีใช้งาน (3 ขั้นตอน)

### 1️⃣ อัพโหลดโปรเจค

**จากเครื่อง Mac:**

```bash
cd /Users/Macbook

# Compress project
tar -czf bot-manager.tar.gz \
    --exclude='Bot_Manager/node_modules' \
    --exclude='Bot_Manager/server/data' \
    --exclude='Bot_Manager/client/dist' \
    --exclude='Bot_Manager/.git' \
    Bot_Manager/

# Upload to VPS
scp -i ~/Downloads/LightsailKey.pem \
    bot-manager.tar.gz \
    ubuntu@YOUR_VPS_IP:/tmp/
```

---

### 2️⃣ Extract บน VPS

**SSH เข้า VPS:**

```bash
ssh -i ~/Downloads/LightsailKey.pem ubuntu@YOUR_VPS_IP

# Create directory
sudo mkdir -p /opt/bot-manager
sudo chown -R ubuntu:ubuntu /opt/bot-manager

# Extract
cd /opt/bot-manager
tar -xzf /tmp/bot-manager.tar.gz --strip-components=1
rm /tmp/bot-manager.tar.gz
```

---

### 3️⃣ รัน Auto Setup (คำสั่งเดียวจบ!)

```bash
cd /opt/bot-manager
bash deploy/auto-setup.sh
```

**Script จะถามข้อมูล 2 อย่าง:**
1. 🌐 VPS IP Address (บังคับ)
2. 🌍 Domain name (optional - ถ้าไม่มีกด Enter ข้าม)

แล้วมันจะทำให้อัตโนมัติทั้งหมด! ⏳ ใช้เวลา 5-10 นาที

---

## 🎯 สิ่งที่ Script จะทำให้

✅ **[1/9]** Update system packages
✅ **[2/9]** Install Node.js 20.x
✅ **[3/9]** Install Python 3 + websocket-client
✅ **[4/9]** Install PM2
✅ **[5/9]** Install Nginx
✅ **[6/9]** Install project dependencies
✅ **[7/9]** Configure .env (auto-generate JWT_SECRET)
✅ **[8/9]** Initialize database (create admin user)
✅ **[9/9]** Optimize for 2GB RAM:
- Add 1GB Swap
- Setup log rotation
- Create monitoring scripts
- Setup auto cleanup
- Optimize system settings

✅ **[Bonus]** Configure Nginx with your IP/domain
✅ **[Starting]** Start backend with PM2
✅ **[Security]** Configure firewall (UFW)

---

## ✅ หลังจาก Setup เสร็จ

จะได้:

```
✅ Node.js:    v20.x.x
✅ Python:     3.x.x
✅ PM2:        Running
✅ Nginx:      Running
✅ Backend:    Running on port 3001
✅ Frontend:   Built and served
✅ Database:   Initialized
✅ Swap:       1GB added
✅ Firewall:   Configured
```

**Access:**
- URL: `http://YOUR_VPS_IP`
- Username: `admin`
- Password: `admin123`

⚠️ **เปลี่ยนรหัสผ่านทันที!**

---

## 🔧 คำสั่งที่ได้หลัง Setup

```bash
# เช็คสถานะ
pm2 status

# ดู logs
pm2 logs bot-manager-api

# เช็ค resources
bash deploy/check-resources.sh

# Restart
pm2 restart bot-manager-api

# Backup
bash deploy/backup.sh
```

---

## 📊 ตัวอย่างการรัน

```bash
ubuntu@ip-172-26-1-123:~$ cd /opt/bot-manager
ubuntu@ip-172-26-1-123:/opt/bot-manager$ bash deploy/auto-setup.sh

╔══════════════════════════════════════════════════════════╗
║          Bot Manager - Auto Setup Script                ║
║          จะ setup ทุกอย่างให้อัตโนมัติ                  ║
╚══════════════════════════════════════════════════════════╝

📋 ข้อมูลที่ต้องการ:

🌐 VPS IP Address: 54.123.45.67
🌍 Domain name (optional, press Enter to skip):

📝 Configuration Summary:
────────────────────────────────────────
VPS IP: 54.123.45.67
Domain: 54.123.45.67
Path: /opt/bot-manager
────────────────────────────────────────

Continue? (y/n): y

🚀 Starting auto setup...

[1/9] Updating system packages...
✅ System updated

[2/9] Installing Node.js 20.x...
✅ Node.js installed: v20.11.0

[3/9] Installing Python...
✅ Python already installed: Python 3.10.12
✅ Python packages installed

[4/9] Installing PM2...
✅ PM2 installed

[5/9] Installing Nginx...
✅ Nginx installed

[6/9] Installing project dependencies...
✅ Backend dependencies installed
✅ Frontend built

[7/9] Configuring environment...
✅ Environment configured
   JWT_SECRET: a7b8c9d0e1f2g3h4...

[8/9] Initializing database...
✅ Database initialized
   Username: admin
   Password: admin123

[9/9] Optimizing system for 2GB RAM...
✅ Swap added (1GB)
✅ Log rotation configured
✅ Monitoring script created
✅ Auto cleanup scheduled (daily 3 AM)
✅ System optimized

[Bonus] Configuring Nginx...
✅ Nginx configured and reloaded

[Starting] Starting backend with PM2...
✅ Backend started with PM2

[Security] Configuring firewall...
✅ Firewall configured (SSH, HTTP, HTTPS)

╔══════════════════════════════════════════════════════════╗
║              ✅ Setup Complete!                          ║
╚══════════════════════════════════════════════════════════╝

📊 System Information:
────────────────────────────────────────
✅ Node.js:    v20.11.0
✅ Python:     3.10.12
✅ PM2:        5.3.0
✅ Nginx:      Running
✅ Backend:    Running on port 3001
✅ Frontend:   Built and ready
✅ Database:   Initialized
✅ Swap:       1GB added
✅ Firewall:   Configured
────────────────────────────────────────

🌐 Access Your Bot Manager:
────────────────────────────────────────
URL:      http://54.123.45.67
Username: admin
Password: admin123

⚠️  IMPORTANT: Change password after first login!
────────────────────────────────────────

🔧 Useful Commands:
────────────────────────────────────────
Check status:    pm2 status
View logs:       pm2 logs bot-manager-api
Restart:         pm2 restart bot-manager-api
Check resources: bash deploy/check-resources.sh
Backup:          bash deploy/backup.sh
────────────────────────────────────────

📈 Next Steps:
1. Open http://54.123.45.67 in your browser
2. Login with admin/admin123
3. Change your password immediately
4. Create your first bot (+ Create Price Collector)
5. Monitor resources: bash deploy/check-resources.sh

🎉 Happy Bot Managing!
```

---

## 🐛 Troubleshooting

### Script หยุดกลางคัน
```bash
# ดู error log
cat /tmp/bot-manager-setup.log

# รันใหม่ได้เลย script จะ skip สิ่งที่ติดตั้งแล้ว
bash deploy/auto-setup.sh
```

### Backend ไม่ start
```bash
# เช็ค logs
pm2 logs bot-manager-api

# หรือ test manual
cd /opt/bot-manager/server
node server.js
```

### Nginx error
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### ลืม JWT_SECRET
```bash
# ดูใน .env file
cat /opt/bot-manager/server/.env | grep JWT_SECRET
```

---

## 🔄 Re-run Setup

ถ้าต้องการ reset และรัน setup ใหม่:

```bash
# Stop everything
pm2 delete all

# Remove old data
rm -rf /opt/bot-manager/server/data/*
rm -rf /opt/bot-manager/server/logs/*

# Re-run setup
bash deploy/auto-setup.sh
```

---

## 📞 Need Help?

1. เช็ค logs: `pm2 logs bot-manager-api`
2. เช็ค resources: `bash deploy/check-resources.sh`
3. ดู system logs: `sudo journalctl -xe`

---

## 🎯 Summary

**คำสั่งเดียวจบ:**
```bash
cd /opt/bot-manager
bash deploy/auto-setup.sh
```

**ตอบแค่ 2 คำถาม:**
1. VPS IP
2. Domain (optional)

**รอ 5-10 นาที = เสร็จ!** ✅

---

ง่ายสุดๆ ไม่ต้องทำอะไรเลย! 🚀
