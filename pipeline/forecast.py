"""Price forecasting models for MarketPulse.

Two standard approaches are fitted per stock:

  ARIMA    - classical linear time-series model, fitted on log prices so the
             differenced series is closer to stationary and forecasts stay
             positive. Supplies genuine confidence intervals.
  XGBoost  - gradient-boosted trees on lagged returns and technical features.
             Predicts the next-day *return*, which is far closer to stationary
             than the raw price level, then reconstructs the price.

Both are evaluated with a walk-forward (expanding window) backtest, never on
data they were trained on. A random-walk baseline is measured over the same
window: if a model cannot beat "tomorrow equals today", it has no predictive
value and the UI is expected to say so.

This module deliberately produces only numeric forecasts and error metrics.
It does not emit buy/sell/hold recommendations.
"""
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

# Trading days ahead to forecast.
FORECAST_HORIZON = 5

# Minimum history required before a model is worth fitting at all.
MIN_TRAIN_OBSERVATIONS = 60

# Size of the held-out walk-forward test window.
BACKTEST_WINDOW = 30


# --------------------------------------------------------------------------
# Feature engineering
# --------------------------------------------------------------------------

def build_features(close: pd.Series, volume: pd.Series = None) -> pd.DataFrame:
    """Build a lagged feature matrix for next-day return prediction.

    Every feature is computed from data at or before time t, and the target is
    the return from t to t+1, so there is no lookahead leakage.
    """
    df = pd.DataFrame({"close": close.astype(float)})
    df["return"] = df["close"].pct_change()

    # Lagged returns: short-term momentum / mean reversion.
    for lag in (1, 2, 3, 5, 10):
        df[f"return_lag_{lag}"] = df["return"].shift(lag)

    # Moving averages and the price's position relative to them.
    for window in (5, 10, 20):
        ma = df["close"].rolling(window).mean()
        df[f"ma_ratio_{window}"] = df["close"] / ma - 1

    # Realised volatility over different windows.
    for window in (5, 10, 20):
        df[f"volatility_{window}"] = df["return"].rolling(window).std()

    # Rolling min/max position (crude stochastic oscillator).
    low_14 = df["close"].rolling(14).min()
    high_14 = df["close"].rolling(14).max()
    span = (high_14 - low_14).replace(0, np.nan)
    df["stoch_14"] = (df["close"] - low_14) / span

    # RSI(14) using a simple moving average of gains and losses.
    delta = df["close"].diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = (-delta.clip(upper=0)).rolling(14).mean()
    rs = gain / loss.replace(0, np.nan)
    df["rsi_14"] = 100 - (100 / (1 + rs))

    if volume is not None:
        vol = volume.astype(float)
        vol_ma = vol.rolling(20).mean()
        df["volume_ratio"] = (vol / vol_ma.replace(0, np.nan)) - 1
        df["volume_change"] = vol.pct_change()

    # Target: next-day return.
    df["target"] = df["return"].shift(-1)

    # Division by a zero or near-zero denominator (a flat rolling window, a
    # zero-volume day) yields +/-inf, which XGBoost rejects outright. Treat
    # those as missing so they are dropped or imputed like any other gap.
    df = df.replace([np.inf, -np.inf], np.nan)

    return df


def _feature_columns(df: pd.DataFrame) -> list:
    return [c for c in df.columns if c not in ("close", "return", "target")]


# --------------------------------------------------------------------------
# Metrics
# --------------------------------------------------------------------------

def _metrics(actual, predicted) -> dict:
    """Standard regression error metrics plus directional accuracy."""
    actual = np.asarray(actual, dtype=float)
    predicted = np.asarray(predicted, dtype=float)

    mask = np.isfinite(actual) & np.isfinite(predicted)
    actual, predicted = actual[mask], predicted[mask]

    if actual.size == 0:
        return {"mae": None, "rmse": None, "mape": None, "directional_accuracy": None}

    errors = predicted - actual
    mae = float(np.mean(np.abs(errors)))
    rmse = float(np.sqrt(np.mean(errors ** 2)))

    nonzero = actual != 0
    mape = (
        float(np.mean(np.abs(errors[nonzero] / actual[nonzero])) * 100)
        if nonzero.any() else None
    )

    # Directional accuracy needs a previous value to compare against, so it is
    # measured on consecutive pairs within the test window.
    if actual.size > 1:
        actual_dir = np.sign(np.diff(actual))
        pred_dir = np.sign(predicted[1:] - actual[:-1])
        valid = actual_dir != 0
        directional = (
            float(np.mean(actual_dir[valid] == pred_dir[valid]))
            if valid.any() else None
        )
    else:
        directional = None

    return {"mae": mae, "rmse": rmse, "mape": mape, "directional_accuracy": directional}


