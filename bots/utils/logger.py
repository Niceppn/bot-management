#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simple Logger
Prints logs with timestamp
"""

from datetime import datetime

class Logger:
    def __init__(self, bot_id, symbol):
        self.bot_id = bot_id
        self.symbol = symbol

    def _log(self, level, message):
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        print(f"[{timestamp}] [{level}] [{self.symbol}] {message}", flush=True)

    def info(self, message):
        self._log("INFO", message)

    def warning(self, message):
        self._log("WARNING", message)

    def error(self, message):
        self._log("ERROR", message)

    def debug(self, message):
        self._log("DEBUG", message)
