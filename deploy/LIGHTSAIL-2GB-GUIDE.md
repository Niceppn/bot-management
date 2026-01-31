# 🚀 Lightsail 2GB - Deploy Guide (2-3 Bots)

คู่มือสำหรับ deploy บน AWS Lightsail 2GB RAM โดยเฉพาะ

---

## 📋 Lightsail Plan

```
Plan: $10/เดือน
├─ CPU: 1 vCPU
├─ RAM: 2 GB
├─ Storage: 60 GB SSD
└─ Traffic: 3 TB/month
```

**เหมาะสำหรับ:** รัน 2-3 price collector bots

---

## 🎯 Step-by-Step Deploy

### 1️⃣ Create Lightsail Instance

1. ไปที่ https://lightsail.aws.amazon.com
2. **Create instance**
3. เลือก:
   - Platform: **Linux/Unix**
   - Blueprint: **OS Only → Ubuntu 22.04 LTS**
   - Plan: **$10/month (2GB RAM)**
   - Instance name: `bot-manager`
4. **Create instance**

รอ 1-2 นาที จน status เป็น **Running**

---

### 2️⃣ Connect to Instance

#### Option A: ผ่าน Browser (ง่ายสุด)
```
คลิก instance → คลิก "Connect using SSH"
```

#### Option B: ผ่าน SSH Client (แนะนำ)
```bash
# Download SSH key
Lightsail Console → Account → SSH Keys → Download

# Connect
ssh -i LightsailDefaultKey-ap-southeast-1.pem ubuntu@YOUR_IP
```

---

### 3️⃣ Setup System

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python and dependencies
sudo apt install -y python3 python3-pip

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Create directory
sudo mkdir -p /opt/bot-manager
sudo chown -R ubuntu:ubuntu /opt/bot-manager
```

---

### 4️⃣ Upload Project

**จากเครื่อง Mac:**

```bash
# 1. Compress project
cd /Users/Macbook
tar -czf bot-manager.tar.gz \
    --exclude='Bot_Manager/node_modules' \
    --exclude='Bot_Manager/server/data' \
    --exclude='Bot_Manager/client/dist' \
    --exclude='Bot_Manager/.git' \
    Bot_Manager/

# 2. Upload to Lightsail
scp -i ~/Downloads/LightsailDefaultKey-*.pem \
    bot-manager.tar.gz \
    ubuntu@YOUR_LIGHTSAIL_IP:/tmp/

# 3. Extract on Lightsail
ssh -i ~/Downloads/LightsailDefaultKey-*.pem ubuntu@YOUR_LIGHTSAIL_IP
cd /opt/bot-manager
tar -xzf /tmp/bot-manager.tar.gz --strip-components=1
rm /tmp/bot-manager.tar.gz
```

---

### 5️⃣ Install Dependencies

```bash
cd /opt/bot-manager

# Install Python packages
pip3 install websocket-client

# Install backend dependencies
cd server
npm install --production
cd ..

# Install frontend dependencies and build
cd client
npm install
npm run build
cd ..

# Create directories
mkdir -p server/data server/logs
```

---

### 6️⃣ Initialize Database

```bash
cd /opt/bot-manager/server
npm run seed
cd ..
```

คุณจะได้:
- Username: `admin`
- Password: `admin123`

---

### 7️⃣ Configure Environment

```bash
# Create .env file
cp deploy/.env.production server/.env
nano server/.env
```

**แก้ไขค่าเหล่านี้:**

```env
NODE_ENV=production
PORT=3001
FRONTEND_URL=http://YOUR_LIGHTSAIL_IP
JWT_SECRET=YOUR_RANDOM_SECRET_HERE
```

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### 8️⃣ Optimize for 2GB RAM

```bash
cd /opt/bot-manager
chmod +x deploy/lightsail-2gb-setup.sh
bash deploy/lightsail-2gb-setup.sh
```

สคริปต์นี้จะ:
- ✅ เพิ่ม 1GB Swap
- ✅ ตั้งค่า log rotation
- ✅ สร้าง monitoring script
- ✅ ตั้งค่า auto cleanup (เก็บข้อมูล 60 วัน)

---

### 9️⃣ Start Backend

```bash
cd /opt/bot-manager

