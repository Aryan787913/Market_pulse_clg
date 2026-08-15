"""MarketPulse Data Pipeline

This script fetches stock market data from Yahoo Finance, validates it,
transforms it, calculates metrics, and stores everything in PostgreSQL.
"""
import sys
import time
import traceback
from datetime import datetime
import yfinance as yf

from config import STOCKS, DATABASE_URL
from database import Database
from validator import DataValidator
from metrics import calculate_metrics_for_stock

def fetch_stock_data(symbol, period="6mo"):
    """Fetch historical stock data from Yahoo Finance"""
    try:
        ticker = yf.Ticker(symbol)
        data = ticker.history(period=period)
        if data.empty:
            return None, f"No data returned for {symbol}"
        return data, None
    except Exception as e:
        return None, f"Error fetching {symbol}: {str(e)}"

def run_pipeline():
    """Execute the full data pipeline"""
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL environment variable is not set")
        return False

    start_time = time.time()
    validator = DataValidator()
    db = Database()

    stocks_processed = 0
    records_inserted = 0
    all_errors = []

    print(f"[{datetime.now()}] MarketPulse pipeline started")
    print(f"Tracking {len(STOCKS)} stocks")

    # Log pipeline start
    run_id = db.log_pipeline_run("running", 0, 0, 0, None, 0)

    try:
        for stock_info in STOCKS:
            symbol = stock_info["symbol"]
            company_name = stock_info["company_name"]
            sector = stock_info.get("sector")
            exchange = stock_info.get("exchange")

            print(f"\nProcessing {symbol}...")

            try:
                # Step 1: Get or create stock record
                stock_id = db.get_or_create_stock(symbol, company_name, sector, exchange)

                # Step 2: Fetch market data
                data, error = fetch_stock_data(symbol)
                if error:
                    print(f"  ✗ Fetch failed: {error}")
                    all_errors.append(error)
                    db.log_data_quality(run_id, stock_id, "DATA_FETCH", "fail", error)
                    continue

                print(f"  ✓ Fetched {len(data)} records")

                # Step 3: Validate and collect records
                valid_records = []
                invalid_count = 0

                for date, row in data.iterrows():
                    record = {
                        "Date": date.date(),
                        "Open": row["Open"],
                        "High": row["High"],
                        "Low": row["Low"],
                        "Close": row["Close"],
                        "Volume": row["Volume"],
                    }

                    is_valid, issues = validator.validate_record(record, symbol)

                    if not is_valid:
                        invalid_count += 1
                        for issue in issues:
                            db.log_data_quality(run_id, stock_id, "OHLC_VALIDATION", "fail", issue)
                        continue

                    valid_records.append((
                        stock_id,
                        record["Date"],
                        round(record["Open"], 2),
                        round(record["High"], 2),
                        round(record["Low"], 2),
                        round(record["Close"], 2),
                        round(row.get("Adj Close", record["Close"]), 2),
                        int(record["Volume"])
                    ))

                # Batch insert all valid records at once
                db.insert_daily_prices_batch(valid_records)
                print(f"  ✓ Stored {len(valid_records)} records ({invalid_count} invalid)")
                records_inserted += len(valid_records)

                # Step 4: Calculate and store metrics
                metrics = calculate_metrics_for_stock(data)
                metric_records = []

                for metric in metrics:
                    metric_records.append((
                        stock_id,
                        metric["date"],
                        metric["daily_return"],
                        round(metric["moving_avg_7d"], 2) if metric["moving_avg_7d"] else None,
                        round(metric["moving_avg_20d"], 2) if metric["moving_avg_20d"] else None,
                        metric["volatility"],
                        round(metric["price_change"], 2) if metric["price_change"] else None,
                        metric["percent_change"]
                    ))

                db.insert_stock_metrics_batch(metric_records)
                print(f"  ✓ Calculated {len(metric_records)} metrics")

                # Log success
                db.log_data_quality(run_id, stock_id, "PIPELINE", "pass", 
                                   f"Processed {len(valid_records)} records, {len(metric_records)} metrics")
                stocks_processed += 1

            except Exception as e:
                error_msg = f"Error processing {symbol}: {str(e)}"
                print(f"  ✗ {error_msg}")
                all_errors.append(error_msg)
                traceback.print_exc()

    finally:
        # Finalize pipeline run
        duration = round(time.time() - start_time, 2)
        status = "success" if stocks_processed == len(STOCKS) else "partial" if stocks_processed > 0 else "failed"
        errors_str = "; ".join(all_errors) if all_errors else None

        db.update_pipeline_run(run_id, status, stocks_processed, records_inserted, errors_str, duration)
        db.close()

        print(f"\n[{datetime.now()}] Pipeline completed in {duration}s")
        print(f"Status: {status}")
        print(f"Stocks processed: {stocks_processed}/{len(STOCKS)}")
        print(f"Records inserted: {records_inserted}")

    return status == "success" or status == "partial"

if __name__ == "__main__":
    success = run_pipeline()
    sys.exit(0 if success else 1)