def naive_baseline_rmse(actual: pd.Series) -> float:
    """RMSE of a random walk: the forecast for t+1 is the value at t."""
    values = np.asarray(actual, dtype=float)
    if values.size < 2:
        return None
    errors = values[1:] - values[:-1]
    return float(np.sqrt(np.mean(errors ** 2)))


# --------------------------------------------------------------------------
# ARIMA
# --------------------------------------------------------------------------

def _fit_arima(train_close: pd.Series, order):
    from statsmodels.tsa.arima.model import ARIMA

    # Fitting on log prices keeps forecasts positive and stabilises variance.
    log_prices = np.log(train_close.astype(float))
    model = ARIMA(log_prices, order=order, enforce_stationarity=False,
                  enforce_invertibility=False)
    return model.fit(method_kwargs={"warn_convergence": False})


def _select_arima_order(train_close: pd.Series):
    """Small grid search over (p, d, q) minimising AIC.

    A full auto_arima would need an extra dependency; this covers the orders
    that matter for daily equity prices, which are near random walks.
    """
    candidates = [
        (1, 1, 0), (0, 1, 1), (1, 1, 1), (2, 1, 1),
        (1, 1, 2), (2, 1, 2), (3, 1, 0), (0, 1, 0),
    ]

    best_order, best_aic, best_fit = None, np.inf, None
    for order in candidates:
        try:
            fitted = _fit_arima(train_close, order)
            if np.isfinite(fitted.aic) and fitted.aic < best_aic:
                best_order, best_aic, best_fit = order, fitted.aic, fitted
        except Exception:
            continue

    return best_order, best_fit


def arima_forecast(close: pd.Series, horizon: int = FORECAST_HORIZON) -> dict:
    """Fit ARIMA on the full series and forecast `horizon` days ahead."""
    order, fitted = _select_arima_order(close)
    if fitted is None:
        return None

    result = fitted.get_forecast(steps=horizon)
    # Undo the log transform. exp() of the mean of a normal on the log scale is
    # the median forecast, which is the appropriate central estimate here.
    predicted = np.exp(result.predicted_mean.to_numpy())
    conf = np.exp(result.conf_int(alpha=0.05).to_numpy())

    return {
        "model_name": "ARIMA",
        "params": f"order={order}",
        "predictions": predicted.tolist(),
        "lower": conf[:, 0].tolist(),
        "upper": conf[:, 1].tolist(),
    }


def arima_backtest(close: pd.Series, order, window: int = BACKTEST_WINDOW) -> dict:
    """Walk-forward one-step-ahead backtest, refitting as data arrives."""
    if len(close) < MIN_TRAIN_OBSERVATIONS + window:
        return None

    split = len(close) - window
    actual, predicted = [], []

    for i in range(split, len(close)):
        train = close.iloc[:i]
        try:
            fitted = _fit_arima(train, order)
            step = fitted.get_forecast(steps=1).predicted_mean.to_numpy()[0]
            predicted.append(float(np.exp(step)))
            actual.append(float(close.iloc[i]))
        except Exception:
            continue

    if len(predicted) < 2:
        return None

    result = _metrics(actual, predicted)
    result["train_size"] = split
    result["test_size"] = len(predicted)
    result["naive_rmse"] = naive_baseline_rmse(pd.Series(actual))
    return result


# --------------------------------------------------------------------------
# XGBoost
# --------------------------------------------------------------------------

def _xgb_model():
    from xgboost import XGBRegressor

    # Conservative settings: financial return series are extremely noisy and
    # deep trees memorise that noise.
    return XGBRegressor(
        n_estimators=200,
        max_depth=3,
        learning_rate=0.03,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=5,
        reg_lambda=1.0,
        objective="reg:squarederror",
        random_state=42,
        n_jobs=2,
        verbosity=0,
    )


XGB_PARAMS = "n_estimators=200,max_depth=3,lr=0.03,subsample=0.8"


