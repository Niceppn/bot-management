#!/usr/bin/env python3
"""
Demo Bot 1 - Simple demonstration bot
"""
import time
import sys
import random
from datetime import datetime

def log(level, message):
    """Print log message with flush"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] [{level}] {message}")
    sys.stdout.flush()

def main():
    log("INFO", "Demo Bot 1 started successfully!")
    log("INFO", "This bot runs every 10 seconds")

    counter = 0

    try:
        while True:
            counter += 1

            # Random log levels
            if counter % 5 == 0:
                log("WARNING", f"Iteration {counter} - This is a warning message")
            elif counter % 10 == 0:
                log("ERROR", f"Iteration {counter} - This is a simulated error")
            else:
                log("INFO", f"Iteration {counter} - Bot is running normally")

            # Random data
            value = random.randint(1, 100)
            log("DEBUG", f"Random value generated: {value}")

            time.sleep(10)

    except KeyboardInterrupt:
        log("INFO", "Bot stopped by user")
        sys.exit(0)
    except Exception as e:
        log("ERROR", f"Fatal error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