# Start with PM2
pm2 start deploy/ecosystem.config.js

# Save PM2 config
pm2 save

# Setup auto-start on reboot
pm2 startup
# คัดลอกคำสั่งที่แสดง แล้ววางรันอีกครั้ง
```

**เช็คสถานะ:**
```bash
pm2 status
pm2 logs bot-manager-api
```

---

### 🔟 Setup Nginx

```bash
# Copy nginx config
sudo cp /opt/bot-manager/deploy/nginx.conf /etc/nginx/sites-available/bot-manager

# Edit config
sudo nano /etc/nginx/sites-available/bot-manager
# แก้ไข: server_name YOUR_LIGHTSAIL_IP;

# Enable site
sudo ln -s /etc/nginx/sites-available/bot-manager /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

### 1️⃣1️⃣ Configure Firewall

**ใน Lightsail Console:**

```
1. คลิก instance → Networking tab
2. Firewall section:
   - HTTP (TCP 80) ✅ (มีอยู่แล้ว)
   - HTTPS (TCP 443) ✅ Add rule
   - SSH (TCP 22) ✅ (มีอยู่แล้ว)
```

---

### 1️⃣2️⃣ Test!

**เปิดเบราว์เซอร์:**
```
http://YOUR_LIGHTSAIL_IP
```

**Login:**
- Username: `admin`
- Password: `admin123`

**เปลี่ยนรหัสผ่านทันที!**

---

## 🤖 สร้าง Bot แรก

1. **Login เข้าระบบ**
2. คลิก **"+ Create Price Collector"**
3. กรอกข้อมูล:
   - Name: `BTC Spot Collector`
   - Category: `Collector`
   - Symbol: `btcusdc`
   - Socket Type: `Spot`
4. คลิก **Create Bot**
5. คลิก **▶ Start**

ตอนนี้ bot จะเริ่มเก็บข้อมูลแล้ว! 🎉

---

## 📊 Monitor Resources

```bash
# Quick check
bash /opt/bot-manager/deploy/check-resources.sh

# Real-time monitoring
pm2 monit

# View logs
pm2 logs bot-manager-api
tail -f /opt/bot-manager/server/logs/*.log

# System resources
htop  # (install: sudo apt install htop)
```

---

## 🔧 Useful Commands

### PM2 Commands
```bash
pm2 status                    # สถานะทั้งหมด
pm2 logs                      # ดู logs
pm2 restart bot-manager-api   # Restart backend
pm2 stop bot-manager-api      # หยุด backend
pm2 start bot-manager-api     # เริ่ม backend
```

### Nginx Commands
```bash
sudo systemctl status nginx   # เช็คสถานะ
sudo systemctl restart nginx  # Restart
sudo nginx -t                 # Test config
sudo tail -f /var/log/nginx/error.log  # ดู error log
```

### Database Commands
```bash
# เข้า database
sqlite3 /opt/bot-manager/server/data/bot_manager.db

# ดูจำนวนข้อมูล
sqlite3 /opt/bot-manager/server/data/bot_manager.db \
  "SELECT COUNT(*) FROM crypto_trades;"

# Export ข้อมูล
sqlite3 /opt/bot-manager/server/data/bot_manager.db \
  ".mode csv" ".output trades.csv" "SELECT * FROM crypto_trades;"
```

---

## 💾 Backup

### Manual Backup
```bash
# Backup database and logs
cd /opt/bot-manager
tar -czf backup-$(date +%Y%m%d).tar.gz \
  server/data \
  server/logs \
  server/.env

# Download to Mac
scp -i ~/Downloads/LightsailDefaultKey-*.pem \
  ubuntu@YOUR_IP:/opt/bot-manager/backup-*.tar.gz \
  ~/Downloads/
```

