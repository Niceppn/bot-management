#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Configuration Loader
Loads config from backend API and watches for updates
"""

import requests
import threading
import time
import json

class ConfigLoader:
    def __init__(self, bot_id, api_url, initial_config=None):
        self.bot_id = bot_id
        self.api_url = api_url
        self.current_config = initial_config or {}
        self.watcher_thread = None
        self.watcher_running = False
        self.update_callback = None

    def load(self):
        """Load config from backend API"""
        try:
            # Get bot config
            response = requests.get(
                f"{self.api_url}/trading/bots/{self.bot_id}/config",
                timeout=10
            )

            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.current_config = {**self.current_config, **data['data']}

            # If we have initial config, merge it
            return self.current_config

        except Exception as e:
            print(f"Warning: Failed to load config from API: {e}")
            # Return current config (or initial config) if API fails
            return self.current_config

    def watch_updates(self, callback):
        """Start watching for config updates (polls every 30s)"""
        self.update_callback = callback
        self.watcher_running = True

        def watcher():
            while self.watcher_running:
                try:
                    time.sleep(30)  # Poll every 30 seconds

                    if not self.watcher_running:
                        break

                    new_config = self.load()

                    # Check if config changed
                    if new_config != self.current_config:
                        print(f"[CONFIG] Config updated, reloading...")
                        self.current_config = new_config
                        if self.update_callback:
                            self.update_callback(new_config)

                except Exception as e:
                    print(f"[CONFIG] Error checking for updates: {e}")

        self.watcher_thread = threading.Thread(target=watcher, daemon=True)
        self.watcher_thread.start()

    def stop_watcher(self):
        """Stop the config watcher"""
        self.watcher_running = False
        if self.watcher_thread:
            self.watcher_thread.join(timeout=5)
