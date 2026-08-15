-- MarketPulse Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Stocks table
CREATE TABLE IF NOT EXISTS stocks (
    stock_id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL UNIQUE,
    company_name VARCHAR(150) NOT NULL,
    sector VARCHAR(100),
    exchange VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily prices table
CREATE TABLE IF NOT EXISTS daily_prices (
    price_id SERIAL PRIMARY KEY,
    stock_id INTEGER NOT NULL REFERENCES stocks(stock_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    open NUMERIC(12,2) NOT NULL,
    high NUMERIC(12,2) NOT NULL,
    low NUMERIC(12,2) NOT NULL,
    close NUMERIC(12,2) NOT NULL,
    adjusted_close NUMERIC(12,2),
    volume BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(stock_id, date)
);

-- Stock metrics table
CREATE TABLE IF NOT EXISTS stock_metrics (
    metric_id SERIAL PRIMARY KEY,
    stock_id INTEGER NOT NULL REFERENCES stocks(stock_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    daily_return NUMERIC(10,4),
    moving_avg_7d NUMERIC(12,2),
    moving_avg_20d NUMERIC(12,2),
    volatility NUMERIC(10,4),
    price_change NUMERIC(12,2),
    percent_change NUMERIC(10,4),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(stock_id, date)
);

-- Profiles table (for Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Watchlist table
CREATE TABLE IF NOT EXISTS watchlist (
    watchlist_id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    stock_id INTEGER NOT NULL REFERENCES stocks(stock_id) ON DELETE CASCADE,
    added_on TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, stock_id)
);

-- Pipeline runs table
CREATE TABLE IF NOT EXISTS pipeline_runs (
    run_id SERIAL PRIMARY KEY,
    run_date TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(20) NOT NULL,
    stocks_processed INTEGER DEFAULT 0,
    records_inserted INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    errors VARCHAR(2000),
    duration_seconds NUMERIC(10,2)
);

-- Data quality results table
CREATE TABLE IF NOT EXISTS data_quality_results (
    result_id SERIAL PRIMARY KEY,
    run_id INTEGER REFERENCES pipeline_runs(run_id),
    stock_id INTEGER REFERENCES stocks(stock_id),
    check_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    details VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_prices_stock_id ON daily_prices(stock_id);
CREATE INDEX IF NOT EXISTS idx_daily_prices_date ON daily_prices(date);
CREATE INDEX IF NOT EXISTS idx_stock_metrics_stock_id ON stock_metrics(stock_id);
CREATE INDEX IF NOT EXISTS idx_stock_metrics_date ON stock_metrics(date);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id);
