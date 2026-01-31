#!/usr/bin/env python3
"""
Binance Promotion Fee Scraper
Scrapes promotion fees from Binance and stores in database
"""

import sys
import json
import time
import sqlite3
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup

# Database path
DB_PATH = './server/data/bot_manager.db'

def log(level, message):
    """Print log message with timestamp"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] [{level}] {message}", flush=True)

def get_db_connection():
    """Get SQLite database connection"""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def scrape_binance_fees():
    """Scrape promotion fees from Binance"""
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")

    driver = webdriver.Chrome(options=chrome_options)
    url = "https://www.binance.com/en/fee/tradingPromote"

    log("INFO", f"Connecting to {url}")
    driver.get(url)

    all_data = []
    page_num = 1

    try:
        wait = WebDriverWait(driver, 15)
        wait.until(EC.presence_of_element_located((By.CLASS_NAME, "bn-web-table-row")))

        while True:
            soup = BeautifulSoup(driver.page_source, 'html.parser')
            rows = soup.find_all('tr', class_='bn-web-table-row')

            row_count = 0
            for row in rows:
                cells = row.find_all('td', class_='bn-web-table-cell')
                if not cells:
                    continue

                symbol_div = cells[0].get_text(strip=True)
                if "/" not in symbol_div:
                    continue

                maker_fee = cells[1].get_text(strip=True)
                taker_fee = cells[2].get_text(strip=True)

                all_data.append({
                    'symbol': symbol_div,
                    'maker_fee': maker_fee,
                    'taker_fee': taker_fee
                })
                row_count += 1

            log("INFO", f"Page {page_num}: Collected {row_count} pairs (Total: {len(all_data)})")

            try:
                next_btn = driver.find_element(By.CSS_SELECTOR, ".bn-pagination-next")
                if next_btn.get_attribute("aria-disabled") == "true":
                    break

                driver.execute_script("arguments[0].click();", next_btn)
                time.sleep(2)
                page_num += 1
            except:
                break
    finally:
        driver.quit()

    return all_data

def update_database(scraped_data):
    """Update database with scraped data and handle removals"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Get existing symbols from database
        cursor.execute("SELECT symbol, maker_fee, taker_fee FROM promotion_fees")
        existing_data = {row[0]: {'maker_fee': row[1], 'taker_fee': row[2]} for row in cursor.fetchall()}

        # Get scraped symbols
        scraped_symbols = {item['symbol'] for item in scraped_data}
        existing_symbols = set(existing_data.keys())

        # Find removed symbols (in DB but not in scraped data)
        removed_symbols = existing_symbols - scraped_symbols

        # Handle removed symbols
        if removed_symbols:
            log("WARNING", f"Found {len(removed_symbols)} removed promotions:")
            for symbol in removed_symbols:
                log("WARNING", f"  [-] {symbol}")

                # Add to removals table (notification)
                cursor.execute("""
                    INSERT INTO promotion_fee_removals (symbol, maker_fee, taker_fee)
                    VALUES (?, ?, ?)
                """, (symbol, existing_data[symbol]['maker_fee'], existing_data[symbol]['taker_fee']))

                # Delete from main table
                cursor.execute("DELETE FROM promotion_fees WHERE symbol = ?", (symbol,))

            conn.commit()

        # Find new symbols (in scraped data but not in DB)
        new_symbols = scraped_symbols - existing_symbols
        new_count = 0

        for item in scraped_data:
            symbol = item['symbol']

            if symbol in new_symbols:
                # Insert new promotion
                cursor.execute("""
                    INSERT INTO promotion_fees (symbol, maker_fee, taker_fee)
                    VALUES (?, ?, ?)
                """, (symbol, item['maker_fee'], item['taker_fee']))
                new_count += 1
                log("INFO", f"  [+] New: {symbol}")

        conn.commit()

        # Summary
        log("INFO", f"✅ Update complete:")
        log("INFO", f"   - New promotions: {new_count}")
        log("INFO", f"   - Removed promotions: {len(removed_symbols)}")
        log("INFO", f"   - Total active: {len(scraped_symbols)}")

        return {
            'success': True,
            'new_count': new_count,
            'removed_count': len(removed_symbols),
            'total_count': len(scraped_symbols)
        }

    except Exception as e:
        conn.rollback()
        log("ERROR", f"Database update error: {e}")
        return {
            'success': False,
            'error': str(e)
        }
    finally:
        conn.close()

def main():
    """Main function"""
    try:
        log("INFO", "🚀 Starting Binance Promotion Fee Scraper")

        # Scrape data
        scraped_data = scrape_binance_fees()

        if not scraped_data:
            log("ERROR", "No data scraped from Binance")
            return {
                'success': False,
                'error': 'No data scraped'
            }

        log("INFO", f"📊 Scraped {len(scraped_data)} promotions")

        # Update database
        result = update_database(scraped_data)

        # Output result as JSON (for API to read)
        print(json.dumps(result))

        return result

    except Exception as e:
        log("ERROR", f"Scraper error: {e}")
        result = {
            'success': False,
            'error': str(e)
        }
        print(json.dumps(result))
        return result

if __name__ == "__main__":
    main()
