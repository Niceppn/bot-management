# Trading Bot Setup Guide

## Quick Start

### 1. Backend Setup

```bash
cd /Users/Macbook/Bot_Manager/server

# Install dependencies
npm install

# Start server
npm start
# Server runs on http://localhost:3001
```

### 2. Install Bot Dependencies

```bash
cd /Users/Macbook/Bot_Manager/bots

# Install Python packages
pip3 install -r requirements.txt

# Or install manually:
pip3 install websocket-client python-binance lightgbm pandas requests
```

### 3. Create Trading Bot via API

First, get an auth token:

```bash
# Login (assuming you have a user created)
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your_password"}' \
  | jq -r '.token'

# Save token to variable
TOKEN="your_jwt_token_here"
```

Create a trading bot:

```bash
curl -X POST http://localhost:3001/api/bots \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "BTCUSDC Trading Bot",
    "description": "AI-powered BTCUSDC futures trading",
    "bot_type": "trading",
    "script_path": "bots/trading_bot.py",
    "script_args": "[\"--bot-id\", \"{{BOT_ID}}\", \"--symbol\", \"BTCUSDC\"]"
  }' | jq '.'
```

### 4. Upload AI Model

```bash
# Upload LightGBM model
curl -X POST http://localhost:3001/api/models/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "model=@/Users/Macbook/Collect_Crypto/BTC_Future/test/BTCUSDC.txt" \
  -F "name=BTCUSDC Model v1" \
  -F "symbol=BTCUSDC" \
  -F "description=LightGBM model trained on BTCUSDC data" \
  | jq '.'
```

### 5. Configure Bot

```bash
BOT_ID=1  # Use the ID from step 3

# Set trading config
curl -X PUT http://localhost:3001/api/trading/bots/$BOT_ID/config \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "confidence_threshold": 0.40,
    "capital_per_trade": 200,
    "holding_time": 2000,
    "profit_target_pct": 0.00015,
    "stop_loss_pct": 0.009,
    "maker_order_timeout": 60,
    "max_positions": 2,
    "model_id": 1
  }' | jq '.'
```

### 6. Run Bot Manually (for testing)

```bash
cd /Users/Macbook/Bot_Manager

python3 bots/trading_bot.py \
  --bot-id 1 \
  --symbol BTCUSDC \
  --config-json '{
    "api_key": "YOUR_BINANCE_API_KEY",
    "secret_key": "YOUR_BINANCE_SECRET_KEY",
    "model_path": "/Users/Macbook/Collect_Crypto/BTC_Future/test/BTCUSDC.txt",
    "confidence_threshold": 0.40,
    "capital_per_trade": 200,
    "testnet": true,
    "socket_type": "demo"
  }'
```

### 7. Start Bot via Bot Manager

```bash
# Start bot through the backend
curl -X POST http://localhost:3001/api/bots/$BOT_ID/start \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'

# Check status
curl http://localhost:3001/api/bots/$BOT_ID \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'
```

## Bot Configuration Reference

### Required Config
```json
{
  "api_key": "your_binance_api_key",
  "secret_key": "your_binance_secret_key",
  "model_path": "/path/to/lightgbm/model.txt",
  "symbol": "BTCUSDC",
  "testnet": true
}
```

### Trading Parameters
```json
{
  "confidence_threshold": 0.40,      // Min AI confidence (0.0-1.0)
  "capital_per_trade": 200,          // USDT per trade
  "holding_time": 2000,              // Max hold time (seconds)
  "profit_target_pct": 0.00015,      // Take profit % (0.015%)
  "stop_loss_pct": 0.009,            // Stop loss % (0.9%)
  "maker_order_timeout": 60,         // Limit order timeout (seconds)
  "max_positions": 2                 // Max concurrent positions
}
```

### Optional: Telegram Notifications
```json
{
  "telegram_token": "bot_token",
  "telegram_chat_id": "chat_id"
}
```

### Socket Types
- `demo` - Binance Demo Testnet (default)
- `future` - Binance Futures Mainnet
- `spot` - Binance Spot Mainnet

## API Endpoints

### Trading Config
```bash
# Get config
GET /api/trading/bots/:id/config

# Update config
PUT /api/trading/bots/:id/config
{
  "confidence_threshold": 0.50,
  "capital_per_trade": 300
}

# Validate config
POST /api/trading/bots/:id/config/validate
```

### Orders
```bash
# Get active orders
GET /api/trading/bots/:id/orders

# Get order history
GET /api/trading/bots/:id/orders/history?limit=100&offset=0

# Bot reports order (internal)
POST /api/trading/bots/:id/orders
```

