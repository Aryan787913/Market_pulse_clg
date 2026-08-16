import { NewsArticle } from "@/types";

/**
 * Stock news aggregation.
 *
 * Headlines are read from publisher-provided RSS feeds and only the title,
 * source, timestamp and a link back to the publisher are stored or shown.
 * Article bodies are never copied, so readers always click through to the
 * original site. Nothing here bypasses a paywall or a robots directive.
 */

/** Symbols the pipeline tracks, with the search terms that surface their news. */
export const TRACKED_STOCKS: Array<{
  symbol: string;
  company: string;
  /** Extra terms used for keyword matching, beyond the company name. */
  aliases: string[];
}> = [
  { symbol: "RELIANCE.NS", company: "Reliance Industries", aliases: ["Reliance", "RIL"] },
  { symbol: "TCS.NS", company: "Tata Consultancy Services", aliases: ["TCS"] },
  { symbol: "INFY.NS", company: "Infosys", aliases: ["Infosys"] },
  { symbol: "HDFCBANK.NS", company: "HDFC Bank", aliases: ["HDFC Bank", "HDFC"] },
  { symbol: "ICICIBANK.NS", company: "ICICI Bank", aliases: ["ICICI"] },
  { symbol: "SBIN.NS", company: "State Bank of India", aliases: ["SBI", "State Bank"] },
  { symbol: "ITC.NS", company: "ITC", aliases: ["ITC"] },
  { symbol: "LT.NS", company: "Larsen & Toubro", aliases: ["Larsen", "L&T"] },
  { symbol: "AXISBANK.NS", company: "Axis Bank", aliases: ["Axis Bank"] },
  { symbol: "BHARTIARTL.NS", company: "Bharti Airtel", aliases: ["Airtel", "Bharti"] },
  { symbol: "HINDUNILVR.NS", company: "Hindustan Unilever", aliases: ["Hindustan Unilever", "HUL"] },
  { symbol: "KOTAKBANK.NS", company: "Kotak Mahindra Bank", aliases: ["Kotak"] },
];

/** Indian market news feeds, used for the "all stocks" view. */
const MARKET_FEEDS = [
  {
    url: "https://news.google.com/rss/search?q=NSE+OR+Sensex+OR+Nifty+stock+market+India+when:3d&hl=en-IN&gl=IN&ceid=IN:en",
    label: "Google News",
  },
];

function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    // Ampersand last so the replacements above are not corrupted.
    .replace(/&amp;/g, "&")
    .trim();
}

function tagContent(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match?.[1] ? decodeEntities(match[1]) : null;
}

/**
 * Strip HTML tags from a title. Google News titles are plain text, but other
 * feeds occasionally embed markup, and this text is rendered as-is in React.
 */
function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

function parseRss(xml: string, fallbackSource: string): NewsArticle[] {
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];

  return items.flatMap((block) => {
    const rawTitle = tagContent(block, "title");
    const link = tagContent(block, "link");
    if (!rawTitle || !link) return [];

    // Google News appends " - Publisher" to titles; split it out for display.
    const title = stripTags(rawTitle);
    const separator = title.lastIndexOf(" - ");
    const publisher =
      tagContent(block, "source") ??
      (separator > 20 ? title.slice(separator + 3) : null);

    const pubDate = tagContent(block, "pubDate");
    const published = pubDate ? new Date(pubDate) : null;

    return [{
      title: separator > 20 && publisher ? title.slice(0, separator) : title,
      link,
      source: publisher || fallbackSource,
      publishedAt:
        published && !Number.isNaN(published.getTime())
          ? published.toISOString()
          : null,
      symbols: [],
    }];
  });
}

async function fetchFeed(url: string, label: string): Promise<NewsArticle[]> {
  try {
    const response = await fetch(url, {
      headers: {
        // Some feed hosts reject requests without a descriptive agent.
        "User-Agent": "MarketPulse/1.0 (academic project; news aggregator)",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
      // Cache at the edge so repeated page views do not hammer the publisher.
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return [];
    return parseRss(await response.text(), label);
  } catch {
    // A single dead feed must not break the page.
    return [];
  }
}

/** Tag an article with any tracked symbols mentioned in its title. */
function matchSymbols(article: NewsArticle): string[] {
  const haystack = article.title.toLowerCase();
  return TRACKED_STOCKS.filter(({ company, aliases }) =>
    [company, ...aliases].some((term) => {
      const needle = term.toLowerCase();
      // Word-boundary match so "ITC" does not match "switch".
      return new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(haystack);
    })
  ).map((stock) => stock.symbol);
}

function dedupeAndSort(articles: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>();
  const unique: NewsArticle[] = [];

  for (const article of articles) {
    // Same story syndicated across feeds shares a title; keep the first.
    const key = article.title.toLowerCase().replace(/\W+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(article);
  }

  return unique.sort((a, b) => {
    if (!a.publishedAt) return 1;
    if (!b.publishedAt) return -1;
    return b.publishedAt.localeCompare(a.publishedAt);
  });
}

/** Headlines for one tracked stock. */
export async function getNewsForSymbol(symbol: string): Promise<NewsArticle[]> {
  const stock = TRACKED_STOCKS.find(
    (s) => s.symbol.toUpperCase() === symbol.toUpperCase()
  );
  if (!stock) return [];

  const query = encodeURIComponent(`"${stock.company}" stock OR share OR NSE when:7d`);
  const url = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`;

  const articles = await fetchFeed(url, "Google News");
  return dedupeAndSort(
    articles.map((article) => ({ ...article, symbols: [stock.symbol] }))
  );
}

/**
 * Market-wide headlines, tagged with any tracked symbol they mention.
 * `onlyTracked` keeps just the stories that map to a stock in the portfolio.
 */
export async function getMarketNews(onlyTracked = false): Promise<NewsArticle[]> {
  const results = await Promise.all(
    MARKET_FEEDS.map((feed) => fetchFeed(feed.url, feed.label))
  );

  const tagged = results.flat().map((article) => ({
    ...article,
    symbols: matchSymbols(article),
  }));

  const filtered = onlyTracked
    ? tagged.filter((article) => article.symbols.length > 0)
    : tagged;

  return dedupeAndSort(filtered);
}
