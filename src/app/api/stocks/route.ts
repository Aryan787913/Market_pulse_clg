import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stocks, dailyPrices, stockMetrics } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sector = searchParams.get("sector");
    const sortBy = searchParams.get("sortBy") || "symbol";
    const order = searchParams.get("order") || "asc";

    const allStocks = sector
      ? await db.select().from(stocks).where(eq(stocks.sector, sector))
      : await db.select().from(stocks);

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

    // Sort
    const sorted = stocksWithData.sort((a, b) => {
      let valA: any, valB: any;
      if (sortBy === "symbol") {
        valA = a.symbol;
        valB = b.symbol;
      } else if (sortBy === "price") {
        valA = parseFloat(a.latestPrice?.close || "0");
        valB = parseFloat(b.latestPrice?.close || "0");
      } else if (sortBy === "change") {
        valA = parseFloat(a.latestMetric?.percentChange || "0");
        valB = parseFloat(b.latestMetric?.percentChange || "0");
      } else if (sortBy === "volume") {
        valA = a.latestPrice?.volume || 0;
        valB = b.latestPrice?.volume || 0;
      } else {
        valA = a.symbol;
        valB = b.symbol;
      }

      if (typeof valA === "string") {
        return order === "desc" ? valB.localeCompare(valA) : valA.localeCompare(valB);
      }
      return order === "desc" ? valB - valA : valA - valB;
    });

    return NextResponse.json({ stocks: sorted });
  } catch (error) {
    console.error("Error fetching stocks:", error);
    return NextResponse.json(
      { error: "Failed to fetch stocks" },
      { status: 500 }
    );
  }
}
