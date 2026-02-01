#!/usr/bin/env python3
"""
Simulate Trading Bot - Controlled by Bot Manager
Receives configuration from command line arguments
"""

import websocket
import json
import datetime
import sys
import requests
import threading
import time
import argparse
import pandas as pd
import lightgbm as lgb
from collections import deque
from binance.client import Client
from binance.enums import *

# ==========================================
# PARSE COMMAND LINE ARGUMENTS
# ==========================================
parser = argparse.ArgumentParser(description='Simulate Trading Bot')
parser.add_argument('--bot-id', type=int, required=True, help='Bot ID')
parser.add_argument('--symbol', type=str, required=True, help='Trading symbol (e.g., BTCUSDC)')
parser.add_argument('--model-path', type=str, required=True, help='Path to LightGBM model file')
parser.add_argument('--api-key', type=str, required=True, help='Binance API Key')
parser.add_argument('--secret-key', type=str, required=True, help='Binance Secret Key')
parser.add_argument('--telegram-token', type=str, default='', help='Telegram Bot Token')
parser.add_argument('--telegram-chat-id', type=str, default='', help='Telegram Chat ID')
parser.add_argument('--confidence', type=float, default=0.40, help='AI Confidence Threshold')
parser.add_argument('--capital', type=float, default=200, help='Capital per trade')
parser.add_argument('--holding-time', type=int, default=2000, help='Holding time in seconds')
parser.add_argument('--profit-target', type=float, default=0.00015, help='Profit target percentage')
parser.add_argument('--stop-loss', type=float, default=0.009, help='Stop loss percentage')
parser.add_argument('--maker-offset', type=float, default=0.00001, help='Maker buy offset percentage')
parser.add_argument('--maker-timeout', type=int, default=60, help='Maker order timeout')
parser.add_argument('--max-positions', type=int, default=2, help='Max concurrent positions')
parser.add_argument('--cooldown', type=int, default=180, help='Cooldown between positions')
parser.add_argument('--testnet', type=int, default=1, help='Use testnet (1) or production (0)')

args = parser.parse_args()

# ==========================================
# CONFIGURATION
# ==========================================
BOT_ID = args.bot_id
SYMBOL_WS = args.symbol.lower()
SYMBOL_TRADE = args.symbol.upper()
MODEL_FILE = args.model_path
API_KEY = args.api_key
SECRET_KEY = args.secret_key
TG_TOKEN = args.telegram_token
TG_CHAT_ID = args.telegram_chat_id

CONFIDENCE_THRESHOLD = args.confidence
CAPITAL_PER_TRADE = args.capital
HOLDING_TIME = args.holding_time
PROFIT_TARGET_PCT = args.profit_target
STOP_LOSS_PCT = args.stop_loss
MAKER_BUY_OFFSET_PCT = args.maker_offset
MAKER_ORDER_TIMEOUT = args.maker_timeout
MAX_POSITIONS = args.max_positions
COOLDOWN_SECONDS = args.cooldown
STATUS_REPORT_INTERVAL = 3800
USE_TESTNET = args.testnet == 1

# ==========================================
# CONNECT TO BINANCE
# ==========================================
def log(msg, level='INFO'):
    """Log with timestamp and level"""
    timestamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] [{level}] {msg}", flush=True)

try:
    client = Client(API_KEY, SECRET_KEY, testnet=USE_TESTNET)
    if USE_TESTNET:
        client.FUTURES_URL = 'https://demo-fapi.binance.com'

    balance = client.futures_account_balance()
    usdt = next((item for item in balance if item["asset"] == "USDT"), None)
    log(f"✅ Connected to Binance {'Testnet' if USE_TESTNET else 'Production'}")
    log(f"💰 Balance: {usdt['balance']} USDT")
except Exception as e:
    log(f"❌ Connection failed: {e}", 'ERROR')
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
    log(f"✅ Loaded AI Model: {MODEL_FILE}")
except Exception as e:
    log(f"❌ Model loading failed: {e}", 'ERROR')
    sys.exit(1)

# ==========================================
# TELEGRAM FUNCTIONS
# ==========================================
def send_tg_msg(msg):
    """Send Telegram message if configured"""
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

        slot_status = ""
        if len(active_orders) == 1 and active_orders[0]['slot'] == 0:
            elapsed = int(current_time - active_orders[0]['entry_ts'])
            remaining = max(0, COOLDOWN_SECONDS - elapsed)
            if remaining > 0:
                slot_status = f"🔹 Slot 1: Active | 🔹 Slot 2: {remaining}s cooldown"
            else:
                slot_status = f"🔹 Slot 1: Active | 🔹 Slot 2: ✅ Ready"
        elif len(active_orders) == 2:
            slot_status = f"🔹 Slot 1: Active | 🔹 Slot 2: Active"

        send_tg_msg(
            f"📊 <b>AUTO REPORT</b>\n"
            f"━━━━━━━━━━━━━━━━\n"
            f"💰 PNL: <b>${total_pnl_cash:.4f}</b>\n"
            f"✅ Win: {stats['win']} | ❌ Loss: {stats['loss']}\n"
            f"📈 Win Rate: <b>{win_rate:.1f}%</b>\n"
            f"{slot_status}"
        )
        last_status_report_time = current_time

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
        log(f"❌ Limit Buy Error: {e}", 'ERROR')
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
        log(f"❌ Limit Sell Error: {e}", 'ERROR')
        return None

