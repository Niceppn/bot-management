#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI Model Training Script - Version 2
Reads data from crypto_trades database table instead of CSV files
Usage: python3 bots/train_model_v2.py --model-id <id> --symbol <symbol>
"""

import pandas as pd
import numpy as np
import lightgbm as lgb
import sqlite3
import os
import sys
import argparse
import json
from datetime import datetime
from sklearn.model_selection import train_test_split
from sklearn.metrics import precision_score

# ==========================================
# Database Configuration
# ==========================================
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "server", "data", "bot_manager.db")
MODEL_DEST_PATH = os.path.join(os.path.dirname(__file__), "..", "models")

def log(level, message):
    """Log with timestamp and flush immediately"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] [{level}] {message}", flush=True)

def update_progress(conn, model_id, progress, log_message=None):
    """Update training progress in database"""
    try:
        cursor = conn.cursor()
        if log_message:
            cursor.execute("""
                UPDATE ai_training_models
                SET progress = ?, log_message = ?
                WHERE id = ?
            """, (progress, log_message, model_id))
        else:
            cursor.execute("""
                UPDATE ai_training_models
                SET progress = ?
                WHERE id = ?
            """, (progress, model_id))
        conn.commit()
        log("INFO", f"Progress: {progress}% - {log_message or ''}")
    except Exception as e:
        log("ERROR", f"Failed to update progress: {e}")

def update_status(conn, model_id, status, accuracy=None, model_file_path=None):
    """Update model status in database"""
    try:
        cursor = conn.cursor()
        if status == 'training':
            cursor.execute("""
                UPDATE ai_training_models
                SET status = ?, started_at = ?
                WHERE id = ?
            """, (status, datetime.now().isoformat(), model_id))
        elif status == 'completed':
            cursor.execute("""
                UPDATE ai_training_models
                SET status = ?, accuracy = ?, model_file_path = ?, completed_at = ?
                WHERE id = ?
            """, (status, accuracy, model_file_path, datetime.now().isoformat(), model_id))
        elif status == 'failed':
            cursor.execute("""
                UPDATE ai_training_models
                SET status = ?, completed_at = ?
                WHERE id = ?
            """, (status, datetime.now().isoformat(), model_id))
        conn.commit()
    except Exception as e:
        log("ERROR", f"Failed to update status: {e}")

