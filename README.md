# MarketPulse - Automated Stock Market Data Pipeline & Analytics Dashboard

A full-stack final-year project that automates stock market data collection, validation, transformation, and visualization.

## Architecture

```
User Browser
     |
     v
  Vercel (Next.js 14)
     |
     v
  Supabase PostgreSQL
     ^
     |
GitHub Actions (Python + yfinance + statsmodels/XGBoost)
```

## Features

- Market dashboard with per-stock latest price, change and volume
- Per-stock detail pages with 90-day price/volume charts and key metrics
- Price forecasting using ARIMA and XGBoost, reported alongside walk-forward
  backtest error and a random-walk skill comparison
- Stock news page aggregating publisher RSS headlines, filterable by symbol
- Email/password and Google (OAuth) authentication via Supabase
- Watchlist for authenticated users


## Cost

The project is designed to operate at ₹0/month using free-tier/free services, subject to the providers' published usage limits.

| Service | Purpose | Cost |
|---------|---------|------|
| Vercel Hobby | Website hosting | ₹0 |
| Supabase Free | PostgreSQL + Auth | ₹0 (500MB DB, 2GB bandwidth) |
| GitHub Actions | Scheduled pipeline | ₹0 (2,000 min/month) |
| yfinance | Market data | ₹0 (rate-limited) |

## Prerequisites

- Node.js 18+
- Python 3.11+
- Supabase account (free)
- GitHub account

## Setup Instructions

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up
2. Create a new project
3. Open **SQL Editor** → **New Query**
4. Copy-paste the contents of `database/migrations/001_initial.sql`
5. Click **Run**
6. Repeat for `database/migrations/002_forecasting.sql` (forecast + evaluation tables)
7. Optional: run `database/migrations/003_bi_layer.sql` for the read-only BI
   role and analytics views (see "Connecting BI Tools" below). Edit the password
   in the file first.

### 2. Get Supabase Credentials

1. Go to **Project Settings → Database**
2. Copy the **Connection String** (pooled connection)
3. Go to **Project Settings → API**
4. Copy:
   - Project URL
   - `anon` public key
   - `service_role` key

### 3. Configure Environment Variables

