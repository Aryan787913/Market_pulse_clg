"use client";

import { useState } from "react";
import Link from "next/link";
import { NewsArticle } from "@/types";
import { ExternalLink, Newspaper } from "lucide-react";

interface NewsListProps {
  articles: NewsArticle[];
  /** Tracked stocks, used to build the filter chips. */
  symbols: Array<{ symbol: string; company: string }>;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

export function NewsList({ articles, symbols }: NewsListProps) {
  const [active, setActive] = useState<string>("ALL");

  const visible =
    active === "ALL"
      ? articles
      : articles.filter((article) => article.symbols.includes(active));

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter by stock">
        <button
          onClick={() => setActive("ALL")}
          aria-pressed={active === "ALL"}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            active === "ALL"
              ? "bg-primary text-primary-foreground border-primary"
              : "hover:bg-muted"
          }`}
        >
          All ({articles.length})
        </button>
        {symbols.map(({ symbol }) => {
          const count = articles.filter((a) => a.symbols.includes(symbol)).length;
          if (count === 0) return null;
          return (
            <button
              key={symbol}
              onClick={() => setActive(symbol)}
              aria-pressed={active === symbol}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                active === symbol
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted"
              }`}
            >
              {symbol.replace(".NS", "")} ({count})
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <Newspaper className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            No headlines matched this filter right now. Feeds refresh every 15 minutes.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((article) => (
            <li
              key={article.link}
              className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/30"
            >
              <a
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium leading-snug group-hover:text-primary">
                    {article.title}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {article.source}
                    {article.publishedAt && ` · ${relativeTime(article.publishedAt)}`}
                  </p>
                  {article.symbols.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {article.symbols.map((symbol) => (
                        <Link
                          key={symbol}
                          href={`/stocks/${symbol}`}
                          onClick={(event) => event.stopPropagation()}
                          className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium hover:bg-secondary/70"
                        >
                          {symbol.replace(".NS", "")}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
                <ExternalLink
                  className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary"
                  aria-hidden="true"
                />
                <span className="sr-only">(opens on publisher site)</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
