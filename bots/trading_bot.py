#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Trading Bot Entry Point
Follows the same pattern as collect_price.py
Usage: python3 bots/trading_bot.py --bot-id <id> --symbol <symbol> --config-json '{...}'
"""

import argparse
import json
import sys
import os
import time
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from utils.config_loader import ConfigLoader
from utils.logger import Logger
from trading.binance_client import BinanceClient
from core.websocket_handler import WebSocketHandler
from core.order_manager import OrderManager
from core.predictor import Predictor
from reporters.composite_reporter import CompositeReporter
from reporters.backend_reporter import BackendReporter
from reporters.telegram_reporter import TelegramReporter

# =========================
# Configuration
# =========================
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "server", "data", "bot_manager.db")
API_BASE_URL = "http://localhost:3001/api"

# =========================
# Main Bot Class
# =========================
class TradingBot:
    def __init__(self, bot_id, symbol, initial_config=None):
        self.bot_id = bot_id
        self.symbol = symbol.upper()
        self.is_running = True

        # Load configuration
        self.config_loader = ConfigLoader(bot_id, API_BASE_URL, initial_config)
        self.config = self.config_loader.load()

        # Setup logger
        self.logger = Logger(bot_id, self.symbol)

        # Setup reporters
        self.reporter = self._setup_reporters()

        # Initialize components
        self.binance_client = BinanceClient(
            api_key=self.config.get('api_key'),
            secret_key=self.config.get('secret_key'),
            testnet=self.config.get('testnet', True),
            logger=self.logger
        )

        # Test connection
        if not self.binance_client.test_connection():
            self.logger.error("Failed to connect to Binance")
            sys.exit(1)

        # Load AI model
        self.predictor = Predictor(
            model_path=self.config.get('model_path'),
            logger=self.logger
        )

        # Order manager
        self.order_manager = OrderManager(
            config=self.config,
            binance_client=self.binance_client,
            reporter=self.reporter,
            logger=self.logger
        )

        # WebSocket handler
        self.ws_handler = WebSocketHandler(
            symbol=self.symbol,
            config=self.config,
            predictor=self.predictor,
            order_manager=self.order_manager,
            logger=self.logger
        )

        # Start config watcher
        self.config_loader.watch_updates(self._on_config_update)

        self.logger.info(f"Trading Bot initialized for {self.symbol}")
        self.reporter.report_status("Bot initialized", {"symbol": self.symbol})

    def _setup_reporters(self):
        """Setup composite reporter with backend + telegram"""
        reporters = [
            BackendReporter(self.bot_id, API_BASE_URL, self.logger)
        ]

        # Add Telegram reporter if configured
        if self.config.get('telegram_token') and self.config.get('telegram_chat_id'):
            reporters.append(
                TelegramReporter(
                    token=self.config['telegram_token'],
                    chat_id=self.config['telegram_chat_id'],
                    logger=self.logger
                )
            )

        return CompositeReporter(reporters)

    def _on_config_update(self, new_config):
        """Called when configuration is updated"""
        self.logger.info("Config updated, reloading...")
        self.config = new_config
        self.order_manager.update_config(new_config)
        self.reporter.report_status("Config reloaded", {"config": new_config})

    def start(self):
        """Start the trading bot"""
        try:
            self.logger.info(f"Starting Trading Bot for {self.symbol}")
            self.logger.info(f"Bot ID: {self.bot_id}")
            self.logger.info(f"Confidence Threshold: {self.config.get('confidence_threshold', 0.4)}")
            self.logger.info(f"Capital per Trade: {self.config.get('capital_per_trade', 200)}")

            self.reporter.report_status("Bot started", {
                "symbol": self.symbol,
                "config": {
                    "confidence_threshold": self.config.get('confidence_threshold'),
                    "capital_per_trade": self.config.get('capital_per_trade')
                }
            })

            # Start WebSocket
            self.ws_handler.start()

        except KeyboardInterrupt:
            self.logger.info("Bot stopped by user")
            self.shutdown()
        except Exception as e:
            self.logger.error(f"Fatal error: {e}")
            self.reporter.report_error("Fatal error", str(e))
            self.shutdown()
            sys.exit(1)

    def shutdown(self):
        """Graceful shutdown"""
        self.logger.info("Shutting down bot...")
        self.is_running = False

        # Close any open positions
        self.order_manager.close_all_positions("Bot shutdown")

        # Stop config watcher
        self.config_loader.stop_watcher()

        self.reporter.report_status("Bot stopped")
        self.logger.info("Bot shutdown complete")

# =========================
# Main Entry Point
# =========================
def main():
    parser = argparse.ArgumentParser(description='Crypto Trading Bot')
    parser.add_argument('--bot-id', type=int, required=True, help='Bot ID from database')
    parser.add_argument('--symbol', type=str, required=True, help='Trading symbol (e.g., BTCUSDC)')
    parser.add_argument('--config-json', type=str, help='Initial config as JSON string')

    args = parser.parse_args()

    # Parse initial config if provided
    initial_config = None
    if args.config_json:
        try:
            initial_config = json.loads(args.config_json)
        except json.JSONDecodeError as e:
            print(f"ERROR: Invalid config JSON: {e}", file=sys.stderr)
            sys.exit(1)

    # Create and start bot
    bot = TradingBot(args.bot_id, args.symbol, initial_config)
    bot.start()

if __name__ == "__main__":
    main()
