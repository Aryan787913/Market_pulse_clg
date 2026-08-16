import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stocks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getMarketNews, getNewsForSymbol } from "@/lib/news";

// Headlines are cached for 15 minutes at the fetch layer; the route itself is
// dynamic because it reads query params.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");
    const scope = searchParams.get("scope");

    if (symbol) {
      // Only serve news for stocks the pipeline actually tracks.
      const [match] = await db
        .select({ symbol: stocks.symbol, company: stocks.companyName })
        .from(stocks)
        .where(eq(stocks.symbol, symbol.toUpperCase()))
        .limit(1);

      if (!match) {
        return NextResponse.json({ error: "Unknown symbol" }, { status: 404 });
      }

      const articles = await getNewsForSymbol(match.symbol, match.company);
      return NextResponse.json({ symbol: match.symbol, articles });
    }

    const tracked = await db
      .select({ symbol: stocks.symbol, company: stocks.companyName })
      .from(stocks);

    // scope=tracked returns only stories mentioning a tracked stock.
    const articles = await getMarketNews(tracked, scope === "tracked");
    return NextResponse.json({ articles });
  } catch (error) {
    console.error("Error fetching news:", error);
    return NextResponse.json(
      { error: "Failed to fetch news" },
      { status: 500 }
    );
  }
}
