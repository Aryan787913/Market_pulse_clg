"""Data quality validation for MarketPulse pipeline"""
import math
from config import MIN_PRICE, MAX_PRICE, MIN_VOLUME

class DataValidator:
    """Validates stock market data for quality issues"""

    def __init__(self):
        self.errors = []
        self.warnings = []

    def is_valid_number(self, value):
        """Check if value is a valid number (not None, NaN, or inf)"""
        if value is None:
            return False
        if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
            return False
        return True

    def validate_ohlc(self, open_p, high, low, close, symbol):
        """Validate OHLC relationships"""
        issues = []

        # Check for missing/invalid values
        for label, value in [("Open", open_p), ("High", high), ("Low", low), ("Close", close)]:
            if not self.is_valid_number(value):
                issues.append(f"Invalid {label} value for {symbol}")

        if issues:
            return False, issues

        # High should be >= Low
        if high < low:
            issues.append(f"High ({high}) < Low ({low}) for {symbol}")

        # High should be >= Open and Close
        if high < open_p:
            issues.append(f"High ({high}) < Open ({open_p}) for {symbol}")
        if high < close:
            issues.append(f"High ({high}) < Close ({close}) for {symbol}")

        # Low should be <= Open and Close
        if low > open_p:
            issues.append(f"Low ({low}) > Open ({open_p}) for {symbol}")
        if low > close:
            issues.append(f"Low ({low}) > Close ({close}) for {symbol}")

        # Price range validation
        for label, value in [("Open", open_p), ("High", high), ("Low", low), ("Close", close)]:
            if value < MIN_PRICE:
                issues.append(f"{label} price ({value}) below minimum for {symbol}")
            if value > MAX_PRICE:
                issues.append(f"{label} price ({value}) above maximum for {symbol}")

        return len(issues) == 0, issues

    def validate_volume(self, volume, symbol):
        """Validate trading volume"""
        if not self.is_valid_number(volume):
            return False, [f"Invalid volume for {symbol}"]
        if volume < MIN_VOLUME:
            return False, [f"Negative volume ({volume}) for {symbol}"]
        return True, []

    def validate_date(self, date, symbol):
        """Validate date is not in the future"""
        from datetime import datetime
        if hasattr(date, 'date'):
            date = date.date()
        if date > datetime.now().date():
            return False, [f"Future date ({date}) for {symbol}"]
        return True, []

    def validate_record(self, record, symbol):
        """Run all validations on a single record"""
        all_issues = []

        valid_ohlc, issues = self.validate_ohlc(
            record.get("Open"), record.get("High"), 
            record.get("Low"), record.get("Close"), symbol
        )
        all_issues.extend(issues)

        valid_vol, issues = self.validate_volume(record.get("Volume"), symbol)
        all_issues.extend(issues)

        valid_date, issues = self.validate_date(record.get("Date"), symbol)
        all_issues.extend(issues)

        is_valid = valid_ohlc and valid_vol and valid_date
        return is_valid, all_issues
