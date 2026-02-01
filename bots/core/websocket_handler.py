#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WebSocket Handler
Connects to Binance WebSocket and processes real-time trade data
"""

import json
import time
import ssl
from collections import deque
from datetime import datetime
import pandas as pd

try:
    from websocket import WebSocketApp
except ImportError:
    import websocket
    WebSocketApp = websocket.WebSocketApp

from .feature_engineering import FeatureEngineer

class WebSocketHandler:
    def __init__(self, symbol, config, predictor, order_manager, logger):
        self.symbol = symbol.lower()
        self.config = config
        self.predictor = predictor
        self.order_manager = order_manager
        self.logger = logger

        # Feature engineer
        self.feature_engineer = FeatureEngineer(logger)

        # Data buffer (60 seconds of data)
        self.buffer = deque(maxlen=60)
        self.current_sec = {
            'net_flow': 0.0,
            'total_volume': 0.0,
            'trade_count': 0,
            'close': 0.0,
            'high': 0.0,
            'low': 999999.0,
            'timestamp': None
        }

        # WebSocket URL
        socket_type = config.get('socket_type', 'demo')
        self.ws_url = self._get_ws_url(socket_type)

        self.ws = None
        self.last_check_time = time.time()

    def _get_ws_url(self, socket_type):
        """Get WebSocket URL based on type"""
        urls = {
            "spot": f"wss://stream.binance.com:9443/ws/{self.symbol}@aggTrade",
            "future": f"wss://fstream.binance.com/ws/{self.symbol}@aggTrade",
            "demo": f"wss://demo-dstream.binance.com/ws/{self.symbol}@aggTrade"
        }
        return urls.get(socket_type, urls["demo"])

    def on_message(self, ws, message):
        """Process incoming trade message"""
        try:
            data = json.loads(message)

            # Parse trade data
            timestamp = data["T"]
            price = float(data["p"])
            quantity = float(data["q"])
            is_buyer_maker = data["m"]

            # Update current second data
            current_second = timestamp // 1000

            if self.current_sec['timestamp'] is None:
                self.current_sec['timestamp'] = current_second

            # Check if new second
            if current_second != self.current_sec['timestamp']:
                # Save completed second to buffer
                self.buffer.append({
                    'timestamp': self.current_sec['timestamp'],
                    'close': self.current_sec['close'],
                    'high': self.current_sec['high'],
                    'low': self.current_sec['low'],
                    'total_volume': self.current_sec['total_volume'],
                    'net_flow': self.current_sec['net_flow'],
                    'trade_count': self.current_sec['trade_count']
                })

                # Reset for new second
                self.current_sec = {
                    'timestamp': current_second,
                    'net_flow': 0.0,
                    'total_volume': 0.0,
                    'trade_count': 0,
                    'close': price,
                    'high': price,
                    'low': price
                }

            # Update current second
            self.current_sec['close'] = price
            self.current_sec['high'] = max(self.current_sec['high'], price)
            self.current_sec['low'] = min(self.current_sec['low'], price)
            self.current_sec['total_volume'] += quantity
            self.current_sec['trade_count'] += 1

            # Net flow (buyers vs sellers)
            if is_buyer_maker:
                self.current_sec['net_flow'] -= quantity  # Sell pressure
            else:
                self.current_sec['net_flow'] += quantity  # Buy pressure

            # Check orders periodically (every 2 seconds)
            current_time = time.time()
            if current_time - self.last_check_time >= 2:
                self.last_check_time = current_time
                self._check_trading_logic(price)

        except Exception as e:
            self.logger.error(f"Message processing error: {e}")

    def _check_trading_logic(self, current_price):
        """Check trading logic (orders + signals)"""
        try:
            # Check existing orders
            self.order_manager.check_pending_orders(current_price)
            self.order_manager.check_active_orders(current_price)

            # Check for new signals (if we can place orders)
            if self.order_manager.can_place_order() and len(self.buffer) >= 60:
                self._check_for_signal(current_price)

        except Exception as e:
            self.logger.error(f"Trading logic error: {e}")

    def _check_for_signal(self, current_price):
        """Check AI signal for new trade"""
        try:
            # Convert buffer to DataFrame
            df = pd.DataFrame(list(self.buffer))

            # Calculate features
            features = self.feature_engineer.calculate_features(df)

            if features is None:
                return

            # Check AI prediction
            confidence_threshold = self.config.get('confidence_threshold', 0.40)
            should_trade, confidence = self.predictor.should_trade(features, confidence_threshold)

            if should_trade:
                self.logger.info(f"AI SIGNAL: BUY | Confidence: {confidence*100:.2f}% | Price: ${current_price:.2f}")
                self.order_manager.place_buy_order(current_price, confidence)

        except Exception as e:
            self.logger.error(f"Signal check error: {e}")

    def on_error(self, ws, error):
        """Handle WebSocket error"""
        self.logger.error(f"WebSocket error: {error}")

    def on_close(self, ws, close_status_code, close_msg):
        """Handle WebSocket close"""
        self.logger.warning("WebSocket closed, will reconnect...")

    def on_open(self, ws):
        """Handle WebSocket open"""
        self.logger.info(f"WebSocket connected: {self.symbol.upper()}")

    def start(self):
        """Start WebSocket connection with auto-reconnect"""
        self.logger.info(f"Starting WebSocket for {self.symbol.upper()}")

        sslopt = {"cert_reqs": ssl.CERT_NONE}
        reconnect_delay = 5

        while True:
            try:
                self.ws = WebSocketApp(
                    self.ws_url,
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
                self.logger.info("WebSocket stopped by user")
                break
            except Exception as e:
                self.logger.error(f"WebSocket error: {e}")

            self.logger.info(f"Reconnecting in {reconnect_delay}s...")
            time.sleep(reconnect_delay)
