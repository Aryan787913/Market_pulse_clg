"""Financial metrics calculation for MarketPulse"""
import math
from statistics import mean, stdev

def calculate_daily_return(current_close, previous_close):
    """Calculate daily return as a decimal"""
    if previous_close is None or previous_close == 0:
        return None
    return (current_close - previous_close) / previous_close

def calculate_moving_average(prices, window):
    """Calculate simple moving average"""
    if len(prices) < window:
        return None
    return mean(prices[-window:])

def calculate_volatility(returns, window=20):
    """Calculate annualized volatility using standard deviation of returns"""
    if len(returns) < 2:
        return None
    try:
        # Use available returns up to window size
        sample = returns[-window:] if len(returns) >= window else returns
        if len(sample) < 2:
            return None
        vol = stdev(sample)
        # Annualize (assuming 252 trading days)
        return vol * math.sqrt(252)
    except:
        return None

def calculate_metrics_for_stock(prices_df):
    """Calculate all metrics for a stock's price history"""
    metrics = []
    close_prices = prices_df["Close"].tolist()
    dates = prices_df.index.tolist()

    returns = []

    for i in range(len(prices_df)):
        current_close = close_prices[i]
        previous_close = close_prices[i - 1] if i > 0 else None

        # Daily return
        daily_return = calculate_daily_return(current_close, previous_close)
        if daily_return is not None:
            returns.append(daily_return)

        # Moving averages
        ma7 = calculate_moving_average(close_prices[:i+1], 7)
        ma20 = calculate_moving_average(close_prices[:i+1], 20)

        # Volatility
        volatility = calculate_volatility(returns)

        # Price change and percent change from previous day
        price_change = current_close - previous_close if previous_close else 0
        percent_change = daily_return if daily_return else 0

        metrics.append({
            "date": dates[i].date(),
            "daily_return": daily_return,
            "moving_avg_7d": ma7,
            "moving_avg_20d": ma20,
            "volatility": volatility,
            "price_change": price_change,
            "percent_change": percent_change,
        })

    return metrics
