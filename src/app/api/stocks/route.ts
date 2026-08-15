import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stocks, dailyPrices, stockMetrics } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sector = searchParams.get("sector");
    const sortBy = searchParams.get("sortBy") || "symbol";
    const order = searchParams.get("order") || "asc";

    let query = db.select().from(stocks);

    if (sector) {
      query = db.select().from(stocks).where(sql`${stocks.sector} = ${sector}`) as any;
    }

    const allStocks = await query;

    // Fetch latest price and metric for each stock
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