def xgboost_forecast(close: pd.Series, volume: pd.Series = None,
                     horizon: int = FORECAST_HORIZON) -> dict:
    """Predict next-day returns iteratively and compound into a price path.

    Each step feeds the predicted price back in to recompute features. Error
    compounds across steps, which is expected and is why the reported metrics
    are one-step-ahead.
    """
    features = build_features(close, volume)
    cols = _feature_columns(features)

    train = features.dropna(subset=cols + ["target"])
    if len(train) < MIN_TRAIN_OBSERVATIONS:
        return None

    model = _xgb_model()
    model.fit(train[cols], train["target"])

    working_close = close.astype(float).copy()
    working_volume = volume.astype(float).copy() if volume is not None else None
    predictions = []

    for _ in range(horizon):
        step_features = build_features(working_close, working_volume)
        latest = step_features[cols].iloc[[-1]]

        # Any residual gap (a feature whose rolling window is not yet full)
        # becomes 0.0, i.e. "no signal from this feature".
        latest = latest.replace([np.inf, -np.inf], np.nan).fillna(0.0)

        predicted_return = float(model.predict(latest)[0])
        # Guard against a pathological prediction producing a negative price.
        predicted_return = float(np.clip(predicted_return, -0.25, 0.25))

        next_close = float(working_close.iloc[-1]) * (1.0 + predicted_return)
        predictions.append(next_close)

        working_close = pd.concat([working_close, pd.Series([next_close])], ignore_index=True)
        if working_volume is not None:
            # Hold volume at its recent average; we are not forecasting it.
            working_volume = pd.concat(
                [working_volume, pd.Series([float(working_volume.iloc[-20:].mean())])],
                ignore_index=True,
            )

    return {
        "model_name": "XGBoost",
        "params": XGB_PARAMS,
        "predictions": predictions,
        "lower": [None] * horizon,
        "upper": [None] * horizon,
    }


def xgboost_backtest(close: pd.Series, volume: pd.Series = None,
                     window: int = BACKTEST_WINDOW) -> dict:
    """Expanding-window one-step-ahead backtest."""
    features = build_features(close, volume)
    cols = _feature_columns(features)
    usable = features.dropna(subset=cols + ["target"])

    if len(usable) < MIN_TRAIN_OBSERVATIONS + window:
        return None

    split = len(usable) - window
    actual, predicted = [], []

    # Refitting on every step is accurate but slow; refit periodically and
    # predict each day in between, which is standard practice.
    refit_every = 5
    model = None

    for offset in range(window):
        idx = split + offset
        if model is None or offset % refit_every == 0:
            train = usable.iloc[:idx]
            model = _xgb_model()
            model.fit(train[cols], train["target"])

        row = usable.iloc[[idx]]
        predicted_return = float(model.predict(row[cols])[0])
        predicted_return = float(np.clip(predicted_return, -0.25, 0.25))

        base_price = float(row["close"].iloc[0])
        predicted.append(base_price * (1.0 + predicted_return))
        # target is the return from this row to the next day.
        actual.append(base_price * (1.0 + float(row["target"].iloc[0])))

    if len(predicted) < 2:
        return None

    result = _metrics(actual, predicted)
    result["train_size"] = split
    result["test_size"] = len(predicted)
    result["naive_rmse"] = naive_baseline_rmse(pd.Series(actual))
    return result


# --------------------------------------------------------------------------
# Orchestration
# --------------------------------------------------------------------------

def next_trading_days(last_date, count: int) -> list:
    """Business days after `last_date`, skipping weekends.

    Exchange holidays are not modelled, so a target date can occasionally fall
    on one. That is a known limitation.
    """
    days, current = [], pd.Timestamp(last_date)
    while len(days) < count:
        current += pd.Timedelta(days=1)
        if current.weekday() < 5:
            days.append(current.date())
    return days


def run_models(prices_df: pd.DataFrame, horizon: int = FORECAST_HORIZON) -> dict:
    """Fit and evaluate every model for one stock.

    `prices_df` must be sorted ascending by date with 'Close' and 'Volume'
    columns and a DatetimeIndex. Returns forecasts and evaluations keyed by
    model name; missing entries mean that model could not be fitted.
    """
    close = prices_df["Close"].astype(float).reset_index(drop=True)
    volume = (
        prices_df["Volume"].astype(float).reset_index(drop=True)
        if "Volume" in prices_df else None
    )

    if len(close) < MIN_TRAIN_OBSERVATIONS:
        return {"forecasts": [], "evaluations": [], "skipped": "insufficient history"}

    last_date = prices_df.index[-1]
    target_dates = next_trading_days(last_date, horizon)

    forecasts, evaluations = [], []

    # ARIMA
    try:
        order, _ = _select_arima_order(close)
        if order is not None:
            arima = arima_forecast(close, horizon)
            if arima:
                arima["target_dates"] = target_dates
                forecasts.append(arima)
            backtest = arima_backtest(close, order)
            if backtest:
                backtest.update({"model_name": "ARIMA", "params": f"order={order}"})
                evaluations.append(backtest)
    except Exception as exc:
        print(f"      ARIMA failed: {exc}")

    # XGBoost
    try:
        xgb = xgboost_forecast(close, volume, horizon)
        if xgb:
            xgb["target_dates"] = target_dates
            forecasts.append(xgb)
        backtest = xgboost_backtest(close, volume)
        if backtest:
            backtest.update({"model_name": "XGBoost", "params": XGB_PARAMS})
            evaluations.append(backtest)
    except Exception as exc:
        print(f"      XGBoost failed: {exc}")

    return {"forecasts": forecasts, "evaluations": evaluations, "skipped": None}
