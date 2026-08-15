"use client";

import { useState } from "react";
import { StockWithPrice } from "@/types";
import { StockTable } from "@/components/stock-table";
import { Search, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minVolume, setMinVolume] = useState("");
  const [results, setResults] = useState<StockWithPrice[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (query) params.append("q", query);
      if (sector) params.append("sector", sector);
      if (minPrice) params.append("minPrice", minPrice);
      if (maxPrice) params.append("maxPrice", maxPrice);
      if (minVolume) params.append("minVolume", minVolume);

      const res = await fetch(`/api/search?${params.toString()}`);
      const data = await res.json();
      setResults(data.stocks || []);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setQuery("");
    setSector("");
    setMinPrice("");
    setMaxPrice("");
    setMinVolume("");
    setResults([]);
    setSearched(false);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Search Stocks</h1>
        <p className="mt-1 text-muted-foreground">
          Find stocks by symbol, company name, or apply filters
        </p>
      </div>

      {/* Search & Filters */}
      <div className="mb-8 rounded-xl border bg-card p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search symbol or name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full rounded-lg border bg-background px-9 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All Sectors</option>
            <option value="Technology">Technology</option>
            <option value="Financial Services">Financial Services</option>
            <option value="Energy">Energy</option>
            <option value="Consumer Goods">Consumer Goods</option>
            <option value="Telecommunications">Telecommunications</option>
            <option value="Conglomerate">Conglomerate</option>
            <option value="Industrials">Industrials</option>
          </select>

          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Min Price"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
            <input
              type="number"
              placeholder="Max Price"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <input
            type="number"
            placeholder="Min Volume"
            value={minVolume}
            onChange={(e) => setMinVolume(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="mt-4 flex gap-3">
          <button
            onClick={handleSearch}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Search className="h-4 w-4" />
            {loading ? "Searching..." : "Search"}
          </button>
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        </div>
      </div>

      {/* Results */}
      {searched && (
        <div>
          <p className="mb-4 text-sm text-muted-foreground">
            {results.length} result{results.length !== 1 ? "s" : ""} found
          </p>
          {results.length > 0 ? (
            <StockTable stocks={results} />
          ) : (
            <div className="rounded-xl border bg-card p-8 text-center">
              <p className="text-muted-foreground">No stocks found matching your criteria.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