Create a file named `.env.local` in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
DATABASE_URL=your-postgres-connection-string-here
```

### 4. Run the Data Pipeline (Populate Database)

```bash
cd pipeline
pip install -r requirements.txt
export DATABASE_URL="your-connection-string"
python main.py
```

This fetches real stock data for 12 Indian stocks and stores it in your database.

### 5. Run the Web App Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 6. Build for Production

```bash
npm run build
```

Fix any errors before deploying.

### 7. Deploy to Vercel

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) → Import GitHub repo
3. Add the same environment variables from `.env.local`
4. Deploy

### 8. Set Up Automated Pipeline

1. In your GitHub repo → **Settings → Secrets and variables → Actions**
2. Add secret: `DATABASE_URL` = your Supabase connection string
3. The pipeline runs automatically every weekday at 6:30 PM IST
4. You can also trigger manually from **Actions** tab

## Tracked Stocks

| Symbol | Company | Sector |
|--------|---------|--------|
| RELIANCE.NS | Reliance Industries | Conglomerate |
| TCS.NS | Tata Consultancy Services | Technology |
| INFY.NS | Infosys | Technology |
| HDFCBANK.NS | HDFC Bank | Financial Services |
| ICICIBANK.NS | ICICI Bank | Financial Services |
| SBIN.NS | State Bank of India | Financial Services |
| ITC.NS | ITC | Consumer Goods |
| LT.NS | Larsen & Toubro | Industrials |
| AXISBANK.NS | Axis Bank | Financial Services |
| BHARTIARTL.NS | Bharti Airtel | Telecommunications |
| HINDUNILVR.NS | Hindustan Unilever | Consumer Goods |
| KOTAKBANK.NS | Kotak Mahindra Bank | Financial Services |

## Metrics Calculated

- **Daily Return**: (Close_t - Close_t-1) / Close_t-1
- **7-Day Moving Average**: Simple average of last 7 closing prices
- **20-Day Moving Average**: Simple average of last 20 closing prices
- **Volatility**: Standard deviation of returns × √252 (annualized)
- **Price Change**: Close_t - Close_t-1
- **Percent Change**: (Price Change / Close_t-1) × 100

## Forecasting Models

Two standard models are fitted per stock on each pipeline run and forecast five
trading days ahead.

| Model | Approach |
|-------|----------|
| ARIMA | Fitted on log prices; `(p,d,q)` chosen by AIC over a small grid. Supplies 95% confidence intervals. |
| XGBoost | Gradient-boosted trees predicting next-day **return** from lagged returns, moving-average ratios, rolling volatility, RSI(14), a stochastic oscillator and volume ratios. |

Accuracy is measured with a walk-forward (expanding window) backtest over the
last 30 trading days, so every prediction scored is out-of-sample. Reported per
model: MAE, RMSE, MAPE and directional accuracy.

A **random-walk baseline** ("tomorrow equals today") is measured over the same
window. A model whose RMSE does not beat that baseline carries no predictive
information, and the UI labels it as such rather than hiding the result. On the
current 50-stock dataset ARIMA beats the random walk on about 36 of 50 stocks by a
narrow margin and XGBoost does not — which is the expected outcome for daily equity
prices and is presented honestly rather than tuned away.

The application shows numeric projections and error metrics only. It does not
produce buy/sell/hold signals or any form of investment recommendation.

## News Aggregation

`/news` pulls headlines from publisher RSS feeds and matches them to tracked
symbols by keyword. The tracked list is read from the `stocks` database table
(the single source of truth, also used by the pipeline), with a small
`EXTRA_ALIASES` map for well-known abbreviations (`RIL`, `HDFC Bank`, `Airtel`,
...). Only the title, source, timestamp and a link to the publisher are stored or
displayed; article bodies are never copied, and every headline links back to the
original site. Feeds are cached for 15 minutes.

## Connecting BI Tools (Excel / Power BI / Tableau)

Because the data lives in PostgreSQL, external BI tools can connect directly to
the same database and build dashboards alongside the web app. Run
`database/migrations/003_bi_layer.sql` first — it creates a read-only role
`bi_readonly` (no access to the `profiles`/`watchlist` PII tables) and flat,
ready-to-chart views.

**Connection settings** (use the IPv4 pooler in *session* mode, port 5432):

| Setting | Value |
|---------|-------|
| Host | `aws-0-<region>.pooler.supabase.com` |
| Port | `5432` (session mode; needed for BI tools' prepared statements) |
| Database | `postgres` |
| User | `bi_readonly.<project-ref>` |
| Password | the password you set in `003_bi_layer.sql` |
| SSL | required |

**Views provided:**

| View | Use |
|------|-----|
| `v_stock_daily` | One row per stock per day (prices + metrics) — main time-series fact table |
| `v_latest_snapshot` | Latest day per stock — KPI tiles / current price |
| `v_sector_performance` | Sector roll-up of the latest snapshot |
| `v_forecast` | Latest ARIMA + XGBoost forecasts per stock |
| `v_forecast_accuracy` | Backtest error per model, with a `beats_random_walk` flag |
| `v_pipeline_health` | Recent pipeline runs (data freshness) |

Use **Import** mode with a scheduled refresh rather than DirectQuery; the dataset
is small and this keeps the free-tier egress negligible. Power BI Service
scheduled refresh of PostgreSQL requires the on-premises data gateway (personal
mode); desktop refresh needs no gateway.

## Project Structure

```
marketpulse/
├── src/
│   ├── app/              # Next.js pages & API routes
│   │   ├── auth/callback # OAuth code exchange
│   │   └── news/         # Stock news page
│   ├── components/       # React components
│   ├── lib/
│   │   ├── db/          # Drizzle ORM schema
│   │   ├── supabase/    # Auth clients
│   │   └── news.ts      # RSS aggregation
│   ├── types/           # TypeScript types
│   └── middleware.ts    # Auth middleware
├── pipeline/
│   ├── main.py          # Orchestration
│   ├── forecast.py      # ARIMA + XGBoost models and backtests
│   ├── metrics.py       # Financial metrics
│   └── validator.py     # Data quality checks
├── database/            # SQL migrations
├── .github/workflows/   # GitHub Actions
└── README.md
```

## Troubleshooting

**Dashboard shows "No data yet"**
→ Run the Python pipeline to populate the database.

**Build fails with TypeScript errors**
→ Run `npx tsc --noEmit` to see the errors, and `npm run lint` for lint issues.

**Pipeline fails in GitHub Actions**
→ Check that `DATABASE_URL` secret is set correctly in GitHub.

**Supabase connection errors**
→ Use the **pooled connection string** (`*.pooler.supabase.com`), not the direct
`db.*.supabase.co` host, which is IPv6-only.

**"No forecast available yet" on a stock page**
→ Models need at least 60 trading days of history. Confirm
`002_forecasting.sql` has been run, then rerun the pipeline.

**Google login returns a redirect error**
→ Confirm the Supabase callback URL is listed as an authorised redirect URI in
the Google Cloud console, and that the site URL and redirect URLs are set in
Supabase → Authentication → URL Configuration.

## Student Information

- **Name**: Aaryan Singh
- **College**: Ramniranjan Jhunjhunwala College of Arts, Science & Commerce
- **Location**: Ghatkopar (W), Mumbai
- **Degree**: B.Sc. Computer Science
- **Academic Year**: 2026–2027
- **Guide**: Prof. Vinita Singh
