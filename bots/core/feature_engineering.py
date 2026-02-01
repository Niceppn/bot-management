#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Feature Engineering
Calculate trading features from market data
"""

import pandas as pd

class FeatureEngineer:
    def __init__(self, logger=None):
        self.logger = logger

    def calculate_features(self, df):
        """
        Calculate features from candle data
        Args:
            df: DataFrame with columns: timestamp, close, high, low, volume, net_flow, trade_count
        Returns:
            dict: Feature dictionary for prediction
        """
        try:
            if len(df) < 60:
                # Not enough data yet
                return None

            # Get latest values
            latest = df.iloc[-1]

            features = {
                # Basic price features
                'close': latest['close'],
                'high': df['high'].iloc[-1],
                'low': df['low'].iloc[-1],

                # Volume features
                'total_volume': latest.get('total_volume', 0),
                'trade_count': latest.get('trade_count', 0),

                # Net flow features
                'net_flow': latest.get('net_flow', 0),
                'net_flow_ma5': df['net_flow'].rolling(5).mean().iloc[-1] if 'net_flow' in df.columns else 0,
                'net_flow_ma10': df['net_flow'].rolling(10).mean().iloc[-1] if 'net_flow' in df.columns else 0,
                'net_flow_ma20': df['net_flow'].rolling(20).mean().iloc[-1] if 'net_flow' in df.columns else 0,

                # Price change features
                'price_change_1': (df['close'].iloc[-1] - df['close'].iloc[-2]) / df['close'].iloc[-2] if len(df) >= 2 else 0,
                'price_change_5': (df['close'].iloc[-1] - df['close'].iloc[-6]) / df['close'].iloc[-6] if len(df) >= 6 else 0,
                'price_change_10': (df['close'].iloc[-1] - df['close'].iloc[-11]) / df['close'].iloc[-11] if len(df) >= 11 else 0,

                # Volatility features
                'price_std_5': df['close'].rolling(5).std().iloc[-1] if len(df) >= 5 else 0,
                'price_std_10': df['close'].rolling(10).std().iloc[-1] if len(df) >= 10 else 0,

                # Moving averages
                'ma5': df['close'].rolling(5).mean().iloc[-1] if len(df) >= 5 else latest['close'],
                'ma10': df['close'].rolling(10).mean().iloc[-1] if len(df) >= 10 else latest['close'],
                'ma20': df['close'].rolling(20).mean().iloc[-1] if len(df) >= 20 else latest['close'],
                'ma30': df['close'].rolling(30).mean().iloc[-1] if len(df) >= 30 else latest['close'],

                # Volume moving averages
                'volume_ma5': df['total_volume'].rolling(5).mean().iloc[-1] if 'total_volume' in df.columns and len(df) >= 5 else 0,
                'volume_ma10': df['total_volume'].rolling(10).mean().iloc[-1] if 'total_volume' in df.columns and len(df) >= 10 else 0,

                # RSI-like features
                'rsi_14': self._calculate_rsi(df['close'], 14) if len(df) >= 15 else 50,

                # Momentum features
                'momentum_5': latest['close'] - df['close'].iloc[-6] if len(df) >= 6 else 0,
                'momentum_10': latest['close'] - df['close'].iloc[-11] if len(df) >= 11 else 0,
            }

            return features

        except Exception as e:
            if self.logger:
                self.logger.error(f"Feature calculation error: {e}")
            return None

    def _calculate_rsi(self, prices, period=14):
        """Calculate RSI indicator"""
        try:
            delta = prices.diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()

            rs = gain / loss
            rsi = 100 - (100 / (1 + rs))

            return rsi.iloc[-1]
        except:
            return 50  # Neutral RSI
