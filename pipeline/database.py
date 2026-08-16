"""Database connection and operations for MarketPulse pipeline"""
import psycopg2
from psycopg2.extras import execute_values
import os

DATABASE_URL = os.getenv("DATABASE_URL", "")

def get_connection():
    """Create a database connection with SSL"""
    return psycopg2.connect(DATABASE_URL, sslmode="require")

class Database:
    """Database wrapper with persistent connection and batch operations"""
    
    def __init__(self):
        self.conn = get_connection()
        self.cur = self.conn.cursor()
    
    def close(self):
        self.cur.close()
        self.conn.close()
    
    def rollback(self):
        """Rollback current transaction after error"""
        self.conn.rollback()
    
    def get_or_create_stock(self, symbol, company_name, sector=None, exchange=None):
        """Get existing stock or create new one"""
        try:
            self.cur.execute(
                "SELECT stock_id FROM stocks WHERE symbol = %s",
                (symbol,)
            )
            result = self.cur.fetchone()
            if result:
                return result[0]
            
            self.cur.execute(
                """INSERT INTO stocks (symbol, company_name, sector, exchange) 
                   VALUES (%s, %s, %s, %s) RETURNING stock_id""",
                (symbol, company_name, sector, exchange)
            )
            self.conn.commit()
            return self.cur.fetchone()[0]
        except Exception as e:
            self.rollback()
            raise e
    
    def insert_daily_prices_batch(self, records):
        """Batch insert daily prices"""
        if not records:
            return
        try:
            execute_values(
                self.cur,
                """INSERT INTO daily_prices 
                   (stock_id, date, open, high, low, close, adjusted_close, volume)
                   VALUES %s
                   ON CONFLICT (stock_id, date) 
                   DO UPDATE SET 
                       open = EXCLUDED.open,
                       high = EXCLUDED.high,
                       low = EXCLUDED.low,
                       close = EXCLUDED.close,
                       adjusted_close = EXCLUDED.adjusted_close,
                       volume = EXCLUDED.volume
                """,
                records
            )
            self.conn.commit()
        except Exception as e:
            self.rollback()
            raise e
    
    def insert_stock_metrics_batch(self, records):
        """Batch insert stock metrics"""
        if not records:
            return
        try:
            execute_values(
                self.cur,
                """INSERT INTO stock_metrics 
                   (stock_id, date, daily_return, moving_avg_7d, moving_avg_20d, 
                    volatility, price_change, percent_change)
                   VALUES %s
                   ON CONFLICT (stock_id, date) 
                   DO UPDATE SET 
                       daily_return = EXCLUDED.daily_return,
                       moving_avg_7d = EXCLUDED.moving_avg_7d,
                       moving_avg_20d = EXCLUDED.moving_avg_20d,
                       volatility = EXCLUDED.volatility,
                       price_change = EXCLUDED.price_change,
                       percent_change = EXCLUDED.percent_change
                """,
                records
            )
            self.conn.commit()
        except Exception as e:
            self.rollback()
            raise e
    
    def log_pipeline_run(self, status, stocks_processed, records_inserted, records_updated, errors, duration_seconds):
        """Log pipeline execution"""
        try:
            self.cur.execute(
                """INSERT INTO pipeline_runs 
                   (status, stocks_processed, records_inserted, records_updated, errors, duration_seconds)
                   VALUES (%s, %s, %s, %s, %s, %s) RETURNING run_id""",
                (status, stocks_processed, records_inserted, records_updated, errors, duration_seconds)
            )
            self.conn.commit()
            return self.cur.fetchone()[0]
        except Exception as e:
            self.rollback()
            raise e
    
    def update_pipeline_run(self, run_id, status, stocks_processed, records_inserted, errors, duration_seconds):
        """Update pipeline run record"""
        try:
            self.cur.execute(
                """UPDATE pipeline_runs 
                   SET status = %s, stocks_processed = %s, records_inserted = %s, 
                       errors = %s, duration_seconds = %s
                   WHERE run_id = %s""",
                (status, stocks_processed, records_inserted, errors, duration_seconds, run_id)
            )
            self.conn.commit()
        except Exception as e:
            self.rollback()
            raise e
    
    def log_data_quality(self, run_id, stock_id, check_type, status, details):
        """Log data quality check result"""
        try:
            self.cur.execute(
                """INSERT INTO data_quality_results 
                   (run_id, stock_id, check_type, status, details)
                   VALUES (%s, %s, %s, %s, %s)""",
                (run_id, stock_id, check_type, status, details)
            )
            self.conn.commit()
        except Exception as e:
            self.rollback()
            # Don't raise - data quality logging should not break the pipeline

    def insert_forecasts_batch(self, records):
        """Batch insert model forecasts.

        Records are (stock_id, model_name, trained_on, target_date, horizon,
        predicted_close, lower_bound, upper_bound).
        """
        if not records:
            return
        try:
            execute_values(
                self.cur,
                """INSERT INTO stock_forecasts
                   (stock_id, model_name, trained_on, target_date, horizon,
                    predicted_close, lower_bound, upper_bound)
                   VALUES %s
                   ON CONFLICT (stock_id, model_name, trained_on, target_date)
                   DO UPDATE SET
                       horizon = EXCLUDED.horizon,
                       predicted_close = EXCLUDED.predicted_close,
                       lower_bound = EXCLUDED.lower_bound,
                       upper_bound = EXCLUDED.upper_bound
                """,
                records
            )
            self.conn.commit()
        except Exception as e:
            self.rollback()
            raise e

    def insert_evaluations_batch(self, records):
        """Batch insert walk-forward backtest metrics.

        Records are (stock_id, model_name, trained_on, train_size, test_size,
        mae, rmse, mape, directional_accuracy, naive_rmse, params).
        """
        if not records:
            return
        try:
            execute_values(
                self.cur,
                """INSERT INTO model_evaluations
                   (stock_id, model_name, trained_on, train_size, test_size,
                    mae, rmse, mape, directional_accuracy, naive_rmse, params)
                   VALUES %s
                   ON CONFLICT (stock_id, model_name, trained_on)
                   DO UPDATE SET
                       train_size = EXCLUDED.train_size,
                       test_size = EXCLUDED.test_size,
                       mae = EXCLUDED.mae,
                       rmse = EXCLUDED.rmse,
                       mape = EXCLUDED.mape,
                       directional_accuracy = EXCLUDED.directional_accuracy,
                       naive_rmse = EXCLUDED.naive_rmse,
                       params = EXCLUDED.params
                """,
                records
            )
            self.conn.commit()
        except Exception as e:
            self.rollback()
            raise e

    def prune_old_forecasts(self, stock_id, keep_trained_on):
        """Drop superseded forecast runs so the table does not grow unbounded."""
        try:
            self.cur.execute(
                "DELETE FROM stock_forecasts WHERE stock_id = %s AND trained_on < %s",
                (stock_id, keep_trained_on)
            )
            self.conn.commit()
        except Exception:
            self.rollback()