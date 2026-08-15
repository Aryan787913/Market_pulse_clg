import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { stocks, dailyPrices, stockMetrics } from "@/lib/db/schema";
import { eq, desc, gte } from "drizzle-orm";
import { formatCurrency, formatPercent, formatNumber, formatDate } from "@/lib/utils";
import { PriceChart } from "@/components/price-chart";
import { VolumeChart } from "@/components/volume-chart";
import { TrendingUp, TrendingDown, ArrowLeft, BarChart3, Activity, Calendar } from "lucide-react";
import Link from "next/link";
import { subDays } from "date-fns";

async function getStockData(symbol: string) {
  const stock = await db
    .select()
    .from(stocks)
    .where(eq(stocks.symbol, symbol.toUpperCase()))
    .limit(1);

  if (!stock.length) return null;

  const stockData = stock[0];
  const fromDate = subDays(new Date(), 90);

  const prices = await db
    .select()
    .from(dailyPrices)
    .where(eq(dailyPrices.stockId, stockData.stockId))
    .where(gte(dailyPrices.date, fromDate.toISOString().split("T")[0]))
    .orderBy(dailyPrices.date);

  const metrics = await db
    .select()
    .from(stockMetrics)
    .where(eq(stockMetrics.stockId, stockData.stockId))
    .where(gte(stockMetrics.date, fromDate.toISOString().split("T")[0]))
    .orderBy(stockMetrics.date);

  const latestPrice = prices[prices.length - 1] || null;
  const latestMetric = metrics[metrics.length - 1] || null;

  // Calculate 52-week high/low from all available data
  const allPrices = await db
    .select()
    .from(dailyPrices)
    .where(eq(dailyPrices.stockId, stockData.stockId))
    .orderBy(desc(dailyPrices.date));

  const high52w = allPrices.length > 0
    ? Math.max(...allPrices.map((p) => parseFloat(p.high)))
    : null;
  const low52w = allPrices.length > 0
    ? Math.min(...allPrices.map((p) => parseFloat(p.low)))
    : null;
  const avgVolume = allPrices.length > 0
    ? allPrices.reduce((sum, p) => sum + p.volume, 0) / allPrices.length
    : null;

  return {
    stock: stockData,
    prices,
    metrics,
    latestPrice,
    latestMetric,
    high52w,
    low52w,
    avgVolume,
    totalRecords: allPrices.length,
  };
}

export default async function StockDetailPage({ params }: { params: { symbol: string } }) {
  const data = await getStockData(params.symbol);

  if (!data) {
    notFound();
  }

  const { stock, prices, metrics, latestPrice, latestMetric, high52w, low52w, avgVolume } = data;
  const change = parseFloat(latestMetric?.percentChange || "0");
  const isPositive = change >= 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{stock.symbol}</h1>
            <p className="text-muted-foreground">{stock.companyName}</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-3xl font-bold">
              {formatCurrency(latestPrice?.close)}
            </p>
            <div className={`flex items-center gap-1 ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
              {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span className="font-medium">{formatPercent(change)}</span>
              <span className="text-muted-foreground text-sm">
                ({formatCurrency(latestMetric?.priceChange)})
              </span>
            </div>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {stock.sector && (
            <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
              {stock.sector}
            </span>
          )}
          {stock.exchange && (
            <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
              {stock.exchange}
            </span>
          )}
        </div>
      </div>

      {/* Price Chart */}
      <div className="mb-8 rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Price History (90 Days)</h2>
        {prices.length > 0 ? (
          <PriceChart prices={prices} metrics={metrics} />
        ) : (
          <p className="text-muted-foreground text-sm">No price history available.</p>
        )}
      </div>

      {/* Volume Chart */}
      <div className="mb-8 rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Trading Volume</h2>
        {prices.length > 0 ? (
          <VolumeChart prices={prices} />
        ) : (
          <p className="text-muted-foreground text-sm">No volume data available.</p>
        )}
      </div>

      {/* Key Metrics */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Key Metrics</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Open</p>
            <p className="text-lg font-semibold">{formatCurrency(latestPrice?.open)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">High</p>
            <p className="text-lg font-semibold">{formatCurrency(latestPrice?.high)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Low</p>
            <p className="text-lg font-semibold">{formatCurrency(latestPrice?.low)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Close</p>
            <p className="text-lg font-semibold">{formatCurrency(latestPrice?.close)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Volume</p>
            <p className="text-lg font-semibold">{formatNumber(latestPrice?.volume)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Daily Return</p>
            <p className={`text-lg font-semibold ${parseFloat(latestMetric?.dailyReturn || "0") >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {formatPercent(parseFloat(latestMetric?.dailyReturn || "0") * 100)}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">7-Day MA</p>
            <p className="text-lg font-semibold">{formatCurrency(latestMetric?.movingAvg7d)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">20-Day MA</p>
            <p className="text-lg font-semibold">{formatCurrency(latestMetric?.movingAvg20d)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Volatility</p>
            <p className="text-lg font-semibold">{latestMetric?.volatility ? `${(parseFloat(latestMetric.volatility) * 100).toFixed(2)}%` : "—"}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">52-Week High</p>
            <p className="text-lg font-semibold">{high52w ? formatCurrency(high52w) : "—"}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">52-Week Low</p>
            <p className="text-lg font-semibold">{low52w ? formatCurrency(low52w) : "—"}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Avg Volume</p>
            <p className="text-lg font-semibold">{avgVolume ? formatNumber(Math.round(avgVolume)) : "—"}</p>
          </div>
        </div>
      </div>

      {/* Data Source Info */}
      <div className="rounded-xl border bg-muted/30 p-4">
        <p className="text-xs text-muted-foreground">
          Data source: Yahoo Finance via yfinance. Last recorded date: {latestPrice ? formatDate(latestPrice.date) : "N/A"}.
          Historical data points: {prices.length} records.
        </p>
      </div>
    </div>
  );
}
