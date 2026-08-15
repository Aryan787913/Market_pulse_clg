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

    def get_or_create_stock(self, symbol, company_name, sector=None, exchange=None):
        """Get existing stock or create new one"""
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
        return self.cur.fetchone()[0]

    def insert_daily_prices_batch(self, records):
        """Batch insert daily prices"""
        if not records:
            return

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

    def insert_stock_metrics_batch(self, records):
        """Batch insert stock metrics"""
        if not records:
            return

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

    def log_pipeline_run(self, status, stocks_processed, records_inserted, records_updated, errors, duration_seconds):
        """Log pipeline execution"""
        self.cur.execute(
            """INSERT INTO pipeline_runs 
               (status, stocks_processed, records_inserted, records_updated, errors, duration_seconds)
               VALUES (%s, %s, %s, %s, %s, %s) RETURNING run_id""",
            (status, stocks_processed, records_inserted, records_updated, errors, duration_seconds)
        )
        self.conn.commit()
        return self.cur.fetchone()[0]

    def update_pipeline_run(self, run_id, status, stocks_processed, records_inserted, errors, duration_seconds):
        """Update pipeline run record"""
        self.cur.execute(
            """UPDATE pipeline_runs 
               SET status = %s, stocks_processed = %s, records_inserted = %s, 
                   errors = %s, duration_seconds = %s
               WHERE run_id = %s""",
            (status, stocks_processed, records_inserted, errors, duration_seconds, run_id)
        )
        self.conn.commit()

    def log_data_quality(self, run_id, stock_id, check_type, status, details):
        """Log data quality check result"""
        self.cur.execute(
            """INSERT INTO data_quality_results 
               (run_id, stock_id, check_type, status, details)
               VALUES (%s, %s, %s, %s, %s)""",
            (run_id, stock_id, check_type, status, details)
        )
        self.conn.commit()