### Lightsail Snapshot
```
Lightsail Console → Snapshots → Create snapshot
```
สร้าง snapshot ทั้ง instance (แนะนำทำทุกสัปดาห์)

---

## 🆙 Update Code

**เมื่อมี code ใหม่:**

```bash
# จาก Mac - อัพโหลดใหม่
cd /Users/Macbook
tar -czf bot-manager-update.tar.gz \
    --exclude='Bot_Manager/node_modules' \
    --exclude='Bot_Manager/server/data' \
    Bot_Manager/

scp -i ~/Downloads/LightsailDefaultKey-*.pem \
    bot-manager-update.tar.gz \
    ubuntu@YOUR_IP:/tmp/

# บน Lightsail
cd /opt/bot-manager
pm2 stop bot-manager-api

# Backup old code
mv server server.backup
mv client client.backup

# Extract new code
tar -xzf /tmp/bot-manager-update.tar.gz --strip-components=1

# Restore data
mv server.backup/data server/
mv server.backup/.env server/
mv server.backup/logs server/

# Reinstall dependencies
cd server && npm install && cd ..
cd client && npm install && npm run build && cd ..

# Restart
pm2 restart bot-manager-api
```

---

## 🐛 Troubleshooting

### Backend ไม่ start
```bash
cd /opt/bot-manager/server
node server.js  # ทดสอบโดยตรง
```

### Bot ไม่รัน
```bash
pm2 logs bot-manager-api
ls -la server/data/  # เช็ค database
```

### Nginx error
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### RAM เต็ม
```bash
free -h
pm2 list  # ดูว่า process ไหนกิน RAM เยอะ
```

### Disk เต็ม
```bash
df -h
du -sh /opt/bot-manager/server/data/
# ถ้าเต็ม รัน:
bash /opt/bot-manager/deploy/auto-cleanup.sh
```

---

## 📈 Performance Expected

**กับ 2GB RAM + 2-3 Bots:**

```
✅ RAM Usage: 40-50% (~1GB)
✅ CPU Usage: 20-30%
✅ Disk Growth: ~200-400 MB/วัน
✅ Data Retention: 60 วัน (auto cleanup)
✅ Status: Very Smooth 🟢
```

---

## 🎯 Next Steps

1. ✅ เปลี่ยนรหัสผ่าน admin
2. ✅ สร้าง bot 2-3 ตัว
3. ✅ Monitor resources ประจำวัน
4. ✅ Setup Lightsail snapshot ทุกสัปดาห์
5. ⭐ (Optional) ตั้ง SSL ถ้ามี domain

---

## 🔒 Security Checklist

- [ ] เปลี่ยนรหัสผ่าน admin
- [ ] ตั้งค่า JWT_SECRET ที่ปลอดภัย
- [ ] Update system packages: `sudo apt update && sudo apt upgrade`
- [ ] ตั้งค่า Lightsail firewall ให้เปิดแค่ port ที่จำเป็น
- [ ] สร้าง snapshot backup
- [ ] ตั้ง SSH key authentication (disable password login)

---

## 💰 Cost

**Monthly Cost:**
```
Lightsail Instance: $10/month
Data Transfer: Included (3TB)
────────────────────────────
Total: $10/month
```

**ถ้ามี bot 3 ตัว เก็บข้อมูล 60 วัน:**
- Database size: ~10-20 GB
- Log files: ~1-2 GB
- Total: ~12-22 GB (พอดีกับ 60GB SSD)

---

## 📞 Need Help?

**Check logs first:**
```bash
pm2 logs bot-manager-api
bash /opt/bot-manager/deploy/check-resources.sh
```

**Common issues:**
- Can't connect → Check Lightsail firewall
- 502 Bad Gateway → Backend not running, check PM2
- Slow performance → Check RAM/CPU usage
- Disk full → Run cleanup script

---

## ✅ Done!

คุณพร้อมใช้งานแล้ว! 🎉

**System Monitor จะแสดง:**
- 💻 CPU usage
- 🧠 RAM usage
- 💾 Disk usage

**Happy Bot Managing!** 🤖
