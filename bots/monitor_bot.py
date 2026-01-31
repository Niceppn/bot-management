#!/usr/bin/env python3
"""
Monitor Bot - Simulates system monitoring
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

def check_cpu():
    """Simulate CPU check"""
    cpu = random.randint(10, 95)
    if cpu > 80:
        log("WARNING", f"High CPU usage detected: {cpu}%")
    else:
        log("INFO", f"CPU usage: {cpu}%")
    return cpu

def check_memory():
    """Simulate memory check"""
    memory = random.randint(20, 90)
    if memory > 85:
        log("WARNING", f"High memory usage detected: {memory}%")
    else:
        log("INFO", f"Memory usage: {memory}%")
    return memory

def check_disk():
    """Simulate disk check"""
    disk = random.randint(30, 95)
    if disk > 90:
        log("ERROR", f"Critical disk space: {disk}% used!")
    elif disk > 80:
        log("WARNING", f"Low disk space: {disk}% used")
    else:
        log("INFO", f"Disk usage: {disk}%")
    return disk

def main():
    log("INFO", "Monitor Bot started - Monitoring system resources")
    log("INFO", "Checking every 30 seconds")

    check_count = 0

    try:
        while True:
            check_count += 1
            log("INFO", f"=== Check #{check_count} ===")

            cpu = check_cpu()
            time.sleep(1)

            memory = check_memory()
            time.sleep(1)

            disk = check_disk()
            time.sleep(1)

            # Overall health
            avg = (cpu + memory + disk) / 3
            if avg > 80:
                log("ERROR", f"System health: CRITICAL (avg: {avg:.1f}%)")
            elif avg > 70:
                log("WARNING", f"System health: WARNING (avg: {avg:.1f}%)")
            else:
                log("INFO", f"System health: OK (avg: {avg:.1f}%)")

            log("DEBUG", f"Next check in 30 seconds")
            time.sleep(27)  # Total 30s with previous sleeps

    except KeyboardInterrupt:
        log("INFO", "Monitor Bot stopped by user")
        sys.exit(0)
    except Exception as e:
        log("ERROR", f"Fatal error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
