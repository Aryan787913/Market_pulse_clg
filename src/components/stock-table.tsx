"use client";

import Link from "next/link";
import { StockWithPrice } from "@/types";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils";
import { TrendingUp, TrendingDown, ArrowUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";

interface StockTableProps {
  stocks: StockWithPrice[];
  showWatchlistActions?: boolean;
  onRemove?: (stockId: number) => void;
  /** Show a search box + sector filter above the table (dashboard use). */
  filterable?: boolean;
}

export function StockTable({ stocks, showWatchlistActions, onRemove, filterable }: StockTableProps) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "symbol",
    direction: "asc",
  });
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("ALL");

  const sectors = useMemo(
    () =>
      Array.from(new Set(stocks.map((s) => s.sector).filter(Boolean))).sort() as string[],
    [stocks]
  );

  const handleSort = (key: string) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const sorted = [...stocks].sort((a, b) => {
    let valA: any, valB: any;
    switch (sortConfig.key) {
      case "symbol":
        valA = a.symbol;
        valB = b.symbol;
        break;
      case "price":
        valA = parseFloat(a.latestPrice?.close || "0");
        valB = parseFloat(b.latestPrice?.close || "0");
        break;
      case "change":
        valA = parseFloat(a.latestMetric?.percentChange || "0");
        valB = parseFloat(b.latestMetric?.percentChange || "0");
        break;
      case "volume":
        valA = a.latestPrice?.volume || 0;
        valB = b.latestPrice?.volume || 0;
        break;
      default:
        valA = a.symbol;
        valB = b.symbol;
    }

    if (typeof valA === "string") {
      return sortConfig.direction === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortConfig.direction === "asc" ? valA - valB : valB - valA;
  });

  const visible = sorted.filter((stock) => {
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      stock.symbol.toLowerCase().includes(q) ||
      stock.companyName.toLowerCase().includes(q);
    const matchesSector = sector === "ALL" || stock.sector === sector;
    return matchesQuery && matchesSector;
  });

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {filterable && (
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search symbol or company"
              className="w-full rounded-md border bg-background px-9 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="ALL">All sectors</option>
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground sm:whitespace-nowrap">
            {visible.length} of {stocks.length}
          </span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">
                <button onClick={() => handleSort("symbol")} className="flex items-center gap-1 hover:text-primary">
                  Symbol <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Company</th>
              <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Sector</th>
              <th className="px-4 py-3 text-right font-medium">
                <button onClick={() => handleSort("price")} className="flex items-center gap-1 hover:text-primary ml-auto">
                  Price <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-medium">
                <button onClick={() => handleSort("change")} className="flex items-center gap-1 hover:text-primary ml-auto">
                  Change <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-medium hidden lg:table-cell">
                <button onClick={() => handleSort("volume")} className="flex items-center gap-1 hover:text-primary ml-auto">
                  Volume <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              {showWatchlistActions && <th className="px-4 py-3 text-center font-medium">Action</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((stock) => {
              const change = stock.latestMetric?.percentChange
                ? parseFloat(stock.latestMetric.percentChange)
                : null;
              const isPositive = (change ?? 0) >= 0;

              return (
                <tr key={stock.stockId} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/stocks/${stock.symbol}`} className="font-semibold text-primary hover:underline">
                      {stock.symbol}
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{stock.companyName}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
                      {stock.sector || "N/A"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCurrency(stock.latestPrice?.close)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {change === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className={`flex items-center justify-end gap-1 ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
                        {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                        <span className="font-medium">{formatPercent(change)}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell text-muted-foreground">
                    {formatNumber(stock.latestPrice?.volume)}
                  </td>
                  {showWatchlistActions && onRemove && (
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => onRemove(stock.stockId)}
                        className="text-xs text-destructive hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={showWatchlistActions ? 7 : 6}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  No stocks match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
