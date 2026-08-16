import { NextResponse } from "next/server";
import { getMarketNews, getNewsForSymbol, TRACKED_STOCKS } from "@/lib/news";

// Headlines are cached for 15 minutes at the fetch layer; the route itself is
// dynamic because it reads query params.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");
    const scope = searchParams.get("scope");

    if (symbol) {
      const known = TRACKED_STOCKS.some(
        (s) => s.symbol.toUpperCase() === symbol.toUpperCase()
      );
      if (!known) {
        return NextResponse.json(
          { error: "Unknown symbol" },
          { status: 404 }
        );
      }

      const articles = await getNewsForSymbol(symbol);
      return NextResponse.json({ symbol: symbol.toUpperCase(), articles });
    }

    // scope=tracked returns only stories mentioning a portfolio stock.
    const articles = await getMarketNews(scope === "tracked");
    return NextResponse.json({ articles });
  } catch (error) {
    console.error("Error fetching news:", error);
    return NextResponse.json(
      { error: "Failed to fetch news" },
      { status: 500 }
    );
  }
}
