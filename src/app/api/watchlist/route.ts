import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { watchlist, stocks, dailyPrices, stockMetrics } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const items = await db
      .select()
      .from(watchlist)
      .where(eq(watchlist.userId, user.id));

    const watchlistWithData = await Promise.all(
      items.map(async (item) => {
        const stockData = await db
          .select()
          .from(stocks)
          .where(eq(stocks.stockId, item.stockId))
          .limit(1);

        const latestPrice = await db
          .select()
          .from(dailyPrices)
          .where(eq(dailyPrices.stockId, item.stockId))
          .orderBy(desc(dailyPrices.date))
          .limit(1);

        const latestMetric = await db
          .select()
          .from(stockMetrics)
          .where(eq(stockMetrics.stockId, item.stockId))
          .orderBy(desc(stockMetrics.date))
          .limit(1);

        return {
          ...item,
          stock: stockData[0] || null,
          latestPrice: latestPrice[0] || null,
          latestMetric: latestMetric[0] || null,
        };
      })
    );

    return NextResponse.json({ watchlist: watchlistWithData });
  } catch (error) {
    console.error("Error fetching watchlist:", error);
    return NextResponse.json(
      { error: "Failed to fetch watchlist" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { stockId } = body;

    if (!stockId) {
      return NextResponse.json(
        { error: "Stock ID is required" },
        { status: 400 }
      );
    }

    const existing = await db
      .select()
      .from(watchlist)
      .where(eq(watchlist.userId, user.id))
      .where(eq(watchlist.stockId, stockId));

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Stock already in watchlist" },
        { status: 409 }
      );
    }

    const result = await db
      .insert(watchlist)
      .values({
        userId: user.id,
        stockId,
      })
      .returning();

    return NextResponse.json({ watchlist: result[0] });
  } catch (error) {
    console.error("Error adding to watchlist:", error);
    return NextResponse.json(
      { error: "Failed to add to watchlist" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const stockId = searchParams.get("stockId");

    if (!stockId) {
      return NextResponse.json(
        { error: "Stock ID is required" },
        { status: 400 }
      );
    }

    await db
      .delete(watchlist)
      .where(eq(watchlist.userId, user.id))
      .where(eq(watchlist.stockId, parseInt(stockId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing from watchlist:", error);
    return NextResponse.json(
      { error: "Failed to remove from watchlist" },
      { status: 500 }
    );
  }
}
