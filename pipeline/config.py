"""MarketPulse Pipeline Configuration"""
import os
from dotenv import load_dotenv

load_dotenv()

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "")

# Seconds to wait between Yahoo Finance requests. yfinance is an unofficial
# client with no published quota and it starts refusing requests when hit hard,
# so requests are spaced out deliberately.
FETCH_DELAY_SECONDS = float(os.getenv("FETCH_DELAY_SECONDS", "1.0"))

# Stock symbols to track (large-cap Indian stocks on NSE via Yahoo Finance).
# Sectors follow a consistent vocabulary because the search page filters on
# these exact strings.
STOCKS = [
    # Conglomerate
    {"symbol": "RELIANCE.NS", "company_name": "Reliance Industries Ltd", "sector": "Conglomerate", "exchange": "NSE"},
    {"symbol": "ADANIENT.NS", "company_name": "Adani Enterprises Ltd", "sector": "Conglomerate", "exchange": "NSE"},
    {"symbol": "GRASIM.NS", "company_name": "Grasim Industries Ltd", "sector": "Conglomerate", "exchange": "NSE"},

    # Technology
    {"symbol": "TCS.NS", "company_name": "Tata Consultancy Services Ltd", "sector": "Technology", "exchange": "NSE"},
    {"symbol": "INFY.NS", "company_name": "Infosys Ltd", "sector": "Technology", "exchange": "NSE"},
    {"symbol": "HCLTECH.NS", "company_name": "HCL Technologies Ltd", "sector": "Technology", "exchange": "NSE"},
    {"symbol": "WIPRO.NS", "company_name": "Wipro Ltd", "sector": "Technology", "exchange": "NSE"},
    {"symbol": "TECHM.NS", "company_name": "Tech Mahindra Ltd", "sector": "Technology", "exchange": "NSE"},
    # LTIM.NS no longer returns data from Yahoo Finance; Persistent Systems is
    # used in its place as another large-cap listed IT services name.
    {"symbol": "PERSISTENT.NS", "company_name": "Persistent Systems Ltd", "sector": "Technology", "exchange": "NSE"},

    # Financial Services
    {"symbol": "HDFCBANK.NS", "company_name": "HDFC Bank Ltd", "sector": "Financial Services", "exchange": "NSE"},
    {"symbol": "ICICIBANK.NS", "company_name": "ICICI Bank Ltd", "sector": "Financial Services", "exchange": "NSE"},
    {"symbol": "SBIN.NS", "company_name": "State Bank of India", "sector": "Financial Services", "exchange": "NSE"},
    {"symbol": "AXISBANK.NS", "company_name": "Axis Bank Ltd", "sector": "Financial Services", "exchange": "NSE"},
    {"symbol": "KOTAKBANK.NS", "company_name": "Kotak Mahindra Bank Ltd", "sector": "Financial Services", "exchange": "NSE"},
    {"symbol": "BAJFINANCE.NS", "company_name": "Bajaj Finance Ltd", "sector": "Financial Services", "exchange": "NSE"},
    {"symbol": "BAJAJFINSV.NS", "company_name": "Bajaj Finserv Ltd", "sector": "Financial Services", "exchange": "NSE"},
    {"symbol": "INDUSINDBK.NS", "company_name": "IndusInd Bank Ltd", "sector": "Financial Services", "exchange": "NSE"},
    {"symbol": "SBILIFE.NS", "company_name": "SBI Life Insurance Company Ltd", "sector": "Financial Services", "exchange": "NSE"},
    {"symbol": "HDFCLIFE.NS", "company_name": "HDFC Life Insurance Company Ltd", "sector": "Financial Services", "exchange": "NSE"},
    {"symbol": "SHRIRAMFIN.NS", "company_name": "Shriram Finance Ltd", "sector": "Financial Services", "exchange": "NSE"},

    # Consumer Goods
    {"symbol": "ITC.NS", "company_name": "ITC Ltd", "sector": "Consumer Goods", "exchange": "NSE"},
    {"symbol": "HINDUNILVR.NS", "company_name": "Hindustan Unilever Ltd", "sector": "Consumer Goods", "exchange": "NSE"},
    {"symbol": "NESTLEIND.NS", "company_name": "Nestle India Ltd", "sector": "Consumer Goods", "exchange": "NSE"},
    {"symbol": "BRITANNIA.NS", "company_name": "Britannia Industries Ltd", "sector": "Consumer Goods", "exchange": "NSE"},
    {"symbol": "TATACONSUM.NS", "company_name": "Tata Consumer Products Ltd", "sector": "Consumer Goods", "exchange": "NSE"},
    {"symbol": "TITAN.NS", "company_name": "Titan Company Ltd", "sector": "Consumer Goods", "exchange": "NSE"},
    {"symbol": "ASIANPAINT.NS", "company_name": "Asian Paints Ltd", "sector": "Consumer Goods", "exchange": "NSE"},

    # Automobile
    {"symbol": "MARUTI.NS", "company_name": "Maruti Suzuki India Ltd", "sector": "Automobile", "exchange": "NSE"},
    # Tata Motors demerged; the passenger-vehicle entity now carries the
    # TMPV.NS ticker and TATAMOTORS.NS returns no data.
    {"symbol": "TMPV.NS", "company_name": "Tata Motors Passenger Vehicles Ltd", "sector": "Automobile", "exchange": "NSE"},
    {"symbol": "M&M.NS", "company_name": "Mahindra & Mahindra Ltd", "sector": "Automobile", "exchange": "NSE"},
    {"symbol": "BAJAJ-AUTO.NS", "company_name": "Bajaj Auto Ltd", "sector": "Automobile", "exchange": "NSE"},
    {"symbol": "HEROMOTOCO.NS", "company_name": "Hero MotoCorp Ltd", "sector": "Automobile", "exchange": "NSE"},
    {"symbol": "EICHERMOT.NS", "company_name": "Eicher Motors Ltd", "sector": "Automobile", "exchange": "NSE"},

    # Pharmaceuticals
    {"symbol": "SUNPHARMA.NS", "company_name": "Sun Pharmaceutical Industries Ltd", "sector": "Pharmaceuticals", "exchange": "NSE"},
    {"symbol": "DRREDDY.NS", "company_name": "Dr Reddys Laboratories Ltd", "sector": "Pharmaceuticals", "exchange": "NSE"},
    {"symbol": "CIPLA.NS", "company_name": "Cipla Ltd", "sector": "Pharmaceuticals", "exchange": "NSE"},
    {"symbol": "DIVISLAB.NS", "company_name": "Divis Laboratories Ltd", "sector": "Pharmaceuticals", "exchange": "NSE"},
    {"symbol": "APOLLOHOSP.NS", "company_name": "Apollo Hospitals Enterprise Ltd", "sector": "Pharmaceuticals", "exchange": "NSE"},

    # Energy
    {"symbol": "NTPC.NS", "company_name": "NTPC Ltd", "sector": "Energy", "exchange": "NSE"},
    {"symbol": "POWERGRID.NS", "company_name": "Power Grid Corporation of India Ltd", "sector": "Energy", "exchange": "NSE"},
    {"symbol": "ONGC.NS", "company_name": "Oil & Natural Gas Corporation Ltd", "sector": "Energy", "exchange": "NSE"},
    {"symbol": "COALINDIA.NS", "company_name": "Coal India Ltd", "sector": "Energy", "exchange": "NSE"},
    {"symbol": "BPCL.NS", "company_name": "Bharat Petroleum Corporation Ltd", "sector": "Energy", "exchange": "NSE"},

    # Metals & Mining
    {"symbol": "TATASTEEL.NS", "company_name": "Tata Steel Ltd", "sector": "Metals & Mining", "exchange": "NSE"},
    {"symbol": "JSWSTEEL.NS", "company_name": "JSW Steel Ltd", "sector": "Metals & Mining", "exchange": "NSE"},
    {"symbol": "HINDALCO.NS", "company_name": "Hindalco Industries Ltd", "sector": "Metals & Mining", "exchange": "NSE"},

    # Industrials
    {"symbol": "LT.NS", "company_name": "Larsen & Toubro Ltd", "sector": "Industrials", "exchange": "NSE"},
    {"symbol": "ULTRACEMCO.NS", "company_name": "UltraTech Cement Ltd", "sector": "Industrials", "exchange": "NSE"},
    {"symbol": "ADANIPORTS.NS", "company_name": "Adani Ports and SEZ Ltd", "sector": "Industrials", "exchange": "NSE"},

    # Telecommunications
    {"symbol": "BHARTIARTL.NS", "company_name": "Bharti Airtel Ltd", "sector": "Telecommunications", "exchange": "NSE"},
]

# Data quality thresholds
MIN_PRICE = 0.01
MAX_PRICE = 1000000
MIN_VOLUME = 0
