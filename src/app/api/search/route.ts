import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stocks, dailyPrices, stockMetrics } from "@/lib/db/schema";
import { eq, desc, sql, or, ilike } from "drizzle-orm";

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

    let conditions = [];

    if (query) {
      conditions.push(
        or(
          ilike(stocks.symbol, `%${query}%`),
          ilike(stocks.companyName, `%${query}%`)
        )
      );
    }

    if (sector) {
      conditions.push(sql`${stocks.sector} = ${sector}`);
    }

    let stockQuery = db.select().from(stocks);
    if (conditions.length > 0) {
      stockQuery = db.select().from(stocks).where(conditions[0]) as any;
      for (let i = 1; i < conditions.length; i++) {
        stockQuery = stockQuery.where(conditions[i]) as any;
      }
    }

    const results = await stockQuery;

    // Fetch latest data for filtering
    const stocksWithData = await Promise.all(
      results.map(async (stock) => {
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

    // Apply price and volume filters
    let filtered = stocksWithData;
    if (minPrice) {
      filtered = filtered.filter((s) => parseFloat(s.latestPrice?.close || "0") >= parseFloat(minPrice));
    }
    if (maxPrice) {
      filtered = filtered.filter((s) => parseFloat(s.latestPrice?.close || "0") <= parseFloat(maxPrice));
    }
    if (minVolume) {
      filtered = filtered.filter((s) => (s.latestPrice?.volume || 0) >= parseInt(minVolume));
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
