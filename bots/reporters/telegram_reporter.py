#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Telegram Reporter
Sends notifications to Telegram
"""

import requests

class TelegramReporter:
    def __init__(self, token, chat_id, logger):
        self.token = token
        self.chat_id = chat_id
        self.logger = logger

    def _send_message(self, text):
        """Send message to Telegram"""
        try:
            requests.post(
                f"https://api.telegram.org/bot{self.token}/sendMessage",
                data={
                    'chat_id': self.chat_id,
                    'text': text,
                    'parse_mode': 'HTML'
                },
                timeout=5
            )
        except Exception as e:
            self.logger.debug(f"Failed to send Telegram message: {e}")

    def report_order(self, order_data):
        """Report order to Telegram"""
        status = order_data.get('status', 'unknown')

        if status == 'pending':
            text = (
                f"🆕 <b>NEW ORDER</b>\n"
                f"━━━━━━━━━━━━━━━━\n"
                f"📊 {order_data.get('symbol')}\n"
                f"💰 Entry: ${order_data.get('entry_price', 0):.2f}\n"
                f"🎯 TP: ${order_data.get('take_profit', 0):.2f}\n"
                f"🛑 SL: ${order_data.get('stop_loss', 0):.2f}\n"
                f"🤖 Confidence: {order_data.get('confidence', 0)*100:.2f}%"
            )
        elif status == 'closed':
            pnl = order_data.get('pnl', 0)
            emoji = "✅" if pnl > 0 else "❌" if pnl < 0 else "😐"
            text = (
                f"{emoji} <b>ORDER CLOSED</b>\n"
                f"━━━━━━━━━━━━━━━━\n"
                f"📊 {order_data.get('symbol')}\n"
                f"💰 Entry: ${order_data.get('entry_price', 0):.2f}\n"
                f"💵 PNL: <b>${pnl:.4f}</b>\n"
                f"📝 Reason: {order_data.get('exit_reason', 'Unknown')}"
            )
        else:
            return  # Don't send for other statuses

        self._send_message(text)

    def report_stats(self, stats_data):
        """Report stats to Telegram"""
        pass  # Stats reports are optional for Telegram

    def report_status(self, status, extra_data=None):
        """Report status to Telegram"""
        text = f"🤖 <b>BOT STATUS</b>\n━━━━━━━━━━━━━━━━\n{status}"
        if extra_data and 'symbol' in extra_data:
            text += f"\n📊 {extra_data['symbol']}"
        self._send_message(text)

    def report_error(self, error_type, error_message):
        """Report error to Telegram"""
        text = (
            f"⚠️ <b>ERROR</b>\n"
            f"━━━━━━━━━━━━━━━━\n"
            f"Type: {error_type}\n"
            f"Message: {error_message}"
        )
        self._send_message(text)
