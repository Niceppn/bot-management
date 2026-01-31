#!/usr/bin/env python3
"""
Demo Bot 2 - Bot with configurable interval
"""
import time
import sys
import argparse
from datetime import datetime

def log(level, message):
    """Print log message with flush"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] [{level}] {message}")
    sys.stdout.flush()

def main():
    parser = argparse.ArgumentParser(description='Demo Bot 2')
    parser.add_argument('--interval', type=int, default=60, help='Interval in seconds')
    args = parser.parse_args()

    log("INFO", f"Demo Bot 2 started with interval: {args.interval}s")

    iteration = 0

    try:
        while True:
            iteration += 1
            log("INFO", f"Iteration {iteration} - Checking system status...")

            # Simulate some work
            time.sleep(2)
            log("INFO", f"Iteration {iteration} - Status check complete")

            log("DEBUG", f"Waiting {args.interval} seconds until next check")
            time.sleep(args.interval)

    except KeyboardInterrupt:
        log("INFO", "Bot stopped gracefully")
        sys.exit(0)
    except Exception as e:
        log("ERROR", f"Fatal error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