def load_parameters(conn, model_id):
    """Load training parameters from database"""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT parameters FROM ai_training_models WHERE id = ?
    """, (model_id,))
    row = cursor.fetchone()
    if not row:
        raise ValueError(f"Model ID {model_id} not found")
    return json.loads(row[0])

def load_trades_from_db(conn, symbol):
    """Load trades from crypto_trades table"""
    log("INFO", f"Loading trades for {symbol} from database...")

    cursor = conn.cursor()
    cursor.execute("""
        SELECT timestamp_ms, price, quantity, side, is_maker
        FROM crypto_trades
        WHERE symbol = ?
        ORDER BY timestamp_ms
    """, (symbol.upper(),))

    trades = cursor.fetchall()

    if not trades:
        raise ValueError(f"No trades found for {symbol}")

    log("INFO", f"Loaded {len(trades):,} trades")

    # Convert to DataFrame
    df = pd.DataFrame(trades, columns=['timestamp_ms', 'price', 'quantity', 'side', 'is_maker'])
    df['datetime'] = pd.to_datetime(df['timestamp_ms'], unit='ms')
    df = df.set_index('datetime')

    return df

def prepare_features(df, params):
    """Prepare features from trade data"""
    log("INFO", "Preparing features...")

    PROFIT_TARGET_PCT = params.get('profit_target_pct', 0.0003)
    FILL_WINDOW = params.get('fill_window', 20)
    PROFIT_WINDOW = params.get('profit_window', 300)

    # Calculate signed volume (BUY = positive, SELL = negative)
    df['signed_volume'] = df.apply(
        lambda x: x['quantity'] if x['side'] == 'BUY' else -x['quantity'],
        axis=1
    )

    # Resample to 1-second candles
    df_1s = df.resample('1s').agg({
        'price': ['last', 'min', 'max'],
        'quantity': 'sum',
        'signed_volume': 'sum',
        'side': 'count'
    })
    df_1s.columns = ['close_price', 'low_price', 'high_price', 'total_volume', 'net_flow', 'trade_count']

    # Fill gaps for seconds with no trades
    df_1s['close_price'] = df_1s['close_price'].ffill()
    df_1s['low_price'] = df_1s['low_price'].fillna(df_1s['close_price'])
    df_1s['high_price'] = df_1s['high_price'].fillna(df_1s['close_price'])
    df_1s['total_volume'] = df_1s['total_volume'].fillna(0)
    df_1s['net_flow'] = df_1s['net_flow'].fillna(0)
    df_1s['trade_count'] = df_1s['trade_count'].fillna(0)

    # Drop rows without price (at the beginning)
    df_1s.dropna(subset=['close_price'], inplace=True)

    log("INFO", f"Resampled to {len(df_1s):,} 1-second candles")

    if len(df_1s) < PROFIT_WINDOW + 100:
        raise ValueError(f"Not enough data after resampling ({len(df_1s)} rows)")

    # Feature engineering
    df_1s['net_flow_ma5'] = df_1s['net_flow'].rolling(5).mean()
    df_1s['net_flow_ma15'] = df_1s['net_flow'].rolling(15).mean()
    df_1s['volume_ma5'] = df_1s['total_volume'].rolling(5).mean()
    df_1s['net_flow_diff'] = df_1s['net_flow'].diff()
    df_1s['price_change'] = df_1s['close_price'].pct_change(fill_method=None) * 100
    df_1s['std_5'] = df_1s['close_price'].rolling(5).std()
    df_1s['dist_ma15'] = df_1s['close_price'] - df_1s['close_price'].rolling(15).mean()

    # RSI calculation
    delta = df_1s['close_price'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
    rs = gain / (loss + 1e-10)
    df_1s['rsi'] = 100 - (100 / (1 + rs))

    # Target creation
    indexer_fill = pd.api.indexers.FixedForwardWindowIndexer(window_size=FILL_WINDOW)
    df_1s['future_min_low'] = df_1s['low_price'].rolling(window=indexer_fill).min().shift(-1)
    is_filled = df_1s['future_min_low'] <= df_1s['close_price']

    indexer_profit = pd.api.indexers.FixedForwardWindowIndexer(window_size=PROFIT_WINDOW)
    df_1s['future_max_high'] = df_1s['high_price'].rolling(window=indexer_profit).max().shift(-1)
    target_price = df_1s['close_price'] * (1 + PROFIT_TARGET_PCT)
    is_profit = df_1s['future_max_high'] > target_price

    df_1s['target'] = (is_filled & is_profit).astype(int)

    # Drop NaN rows
    before_drop = len(df_1s)
    df_1s.dropna(inplace=True)
    log("INFO", f"Final training set: {len(df_1s):,} rows (dropped {before_drop - len(df_1s)} rows)")

    return df_1s

def train_model(df_1s, params, model_id, symbol, conn):
    """Train LightGBM model"""
    log("INFO", "Starting model training...")

    y = df_1s['target']
    counts = y.value_counts()
    pos_samples = counts.get(1, 0)
    neg_samples = counts.get(0, 0)

    log("INFO", f"Class distribution: Win (1) = {pos_samples:,} | Loss (0) = {neg_samples:,}")

    if pos_samples < 50:
        raise ValueError(f"Not enough positive samples ({pos_samples})")

    # Prepare features
    feature_cols = [
        'total_volume', 'net_flow', 'trade_count',
        'net_flow_ma5', 'net_flow_ma15', 'volume_ma5',
        'net_flow_diff', 'price_change',
        'std_5', 'dist_ma15', 'rsi'
    ]

    X = df_1s[feature_cols]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, shuffle=False
    )

    # Calculate scale pos weight
    neg = y_train.value_counts().get(0, 1)
    pos = y_train.value_counts().get(1, 1)
    scale_weight = neg / pos if pos > 0 else 1.0

    log("INFO", f"Scale pos weight: {scale_weight:.2f}")
    update_progress(conn, model_id, 50, "Training model...")

    # Train model
    model = lgb.LGBMClassifier(
        n_estimators=params.get('n_estimators', 500),
        learning_rate=params.get('learning_rate', 0.01),
        num_leaves=31,
        max_depth=params.get('max_depth', 7),
        scale_pos_weight=scale_weight,
        random_state=42,
        verbose=-1
    )

    model.fit(X_train, y_train)
    update_progress(conn, model_id, 80, "Evaluating model...")

    # Evaluate
    confidence_threshold = params.get('confidence_threshold', 0.60)
    probs = model.predict_proba(X_test)[:, 1]
    preds = (probs >= confidence_threshold).astype(int)
    precision = precision_score(y_test, preds, zero_division=0)

    log("INFO", f"Precision (Test Set): {precision*100:.2f}%")
    update_progress(conn, model_id, 90, "Saving model...")

    # Save model
    if not os.path.exists(MODEL_DEST_PATH):
        os.makedirs(MODEL_DEST_PATH)

    model_filename = f"{symbol}_model_{model_id}.txt"
    model_path = os.path.join(MODEL_DEST_PATH, model_filename)
    model.booster_.save_model(model_path)

    log("INFO", f"Model saved: {model_filename}")
    update_progress(conn, model_id, 100, "Training completed!")

    return precision, model_path

def main():
    parser = argparse.ArgumentParser(description='AI Model Training Script')
    parser.add_argument('--model-id', type=int, required=True, help='Model ID from database')
    parser.add_argument('--symbol', type=str, required=True, help='Trading symbol (e.g., BTCUSDC)')

    args = parser.parse_args()
    model_id = args.model_id
    symbol = args.symbol.upper()

    conn = None

    try:
        # Connect to database
        conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")

        log("INFO", f"Starting training for Model ID: {model_id}, Symbol: {symbol}")
        update_status(conn, model_id, 'training')
        update_progress(conn, model_id, 10, "Loading parameters...")

        # Load parameters
        params = load_parameters(conn, model_id)
        log("INFO", f"Parameters: {json.dumps(params, indent=2)}")
        update_progress(conn, model_id, 20, "Loading trade data...")

        # Load trades
        df = load_trades_from_db(conn, symbol)
        update_progress(conn, model_id, 30, "Preparing features...")

        # Prepare features
        df_1s = prepare_features(df, params)
        update_progress(conn, model_id, 40, "Feature preparation complete")

        # Train model
        precision, model_path = train_model(df_1s, params, model_id, symbol, conn)

        # Update final status
        update_status(conn, model_id, 'completed', accuracy=precision, model_file_path=model_path)
        log("INFO", "✅ Training completed successfully!")

        sys.exit(0)

    except Exception as e:
        log("ERROR", f"Training failed: {e}")
        import traceback
        traceback.print_exc()

        if conn:
            update_status(conn, model_id, 'failed')
            update_progress(conn, model_id, 0, f"Error: {str(e)}")

        sys.exit(1)

    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    main()
