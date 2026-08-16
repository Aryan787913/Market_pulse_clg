import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stocks, dailyPrices, stockMetrics } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { symbol: string } }
) {
  try {
    const symbol = params.symbol.toUpperCase();

    const stock = await db
      .select()
      .from(stocks)
      .where(eq(stocks.symbol, symbol))
      .limit(1);

    if (!stock.length) {
      return NextResponse.json(
        { error: "Stock not found" },
        { status: 404 }
      );
    }

    const stockData = stock[0];

    const latestPrice = await db
      .select()
      .from(dailyPrices)
      .where(eq(dailyPrices.stockId, stockData.stockId))
      .orderBy(desc(dailyPrices.date))
      .limit(1);

    const latestMetric = await db
      .select()
      .from(stockMetrics)
      .where(eq(stockMetrics.stockId, stockData.stockId))
      .orderBy(desc(stockMetrics.date))
      .limit(1);

    return NextResponse.json({
      stock: stockData,
      latestPrice: latestPrice[0] || null,
      latestMetric: latestMetric[0] || null,
    });
  } catch (error) {
    console.error("Error fetching stock:", error);
    return NextResponse.json(
      { error: "Failed to fetch stock details" },
      { status: 500 }
    );
  }
}