### Statistics
```bash
# Get stats
GET /api/trading/bots/:id/stats?days=30

# Get PNL breakdown
GET /api/trading/bots/:id/pnl?days=7

# Update stats (internal)
POST /api/trading/bots/:id/stats/update
```

### Models
```bash
# List models
GET /api/models

# Get model
GET /api/models/:id

# Upload model
POST /api/models/upload
Content-Type: multipart/form-data
{
  model: file,
  name: string,
  symbol: string,
  description: string
}

# Update model
PUT /api/models/:id

# Delete model
DELETE /api/models/:id

# Assign model to bot
PUT /api/models/assign/:botId
{
  "model_id": 1
}

# Get models by symbol
GET /api/models/symbol/BTCUSDC
```

## Monitoring

### Check Bot Status
```bash
curl http://localhost:3001/api/bots/$BOT_ID/stats \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'
```

### View Active Orders
```bash
curl http://localhost:3001/api/trading/bots/$BOT_ID/orders \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'
```

### View Logs
```bash
# If bot is running through bot manager
tail -f server/logs/btcusdc_trading_bot.log
```

## Hot Config Reload

The bot automatically reloads config every 30 seconds:

```bash
# Update config
curl -X PUT http://localhost:3001/api/trading/bots/$BOT_ID/config \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"confidence_threshold": 0.50}'

# Bot will pick up changes within 30 seconds
# No restart needed!
```

## Troubleshooting

### Bot won't start
1. Check API keys are valid
2. Check model file exists
3. Check Python dependencies installed
4. Check database connection

### No trades happening
1. Check AI confidence threshold (try lowering)
2. Check if max_positions reached
3. Check market conditions
4. Check WebSocket connection

### Orders not filling
1. Check maker_order_timeout setting
2. Check limit order offset
3. Consider using market orders (modify code)

### Config not reloading
1. Check bot is reading from API
2. Check config_loader logs
3. Verify API endpoint returns new config

## Best Practices

1. **Start with Testnet**
   - Always test on Binance Testnet first
   - Set `testnet: true` in config

2. **Small Capital First**
   - Start with small `capital_per_trade`
   - Increase gradually

3. **Conservative Thresholds**
   - Start with high `confidence_threshold` (0.50+)
   - Lower gradually as you gain confidence

4. **Monitor Closely**
   - Watch first few trades
   - Check PNL calculations
   - Verify TP/SL logic

5. **Backup Strategy**
   - Keep original bot code
   - Backup database regularly
   - Have manual close plan

## Migration from Legacy Bots

### Step 1: Extract Model
```bash
# Copy model file to accessible location
cp /Users/Macbook/Collect_Crypto/BTC_Future/test/BTCUSDC.txt \
   /Users/Macbook/Bot_Manager/models/
```

### Step 2: Extract Config
```python
# From old bot code
CONFIDENCE_THRESHOLD = 0.40
CAPITAL_PER_TRADE = 200
HOLDING_TIME = 2000
# ... etc
```

### Step 3: Upload Model
Use API endpoint (see above)

### Step 4: Create Bot
Use API endpoint (see above)

### Step 5: Test Side-by-Side
- Run old bot
- Run new bot with small capital
- Compare results

### Step 6: Full Migration
- Stop old bot
- Start new bot with full capital
- Monitor for 24h

## Performance Tips

1. **Database Optimization**
   - Database uses WAL mode
   - Indexes on frequently queried fields
   - Batch inserts where possible

2. **API Performance**
   - Config cached on bot side
   - Only polls every 30s
   - Non-blocking HTTP posts

3. **WebSocket Efficiency**
   - Single connection per bot
   - Auto-reconnect on disconnect
   - Efficient data buffering

4. **Order Management**
   - Checks every 2 seconds (not every tick)
   - Early exit conditions
   - Minimal API calls

## Security Notes

1. **API Keys**
   - Store in environment variables
   - Never commit to git
   - Use read/write permissions only

2. **JWT Tokens**
   - Expire after period
   - Rotate regularly
   - Store securely

3. **Database**
   - Regular backups
   - Secure file permissions
   - Consider encryption

4. **Network**
   - Use HTTPS in production
   - Firewall bot manager port
   - VPN for remote access

## Next Steps

1. Build frontend (Phase 3)
2. Add more indicators
3. Implement backtesting
4. Add strategy optimization
5. Multi-symbol support
6. Portfolio management

## Support

For issues or questions:
1. Check IMPLEMENTATION_STATUS.md
2. Review bot logs
3. Test with minimal config
4. Verify API connectivity
