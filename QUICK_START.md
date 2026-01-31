# 🚀 Quick Start Guide - Bot Manager

โปรเจ็กต์ใหม่สร้างเสร็จแล้ว! พร้อมใช้งานเลย

## ✅ ติดตั้งเสร็จแล้ว

- ✅ Backend dependencies (Node.js + Express + SQLite)
- ✅ Frontend dependencies (React + Vite)
- ✅ Database seeded พร้อม user และ 3 bots
- ✅ Python bot scripts พร้อมใช้งาน (3 bots)

---

## 🎯 เริ่มใช้งาน (3 ขั้นตอน)

### 1. Start Backend

```bash
cd /Users/Macbook/Bot_Manager/server
npm start
```

ควรเห็น:
```
✅ Database connection successful
🚀 Server running on http://localhost:3001
📊 API available at http://localhost:3001/api
```

### 2. Start Frontend (Terminal ใหม่)

```bash
cd /Users/Macbook/Bot_Manager/client
npm run dev
```

ควรเห็น:
```
  VITE ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

### 3. เปิด Browser

เข้า: http://localhost:5173

**Login:**
- Username: `admin`
- Password: `admin123`

---

## 🎮 ทดสอบใช้งาน

### ใน Bot Dashboard:

1. ✅ ดูรายการ bot 3 ตัว (Demo Bot 1, Demo Bot 2, Monitor Bot)
2. ✅ คลิก **▶ Start** ที่ Demo Bot 1
3. ✅ รอ 5 วินาที สถานะจะเปลี่ยนเป็น **Running** 🟢
4. ✅ คลิก **View Details** เพื่อดู live logs
5. ✅ ดู logs แสดงแบบ real-time!
6. ✅ คลิก **⏹ Stop** เพื่อหยุด bot

---

## 📁 โครงสร้างโปรเจ็กต์

```
/Users/Macbook/Bot_Manager/
├── server/              # Backend (Port 3001)
│   ├── data/           # SQLite database (bot_manager.db)
│   ├── logs/           # Bot log files
│   └── ...
├── client/              # Frontend (Port 5173)
│   └── src/
│       └── components/
└── bots/                # Python bot scripts
    ├── demo_bot1.py    ✅ รันได้เลย
    ├── demo_bot2.py    ✅ รันได้เลย
    └── monitor_bot.py  ✅ รันได้เลย
```

---

## 🤖 Bots ที่มีอยู่

### 1. Demo Bot 1
- **Path**: `bots/demo_bot1.py`
- **Description**: Simple bot, รันทุก 10 วินาที
- **Logs**: INFO, WARNING, ERROR, DEBUG

### 2. Demo Bot 2
- **Path**: `bots/demo_bot2.py`
- **Description**: Bot with configurable interval (default 60s)
- **Args**: `["--interval", "60"]`

### 3. Monitor Bot
- **Path**: `bots/monitor_bot.py`
- **Description**: Simulates system monitoring (CPU, Memory, Disk)
- **Logs**: Resource usage every 30s

---

## 🔥 คำสั่งที่ใช้บ่อย

### Backend
```bash
cd /Users/Macbook/Bot_Manager/server
npm start          # Start server
npm run dev        # Start with auto-reload
npm run seed       # Re-seed database
```

### Frontend
```bash
cd /Users/Macbook/Bot_Manager/client
npm run dev        # Start dev server
npm run build      # Build for production
```

---

## 🐛 Troubleshooting

### Bot ไม่ start
```bash
# ตรวจสอบว่า Python 3 ติดตั้งแล้ว
python3 --version

# ตรวจสอบว่า script รันได้
python3 bots/demo_bot1.py
```

### Port ถูกใช้แล้ว
```bash
# Backend (Port 3001)
lsof -ti:3001 | xargs kill

# Frontend (Port 5173)
lsof -ti:5173 | xargs kill
```

### Database ต้องการ reset
```bash
cd server
rm data/bot_manager.db
npm run seed
```

---

## 📊 Database Info

- **Location**: `/Users/Macbook/Bot_Manager/server/data/bot_manager.db`
- **Users**: 1 user (admin)
- **Bots**: 3 bots (all stopped by default)

ดูข้อมูล:
```bash
cd server
sqlite3 data/bot_manager.db "SELECT id, name, status FROM bots;"
```

---

## 🎨 Features

✅ **Dashboard**
- Bot cards with status indicators
- Auto-refresh every 5 seconds
- Start/Stop controls

✅ **Bot Detail Page**
- Live log streaming (SSE)
- Statistics (uptime, restarts, log count)
- Auto-scroll toggle
- Color-coded log levels

✅ **UI**
- Dark minimalist theme
- Glass morphism effects
- Smooth animations
- Responsive design

---

## 🚀 Production Deployment

### Backend (VPS)
```bash
# Install PM2
npm install -g pm2

# Start server
cd server
pm2 start server.js --name bot-manager

# View logs
pm2 logs bot-manager
```

### Frontend (Vercel)
```bash
cd client
npm run build
# Upload dist/ folder to Vercel
```

---

## 📝 Next Steps

1. ✅ Start backend และ frontend
2. ✅ Login และทดสอบ start/stop bot
3. ✅ ดู live logs ในหน้า detail
4. 🔜 สร้าง Python bots ของคุณเองใน `bots/` directory
5. 🔜 เพิ่ม bots ใหม่ในฐานข้อมูล

---

## 💡 Tips

- กด **F12** เพื่อเปิด DevTools ดู network requests
- Log files อยู่ที่ `server/logs/*.log`
- Database อยู่ที่ `server/data/bot_manager.db`
- เปลี่ยน API URL ที่ `client/src/services/api.js`

---

## 🎉 Happy Bot Managing!

หากมีปัญหา check:
1. Backend console output
2. Frontend browser console
3. Bot log files ใน `server/logs/`

Full documentation: [README.md](README.md)
