import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stocks, dailyPrices, stockMetrics, pipelineRuns } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";

export async function GET() {
  try {
    const allStocks = await db.select().from(stocks);
    const totalStocks = allStocks.length;

    // Get latest prices and metrics for all stocks
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
