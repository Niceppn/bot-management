#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Binance Client Wrapper
Handles all Binance API interactions
"""

from binance.client import Client
from binance.enums import *

class BinanceClient:
    def __init__(self, api_key, secret_key, testnet=True, logger=None):
        self.logger = logger
        self.testnet = testnet

        try:
            self.client = Client(api_key, secret_key, testnet=testnet)

            if testnet:
                self.client.FUTURES_URL = 'https://demo-fapi.binance.com'

        except Exception as e:
            if self.logger:
                self.logger.error(f"Failed to initialize Binance client: {e}")
            raise

    def test_connection(self):
        """Test connection to Binance"""
        try:
            balance = self.client.futures_account_balance()
            usdt = next((item for item in balance if item["asset"] == "USDT"), None)

            if self.logger:
                self.logger.info(f"Connected to Binance {'Testnet' if self.testnet else 'Mainnet'}")
                self.logger.info(f"USDT Balance: {usdt['balance']}")

            return True
        except Exception as e:
            if self.logger:
                self.logger.error(f"Connection test failed: {e}")
            return False

    def get_balance(self, asset="USDT"):
        """Get account balance"""
        try:
            balance = self.client.futures_account_balance()
            asset_balance = next((item for item in balance if item["asset"] == asset), None)
            return float(asset_balance['balance']) if asset_balance else 0.0
        except Exception as e:
            if self.logger:
                self.logger.error(f"Failed to get balance: {e}")
            return 0.0

    def place_limit_buy(self, symbol, quantity, limit_price):
        """Place limit buy order"""
        try:
            order = self.client.futures_create_order(
                symbol=symbol,
                side='BUY',
                type='LIMIT',
                quantity=quantity,
                price=str(round(limit_price, 1)),
                timeInForce='GTC'
            )
            if self.logger:
                self.logger.info(f"Limit BUY placed: {quantity} @ ${limit_price:.2f} | OrderID: {order.get('orderId')}")
            return order
        except Exception as e:
            if self.logger:
                self.logger.error(f"Failed to place limit buy: {e}")
            return None

    def place_limit_sell(self, symbol, quantity, limit_price):
        """Place limit sell order (reduce only)"""
        try:
            order = self.client.futures_create_order(
                symbol=symbol,
                side='SELL',
                type='LIMIT',
                quantity=quantity,
                price=str(round(limit_price, 1)),
                timeInForce='GTC',
                reduceOnly=True
            )
            if self.logger:
                self.logger.info(f"Limit SELL placed: {quantity} @ ${limit_price:.2f} | OrderID: {order.get('orderId')}")
            return order
        except Exception as e:
            if self.logger:
                self.logger.error(f"Failed to place limit sell: {e}")
            return None

    def place_market_sell(self, symbol, quantity):
        """Place market sell order (close position)"""
        try:
            order = self.client.futures_create_order(
                symbol=symbol,
                side='SELL',
                type='MARKET',
                quantity=quantity,
                reduceOnly=True
            )
            if self.logger:
                self.logger.info(f"Market SELL placed: {quantity}")
            return order
        except Exception as e:
            if self.logger:
                self.logger.error(f"Failed to place market sell: {e}")
            return None

    def cancel_order(self, symbol, order_id):
        """Cancel order"""
        try:
            self.client.futures_cancel_order(symbol=symbol, orderId=order_id)
            if self.logger:
                self.logger.info(f"Order cancelled: {order_id}")
            return True
        except Exception as e:
            if self.logger:
                self.logger.error(f"Failed to cancel order: {e}")
            return False

    def get_current_price(self, symbol):
        """Get current market price"""
        try:
            ticker = self.client.futures_symbol_ticker(symbol=symbol)
            return float(ticker['price'])
        except Exception as e:
            if self.logger:
                self.logger.error(f"Failed to get current price: {e}")
            return 0.0
