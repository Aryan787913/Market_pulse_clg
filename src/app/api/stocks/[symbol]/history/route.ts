import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stocks, dailyPrices, stockMetrics } from "@/lib/db/schema";
import { and, eq, gte } from "drizzle-orm";
import { subDays } from "date-fns";

export const dynamic = "force-dynamic";

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
    const fromDateStr = fromDate.toISOString().split("T")[0]!;

    const prices = await db
      .select()
      .from(dailyPrices)
      .where(
        and(
          eq(dailyPrices.stockId, stockData.stockId),
          gte(dailyPrices.date, fromDateStr)
        )
      )
      .orderBy(dailyPrices.date);

    const metrics = await db
      .select()
      .from(stockMetrics)
      .where(
        and(
          eq(stockMetrics.stockId, stockData.stockId),
          gte(stockMetrics.date, fromDateStr)
        )
      )
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
