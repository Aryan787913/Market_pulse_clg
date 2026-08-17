import { db } from "@/lib/db";
import { stocks, dailyPrices, stockMetrics, pipelineRuns } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";
import { StatsCard } from "@/components/stats-card";
import { StockTable } from "@/components/stock-table";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";

// The dashboard reads live data, so it must not be prerendered at build time.
export const dynamic = "force-dynamic";

async function getMarketData() {
  const allStocks = await db.select().from(stocks);

  // One query each for the latest price/metric row per stock instead of a
  // query per stock (the previous N+1 pattern issued 2 * N round trips).
  const latestPrices = await db
    .selectDistinctOn([dailyPrices.stockId])
    .from(dailyPrices)
    .orderBy(dailyPrices.stockId, desc(dailyPrices.date));

  const latestMetrics = await db
    .selectDistinctOn([stockMetrics.stockId])
    .from(stockMetrics)
    .orderBy(stockMetrics.stockId, desc(stockMetrics.date));

  const priceByStock = new Map(latestPrices.map((p) => [p.stockId, p]));
  const metricByStock = new Map(latestMetrics.map((m) => [m.stockId, m]));

  const stocksWithData = allStocks.map((stock) => ({
    ...stock,
    latestPrice: priceByStock.get(stock.stockId) ?? null,
    latestMetric: metricByStock.get(stock.stockId) ?? null,
  }));

  const topGainers = [...stocksWithData]
    .filter((s) => s.latestMetric && parseFloat(s.latestMetric.percentChange || "0") > 0)
    .sort((a, b) => parseFloat(b.latestMetric?.percentChange || "0") - parseFloat(a.latestMetric?.percentChange || "0"))
    .slice(0, 5);

  const topLosers = [...stocksWithData]
    .filter((s) => s.latestMetric && parseFloat(s.latestMetric.percentChange || "0") < 0)
    .sort((a, b) => parseFloat(a.latestMetric?.percentChange || "0") - parseFloat(b.latestMetric?.percentChange || "0"))
    .slice(0, 5);

  const lastRun = await db
    .select()
    .from(pipelineRuns)
    .orderBy(desc(pipelineRuns.runDate))
    .limit(1);

  // Equal-weighted average close per trading day for the last 30 sessions.
  // The old version sliced raw rows across every stock, which mixed unrelated
  // symbols into a single series.
  const trendRows = await db
    .select({
      date: dailyPrices.date,
      avgClose: sql<string>`avg(${dailyPrices.close})`,
      totalVolume: sql<string>`sum(${dailyPrices.volume})`,
    })
    .from(dailyPrices)
    .groupBy(dailyPrices.date)
    .orderBy(desc(dailyPrices.date))
    .limit(30);

  const trendData = trendRows
    .map((row) => ({
      date: row.date,
      avgClose: parseFloat(row.avgClose),
      totalVolume: Number(row.totalVolume),
    }))
    .reverse();

  return {
    totalStocks: allStocks.length,
    topGainers,
    topLosers,
    lastUpdated: lastRun[0]?.runDate || null,
    allStocks: stocksWithData,
    trendData,
  };
}

export default async function HomePage() {
  const data = await getMarketData();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Market Overview</h1>
        <p className="mt-1 text-muted-foreground">
          Real-time insights into the Indian stock market
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Prices refresh every weekday around 7:00 PM IST, after the NSE close.
          Weekends and market holidays show the last trading day.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatsCard
          title="Tracked Stocks"
          value={String(data.totalStocks)}
          subtitle="Active instruments"
          iconName="BarChart3"
        />
        <StatsCard
          title="Top Gainer"
          value={data.topGainers[0]?.symbol || "—"}
          change={data.topGainers[0]?.latestMetric?.percentChange ? parseFloat(data.topGainers[0].latestMetric.percentChange) : undefined}
          subtitle={data.topGainers[0]?.companyName}
          iconName="TrendingUp"
        />
        <StatsCard
          title="Top Loser"
          value={data.topLosers[0]?.symbol || "—"}
          change={data.topLosers[0]?.latestMetric?.percentChange ? parseFloat(data.topLosers[0].latestMetric.percentChange) : undefined}
          subtitle={data.topLosers[0]?.companyName}
          iconName="TrendingDown"
        />
        <StatsCard
          title="Last Updated"
          value={data.lastUpdated ? formatDateTime(data.lastUpdated).split(",")[0] : "—"}
          subtitle={data.lastUpdated ? formatDateTime(data.lastUpdated).split(",")[1]?.trim() : "No data yet"}
          iconName="Clock"
        />
      </div>

      <div className="mb-8 rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Market Activity</h2>
        <p className="-mt-3 mb-4 text-xs text-muted-foreground">
          Equal-weighted average closing price across all tracked stocks, last{" "}
          {data.trendData.length} trading sessions
        </p>
        {data.trendData.length > 0 ? (
          <div className="h-[250px]">
            <div className="flex items-end gap-1 h-full pb-8">
              {data.trendData.map((point) => {
                // Scale each bar relative to the observed range so the chart
                // stays readable regardless of absolute price levels.
                const values = data.trendData.map((d) => d.avgClose);
                const min = Math.min(...values);
                const max = Math.max(...values);
                const span = max - min || 1;
                const height = 20 + ((point.avgClose - min) / span) * 80;
                return (
                  <div
                    key={point.date}
                    className="flex-1 bg-primary/20 hover:bg-primary/40 transition-colors rounded-t"
                    style={{ height: `${height}%` }}
                    title={`${point.date}: ₹${point.avgClose.toFixed(2)} avg`}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No trend data available.</p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Top Gainers</h2>
          {data.topGainers.length > 0 ? (
            <div className="space-y-3">
              {data.topGainers.map((stock) => (
                <Link
                  key={stock.stockId}
                  href={`/stocks/${stock.symbol}`}
                  className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3 hover:bg-muted transition-colors"
                >
                  <div>
                    <p className="font-semibold">{stock.symbol}</p>
                    <p className="text-xs text-muted-foreground">{stock.companyName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">₹{parseFloat(stock.latestPrice?.close || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                    <p className="text-xs text-emerald-500 font-medium">
                      +{parseFloat(stock.latestMetric?.percentChange || "0").toFixed(2)}%
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No gainers data available.</p>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Top Losers</h2>
          {data.topLosers.length > 0 ? (
            <div className="space-y-3">
              {data.topLosers.map((stock) => (
                <Link
                  key={stock.stockId}
                  href={`/stocks/${stock.symbol}`}
                  className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3 hover:bg-muted transition-colors"
                >
                  <div>
                    <p className="font-semibold">{stock.symbol}</p>
                    <p className="text-xs text-muted-foreground">{stock.companyName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">₹{parseFloat(stock.latestPrice?.close || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                    <p className="text-xs text-red-500 font-medium">
                      {parseFloat(stock.latestMetric?.percentChange || "0").toFixed(2)}%
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No losers data available.</p>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">All Stocks</h2>
        <StockTable stocks={data.allStocks} />
      </div>
    </div>
  );
}