-- MarketPulse: BI / analytics access layer
-- Run this in the Supabase SQL Editor AFTER 001_initial.sql and 002_forecasting.sql.
--
-- What this does:
--   1. Creates a read-only login role `bi_readonly` for Excel / Power BI / Tableau.
--      It can read market data + the views below, but NOT the PII tables
--      (`profiles`, `watchlist`).
--   2. Creates denormalized views so BI tools get flat, ready-to-chart tables
--      instead of having to join raw tables themselves.
--
-- IMPORTANT: change the password below before running, and keep it separate from
-- your main DATABASE_URL password. Through the Supabase pooler you connect as
-- user `bi_readonly.gemortzpevkdlzrmprjf` (see the README "BI Tools" section).

-- ---------------------------------------------------------------------------
-- 1. Read-only role
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bi_readonly') THEN
    CREATE ROLE bi_readonly WITH LOGIN PASSWORD 'REPLACE_WITH_A_STRONG_PASSWORD';
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 2. Analytics views (flat, BI-friendly)
-- ---------------------------------------------------------------------------

-- One row per stock per trading day: prices + all derived metrics.
-- This is the main "fact table" for time-series dashboards.
CREATE OR REPLACE VIEW v_stock_daily AS
SELECT
  s.stock_id,
  s.symbol,
  s.company_name,
  s.sector,
  s.exchange,
  p.date,
  p.open,
  p.high,
  p.low,
  p.close,
  p.adjusted_close,
  p.volume,
  m.daily_return,
  m.moving_avg_7d,
  m.moving_avg_20d,
  m.volatility,
  m.price_change,
  m.percent_change
FROM daily_prices p
JOIN stocks s ON s.stock_id = p.stock_id
LEFT JOIN stock_metrics m ON m.stock_id = p.stock_id AND m.date = p.date;

-- Latest available day per stock: for "current price" cards and KPI tiles.
CREATE OR REPLACE VIEW v_latest_snapshot AS
SELECT DISTINCT ON (p.stock_id)
  s.stock_id,
  s.symbol,
  s.company_name,
  s.sector,
  p.date,
  p.open,
  p.high,
  p.low,
  p.close,
  p.volume,
  m.daily_return,
  m.percent_change,
  m.volatility,
  m.moving_avg_7d,
  m.moving_avg_20d
FROM daily_prices p
JOIN stocks s ON s.stock_id = p.stock_id
LEFT JOIN stock_metrics m ON m.stock_id = p.stock_id AND m.date = p.date
ORDER BY p.stock_id, p.date DESC;

-- Sector roll-up of the latest snapshot: for sector comparison charts.
CREATE OR REPLACE VIEW v_sector_performance AS
SELECT
  COALESCE(sector, 'Unclassified') AS sector,
  COUNT(*)                         AS stock_count,
  ROUND(AVG(percent_change), 4)    AS avg_percent_change,
  ROUND(AVG(volatility), 4)        AS avg_volatility,
  ROUND(AVG(close), 2)             AS avg_close,
  SUM(volume)                      AS total_volume
FROM v_latest_snapshot
GROUP BY COALESCE(sector, 'Unclassified');

-- Forecasts from the most recent training run per stock (ARIMA + XGBoost).
CREATE OR REPLACE VIEW v_forecast AS
SELECT
  s.symbol,
  s.company_name,
  s.sector,
  f.model_name,
  f.trained_on,
  f.target_date,
  f.horizon,
  f.predicted_close,
  f.lower_bound,
  f.upper_bound
FROM stock_forecasts f
JOIN stocks s ON s.stock_id = f.stock_id
WHERE f.trained_on = (
  SELECT MAX(f2.trained_on) FROM stock_forecasts f2 WHERE f2.stock_id = f.stock_id
);

-- Backtest accuracy from the most recent evaluation per stock, with a plain
-- boolean for "did the model beat a random walk" so charts can colour by it.
CREATE OR REPLACE VIEW v_forecast_accuracy AS
SELECT
  s.symbol,
  s.company_name,
  s.sector,
  e.model_name,
  e.trained_on,
  e.train_size,
  e.test_size,
  e.mae,
  e.rmse,
  e.mape,
  e.directional_accuracy,
  e.naive_rmse,
  (e.rmse < e.naive_rmse) AS beats_random_walk,
  e.params
FROM model_evaluations e
JOIN stocks s ON s.stock_id = e.stock_id
WHERE e.trained_on = (
  SELECT MAX(e2.trained_on) FROM model_evaluations e2 WHERE e2.stock_id = e.stock_id
);

-- Recent pipeline runs: for a data-freshness / job-health panel.
CREATE OR REPLACE VIEW v_pipeline_health AS
SELECT
  run_id,
  run_date,
  status,
  stocks_processed,
  records_inserted,
  records_updated,
  duration_seconds
FROM pipeline_runs
ORDER BY run_date DESC;

-- ---------------------------------------------------------------------------
-- 3. Grants (data + views only; PII tables profiles/watchlist are excluded)
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO bi_readonly;

GRANT SELECT ON
  stocks,
  daily_prices,
  stock_metrics,
  stock_forecasts,
  model_evaluations,
  pipeline_runs,
  data_quality_results
TO bi_readonly;

GRANT SELECT ON
  v_stock_daily,
  v_latest_snapshot,
  v_sector_performance,
  v_forecast,
  v_forecast_accuracy,
  v_pipeline_health
TO bi_readonly;

-- Note: if you enable Row Level Security on any of the tables above, add a
-- read policy for bi_readonly, or query only through the views (view access
-- runs with the view owner's rights and is unaffected by RLS on base tables).
