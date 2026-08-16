import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stocks, dailyPrices, stockMetrics, pipelineRuns } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

// Market data changes per pipeline run; never cache at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const allStocks = await db.select().from(stocks);
    const totalStocks = allStocks.length;

    // Latest price/metric per stock in two queries rather than 2N queries.
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

    // Top gainers (sorted by percent change desc)
    const topGainers = [...stocksWithData]
      .filter((s) => s.latestMetric && parseFloat(s.latestMetric.percentChange || "0") > 0)
      .sort((a, b) => parseFloat(b.latestMetric?.percentChange || "0") - parseFloat(a.latestMetric?.percentChange || "0"))
      .slice(0, 5);

    // Top losers (sorted by percent change asc)
    const topLosers = [...stocksWithData]
      .filter((s) => s.latestMetric && parseFloat(s.latestMetric.percentChange || "0") < 0)
      .sort((a, b) => parseFloat(a.latestMetric?.percentChange || "0") - parseFloat(b.latestMetric?.percentChange || "0"))
      .slice(0, 5);

    // Most active by volume
    const mostActive = [...stocksWithData]
      .filter((s) => s.latestPrice)
      .sort((a, b) => (b.latestPrice?.volume || 0) - (a.latestPrice?.volume || 0))
      .slice(0, 5);

    // Last pipeline run
    const lastRun = await db
      .select()
      .from(pipelineRuns)
      .orderBy(desc(pipelineRuns.runDate))
      .limit(1);

    return NextResponse.json({
      totalStocks,
      topGainers,
      topLosers,
      mostActive,
      lastUpdated: lastRun[0]?.runDate || null,
    });
  } catch (error) {
    console.error("Error fetching market summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch market summary" },
      { status: 500 }
    );
  }
}
