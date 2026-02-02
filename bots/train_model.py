#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI Model Training Script
Trains LightGBM models from database crypto_trades data
"""

import pandas as pd
import numpy as np
import lightgbm as lgb
import os
import sys
import argparse
import sqlite3
from datetime import datetime
from sklearn.model_selection import train_test_split
from sklearn.metrics import precision_score

# =========================
# Configuration
# =========================
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "server", "data", "bot_manager.db")
MODELS_PATH = os.path.join(os.path.dirname(__file__), "..", "models")

# Ensure models directory exists
if not os.path.exists(MODELS_PATH):
    os.makedirs(MODELS_PATH)

def log(message):
    """Print log message with timestamp"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] {message}", flush=True)

def update_progress(model_id, progress):
    """Update training progress in database"""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute("""
            UPDATE ai_training_models 
            SET progress = ?
            WHERE id = ?
        """, (progress, model_id))
        conn.commit()
        conn.close()
        print(f"Progress: {progress}%", flush=True)
    except Exception as e:
        log(f"Failed to update progress: {e}")

def update_accuracy(model_id, accuracy):
    """Update model accuracy in database"""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute("""
            UPDATE ai_training_models 
            SET accuracy = ?
            WHERE id = ?
        """, (accuracy, model_id))
        conn.commit()
        conn.close()
    except Exception as e:
        log(f"Failed to update accuracy: {e}")

def load_data_from_db(symbol):
    """Load crypto trades data from database"""
    log(f"Loading data for {symbol} from database...")
    
    conn = sqlite3.connect(DB_PATH)
    
    # Load trades data
    query = """
        SELECT 
            timestamp_ms,
            price,
            quantity,
            side
        FROM crypto_trades 
        WHERE symbol = ?
        ORDER BY timestamp_ms ASC
    """
    
    df = pd.read_sql_query(query, conn, params=(symbol,))
    conn.close()
    
    if len(df) == 0:
        raise ValueError(f"No data found for symbol {symbol}")
    
    log(f"Loaded {len(df):,} trade records")
    return df

def prepare_features(df, profit_target_pct, fill_window, profit_window):
    """Prepare features and targets from raw trade data"""
    log("Preparing features and targets...")
    
    # Convert timestamp and set index
    df['datetime'] = pd.to_datetime(df['timestamp_ms'], unit='ms')
    df = df.set_index('datetime')
    
    # Create signed volume (positive for BUY, negative for SELL)
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
    
    # Fill missing values
    df_1s['close_price'] = df_1s['close_price'].ffill()
    df_1s['low_price'] = df_1s['low_price'].fillna(df_1s['close_price'])
    df_1s['high_price'] = df_1s['high_price'].fillna(df_1s['close_price'])
    df_1s['total_volume'] = df_1s['total_volume'].fillna(0)
    df_1s['net_flow'] = df_1s['net_flow'].fillna(0)
    df_1s['trade_count'] = df_1s['trade_count'].fillna(0)
    
    # Drop rows where price is still NaN
    df_1s.dropna(subset=['close_price'], inplace=True)
    
    log(f"Resampled to {len(df_1s):,} 1-second candles")
    
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
    log("Creating targets...")
    
    # Future minimum low (for fill check)
    indexer_fill = pd.api.indexers.FixedForwardWindowIndexer(window_size=fill_window)
    df_1s['future_min_low'] = df_1s['low_price'].rolling(window=indexer_fill).min().shift(-1)
    is_filled = df_1s['future_min_low'] <= df_1s['close_price']
    
    # Future maximum high (for profit check)
    indexer_profit = pd.api.indexers.FixedForwardWindowIndexer(window_size=profit_window)
    df_1s['future_max_high'] = df_1s['high_price'].rolling(window=indexer_profit).max().shift(-1)
    target_price = df_1s['close_price'] * (1 + profit_target_pct)
    is_profit = df_1s['future_max_high'] > target_price
    
    # Combined target (filled AND profitable)
    df_1s['target'] = (is_filled & is_profit).astype(int)
    
    # Remove NaN values
    df_1s.dropna(inplace=True)
    
    log(f"Final dataset: {len(df_1s):,} rows")
    
    y = df_1s['target']
    counts = y.value_counts()
    pos_samples = counts.get(1, 0)
    neg_samples = counts.get(0, 0)
    
    log(f"Target distribution: Win (1) = {pos_samples:,} | Loss (0) = {neg_samples:,}")
    
    if pos_samples < 100:
        raise ValueError(f"Insufficient positive samples ({pos_samples}). Need at least 100.")
    
    return df_1s

