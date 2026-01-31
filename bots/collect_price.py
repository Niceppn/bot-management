#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Crypto Price Collector Bot
Collects real-time trade data from Binance WebSocket and saves to SQLite database
"""

import json
import sqlite3
import os
import sys
import time
import argparse
import ssl
from datetime import datetime

# Import WebSocketApp explicitly
try:
    from websocket import WebSocketApp
except ImportError:
    import websocket
    WebSocketApp = websocket.WebSocketApp

# =========================
# Configuration
# =========================
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "server", "data", "bot_manager.db")
RECONNECT_DELAY = 5  # seconds

# Socket endpoints
SOCKET_TYPES = {
    "spot": "wss://stream.binance.com:9443/ws/{symbol}@aggTrade",
    "future": "wss://fstream.binance.com/ws/{symbol}@aggTrade",
    "demo": "wss://demo-dstream.binance.com/ws/{symbol}@aggTrade"
}

# =========================
# Database Helpers
# =========================
def get_db_connection():
    """Get SQLite database connection with WAL mode for better performance"""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn

# =========================
# Logging
# =========================
def log(level, message):
    """Print log message with timestamp"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] [{level}] {message}", flush=True)

# =========================
# WebSocket Handler
# =========================
class BinanceCollector:
    def __init__(self, bot_id, symbol, socket_type, batch_size=50):
        self.bot_id = bot_id
        self.symbol = symbol.lower()
        self.socket_type = socket_type
        self.socket_url = SOCKET_TYPES[socket_type].format(symbol=self.symbol)
        self.ws = None
        self.trade_count = 0

        # Batch insert optimization
        self.batch_size = batch_size
        self.trade_buffer = []
        self.db_conn = None
        self.last_flush_time = time.time()

    def flush_trades(self):
        """Flush accumulated trades to database in batch"""
        if not self.trade_buffer:
            return

        try:
            if not self.db_conn:
                self.db_conn = get_db_connection()

            cursor = self.db_conn.cursor()
            cursor.executemany("""
                INSERT INTO crypto_trades
                (bot_id, symbol, timestamp_ms, readable_time, price, quantity, side, is_maker)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, self.trade_buffer)

            self.db_conn.commit()
            batch_count = len(self.trade_buffer)
            self.trade_buffer.clear()
            self.last_flush_time = time.time()

            return batch_count
        except Exception as e:
            log("ERROR", f"Batch insert error: {e}")
            self.trade_buffer.clear()
            # Reconnect on error
            if self.db_conn:
                try:
                    self.db_conn.close()
                except:
                    pass
                self.db_conn = None
            return 0

    def on_message(self, ws, message):
        try:
            data = json.loads(message)

            # Parse trade data
            timestamp_ms = data["T"]
            price = float(data["p"])
            quantity = float(data["q"])
            is_maker = 1 if data["m"] else 0
            side = "SELL" if data["m"] else "BUY"
            readable_time = datetime.fromtimestamp(timestamp_ms / 1000).strftime("%Y-%m-%d %H:%M:%S.%f")

            # Add to batch buffer
            self.trade_buffer.append((
                self.bot_id,
                self.symbol.upper(),
                timestamp_ms,
                readable_time,
                price,
                quantity,
                side,
                is_maker
            ))

            self.trade_count += 1

            # Flush when buffer is full or every 5 seconds
            should_flush = (
                len(self.trade_buffer) >= self.batch_size or
                time.time() - self.last_flush_time >= 5
            )

            if should_flush:
                batch_count = self.flush_trades()
                if batch_count > 0:
                    log("INFO", f"[{side}] {self.symbol.upper()} Price={price} | Saved {batch_count} trades (Total: {self.trade_count})")

        except Exception as e:
            log("ERROR", f"Message processing error: {e}")

    def on_error(self, ws, error):
        log("ERROR", f"WebSocket error: {error}")

    def on_close(self, ws, close_status_code, close_msg):
        # Flush remaining trades before closing
        if self.trade_buffer:
            batch_count = self.flush_trades()
            log("INFO", f"Flushed {batch_count} remaining trades")

        # Close database connection
        if self.db_conn:
            try:
                self.db_conn.close()
            except:
                pass
            self.db_conn = None

        log("WARNING", "WebSocket closed. Will reconnect...")

    def on_open(self, ws):
        log("INFO", f"Connected to {self.socket_type.upper()} - {self.symbol.upper()}")
        log("INFO", f"Collecting data (Bot ID: {self.bot_id})...")
        log("INFO", f"Batch mode: inserting every {self.batch_size} trades or 5 seconds")

    def start(self):
        """Start collecting data with auto-reconnect"""
        log("INFO", f"Starting Price Collector Bot")
        log("INFO", f"Symbol: {self.symbol.upper()}")
        log("INFO", f"Socket Type: {self.socket_type.upper()}")
        log("INFO", f"Bot ID: {self.bot_id}")

        # SSL options - disable certificate verification for development
        sslopt = {"cert_reqs": ssl.CERT_NONE}

        while True:
            try:
                self.ws = WebSocketApp(
                    self.socket_url,
                    on_open=self.on_open,
                    on_message=self.on_message,
                    on_error=self.on_error,
                    on_close=self.on_close,
                )
                self.ws.run_forever(
                    ping_interval=20,
                    ping_timeout=10,
                    sslopt=sslopt
                )

            except KeyboardInterrupt:
                log("INFO", "Bot stopped by user")
                # Flush remaining trades
                if self.trade_buffer:
                    batch_count = self.flush_trades()
                    log("INFO", f"Flushed {batch_count} remaining trades before exit")
                if self.db_conn:
                    self.db_conn.close()
                sys.exit(0)
            except Exception as e:
                log("ERROR", f"Fatal error: {e}")

            log("INFO", f"Reconnecting in {RECONNECT_DELAY}s...")
            time.sleep(RECONNECT_DELAY)

# =========================
# Main
# =========================
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Binance Price Collector Bot')
    parser.add_argument('--bot-id', type=int, required=True, help='Bot ID from database')
    parser.add_argument('--symbol', type=str, required=True, help='Trading symbol (e.g., btcusdc)')
    parser.add_argument('--socket-type', type=str, choices=['spot', 'future', 'demo'],
                        required=True, help='Socket type: spot, future, or demo')

    args = parser.parse_args()

    # Validate socket type
    if args.socket_type not in SOCKET_TYPES:
        log("ERROR", f"Invalid socket type: {args.socket_type}")
        sys.exit(1)

    # Start collector
    collector = BinanceCollector(args.bot_id, args.symbol, args.socket_type)
    collector.start()
