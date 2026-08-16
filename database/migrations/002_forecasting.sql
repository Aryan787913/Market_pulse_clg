-- MarketPulse: forecasting tables
-- Run this in the Supabase SQL Editor after 001_initial.sql

-- Point forecasts produced by each model on each training run.
CREATE TABLE IF NOT EXISTS stock_forecasts (
    forecast_id SERIAL PRIMARY KEY,
    stock_id INTEGER NOT NULL REFERENCES stocks(stock_id) ON DELETE CASCADE,
    model_name VARCHAR(30) NOT NULL,
    -- Date of the last observation the model was fitted on. Makes every
    -- forecast reproducible and prevents mixing runs.
    trained_on DATE NOT NULL,
    target_date DATE NOT NULL,
    horizon INTEGER NOT NULL,
    predicted_close NUMERIC(12,2) NOT NULL,
    -- 95% interval. ARIMA supplies these; tree models leave them NULL.
    lower_bound NUMERIC(12,2),
    upper_bound NUMERIC(12,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(stock_id, model_name, trained_on, target_date)
);

-- Walk-forward backtest results, so predictions can be shown alongside
-- measured out-of-sample error rather than presented as fact.
CREATE TABLE IF NOT EXISTS model_evaluations (
    evaluation_id SERIAL PRIMARY KEY,
    stock_id INTEGER NOT NULL REFERENCES stocks(stock_id) ON DELETE CASCADE,
    model_name VARCHAR(30) NOT NULL,
    trained_on DATE NOT NULL,
    train_size INTEGER NOT NULL,
    test_size INTEGER NOT NULL,
    mae NUMERIC(12,4),
    rmse NUMERIC(12,4),
    mape NUMERIC(10,4),
    -- Share of test days where the predicted direction matched the actual.
    directional_accuracy NUMERIC(10,4),
    -- RMSE of a random-walk baseline (tomorrow = today) over the same window.
    -- A model that cannot beat this adds no value.
    naive_rmse NUMERIC(12,4),
    params VARCHAR(300),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(stock_id, model_name, trained_on)
);

CREATE INDEX IF NOT EXISTS idx_stock_forecasts_stock_id ON stock_forecasts(stock_id);
CREATE INDEX IF NOT EXISTS idx_stock_forecasts_lookup ON stock_forecasts(stock_id, model_name, trained_on);
CREATE INDEX IF NOT EXISTS idx_model_evaluations_stock_id ON model_evaluations(stock_id);
