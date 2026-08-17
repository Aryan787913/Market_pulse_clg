"use client";

import { useState, useEffect } from "react";
import { WatchlistItem } from "@/types";
import { StockTable } from "@/components/stock-table";
import { Heart, LogIn } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      if (data.user) {
        fetchWatchlist();
      } else {
        setLoading(false);
      }
    };
    checkAuth();
  }, [supabase]);

  const fetchWatchlist = async () => {
    try {
      const res = await fetch("/api/watchlist");
      const data = await res.json();
      setWatchlist(data.watchlist || []);
    } catch (error) {
      console.error("Error fetching watchlist:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (stockId: number) => {
    try {
      await fetch(`/api/watchlist?stockId=${stockId}`, { method: "DELETE" });
      setWatchlist((prev) => prev.filter((item) => item.stockId !== stockId));
    } catch (error) {
      console.error("Error removing from watchlist:", error);
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 text-center">
        <Heart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Watchlist</h1>
        <p className="text-muted-foreground mb-6">Please log in to view and manage your watchlist.</p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <LogIn className="h-4 w-4" />
          Log In
        </Link>
      </div>
    );
  }

  const stocks = watchlist
    .filter((item) => item.stock)
    .map((item) => ({
      ...item.stock!,
      latestPrice: item.latestPrice,
      latestMetric: item.latestMetric,
    }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">My Watchlist</h1>
        <p className="mt-1 text-muted-foreground">
          Track your favorite stocks
        </p>
      </div>

      {loading ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <p className="text-muted-foreground">Loading watchlist...</p>
        </div>
      ) : stocks.length > 0 ? (
        <StockTable stocks={stocks} showWatchlistActions onRemove={handleRemove} />
      ) : (
        <div className="rounded-xl border bg-card p-8 text-center">
          <Heart className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Your watchlist is empty. Open any stock and tap &ldquo;Add to Watchlist&rdquo; to save it here.</p>
        </div>
      )}
    </div>
  );
}
