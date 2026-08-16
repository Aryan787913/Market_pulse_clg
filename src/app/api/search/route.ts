import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stocks, dailyPrices, stockMetrics } from "@/lib/db/schema";
import { and, desc, eq, or, ilike, type SQL } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const sector = searchParams.get("sector");
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const minVolume = searchParams.get("minVolume");

    if (!query && !sector && !minPrice && !maxPrice && !minVolume) {
      return NextResponse.json({ stocks: [] });
    }

    const conditions: SQL[] = [];

    if (query) {
      const clause = or(
        ilike(stocks.symbol, `%${query}%`),
        ilike(stocks.companyName, `%${query}%`)
      );
      if (clause) conditions.push(clause);
    }

    if (sector) {
      conditions.push(eq(stocks.sector, sector));
    }

    const results = conditions.length > 0
      ? await db.select().from(stocks).where(and(...conditions))
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

    const stocksWithData = results.map((stock) => ({
      ...stock,
      latestPrice: priceByStock.get(stock.stockId) ?? null,
      latestMetric: metricByStock.get(stock.stockId) ?? null,
    }));

    // Apply price and volume filters
    let filtered = stocksWithData;
    if (minPrice) {
      const min = parseFloat(minPrice);
      if (Number.isFinite(min)) {
        filtered = filtered.filter((s) => parseFloat(s.latestPrice?.close || "0") >= min);
      }
    }
    if (maxPrice) {
      const max = parseFloat(maxPrice);
      if (Number.isFinite(max)) {
        filtered = filtered.filter((s) => parseFloat(s.latestPrice?.close || "0") <= max);
      }
    }
    if (minVolume) {
      const min = parseInt(minVolume, 10);
      if (Number.isFinite(min)) {
        filtered = filtered.filter((s) => (s.latestPrice?.volume || 0) >= min);
      }
    }

    return NextResponse.json({ stocks: filtered });
  } catch (error) {
    console.error("Error searching stocks:", error);
    return NextResponse.json(
      { error: "Failed to search stocks" },
      { status: 500 }
    );
  }
}
