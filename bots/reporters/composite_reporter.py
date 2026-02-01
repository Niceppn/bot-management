#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Composite Reporter
Combines multiple reporters (backend + telegram)
"""

class CompositeReporter:
    def __init__(self, reporters):
        self.reporters = reporters

    def report_order(self, order_data):
        """Report to all reporters"""
        for reporter in self.reporters:
            try:
                reporter.report_order(order_data)
            except Exception as e:
                print(f"Reporter error: {e}")

    def report_stats(self, stats_data):
        """Report to all reporters"""
        for reporter in self.reporters:
            try:
                reporter.report_stats(stats_data)
            except Exception as e:
                print(f"Reporter error: {e}")

    def report_status(self, status, extra_data=None):
        """Report to all reporters"""
        for reporter in self.reporters:
            try:
                reporter.report_status(status, extra_data)
            except Exception as e:
                print(f"Reporter error: {e}")

    def report_error(self, error_type, error_message):
        """Report to all reporters"""
        for reporter in self.reporters:
            try:
                reporter.report_error(error_type, error_message)
            except Exception as e:
                print(f"Reporter error: {e}")
