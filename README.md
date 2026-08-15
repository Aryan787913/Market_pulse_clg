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
GitHub Actions (Python + yfinance)
```

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

## Project Structure

```
marketpulse/
├── src/
│   ├── app/              # Next.js pages & API routes
│   ├── components/       # React components
│   ├── lib/
│   │   ├── db/          # Drizzle ORM schema
│   │   └── supabase/    # Auth clients
│   ├── types/           # TypeScript types
│   └── middleware.ts    # Auth middleware
├── pipeline/            # Python data pipeline
├── database/            # SQL migrations
├── .github/workflows/   # GitHub Actions
└── README.md
```

## Troubleshooting

**Dashboard shows "No data yet"**
→ Run the Python pipeline to populate the database.

**Build fails with TypeScript errors**
→ Run `npm run lint` and fix any issues.

**Pipeline fails in GitHub Actions**
→ Check that `DATABASE_URL` secret is set correctly in GitHub.

**Supabase connection errors**
→ Use the **pooled connection string** (not the direct one).

## Student Information

- **Name**: Aaryan Singh
- **College**: Ramniranjan Jhunjhunwala College of Arts, Science & Commerce
- **Location**: Ghatkopar (W), Mumbai
- **Degree**: B.Sc. Computer Science
- **Academic Year**: 2026–2027
- **Guide**: Prof. Vinita Singh