def train_model(df_1s, model_id, learning_rate, n_estimators, max_depth, confidence_threshold):
    """Train LightGBM model"""
    log("Training LightGBM model...")
    
    # Feature columns
    feature_cols = [
        'total_volume', 'net_flow', 'trade_count', 'net_flow_ma5', 
        'net_flow_ma15', 'volume_ma5', 'net_flow_diff', 'price_change', 
        'std_5', 'dist_ma15', 'rsi'
    ]
    
    X = df_1s[feature_cols]
    y = df_1s['target']
    
    # Train/test split (time-based)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, shuffle=False)
    
    # Calculate scale weight for imbalanced data
    neg = y_train.value_counts().get(0, 1)
    pos = y_train.value_counts().get(1, 1)
    scale_weight = neg / pos if pos > 0 else 1.0
    
    log(f"Scale pos weight: {scale_weight:.2f}")
    
    update_progress(model_id, 30)
    
    # Train model
    model = lgb.LGBMClassifier(
        n_estimators=n_estimators,
        learning_rate=learning_rate,
        num_leaves=31,
        max_depth=max_depth,
        scale_pos_weight=scale_weight,
        random_state=42,
        verbose=-1
    )
    
    update_progress(model_id, 50)
    
    model.fit(X_train, y_train)
    
    update_progress(model_id, 80)
    
    # Evaluate model
    log("Evaluating model...")
    probs = model.predict_proba(X_test)[:, 1]
    preds = (probs >= confidence_threshold).astype(int)
    precision = precision_score(y_test, preds, zero_division=0)
    
    log(f"Model precision: {precision*100:.2f}%")
    
    # Update accuracy in database
    update_accuracy(model_id, precision)
    
    return model, precision

def main():
    parser = argparse.ArgumentParser(description='Train AI model from database')
    parser.add_argument('--model-id', type=int, required=True, help='Model ID')
    parser.add_argument('--symbol', type=str, required=True, help='Trading symbol')
    parser.add_argument('--profit-target-pct', type=float, default=0.0003, help='Profit target %')
    parser.add_argument('--fill-window', type=int, default=20, help='Fill window (seconds)')
    parser.add_argument('--profit-window', type=int, default=300, help='Profit window (seconds)')
    parser.add_argument('--confidence-threshold', type=float, default=0.60, help='Confidence threshold')
    parser.add_argument('--learning-rate', type=float, default=0.01, help='Learning rate')
    parser.add_argument('--n-estimators', type=int, default=500, help='Number of estimators')
    parser.add_argument('--max-depth', type=int, default=7, help='Max depth')
    
    args = parser.parse_args()
    
    log(f"Starting training for Model ID: {args.model_id}, Symbol: {args.symbol}")
    
    try:
        update_progress(args.model_id, 10)
        
        # Load data from database
        df = load_data_from_db(args.symbol)
        
        update_progress(args.model_id, 20)
        
        # Prepare features and targets
        df_1s = prepare_features(
            df, 
            args.profit_target_pct, 
            args.fill_window, 
            args.profit_window
        )
        
        # Train model
        model, precision = train_model(
            df_1s,
            args.model_id,
            args.learning_rate,
            args.n_estimators,
            args.max_depth,
            args.confidence_threshold
        )
        
        update_progress(args.model_id, 90)
        
        # Save model
        model_filename = f"{args.symbol}_model_{args.model_id}.txt"
        model_path = os.path.join(MODELS_PATH, model_filename)
        model.booster_.save_model(model_path)
        
        log(f"Model saved: {model_filename}")
        
        update_progress(args.model_id, 100)
        
        log(f"Training completed successfully! Precision: {precision*100:.2f}%")
        
    except Exception as e:
        log(f"Training failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()