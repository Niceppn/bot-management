#!/usr/bin/env python3
"""
Simulate Bot for Bot Manager
Integrates with Bot Manager for configuration and logging
"""

import websocket, json, datetime, sys, requests, threading, time, argparse, logging
import pandas as pd
import lightgbm as lgb
from collections import deque
from binance.client import Client
from binance.enums import *

# ==========================================
# PARSE ARGUMENTS
# ==========================================
parser = argparse.ArgumentParser(description='Simulate Bot')
parser.add_argument('--bot-id', required=True, help='Bot ID from database')
parser.add_argument('--symbol', required=True, help='Trading symbol (e.g., BTCUSDC)')
parser.add_argument('--model-path', required=True, help='Path to LightGBM model file')
parser.add_argument('--api-key', required=True, help='Binance API Key')
parser.add_argument('--secret-key', required=True, help='Binance Secret Key')
parser.add_argument('--telegram-token', default='', help='Telegram Bot Token')
parser.add_argument('--telegram-chat-id', default='', help='Telegram Chat ID')
parser.add_argument('--confidence', type=float, default=0.40, help='AI Confidence Threshold (0-1)')
parser.add_argument('--capital', type=float, default=200, help='Capital per trade (USDT)')
parser.add_argument('--holding-time', type=int, default=2000, help='Holding time (seconds)')
parser.add_argument('--profit-target', type=float, default=0.0003, help='Profit target percentage (0-1)')
parser.add_argument('--stop-loss', type=float, default=0.006, help='Stop loss percentage (0-1)')
parser.add_argument('--maker-offset', type=float, default=0.00001, help='Maker buy offset percentage (0-1)')
parser.add_argument('--maker-timeout', type=int, default=60, help='Maker order timeout (seconds)')
parser.add_argument('--max-positions', type=int, default=3, help='Maximum concurrent positions')
parser.add_argument('--cooldown', type=int, default=180, help='Cooldown between slot 1 trades (seconds)')
parser.add_argument('--cooldown-slot2', type=int, default=180, help='Cooldown for slot 2 after slot 1 filled (seconds)')
parser.add_argument('--cooldown-slot3', type=int, default=30, help='Cooldown for slot 3 after slot 2 filled (seconds)')
parser.add_argument('--testnet', type=int, default=1, help='Use testnet (1) or mainnet (0)')

args = parser.parse_args()

# ==========================================
# CONFIGURATION
# ==========================================
BOT_ID = args.bot_id
SYMBOL_WS = args.symbol.lower()
SYMBOL_TRADE = args.symbol.upper()
MODEL_FILE = args.model_path

# --- TELEGRAM ---
TG_TOKEN = args.telegram_token
TG_CHAT_ID = args.telegram_chat_id

# --- API KEYS ---
API_KEY = args.api_key
SECRET_KEY = args.secret_key

# --- Strategy ---
CONFIDENCE_THRESHOLD = args.confidence
CAPITAL_PER_TRADE = args.capital
HOLDING_TIME = args.holding_time
PROFIT_TARGET_PCT = args.profit_target
STOP_LOSS_PCT = args.stop_loss
MAKER_BUY_OFFSET_PCT = args.maker_offset
MAKER_ORDER_TIMEOUT = args.maker_timeout
STATUS_REPORT_INTERVAL = 1800  # 30 minutes

# --- Concurrent Positions ---
MAX_POSITIONS = args.max_positions
COOLDOWN_SECONDS = args.cooldown
SLOT2_COOLDOWN_SECONDS = args.cooldown_slot2
SLOT3_COOLDOWN_SECONDS = args.cooldown_slot3

USE_TESTNET = args.testnet == 1

