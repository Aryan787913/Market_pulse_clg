"use client";

import Link from "next/link";
import { StockWithPrice } from "@/types";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils";
import { TrendingUp, TrendingDown, ArrowUpDown } from "lucide-react";
import { useState } from "react";

interface StockTableProps {
  stocks: StockWithPrice[];
  showWatchlistActions?: boolean;
  onRemove?: (stockId: number) => void;
}

export function StockTable({ stocks, showWatchlistActions, onRemove }: StockTableProps) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "symbol",
    direction: "asc",
  });

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

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
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
            {sorted.map((stock) => {
              const change = parseFloat(stock.latestMetric?.percentChange || "0");
              const isPositive = change >= 0;

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
                    <div className={`flex items-center justify-end gap-1 ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
                      {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                      <span className="font-medium">{formatPercent(change)}</span>
                    </div>
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
