"""MarketPulse Pipeline Configuration"""
import os
from dotenv import load_dotenv

load_dotenv()

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "")

# Stock symbols to track (Indian stocks on NSE via Yahoo Finance)
STOCKS = [
    {"symbol": "RELIANCE.NS", "company_name": "Reliance Industries Ltd", "sector": "Conglomerate", "exchange": "NSE"},
    {"symbol": "TCS.NS", "company_name": "Tata Consultancy Services Ltd", "sector": "Technology", "exchange": "NSE"},
    {"symbol": "INFY.NS", "company_name": "Infosys Ltd", "sector": "Technology", "exchange": "NSE"},
    {"symbol": "HDFCBANK.NS", "company_name": "HDFC Bank Ltd", "sector": "Financial Services", "exchange": "NSE"},
    {"symbol": "ICICIBANK.NS", "company_name": "ICICI Bank Ltd", "sector": "Financial Services", "exchange": "NSE"},
    {"symbol": "SBIN.NS", "company_name": "State Bank of India", "sector": "Financial Services", "exchange": "NSE"},
    {"symbol": "ITC.NS", "company_name": "ITC Ltd", "sector": "Consumer Goods", "exchange": "NSE"},
    {"symbol": "LT.NS", "company_name": "Larsen & Toubro Ltd", "sector": "Industrials", "exchange": "NSE"},
    {"symbol": "AXISBANK.NS", "company_name": "Axis Bank Ltd", "sector": "Financial Services", "exchange": "NSE"},
    {"symbol": "BHARTIARTL.NS", "company_name": "Bharti Airtel Ltd", "sector": "Telecommunications", "exchange": "NSE"},
    {"symbol": "HINDUNILVR.NS", "company_name": "Hindustan Unilever Ltd", "sector": "Consumer Goods", "exchange": "NSE"},
    {"symbol": "KOTAKBANK.NS", "company_name": "Kotak Mahindra Bank Ltd", "sector": "Financial Services", "exchange": "NSE"},
]

# Data quality thresholds
MIN_PRICE = 0.01
MAX_PRICE = 1000000
MIN_VOLUME = 0
