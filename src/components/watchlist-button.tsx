"use client";

import { useEffect, useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Add/remove the current stock to the signed-in user's watchlist.
 *
 * Renders on the stock detail page. It checks auth on the client, reflects
 * whether the stock is already saved, and calls the existing /api/watchlist
 * POST/DELETE endpoints. Anonymous visitors are sent to the login page.
 */
export function WatchlistButton({ stockId }: { stockId: number }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [inList, setInList] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    let active = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (!user) {
        setAuthed(false);
        setReady(true);
        return;
      }

      setAuthed(true);
      try {
        const res = await fetch("/api/watchlist");
        if (res.ok) {
          const data = await res.json();
          const found = (data.watchlist ?? []).some(
            (item: { stockId: number }) => item.stockId === stockId
          );
          setInList(found);
        }
      } catch {
        // Non-fatal: default to "not in list" and let the toggle sort it out.
      } finally {
        setReady(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [supabase, stockId]);

  const toggle = async () => {
    setMessage(null);

    if (!authed) {
      window.location.href = "/login";
      return;
    }

    setBusy(true);
    try {
      if (inList) {
        const res = await fetch(`/api/watchlist?stockId=${stockId}`, {
          method: "DELETE",
        });
        if (res.ok) setInList(false);
        else setMessage("Could not remove. Please try again.");
      } else {
        const res = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stockId }),
        });
        // 409 means it is already saved, which is the state we want anyway.
        if (res.ok || res.status === 409) {
          setInList(true);
        } else {
          const data = await res.json().catch(() => ({}));
          setMessage(data.error || "Could not add. Please try again.");
        }
      }
    } catch {
      setMessage("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const label = !ready
    ? "Watchlist"
    : !authed
      ? "Add to Watchlist"
      : inList
        ? "In Watchlist"
        : "Add to Watchlist";

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={busy || !ready}
        aria-pressed={inList}
        className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
          inList
            ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
            : "bg-background hover:bg-muted"
        }`}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Heart className={`h-4 w-4 ${inList ? "fill-current" : ""}`} />
        )}
        {label}
      </button>
      {message && <span className="text-xs text-destructive">{message}</span>}
      {ready && !authed && (
        <span className="text-xs text-muted-foreground">
          Log in to save stocks to your watchlist.
        </span>
      )}
    </div>
  );
}