# ==========================================
# SETUP LOGGING
# ==========================================
# Log to stdout so Bot Manager can capture it
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# ==========================================
# CONNECT TO BINANCE
# ==========================================
try:
    client = Client(API_KEY, SECRET_KEY, testnet=USE_TESTNET)
    if USE_TESTNET:
        client.FUTURES_URL = 'https://demo-fapi.binance.com'

    balance = client.futures_account_balance()
    usdt = next((item for item in balance if item["asset"] == "USDT"), None)
    logger.info(f"✅ Connected to Binance {'Testnet' if USE_TESTNET else 'Mainnet'}")
    logger.info(f"💰 Balance: {usdt['balance']} USDT")

except Exception as e:
    logger.error(f"❌ Connection failed: {e}")
    sys.exit(1)

# ==========================================
# GLOBAL VARS
# ==========================================
IS_RUNNING = True
stats = {'win': 0, 'loss': 0, 'breakeven': 0, 'unfilled': 0}
total_pnl_cash = 0.0
active_orders = []
pending_orders = []
timeout_history = []
last_trade_time_per_slot = [0] * MAX_POSITIONS
last_status_report_time = time.time()
last_update_id = 0
buffer = deque(maxlen=60)
current_sec = {'net_flow': 0.0, 'total_volume': 0.0, 'trade_count': 0, 'close': 0.0, 'low': 999999.0, 'ts': None}

# Load model
try:
    model = lgb.Booster(model_file=MODEL_FILE)
    logger.info(f"✅ Loaded AI Model: {MODEL_FILE}")
except Exception as e:
    logger.error(f"❌ Model file not found: {e}")
    sys.exit(1)

# ==========================================
# TELEGRAM FUNCTIONS
# ==========================================
def send_tg_msg(msg):
    if not TG_TOKEN or not TG_CHAT_ID:
        return
    try:
        requests.post(
            f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage",
            data={'chat_id': TG_CHAT_ID, 'text': msg, 'parse_mode': 'HTML'},
            timeout=5
        )
    except:
        pass

def send_status_report():
    """Send status report every 30 minutes"""
    global last_status_report_time

    current_time = time.time()
    if current_time - last_status_report_time >= STATUS_REPORT_INTERVAL:
        total_trades = stats['win'] + stats['loss'] + stats['breakeven']
        win_rate = (stats['win'] / total_trades * 100) if total_trades > 0 else 0

        slot_status = build_slot_status_text(current_time)

        send_tg_msg(
            f"📊 <b>AUTO REPORT (30 min)</b>\n"
            f"━━━━━━━━━━━━━━━━\n"
            f"⏰ {datetime.datetime.now().strftime('%H:%M:%S')}\n"
            f"💰 Total PNL: <b>${total_pnl_cash:.4f}</b>\n"
            f"━━━━━━━━━━━━━━━━\n"
            f"✅ Win: {stats['win']}\n"
            f"❌ Loss: {stats['loss']}\n"
            f"😐 BE: {stats['breakeven']}\n"
            f"⏳ Unfilled: {stats['unfilled']}\n"
            f"📈 Win Rate: <b>{win_rate:.1f}%</b>\n"
            f"━━━━━━━━━━━━━━━━\n"
            f"📋 Active: {len(active_orders)}\n"
            f"⏱️ Pending: {len(pending_orders)}\n"
            f"━━━━━━━━━━━━━━━━\n"
            f"{slot_status}"
        )
        last_status_report_time = current_time

