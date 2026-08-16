"""MarketPulse Data Pipeline

Fetches stock market data from Yahoo Finance, validates it,
transforms it, calculates metrics, and stores everything in PostgreSQL.
"""
import sys
import time
import traceback
from datetime import datetime
import yfinance as yf

from config import STOCKS, DATABASE_URL, FETCH_DELAY_SECONDS
from database import Database
from validator import DataValidator
from metrics import calculate_metrics_for_stock
from forecast import run_models, FORECAST_HORIZON

def fetch_stock_data(symbol, period="2y"):
    """Fetch historical stock data from Yahoo Finance.

    Two years gives the forecasting models enough observations to train on and
    makes the 52-week high/low genuinely reflect 52 weeks.
    """
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
    print("=" * 60)
    
    # Log pipeline start
    run_id = db.log_pipeline_run("running", 0, 0, 0, None, 0)
    
    for index, stock_info in enumerate(STOCKS):
        symbol = stock_info["symbol"]
        company_name = stock_info["company_name"]
        sector = stock_info.get("sector")
        exchange = stock_info.get("exchange")

        print(f"\n[{index + 1}/{len(STOCKS)}] {symbol} - {company_name}")

        # Space out requests so Yahoo Finance does not start rejecting them.
        if index > 0 and FETCH_DELAY_SECONDS > 0:
            time.sleep(FETCH_DELAY_SECONDS)

        try:
            # Step 1: Get or create stock record
            stock_id = db.get_or_create_stock(symbol, company_name, sector, exchange)
            
            # Step 2: Fetch market data
            data, error = fetch_stock_data(symbol)
            if error:
                print(f"    FETCH FAILED: {error}")
                all_errors.append(error)
                db.log_data_quality(run_id, stock_id, "DATA_FETCH", "fail", error)
                continue

            print(f"    Fetched {len(data)} records")
            
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
            print(f"    Stored {len(valid_records)} records ({invalid_count} invalid)")
            records_inserted += len(valid_records)
            
            # Step 4: Calculate and store metrics
            metrics = calculate_metrics_for_stock(data)
            metric_records = []
            
            for metric in metrics:
                metric_records.append((
                    stock_id,
                    metric["date"],
                    metric["daily_return"],
                    round(metric["moving_avg_7d"], 2) if metric["moving_avg_7d"] is not None else None,
                    round(metric["moving_avg_20d"], 2) if metric["moving_avg_20d"] is not None else None,
                    metric["volatility"],
                    round(metric["price_change"], 2) if metric["price_change"] is not None else None,
                    metric["percent_change"]
                ))
            
            db.insert_stock_metrics_batch(metric_records)
            print(f"    Calculated {len(metric_records)} metrics")

            # Step 5: Fit forecasting models and record their backtested error
            try:
                trained_on = data.index[-1].date()
                model_output = run_models(data, horizon=FORECAST_HORIZON)

                if model_output["skipped"]:
                    print(f"    Forecast skipped: {model_output['skipped']}")
                else:
                    forecast_records = []
                    for result in model_output["forecasts"]:
                        for step, target_date in enumerate(result["target_dates"], start=1):
                            lower = result["lower"][step - 1]
                            upper = result["upper"][step - 1]
                            forecast_records.append((
                                stock_id,
                                result["model_name"],
                                trained_on,
                                target_date,
                                step,
                                round(result["predictions"][step - 1], 2),
                                round(lower, 2) if lower is not None else None,
                                round(upper, 2) if upper is not None else None,
                            ))

                    db.insert_forecasts_batch(forecast_records)

                    evaluation_records = []
                    for ev in model_output["evaluations"]:
                        evaluation_records.append((
                            stock_id,
                            ev["model_name"],
                            trained_on,
                            ev["train_size"],
                            ev["test_size"],
                            round(ev["mae"], 4) if ev["mae"] is not None else None,
                            round(ev["rmse"], 4) if ev["rmse"] is not None else None,
                            round(ev["mape"], 4) if ev["mape"] is not None else None,
                            round(ev["directional_accuracy"], 4) if ev["directional_accuracy"] is not None else None,
                            round(ev["naive_rmse"], 4) if ev["naive_rmse"] is not None else None,
                            ev["params"],
                        ))

                    db.insert_evaluations_batch(evaluation_records)
                    db.prune_old_forecasts(stock_id, trained_on)

                    model_names = ", ".join(r["model_name"] for r in model_output["forecasts"])
                    print(f"    Forecast {len(forecast_records)} points ({model_names or 'none'})")

                    for ev in model_output["evaluations"]:
                        skill = ""
                        if ev["rmse"] and ev["naive_rmse"]:
                            better = ev["rmse"] < ev["naive_rmse"]
                            skill = " beats naive" if better else " WORSE than naive"
                        mape = f"{ev['mape']:.2f}%" if ev["mape"] is not None else "n/a"
                        print(f"      {ev['model_name']}: MAPE {mape}{skill}")
            except Exception as exc:
                # Forecasting is supplementary; never let it kill ingestion.
                forecast_error = f"Forecast failed for {symbol}: {exc}"
                print(f"    {forecast_error}")
                all_errors.append(forecast_error)
                db.log_data_quality(run_id, stock_id, "FORECAST", "fail", str(exc)[:500])
            
            # Log success
            db.log_data_quality(run_id, stock_id, "PIPELINE", "pass", 
                               f"Processed {len(valid_records)} records, {len(metric_records)} metrics")
            stocks_processed += 1
            
        except Exception as e:
            error_msg = f"Error processing {symbol}: {str(e)}"
            print(f"    ERROR: {error_msg}")
            all_errors.append(error_msg)
            traceback.print_exc()
            # Continue to next stock - don't let one failure kill everything
    
    # Finalize pipeline run
    duration = round(time.time() - start_time, 2)
    status = "success" if stocks_processed == len(STOCKS) else "partial" if stocks_processed > 0 else "failed"
    errors_str = "; ".join(all_errors) if all_errors else None
    
    db.update_pipeline_run(run_id, status, stocks_processed, records_inserted, errors_str, duration)
    db.close()
    
    print(f"\n{'=' * 60}")
    print(f"[{datetime.now()}] Pipeline completed in {duration}s")
    print(f"Status: {status}")
    print(f"Stocks processed: {stocks_processed}/{len(STOCKS)}")
    print(f"Records inserted: {records_inserted}")

    if all_errors:
        print(f"Errors: {len(all_errors)}")
        for message in all_errors[:10]:
            print(f"  - {message}")
        if len(all_errors) > 10:
            print(f"  ... and {len(all_errors) - 10} more")

    return status == "success" or status == "partial"

if __name__ == "__main__":
    success = run_pipeline()
    sys.exit(0 if success else 1)