#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Backend Reporter
Sends updates to backend API via stdout (JSON) and HTTP
"""

import requests
import json
import sys

class BackendReporter:
    def __init__(self, bot_id, api_url, logger):
        self.bot_id = bot_id
        self.api_url = api_url
        self.logger = logger

    def _print_json(self, message_type, data):
        """Print JSON message to stdout for bot manager to capture"""
        message = {
            'type': message_type,
            'bot_id': self.bot_id,
            'data': data,
            'timestamp': str(sys.modules['datetime'].datetime.now())
        }
        print(json.dumps(message), flush=True)

    def _post_to_api(self, endpoint, data):
        """Post data to API (non-blocking)"""
        try:
            requests.post(
                f"{self.api_url}/{endpoint}",
                json=data,
                timeout=5
            )
        except Exception as e:
            self.logger.debug(f"Failed to post to API: {e}")

    def report_order(self, order_data):
        """Report order update"""
        self._print_json('order_update', order_data)
        self._post_to_api(f'trading/bots/{self.bot_id}/orders', order_data)

    def report_stats(self, stats_data):
        """Report statistics update"""
        self._print_json('stats_update', stats_data)
        self._post_to_api(f'trading/bots/{self.bot_id}/stats/update', stats_data)

    def report_status(self, status, extra_data=None):
        """Report bot status"""
        data = {'status': status}
        if extra_data:
            data.update(extra_data)
        self._print_json('status_update', data)

    def report_error(self, error_type, error_message):
        """Report error"""
        self._print_json('error', {
            'error_type': error_type,
            'error_message': error_message
        })