def build_slot_status_text(current_time):
    """Build slot status text for Telegram messages"""
    if len(active_orders) == 0:
        return "🔹 Slot 1: ✓ พร้อม\n🔹 Slot 2: รอไม้ 1\n🔹 Slot 3: รอไม้ 2"

    slot_lines = []
    for i in range(MAX_POSITIONS):
        order = next((o for o in active_orders if o['slot'] == i), None)
        if order:
            slot_lines.append(f"🔹 Slot {i+1}: ใช้งานที่ ${order['entry']:.2f} | TP: ${order['take_profit']:.2f}")
        elif i == 1 and len(active_orders) >= 1:
            # Slot 2: check cooldown from slot 1
            slot1 = next((o for o in active_orders if o['slot'] == 0), None)
            if slot1:
                elapsed = int(current_time - slot1['entry_ts'])
                remaining = max(0, SLOT2_COOLDOWN_SECONDS - elapsed)
                if remaining > 0:
                    slot_lines.append(f"🔹 Slot 2: เหลือเวลา {remaining}วิก่อนเข้า")
                else:
                    slot_lines.append(f"🔹 Slot 2: ✅ พร้อมเข้า")
            else:
                slot_lines.append(f"🔹 Slot 2: รอไม้ 1")
        elif i == 2 and len(active_orders) >= 2:
            # Slot 3: check cooldown from slot 2
            slot2 = next((o for o in active_orders if o['slot'] == 1), None)
            if slot2:
                elapsed = int(current_time - slot2['entry_ts'])
                remaining = max(0, SLOT3_COOLDOWN_SECONDS - elapsed)
                if remaining > 0:
                    slot_lines.append(f"🔹 Slot 3: เหลือเวลา {remaining}วิก่อนเข้า")
                else:
                    slot_lines.append(f"🔹 Slot 3: ✅ พร้อมเข้า")
            else:
                slot_lines.append(f"🔹 Slot 3: รอไม้ 2")
        elif i == 2:
            slot_lines.append(f"🔹 Slot 3: รอไม้ 2")

    return "\n".join(slot_lines) if slot_lines else "🔹 Slot 1: ✓ พร้อม\n🔹 Slot 2: รอไม้ 1\n🔹 Slot 3: รอไม้ 2"

# ==========================================
# TELEGRAM COMMAND HANDLER
# ==========================================
def get_telegram_updates():
    global last_update_id
    if not TG_TOKEN:
        return []
    try:
        response = requests.get(
            f"https://api.telegram.org/bot{TG_TOKEN}/getUpdates",
            params={'offset': last_update_id + 1, 'timeout': 5},
            timeout=10
        )
        data = response.json()
        if data.get('ok') and data.get('result'):
            return data['result']
    except:
        pass
    return []

def handle_telegram_commands():
    global last_update_id, IS_RUNNING
    global HOLDING_TIME, STOP_LOSS_PCT, PROFIT_TARGET_PCT, CONFIDENCE_THRESHOLD, CAPITAL_PER_TRADE, MAKER_ORDER_TIMEOUT

    updates = get_telegram_updates()
    for update in updates:
        last_update_id = update['update_id']

        if 'message' not in update or 'text' not in update['message']:
            continue

        message = update['message']['text'].strip()

        # /status
        if message == '/status':
            total_trades = stats['win'] + stats['loss'] + stats['breakeven']
            win_rate = (stats['win'] / total_trades * 100) if total_trades > 0 else 0

            try:
                balance = client.futures_account_balance()
                usdt = next((item for item in balance if item["asset"] == "USDT"), None)
                balance_text = f"💰 Balance: ${float(usdt['balance']):.2f}"
            except:
                balance_text = "💰 Balance: N/A"

            slot_status = build_slot_status_text(time.time())

            send_tg_msg(
                f"📊 <b>BOT STATUS</b>\n"
                f"━━━━━━━━━━━━━━━━\n"
                f"🤖 Status: {'🟢 RUNNING' if IS_RUNNING else '🔴 STOPPED'}\n"
                f"{balance_text}\n"
                f"💵 Total PNL: <b>${total_pnl_cash:.4f}</b>\n"
                f"━━━━━━━━━━━━━━━━\n"
                f"✅ Win: {stats['win']}\n"
                f"❌ Loss: {stats['loss']}\n"
                f"😐 BE: {stats['breakeven']}\n"
                f"⏳ Unfilled: {stats['unfilled']}\n"
                f"📈 Win Rate: <b>{win_rate:.1f}%</b>\n"
                f"━━━━━━━━━━━━━━━━\n"
                f"📋 Active: {len(active_orders)}\n"
                f"⏱️ Pending: {len(pending_orders)}\n"
                f"━━━━━━━━━━━━━━━━\n"
                f"{slot_status}\n"
                f"━━━━━━━━━━━━━━━━\n"
                f"⚙️ <b>SETTINGS:</b>\n"
                f"🤖 AI Confidence: {CONFIDENCE_THRESHOLD*100:.0f}%\n"
                f"💰 Capital/Trade: ${CAPITAL_PER_TRADE}\n"
                f"⏰ Holding: {HOLDING_TIME}s\n"
                f"🎯 TP: {PROFIT_TARGET_PCT*100:.3f}%\n"
                f"🛑 SL: {STOP_LOSS_PCT*100:.3f}%\n"
                f"⏱️ Order Timeout: {MAKER_ORDER_TIMEOUT}s"
            )

        # Other commands...
        elif message == '/stop':
            IS_RUNNING = False
            send_tg_msg("🔴 <b>BOT STOPPED</b>\nBot stopped trading. Use /start to resume.")

        elif message == '/start':
            IS_RUNNING = True
            send_tg_msg("🟢 <b>BOT STARTED</b>\nBot resumed trading!")

        # Add more commands as needed...

