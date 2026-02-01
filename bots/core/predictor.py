#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI Predictor
Loads LightGBM model and makes predictions
"""

import lightgbm as lgb
import pandas as pd

class Predictor:
    def __init__(self, model_path, logger=None):
        self.logger = logger
        self.model = None

        try:
            self.model = lgb.Booster(model_file=model_path)
            if self.logger:
                self.logger.info(f"AI Model loaded from: {model_path}")
        except Exception as e:
            if self.logger:
                self.logger.error(f"Failed to load model: {e}")
            raise

    def predict(self, features):
        """
        Make prediction from features
        Returns: (prediction, confidence)
            prediction: 0 or 1 (0=no trade, 1=buy signal)
            confidence: probability (0.0 to 1.0)
        """
        try:
            # Convert features dict to DataFrame
            if isinstance(features, dict):
                df = pd.DataFrame([features])
            else:
                df = features

            # Make prediction
            probabilities = self.model.predict(df)

            # Get confidence (probability of class 1)
            if len(probabilities.shape) > 1:
                # Multi-class
                confidence = probabilities[0][1]
            else:
                # Binary
                confidence = probabilities[0]

            # Determine prediction
            prediction = 1 if confidence >= 0.5 else 0

            return prediction, confidence

        except Exception as e:
            if self.logger:
                self.logger.error(f"Prediction error: {e}")
            return 0, 0.0

    def should_trade(self, features, threshold=0.40):
        """
        Determine if we should trade based on confidence threshold
        Returns: (should_trade, confidence)
        """
        prediction, confidence = self.predict(features)

        should_trade = prediction == 1 and confidence >= threshold

        return should_trade, confidence