def cancel_order(symbol, order_id):
    try:
        client.futures_cancel_order(symbol=symbol, orderId=order_id)
        return True
    except Exception as e:
        log(f"❌ Cancel Error: {e}", 'ERROR')
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
        log(f"❌ Close Error: {e}", 'ERROR')
        return False

def check_pending_orders(current_price, current_ts):
    global pending_orders, active_orders, stats, timeout_history

    for order in pending_orders[:]:
        if current_price <= order['limit_price']:
            if order['slot'] == 0:
                send_tg_msg(
                    f"🟢 <b>POS 1 FILLED</b>\n"
                    f"📥 Entry: ${order['limit_price']:.2f}\n"
                    f"🎯 TP: ${order['take_profit']:.2f}\n"
                    f"🤖 AI: {order.get('confidence', 0)*100:.2f}%"
                )

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
            stats['unfilled'] += 1
            log(f"⏳ UNFILLED: Slot {order['slot']} @ {order['limit_price']:.2f}", 'WARN')

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

                log(f"✅ SOLD [Slot {order['slot']}]: {current_price:.2f} | PNL: {profit:.4f} | Total: {total_pnl_cash:.4f} | {reason}")

                active_orders.remove(order)

def get_available_slot(current_ts):
    """Find available slot with cooldown check"""
    total_open = len(active_orders) + len(pending_orders)
    if total_open >= MAX_POSITIONS:
        return None

    if total_open == 0:
        return 0

    if total_open == 1 and len(active_orders) == 1:
        first_active_order = active_orders[0]
        entry_time = first_active_order.get('entry_ts', current_ts)

        if entry_time and (current_ts - entry_time) >= COOLDOWN_SECONDS:
            return 1

    return None

def predict(data_list, last_price, current_ts):
    global last_trade_time_per_slot, active_orders, pending_orders

    if not IS_RUNNING:
        return

    available_slot = get_available_slot(current_ts)
    if available_slot is None:
        return

    df = pd.DataFrame(data_list)
    if len(df) < 15:
        return

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

    # Show slot status
    slot_status = ""
    for i in range(MAX_POSITIONS):
        if i == 0:
            remaining = max(0, COOLDOWN_SECONDS - (current_ts - last_trade_time_per_slot[i]))
        elif i == 1 and len(active_orders) > 0:
            entry_time = active_orders[0].get('entry_ts', current_ts)
            remaining = max(0, COOLDOWN_SECONDS - (current_ts - entry_time))
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

            log(f"⚡ LIMIT BUY: Slot {available_slot} @ {limit_buy_price:.2f} | AI: {prob*100:.2f}%")

            if available_slot == 1:
                send_tg_msg(
                    f"🔥 <b>POS 2 OPENED</b>\n"
                    f"📥 Entry: ${limit_buy_price:.2f}\n"
                    f"🎯 TP: ${tp:.2f}\n"
                    f"🤖 AI: {prob*100:.2f}%"
                )

            order_response = place_limit_buy(SYMBOL_TRADE, qty, limit_buy_price)

            if order_response:
                order_id = order_response.get('orderId')
                log(f"✅ Limit Order Placed | Slot {available_slot} | OrderID: {order_id}")

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
            log(f"❌ BUY ERROR: {e}", 'ERROR')

# ==========================================
# WEBSOCKET HANDLER
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
    log(f"❌ WebSocket Error: {error}", 'ERROR')

def on_close(ws, close_status_code, close_msg):
    log(f"⚠️ WebSocket Closed: {close_status_code} - {close_msg}", 'WARN')

def on_open(ws):
    log(f"🚀 Bot Started - Symbol: {SYMBOL_TRADE}")
    send_tg_msg(
        f"🚀 <b>BOT STARTED</b>\n"
        f"━━━━━━━━━━━━━━━━\n"
        f"📊 Symbol: {SYMBOL_TRADE}\n"
        f"🤖 AI Conf: {CONFIDENCE_THRESHOLD*100:.0f}%\n"
        f"💰 Capital: ${CAPITAL_PER_TRADE}"
    )

# ==========================================
# MAIN
# ==========================================
if __name__ == "__main__":
    ws_url = f"wss://{'demo-' if USE_TESTNET else ''}fstream.binance.com/ws/{SYMBOL_WS}@aggTrade"
    ws = websocket.WebSocketApp(
        ws_url,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close,
        on_open=on_open
    )
    ws.run_forever()