def telegram_command_loop():
    while True:
        try:
            handle_telegram_commands()
        except Exception as e:
            logger.error(f"❌ Telegram Command Error: {e}")
        time.sleep(5)

# ==========================================
# TRADING FUNCTIONS
# ==========================================
def place_limit_buy(symbol, quantity, limit_price):
    try:
        order = client.futures_create_order(
            symbol=symbol,
            side='BUY',
            type='LIMIT',
            quantity=quantity,
            price=str(round(limit_price, 1)),
            timeInForce='GTC'
        )
        return order
    except Exception as e:
        logger.error(f"❌ Error Placing Limit Buy: {e}")
        return None

def place_limit_sell(symbol, quantity, limit_price):
    try:
        order = client.futures_create_order(
            symbol=symbol,
            side='SELL',
            type='LIMIT',
            quantity=quantity,
            price=str(round(limit_price, 1)),
            timeInForce='GTC',
            reduceOnly=True
        )
        return order
    except Exception as e:
        logger.error(f"❌ Error Placing Limit Sell: {e}")
        return None

def cancel_order(symbol, order_id):
    try:
        client.futures_cancel_order(symbol=symbol, orderId=order_id)
        return True
    except Exception as e:
        logger.error(f"❌ Error Cancelling: {e}")
        return False

def close_position(symbol, quantity, reason):
    try:
        order = client.futures_create_order(
            symbol=symbol,
            side='SELL',
            type='MARKET',
            quantity=quantity,
            reduceOnly=True
        )
        return True
    except Exception as e:
        logger.error(f"❌ Error Closing: {e}")
        return False

def check_pending_orders(current_price, current_ts):
    """Check if pending limit orders should be filled or timeout"""
    global pending_orders, active_orders, stats, timeout_history

    for order in pending_orders[:]:
        if current_price <= order['limit_price']:
            # Order filled
            logger.info(f"⚡ LIMIT BUY: Slot {order['slot']} @ {order['limit_price']:.2f} | AI: {order.get('confidence', 0)*100:.2f}%")

            # Send Telegram notification
            if order['slot'] == 0:
                send_tg_msg(
                    f"🟢 <b>POSITION 1 FILLED</b>\n"
                    f"━━━━━━━━━━━━━━━━\n"
                    f"📥 Entry: ${order['limit_price']:.2f}\n"
                    f"🎯 TP: ${order['take_profit']:.2f}\n"
                    f"🛑 SL: ${order['stop_loss']:.2f}\n"
                    f"🤖 AI Conf: {order.get('confidence', 0)*100:.2f}%"
                )

            # Place TP limit sell order
            sell_order = place_limit_sell(SYMBOL_TRADE, order['quantity'], order['take_profit'])

            active_orders.append({
                'entry': order['limit_price'],
                'quantity': order['quantity'],
                'take_profit': order['take_profit'],
                'stop_loss': order['stop_loss'],
                'exit_ts': current_ts + HOLDING_TIME,
                'entry_ts': current_ts,
                'buy_order_id': order.get('order_id'),
                'sell_order_id': sell_order.get('orderId') if sell_order else None,
                'confidence': order.get('confidence', 0),
                'slot': order.get('slot', 0)
            })

            pending_orders.remove(order)

        elif current_ts >= order['timeout_ts']:
            # Order timeout
            stats['unfilled'] += 1
            logger.info(f"⏳ UNFILLED: Slot {order['slot']} | Limit @ {order['limit_price']:.2f} (AI: {order.get('confidence', 0)*100:.2f}%) cancelled (timeout)")

            timeout_history.append({
                'time': datetime.datetime.now().strftime('%H:%M:%S'),
                'limit_price': order['limit_price'],
                'confidence': order.get('confidence', 0),
                'timeout': MAKER_ORDER_TIMEOUT
            })

            if len(timeout_history) > 50:
                timeout_history.pop(0)

            if 'order_id' in order:
                cancel_order(SYMBOL_TRADE, order['order_id'])

            pending_orders.remove(order)

