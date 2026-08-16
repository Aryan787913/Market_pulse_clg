import { getMarketNews, TRACKED_STOCKS } from "@/lib/news";
import { NewsList } from "@/components/news-list";
import { Newspaper } from "lucide-react";

// Headlines are fetched server-side and cached for 15 minutes.
export const revalidate = 900;

export const metadata = {
  title: "Stock News - MarketPulse",
  description: "Latest headlines for tracked Indian stocks",
};

export default async function NewsPage() {
  // Market-wide feed, tagged with any tracked symbol mentioned in the headline.
  const articles = await getMarketNews(false);
  const tagged = articles.filter((article) => article.symbols.length > 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Stock News</h1>
        <p className="mt-1 text-muted-foreground">
          Headlines for the 12 tracked NSE stocks, refreshed every 15 minutes
        </p>
      </div>

      {articles.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <Newspaper className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <h2 className="font-semibold mb-1">Headlines unavailable</h2>
          <p className="text-sm text-muted-foreground">
            The news feed could not be reached. This is usually temporary.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            {tagged.length} of {articles.length} headlines mention a tracked stock.
          </p>
          <NewsList
            articles={articles}
            symbols={TRACKED_STOCKS.map(({ symbol, company }) => ({ symbol, company }))}
          />
        </>
      )}

      <div className="mt-8 rounded-xl border bg-muted/30 p-4">
        <p className="text-xs text-muted-foreground">
          Headlines are aggregated from publisher RSS feeds. Only titles, sources
          and links are shown; every link opens the original article on the
          publisher&apos;s own site. MarketPulse does not host or reproduce
          article content, and nothing here is investment advice.
        </p>
      </div>
    </div>
  );
}
