import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { watchlist, stocks, dailyPrices, stockMetrics } from "@/lib/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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

    if (items.length === 0) {
      return NextResponse.json({ watchlist: [] });
    }

    const stockIds = items.map((item) => item.stockId);

    // Resolve stock rows and their latest price/metric in three queries.
    const stockRows = await db
      .select()
      .from(stocks)
      .where(inArray(stocks.stockId, stockIds));

    const latestPrices = await db
      .selectDistinctOn([dailyPrices.stockId])
      .from(dailyPrices)
      .where(inArray(dailyPrices.stockId, stockIds))
      .orderBy(dailyPrices.stockId, desc(dailyPrices.date));

    const latestMetrics = await db
      .selectDistinctOn([stockMetrics.stockId])
      .from(stockMetrics)
      .where(inArray(stockMetrics.stockId, stockIds))
      .orderBy(stockMetrics.stockId, desc(stockMetrics.date));

    const stockById = new Map(stockRows.map((s) => [s.stockId, s]));
    const priceByStock = new Map(latestPrices.map((p) => [p.stockId, p]));
    const metricByStock = new Map(latestMetrics.map((m) => [m.stockId, m]));

    const watchlistWithData = items.map((item) => ({
      ...item,
      stock: stockById.get(item.stockId) ?? null,
      latestPrice: priceByStock.get(item.stockId) ?? null,
      latestMetric: metricByStock.get(item.stockId) ?? null,
    }));

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
    const stockId = Number(body?.stockId);

    if (!Number.isInteger(stockId) || stockId <= 0) {
      return NextResponse.json(
        { error: "A valid stock ID is required" },
        { status: 400 }
      );
    }

    const existing = await db
      .select()
      .from(watchlist)
      .where(
        and(
          eq(watchlist.userId, user.id),
          eq(watchlist.stockId, stockId)
        )
      );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Stock already in watchlist" },
        { status: 409 }
      );
    }

    // Reject unknown stock IDs up front so the FK violation never surfaces
    // as an opaque 500.
    const stockExists = await db
      .select({ stockId: stocks.stockId })
      .from(stocks)
      .where(eq(stocks.stockId, stockId))
      .limit(1);

    if (stockExists.length === 0) {
      return NextResponse.json(
        { error: "Stock not found" },
        { status: 404 }
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
    const stockIdParam = searchParams.get("stockId");
    const stockId = Number(stockIdParam);

    if (!stockIdParam || !Number.isInteger(stockId) || stockId <= 0) {
      return NextResponse.json(
        { error: "A valid stock ID is required" },
        { status: 400 }
      );
    }

    await db
      .delete(watchlist)
      .where(
        and(
          eq(watchlist.userId, user.id),
          eq(watchlist.stockId, stockId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing from watchlist:", error);
    return NextResponse.json(
      { error: "Failed to remove from watchlist" },
      { status: 500 }
    );
  }
}