def check_orders(current_price, current_ts):
    """Check active orders for TP/SL/Timeout"""
    global stats, total_pnl_cash

    for order in active_orders[:]:
        is_exit = False
        reason = ""
        is_tp_hit = False

        if current_price >= order['take_profit']:
            is_exit = True
            is_tp_hit = True
            reason = "TP WIN 🎯"
        elif current_price <= order['stop_loss']:
            is_exit = True
            reason = "STOP LOSS 🛑"
        elif current_ts >= order['exit_ts']:
            is_exit = True
            reason = "TIME EXIT ⏳"

        if is_exit:
            if not is_tp_hit and order.get('sell_order_id'):
                cancel_order(SYMBOL_TRADE, order['sell_order_id'])
                success = close_position(SYMBOL_TRADE, order['quantity'], reason)
            else:
                success = True

            if success:
                profit = (current_price - order['entry']) * order['quantity']
                total_pnl_cash += profit

                if profit > 0:
                    stats['win'] += 1
                elif profit < 0:
                    stats['loss'] += 1
                else:
                    stats['breakeven'] += 1

                confidence = order.get('confidence', 0)
                logger.info(f"✅ SOLD [Slot {order['slot']}]: {current_price:.2f} | PNL: {profit:.4f} | Total: {total_pnl_cash:.4f} | {reason}")

                active_orders.remove(order)

def get_available_slot(current_ts):
    """Find available slot that passed cooldown — returns index or None"""
    total_open = len(active_orders) + len(pending_orders)
    if total_open >= MAX_POSITIONS:
        return None

    if total_open == 0:
        return 0

    if total_open == 1 and len(active_orders) == 1:
        first_active_order = active_orders[0]
        entry_time = first_active_order.get('entry_ts', current_ts)

        if entry_time and (current_ts - entry_time) >= SLOT2_COOLDOWN_SECONDS:
            return 1

    if total_open == 2 and len(active_orders) == 2:
        second_active_order = None
        for order in active_orders:
            if order['slot'] == 1:
                second_active_order = order
                break

        if second_active_order:
            entry_time = second_active_order.get('entry_ts', current_ts)
            if entry_time and (current_ts - entry_time) >= SLOT3_COOLDOWN_SECONDS:
                return 2

    return None

