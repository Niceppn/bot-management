#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Order Manager
Manages pending and active orders, handles TP/SL logic
"""

import time
from datetime import datetime

class OrderManager:
    def __init__(self, config, binance_client, reporter, logger):
        self.config = config
        self.binance_client = binance_client
        self.reporter = reporter
        self.logger = logger

        # Order tracking
        self.pending_orders = []
        self.active_orders = []

        # Statistics
        self.stats = {
            'win': 0,
            'loss': 0,
            'breakeven': 0,
            'unfilled': 0
        }
        self.total_pnl = 0.0

    def update_config(self, new_config):
        """Update configuration (hot reload)"""
        self.config = new_config
        self.logger.info("Order manager config updated")

    def can_place_order(self):
        """Check if we can place a new order"""
        max_positions = self.config.get('max_positions', 2)
        return len(self.active_orders) < max_positions

    def place_buy_order(self, current_price, confidence):
        """Place a new buy order based on signal"""
        if not self.can_place_order():
            self.logger.debug("Max positions reached, skipping order")
            return False

        try:
            symbol = self.config.get('symbol', 'BTCUSDC')
            capital = self.config.get('capital_per_trade', 200)
            maker_offset = self.config.get('maker_buy_offset_pct', 0.00001)

            # Calculate order parameters
            limit_price = current_price * (1 - maker_offset)
            quantity = round(capital / limit_price, 3)

            # Calculate TP/SL
            profit_pct = self.config.get('profit_target_pct', 0.00015)
            stop_loss_pct = self.config.get('stop_loss_pct', 0.009)

            take_profit = limit_price * (1 + profit_pct)
            stop_loss = limit_price * (1 - stop_loss_pct)

            # Place order on Binance
            order = self.binance_client.place_limit_buy(symbol, quantity, limit_price)

            if order:
                order_id = order.get('orderId')
                timeout_seconds = self.config.get('maker_order_timeout', 60)

                # Add to pending orders
                pending_order = {
                    'order_id': order_id,
                    'limit_price': limit_price,
                    'quantity': quantity,
                    'take_profit': take_profit,
                    'stop_loss': stop_loss,
                    'confidence': confidence,
                    'created_ts': time.time(),
                    'timeout_ts': time.time() + timeout_seconds,
                    'slot': len(self.active_orders)
                }

                self.pending_orders.append(pending_order)

                # Report to backend
                self.reporter.report_order({
                    'order_id': str(order_id),
                    'symbol': symbol,
                    'side': 'BUY',
                    'entry_price': limit_price,
                    'take_profit': take_profit,
                    'stop_loss': stop_loss,
                    'quantity': quantity,
                    'status': 'pending',
                    'confidence': confidence,
                    'entry_time': datetime.now().isoformat()
                })

                self.logger.info(f"BUY order placed: {quantity} @ ${limit_price:.2f} (Confidence: {confidence*100:.2f}%)")
                return True

        except Exception as e:
            self.logger.error(f"Failed to place buy order: {e}")
            return False

    def check_pending_orders(self, current_price):
        """Check if pending orders should become active"""
        current_ts = time.time()

        for order in self.pending_orders[:]:
            # Check if order filled
            if current_price <= order['limit_price']:
                self._activate_order(order, current_price, current_ts)

            # Check if order timeout
            elif current_ts >= order['timeout_ts']:
                self._timeout_order(order)

    def _activate_order(self, order, current_price, current_ts):
        """Move pending order to active"""
        try:
            symbol = self.config.get('symbol', 'BTCUSDC')
            holding_time = self.config.get('holding_time', 2000)

            # Place TP limit order
            sell_order = self.binance_client.place_limit_sell(
                symbol,
                order['quantity'],
                order['take_profit']
            )

            sell_order_id = sell_order.get('orderId') if sell_order else None

            # Move to active
            active_order = {
                **order,
                'entry': order['limit_price'],
                'entry_ts': current_ts,
                'exit_ts': current_ts + holding_time,
                'sell_order_id': sell_order_id
            }

            self.active_orders.append(active_order)
            self.pending_orders.remove(order)

            # Report
            self.reporter.report_order({
                'order_id': str(order['order_id']),
                'status': 'active',
                'entry_time': datetime.now().isoformat()
            })

            self.logger.info(f"Order activated: ${order['limit_price']:.2f} -> TP: ${order['take_profit']:.2f}")

        except Exception as e:
            self.logger.error(f"Failed to activate order: {e}")

    def _timeout_order(self, order):
        """Handle order timeout"""
        self.stats['unfilled'] += 1
        self.pending_orders.remove(order)

        # Cancel on exchange
        symbol = self.config.get('symbol', 'BTCUSDC')
        self.binance_client.cancel_order(symbol, order['order_id'])

        self.logger.warning(f"Order timeout: ${order['limit_price']:.2f} (Confidence: {order['confidence']*100:.2f}%)")

    def check_active_orders(self, current_price):
        """Check active orders for TP/SL/timeout"""
        current_ts = time.time()

        for order in self.active_orders[:]:
            # Check TP hit
            if current_price >= order['take_profit']:
                self._close_order(order, current_price, 'TP_HIT')

            # Check SL hit
            elif current_price <= order['stop_loss']:
                self._close_order(order, current_price, 'SL_HIT')

            # Check timeout
            elif current_ts >= order['exit_ts']:
                self._close_order(order, current_price, 'TIMEOUT')

    def _close_order(self, order, exit_price, reason):
        """Close an active order"""
        try:
            symbol = self.config.get('symbol', 'BTCUSDC')

            # Cancel TP order if exists
            if order.get('sell_order_id'):
                self.binance_client.cancel_order(symbol, order['sell_order_id'])

            # Market close
            self.binance_client.place_market_sell(symbol, order['quantity'])

            # Calculate PNL
            pnl = (exit_price - order['entry']) * order['quantity']
            self.total_pnl += pnl

            # Update stats
            if pnl > 0:
                self.stats['win'] += 1
            elif pnl < 0:
                self.stats['loss'] += 1
            else:
                self.stats['breakeven'] += 1

            # Remove from active
            self.active_orders.remove(order)

            # Report
            self.reporter.report_order({
                'order_id': str(order['order_id']),
                'status': 'closed',
                'exit_time': datetime.now().isoformat(),
                'exit_reason': reason,
                'pnl': pnl
            })

            # Report stats
            total_trades = self.stats['win'] + self.stats['loss'] + self.stats['breakeven']
            win_rate = (self.stats['win'] / total_trades * 100) if total_trades > 0 else 0

            self.reporter.report_stats({
                'date': datetime.now().strftime('%Y-%m-%d'),
                'total_trades': total_trades,
                'wins': self.stats['win'],
                'losses': self.stats['loss'],
                'total_pnl': self.total_pnl,
                'win_rate': win_rate
            })

            emoji = "✅" if pnl > 0 else "❌" if pnl < 0 else "😐"
            self.logger.info(f"{emoji} Order closed: {reason} | PNL: ${pnl:.4f} | Exit: ${exit_price:.2f}")

        except Exception as e:
            self.logger.error(f"Failed to close order: {e}")

    def close_all_positions(self, reason="Manual"):
        """Close all active positions"""
        current_price = self.binance_client.get_current_price(self.config.get('symbol', 'BTCUSDC'))

        for order in self.active_orders[:]:
            self._close_order(order, current_price, reason)

        self.logger.info(f"All positions closed: {reason}")

    def get_stats(self):
        """Get current statistics"""
        return {
            **self.stats,
            'total_pnl': self.total_pnl,
            'active_orders': len(self.active_orders),
            'pending_orders': len(self.pending_orders)
        }
