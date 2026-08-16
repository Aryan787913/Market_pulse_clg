import { NewsArticle } from "@/types";

/**
 * Stock news aggregation.
 *
 * Headlines are read from publisher-provided RSS feeds and only the title,
 * source, timestamp and a link back to the publisher are stored or shown.
 * Article bodies are never copied, so readers always click through to the
 * original site. Nothing here bypasses a paywall or a robots directive.
 *
 * The tracked stock list is not duplicated here; callers pass it in from the
 * database so the pipeline's `stocks` table stays the single source of truth.
 */

export interface TrackedStock {
  symbol: string;
  company: string;
}

/**
 * Build the terms used to match a headline to a company.
 *
 * Legal-form suffixes are dropped because headlines rarely include them, and a
 * short leading fragment is added so "Hindustan Unilever Ltd" also matches a
 * headline that only says "Hindustan Unilever".
 */
export function matchTermsFor(company: string): string[] {
  const cleaned = company
    .replace(
      /\b(Ltd|Limited|Corporation|Corp|Company|Enterprises|Industries|Holdings|Inc|PLC)\b\.?/gi,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();

  const terms = new Set<string>();
  if (cleaned.length >= 3) terms.add(cleaned);

  const words = cleaned.split(" ").filter(Boolean);
  // First two words catch the common short form ("Tata Consultancy").
  if (words.length > 2) terms.add(words.slice(0, 2).join(" "));
  // A distinctive single first word ("Infosys", "Wipro", "Cipla"). Short words
  // are skipped because they produce false matches.
  if (words.length === 1 || (words[0] && words[0].length >= 5)) {
    terms.add(words[0]!);
  }

  return Array.from(terms);
}

/**
 * Well-known abbreviations that never appear in the registered company name.
 * Only unambiguous ones are listed; a generic acronym would create false
 * matches against unrelated headlines.
 */
const EXTRA_ALIASES: Record<string, string[]> = {
  "RELIANCE.NS": ["RIL"],
  "TCS.NS": ["TCS"],
  "HDFCBANK.NS": ["HDFC Bank"],
  "ICICIBANK.NS": ["ICICI"],
  "SBIN.NS": ["SBI", "State Bank"],
  "LT.NS": ["L&T", "Larsen"],
  "HINDUNILVR.NS": ["HUL"],
  "BHARTIARTL.NS": ["Airtel"],
  "M&M.NS": ["Mahindra"],
  "SUNPHARMA.NS": ["Sun Pharma"],
  "DRREDDY.NS": ["Dr Reddy", "Dr Reddy's"],
  "ONGC.NS": ["ONGC"],
  "NTPC.NS": ["NTPC"],
  "BPCL.NS": ["BPCL"],
  "POWERGRID.NS": ["Power Grid"],
  "ULTRACEMCO.NS": ["UltraTech"],
  "TMPV.NS": ["Tata Motors"],
  "HCLTECH.NS": ["HCL Tech", "HCLTech"],
  "APOLLOHOSP.NS": ["Apollo Hospitals"],
  "INDUSINDBK.NS": ["IndusInd"],
  "DIVISLAB.NS": ["Divi's", "Divis"],
  "ITC.NS": ["ITC"],
  "JSWSTEEL.NS": ["JSW"],
  "GRASIM.NS": ["Grasim"],
  "TITAN.NS": ["Titan"],
  "TRENT.NS": ["Trent"],
  "WIPRO.NS": ["Wipro"],
  "CIPLA.NS": ["Cipla"],
  "INFY.NS": ["Infosys"],
};

/** Indian market news feeds, used for the "all stocks" view. */
const MARKET_FEEDS = [
  {
    url: "https://news.google.com/rss/search?q=NSE+OR+Sensex+OR+Nifty+stock+market+India+when:3d&hl=en-IN&gl=IN&ceid=IN:en",
    label: "Google News",
  },
  {
    url: "https://news.google.com/rss/search?q=NSE+largecap+shares+results+OR+earnings+India+when:3d&hl=en-IN&gl=IN&ceid=IN:en",
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
 * feeds occasionally embed markup, and this text is rendered in React.
 */
function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

/** Tag a headline with every tracked symbol it mentions. */
function matchSymbols(title: string, stocks: TrackedStock[]): string[] {
  const haystack = title.toLowerCase();

  return stocks
    .filter(({ symbol, company }) => {
      const terms = [
        ...matchTermsFor(company),
        ...(EXTRA_ALIASES[symbol] ?? []),
      ];

      return terms.some((term) => {
        const needle = term.toLowerCase().trim();
        if (needle.length < 3) return false;
        // Word-boundary match so "ITC" does not match "switch". \b does not
        // work after a symbol like "&", so the boundary is only applied where
        // the term starts and ends with a word character.
        const left = /^\w/.test(needle) ? "\\b" : "";
        const right = /\w$/.test(needle) ? "\\b" : "";
        return new RegExp(`${left}${escapeRegex(needle)}${right}`).test(haystack);
      });
    })
    .map((stock) => stock.symbol);
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

/** Headlines for a single stock, searched by company name. */
export async function getNewsForSymbol(
  symbol: string,
  company: string
): Promise<NewsArticle[]> {
  const query = encodeURIComponent(`"${company}" stock OR share OR NSE when:7d`);
  const url = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`;

  const articles = await fetchFeed(url, "Google News");
  return dedupeAndSort(
    articles.map((article) => ({ ...article, symbols: [symbol.toUpperCase()] }))
  );
}

/**
 * Market-wide headlines, tagged with any tracked symbol they mention.
 * `onlyTracked` keeps just the stories that map to one of `stocks`.
 */
export async function getMarketNews(
  stocks: TrackedStock[],
  onlyTracked = false
): Promise<NewsArticle[]> {
  const results = await Promise.all(
    MARKET_FEEDS.map((feed) => fetchFeed(feed.url, feed.label))
  );

  const tagged = results.flat().map((article) => ({
    ...article,
    symbols: matchSymbols(article.title, stocks),
  }));

  const filtered = onlyTracked
    ? tagged.filter((article) => article.symbols.length > 0)
    : tagged;

  return dedupeAndSort(filtered);
}
