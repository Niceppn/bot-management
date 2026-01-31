# 🚀 Price Collector Bot - User Guide

## ✨ ฟีเจอร์ใหม่ที่เพิ่มเข้ามา

### 1. สร้าง Price Collector Bot
- เลือก **Symbol** (เช่น btcusdc, ethusdc)
- เลือก **Socket Type**:
  - **Spot** - ข้อมูลจากตลาด Spot ของ Binance
  - **Future** - ข้อมูลจากตลาด Futures
  - **Demo** - ข้อมูลจาก Testnet (ทดสอบ)

### 2. Dashboard แสดงข้อมูล Crypto Trades
- **Total Records** - จำนวน trades ที่เก็บได้ทั้งหมด
- **Runtime** - ระยะเวลาที่บอททำงาน (นาที)
- **Average Price** - ราคาเฉลี่ย
- **Price Range** - ช่วงราคา (ต่ำสุด-สูงสุด)
- **Trade Distribution** - สัดส่วน BUY/SELL
- **Recent Trades** - แสดง 10 trades ล่าสุด

### 3. Live Logs
- ดู logs แบบ real-time
- Auto-scroll toggle
- **Download Logs** - ดาวน์โหลด logs ทั้งหมดเป็นไฟล์ .txt

---

## 📖 วิธีใช้งาน

### ขั้นตอนที่ 1: สร้าง Price Collector Bot

1. Login เข้าระบบ (admin/admin123)
2. ที่หน้า Dashboard คลิก **"+ Create Price Collector"**
3. กรอกข้อมูล:
   ```
   Bot Name: BTC Spot Collector
   Symbol: btcusdc
   Socket Type: Spot Trading
   ```
4. คลิก **"Create Bot"**

### ขั้นตอนที่ 2: เริ่มเก็บข้อมูล

1. กลับไปหน้า Dashboard
2. คลิก **"▶ Start"** ที่ bot ที่สร้าง
3. รอสัก 5 วินาที สถานะจะเปลี่ยนเป็น **Running** 🟢

### ขั้นตอนที่ 3: ดูข้อมูล

1. คลิก **"View Details"**
2. จะเห็น Dashboard แสดง:
   - จำนวน records
   - Runtime (นาที)
   - ราคาเฉลี่ย
   - กราฟ BUY/SELL distribution
   - ตาราง Recent Trades

### ขั้นตอนที่ 4: ดู Live Logs

1. ใน Detail Page คลิกแท็บ **"📄 Logs"**
2. ดู logs แบบ real-time
3. คลิก **"📥 Download Logs"** เพื่อดาวน์โหลดเป็นไฟล์ .txt

---

## 🎯 ตัวอย่างการใช้งาน

### ตัวอย่างที่ 1: เก็บข้อมูล BTC Spot
```
Bot Name: BTC Spot Collector
Symbol: btcusdc
Socket Type: spot
```

### ตัวอย่างที่ 2: เก็บข้อมูล ETH Futures
```
Bot Name: ETH Future Collector
Symbol: ethusdc
Socket Type: future
```

### ตัวอย่างที่ 3: ทดสอบด้วย Demo
```
Bot Name: Test Collector
Symbol: btcusdc
Socket Type: demo
```

---

## 📊 โครงสร้างข้อมูลใน Database

### ตาราง `crypto_trades`

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| bot_id | INTEGER | Bot ID |
| symbol | TEXT | Trading pair (e.g., BTCUSDC) |
| timestamp_ms | INTEGER | Unix timestamp (ms) |
| readable_time | TEXT | Human-readable time |
| price | REAL | Trade price |
| quantity | REAL | Trade quantity |
| side | TEXT | BUY or SELL |
| is_maker | INTEGER | Maker flag (0 or 1) |
| created_at | TEXT | Record creation time |

---

## 🔧 Technical Details

### Python Script
```bash
bots/collect_price.py
```

### Arguments
```bash
--bot-id <bot_id>        # Bot ID from database
--symbol <symbol>        # Trading symbol (e.g., btcusdc)
--socket-type <type>     # spot, future, or demo
```

### ตัวอย่าง Command
```bash
python3 bots/collect_price.py \
  --bot-id 4 \
  --symbol btcusdc \
  --socket-type spot
```

### Socket Endpoints

**Spot Trading:**
```
wss://stream.binance.com:9443/ws/{symbol}@aggTrade
```

**Futures Trading:**
```
wss://fstream.binance.com/ws/{symbol}@aggTrade
```

**Demo/Testnet:**
```
wss://demo-dstream.binance.com/ws/{symbol}@aggTrade
```

---

## 📁 ไฟล์ที่สร้างใหม่

### Backend (4 files)
1. `server/routes/trades.js` - Trades API endpoints
2. `server/config/database.js` - Updated (added crypto_trades table)
3. `bots/collect_price.py` - Price collector script
4. `requirements.txt` - Python dependencies

