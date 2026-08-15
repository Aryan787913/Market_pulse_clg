import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stocks, dailyPrices, stockMetrics } from "@/lib/db/schema";
import { eq, desc, gte } from "drizzle-orm";
import { subDays } from "date-fns";

export async function GET(
  request: Request,
  { params }: { params: { symbol: string } }
) {
  try {
    const symbol = params.symbol.toUpperCase();
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "90");

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
    const fromDate = subDays(new Date(), days);

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

    return NextResponse.json({
      stock: stockData,
      prices,
      metrics,
    });
  } catch (error) {
    console.error("Error fetching history:", error);
    return NextResponse.json(
      { error: "Failed to fetch historical data" },
      { status: 500 }
    );
  }
}