def predict(data_list, last_price, current_ts):
    """AI Prediction and order placement"""
    global last_trade_time_per_slot

    if not IS_RUNNING:
        return

    available_slot = get_available_slot(current_ts)
    if available_slot is None:
        return

    df = pd.DataFrame(data_list)
    if len(df) < 15:
        return

    # Feature engineering
    feat = {
        'total_volume': df['total_volume'].iloc[-1],
        'net_flow': df['net_flow'].iloc[-1],
        'trade_count': df['trade_count'].iloc[-1],
        'net_flow_ma5': df['net_flow'].rolling(5).mean().iloc[-1],
        'net_flow_ma15': df['net_flow'].rolling(15).mean().iloc[-1],
        'volume_ma5': df['total_volume'].rolling(5).mean().iloc[-1],
        'net_flow_diff': df['net_flow'].diff().iloc[-1],
        'price_change': df['close'].pct_change().iloc[-1] * 100,
        'std_5': df['close'].rolling(5).std().iloc[-1],
        'dist_ma15': df['close'].iloc[-1] - df['close'].rolling(15).mean().iloc[-1]
    }

    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
    feat['rsi'] = 100 - (100 / (1 + (gain / (loss + 1e-10)))).iloc[-1]

    prob = model.predict(pd.DataFrame([feat]))[0]

    # Print slot status
    slot_status = ""
    for i in range(MAX_POSITIONS):
        if i == 0:
            remaining = max(0, COOLDOWN_SECONDS - (current_ts - last_trade_time_per_slot[i]))
        elif i == 1 and len(active_orders) > 0:
            entry_time = active_orders[0].get('entry_ts', current_ts)
            remaining = max(0, SLOT2_COOLDOWN_SECONDS - (current_ts - entry_time))
        elif i == 2 and len(active_orders) >= 2:
            slot2 = next((o for o in active_orders if o['slot'] == 1), None)
            if slot2:
                entry_time = slot2.get('entry_ts', current_ts)
                remaining = max(0, SLOT3_COOLDOWN_SECONDS - (current_ts - entry_time))
            else:
                remaining = 0
        else:
            remaining = 0

        slot_status += f" S{i+1}:{'CD'+str(int(remaining))+'s' if remaining > 0 else '✓'}"

    print(f"\rPrice: {last_price:.2f} | Prob: {prob*100:.2f}% |{slot_status}", end="", flush=True)

    if prob >= CONFIDENCE_THRESHOLD:
        try:
            limit_buy_price = last_price * (1 - MAKER_BUY_OFFSET_PCT)
            qty = round(CAPITAL_PER_TRADE / limit_buy_price, 3)

            tp = limit_buy_price * (1 + PROFIT_TARGET_PCT)
            sl = limit_buy_price * (1 - STOP_LOSS_PCT)

            logger.info(f"📊 SIGNAL: Slot {available_slot} | Limit @ {limit_buy_price:.2f} | AI: {prob*100:.2f}% | TP: {tp:.2f} | SL: {sl:.2f}")

            # Send Telegram for slot 2 and 3
            if available_slot == 1:
                pos1_info = ""
                if len(active_orders) > 0:
                    pos1 = active_orders[0]
                    pos1_info = f"\n📊 Position 1:\n📥 Entry: ${pos1['entry']:.2f}\n🎯 TP: ${pos1['take_profit']:.2f}\n💰 Current: ${last_price:.2f}"

                send_tg_msg(
                    f"🔥 <b>POSITION 2 OPENED</b>\n"
                    f"━━━━━━━━━━━━━━━━\n"
                    f"📥 Entry: ${limit_buy_price:.2f}\n"
                    f"🎯 TP: ${tp:.2f}\n"
                    f"🛑 SL: ${sl:.2f}\n"
                    f"🤖 AI Conf: {prob*100:.2f}%"
                    f"{pos1_info}"
                )

            elif available_slot == 2:
                pos_info = ""
                if len(active_orders) >= 2:
                    slot1 = next((o for o in active_orders if o['slot'] == 0), None)
                    slot2 = next((o for o in active_orders if o['slot'] == 1), None)
                    if slot1 and slot2:
                        pos_info = f"\n📊 Position 1: ${slot1['entry']:.2f} | TP: ${slot1['take_profit']:.2f}\n📊 Position 2: ${slot2['entry']:.2f} | TP: ${slot2['take_profit']:.2f}\n💰 Current: ${last_price:.2f}"

                send_tg_msg(
                    f"🔥🔥 <b>POSITION 3 OPENED</b>\n"
                    f"━━━━━━━━━━━━━━━━\n"
                    f"📥 Entry: ${limit_buy_price:.2f}\n"
                    f"🎯 TP: ${tp:.2f}\n"
                    f"🛑 SL: ${sl:.2f}\n"
                    f"🤖 AI Conf: {prob*100:.2f}%"
                    f"{pos_info}"
                )

            order_response = place_limit_buy(SYMBOL_TRADE, qty, limit_buy_price)

            if order_response:
                order_id = order_response.get('orderId')
                logger.info(f"✅ Limit Order Placed | Slot {available_slot} | OrderID: {order_id}")

                pending_orders.append({
                    'limit_price': limit_buy_price,
                    'quantity': qty,
                    'take_profit': tp,
                    'stop_loss': sl,
                    'timeout_ts': current_ts + MAKER_ORDER_TIMEOUT,
                    'order_id': order_id,
                    'confidence': prob,
                    'slot': available_slot
                })

                last_trade_time_per_slot[available_slot] = current_ts

        except Exception as e:
            logger.error(f"❌ BUY ERROR: {e}")