### Frontend (4 files)
1. `client/src/components/CreatePriceCollectorBot.jsx` - Create bot form
2. `client/src/components/CreatePriceCollectorBot.css` - Styles
3. `client/src/components/PriceCollectorDetail.jsx` - Dashboard & logs
4. `client/src/components/PriceCollectorDetail.css` - Styles

### Updated Files
- `server/server.js` - Added trades routes
- `server/routes/bots.js` - Added create/update/delete endpoints
- `server/services/botManager.js` - Support {{BOT_ID}} placeholder
- `client/src/services/api.js` - Added tradesAPI
- `client/src/App.jsx` - Added new routes
- `client/src/components/BotDashboard.jsx` - Added create button

---

## 🎮 API Endpoints

### Trades API

**Get trades:**
```
GET /api/trades/:botId?page=1&limit=50
```

**Get statistics:**
```
GET /api/trades/:botId/stats
```

**Get recent trades:**
```
GET /api/trades/:botId/recent?limit=10
```

**Clear trades:**
```
DELETE /api/trades/:botId
```

### Bots API (New)

**Create bot:**
```
POST /api/bots
Body: {
  name: "BTC Collector",
  description: "...",
  bot_type: "price_collector",
  config: {
    symbol: "btcusdc",
    socket_type: "spot"
  }
}
```

**Update bot:**
```
PUT /api/bots/:id
Body: {
  name: "...",
  config: { ... }
}
```

**Delete bot:**
```
DELETE /api/bots/:id
```

---

## 🐛 Troubleshooting

### Bot ไม่เริ่มเก็บข้อมูล

**ตรวจสอบ:**
1. Python websocket-client ติดตั้งแล้ว
   ```bash
   pip3 install websocket-client
   ```

2. Database มี table crypto_trades
   ```bash
   cd server
   npm run seed
   ```

3. ดู logs
   ```bash
   tail -f server/logs/<bot-name>.log
   ```

### ข้อมูลไม่แสดงใน Dashboard

**ตรวจสอบ:**
1. Bot status = Running
2. Logs มี messages
3. Database มีข้อมูล:
   ```bash
   sqlite3 server/data/bot_manager.db "SELECT COUNT(*) FROM crypto_trades WHERE bot_id=X;"
   ```

### WebSocket Error

**สาเหตุ:**
- Internet connection ขาด
- Binance API down
- Symbol ผิด (ต้องเป็นตัวพิมพ์เล็ก เช่น btcusdc)

**แก้ไข:**
- Bot จะ auto-reconnect ทุก 5 วินาที
- ตรวจสอบ symbol ถูกต้อง
- ลองเปลี่ยนเป็น demo socket

---

## 💡 Tips & Best Practices

### 1. เลือก Socket Type
- **Spot** - ใช้เก็บข้อมูลจริงจากตลาด spot
- **Future** - ใช้เก็บข้อมูลจากตลาด futures (leverage)
- **Demo** - ใช้ทดสอบก่อน (testnet)

### 2. เลือก Symbol
- ใช้ตัวพิมพ์เล็กทั้งหมด: `btcusdc` ไม่ใช่ `BTCUSDC`
- Symbol ต้องมีจริงใน Binance
- Popular: btcusdc, ethusdc, bnbusdc

### 3. จัดการข้อมูล
- ข้อมูลเก็บใน SQLite database
- ใช้ API `/api/trades/:botId` เพื่อดึงข้อมูล
- สามารถ clear ข้อมูลได้ตอนหยุด bot

### 4. Performance
- Auto-refresh ทุก 5 วินาที
- เก็บ logs ล่าสุด 200 รายการใน memory
- Database อัพเดทแบบ real-time

---

## 📈 Use Cases

### 1. ทำ ML/AI Training
- เก็บข้อมูลราคา real-time
- ส่งออกเป็น CSV สำหรับ training
- วิเคราะห์ pattern

### 2. Price Monitoring
- ติดตามราคา real-time
- แจ้งเตือนเมื่อราคาผิดปกติ
- สร้าง price alerts

### 3. Market Analysis
- วิเคราะห์ BUY/SELL ratio
- ดู trading volume
- หา support/resistance

### 4. Research & Backtesting
- เก็บข้อมูลย้อนหลัง
- ทดสอบ trading strategy
- วัดประสิทธิภาพ algorithms

---

## 🎉 Summary

✅ สร้าง Price Collector Bot ได้ง่ายๆ
✅ เลือก Symbol และ Socket Type
✅ Dashboard แสดงข้อมูลครบถ้วน
✅ Live Logs + Download logs
✅ ข้อมูลเก็บใน Database พร้อมใช้
✅ Auto-reconnect เมื่อ connection ขาด

**Ready to collect crypto data! 🚀📊**
