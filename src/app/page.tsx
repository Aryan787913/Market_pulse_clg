import { db } from "@/lib/db";
import { stocks, dailyPrices, stockMetrics, pipelineRuns } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { StatsCard } from "@/components/stats-card";
import { StockTable } from "@/components/stock-table";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";

async function getMarketData() {
  const allStocks = await db.select().from(stocks);

  const stocksWithData = await Promise.all(
    allStocks.map(async (stock) => {
      const latestPrice = await db
        .select()
        .from(dailyPrices)
        .where(eq(dailyPrices.stockId, stock.stockId))
        .orderBy(desc(dailyPrices.date))
        .limit(1);

      const latestMetric = await db
        .select()
        .from(stockMetrics)
        .where(eq(stockMetrics.stockId, stock.stockId))
        .orderBy(desc(stockMetrics.date))
        .limit(1);

      return {
        ...stock,
        latestPrice: latestPrice[0] || null,
        latestMetric: latestMetric[0] || null,
      };
    })
  );

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

  const allPrices = await db.select().from(dailyPrices).orderBy(dailyPrices.date);
  const trendData = allPrices.slice(-30);

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
        {data.trendData.length > 0 ? (
          <div className="h-[250px]">
            <div className="flex items-end gap-1 h-full pb-8">
              {data.trendData.map((price, i) => {
                const height = Math.max(5, (parseFloat(price.close) / 5000) * 100);
                return (
                  <div
                    key={i}
                    className="flex-1 bg-primary/20 hover:bg-primary/40 transition-colors rounded-t"
                    style={{ height: `${height}%` }}
                    title={`${price.date}: ₹${parseFloat(price.close).toFixed(2)}`}
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