# ==========================================
# WEBSOCKET RUNNER
# ==========================================
def on_message(ws, msg):
    global current_sec
    d = json.loads(msg)
    p, q, m, t = float(d['p']), float(d['q']), d['m'], int(d['T']/1000)

    if current_sec['ts'] is None:
        current_sec['ts'] = t

    check_pending_orders(p, t)
    check_orders(p, t)
    send_status_report()

    if t > current_sec['ts']:
        buffer.append(current_sec.copy())
        predict(list(buffer), p, t)
        current_sec = {'net_flow':0.0, 'total_volume':0.0, 'trade_count':0, 'close':p, 'low':p, 'ts':t}

    current_sec['net_flow'] += -q if m else q
    current_sec['total_volume'] += q
    current_sec['trade_count'] += 1
    current_sec['close'] = p
    if p < current_sec['low']:
        current_sec['low'] = min(current_sec['low'], p)

def on_error(ws, error):
    logger.error(f"❌ WebSocket Error: {error}")

def on_close(ws, close_status_code, close_msg):
    logger.warning(f"⚠️ WebSocket Closed: {close_msg}")

def on_open(ws):
    logger.info(f"✅ WebSocket Connected: {SYMBOL_WS}@aggTrade")

# ==========================================
# MAIN
# ==========================================
if __name__ == "__main__":
    logger.info(f"🚀 Bot Started | Bot ID: {BOT_ID} | Symbol: {SYMBOL_TRADE}")
    logger.info(f"📊 Config: Confidence={CONFIDENCE_THRESHOLD*100:.0f}%, Capital=${CAPITAL_PER_TRADE}, Holding={HOLDING_TIME}s")
    logger.info(f"🎯 TP={PROFIT_TARGET_PCT*100:.3f}%, SL={STOP_LOSS_PCT*100:.3f}%, Slots={MAX_POSITIONS}")

    send_tg_msg(
        f"🚀 <b>AI BOT STARTED</b>\n"
        f"━━━━━━━━━━━━━━━━\n"
        f"🔕 Silent Mode: แจ้งทุก 30 นาที\n"
        f"ใช้ /status เพื่อดูสถานะ"
    )

    # Start Telegram command handler
    if TG_TOKEN and TG_CHAT_ID:
        telegram_thread = threading.Thread(target=telegram_command_loop, daemon=True)
        telegram_thread.start()
        logger.info("✅ Telegram Command Handler Started")

    # Start WebSocket
    ws = websocket.WebSocketApp(
        f"wss://{'demo-' if USE_TESTNET else ''}fstream.binance.com/ws/{SYMBOL_WS}@aggTrade",
        on_message=on_message,
        on_error=on_error,
        on_close=on_close,
        on_open=on_open
    )

    ws.run_forever()
