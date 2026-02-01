#!/usr/bin/env python3
"""
Test Bot for IDE Temporary Bot Feature
This bot prints a counter every second for testing purposes
"""

import time
import sys

print("🤖 Test bot started!")
print("=" * 50)

try:
    for i in range(10):
        print(f"Count: {i} - Running normally...")
        sys.stdout.flush()  # Ensure logs appear immediately
        time.sleep(1)

    print("=" * 50)
    print("✅ Test bot finished successfully!")

except KeyboardInterrupt:
    print("\n⚠️  Bot stopped by user")
    sys.exit(0)
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
