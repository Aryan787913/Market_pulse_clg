"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Download, FileJson, FileSpreadsheet } from "lucide-react";

interface StockOption {
  symbol: string;
  company: string;
}

const DATASETS: { value: string; label: string; hint: string }[] = [
  { value: "daily", label: "Daily prices + metrics", hint: "Recommended — OHLCV plus returns, moving averages, volatility" },
  { value: "prices", label: "Prices only (OHLCV)", hint: "Open, high, low, close, adjusted close, volume" },
  { value: "metrics", label: "Computed metrics", hint: "Daily return, 7/20-day MA, volatility, % change" },
  { value: "forecasts", label: "Forecasts (ARIMA + XGBoost)", hint: "Latest 5-day projections per stock" },
  { value: "stocks", label: "Stock list", hint: "Symbol, company, sector, exchange" },
];

export function ExportPanel({ stocks }: { stocks: StockOption[] }) {
  const [dataset, setDataset] = useState("daily");
  const [symbol, setSymbol] = useState("ALL");
  const [format, setFormat] = useState("csv");
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const symbolLocked = dataset === "stocks";

  const params = new URLSearchParams({ dataset });
  if (!symbolLocked && symbol !== "ALL") params.set("symbol", symbol);
  if (format === "json") params.set("format", "json");

  const path = `/api/export?${params.toString()}`;
  const fullUrl = origin ? `${origin}${path}` : path;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked; the field is selectable as a fallback.
    }
  };

  const selectClass =
    "w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Dataset</span>
            <select
              value={dataset}
              onChange={(e) => setDataset(e.target.value)}
              className={selectClass}
            >
              {DATASETS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Stock</span>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              disabled={symbolLocked}
              className={`${selectClass} disabled:opacity-50`}
            >
              <option value="ALL">All stocks</option>
              {stocks.map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol} — {s.company}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Format</span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className={selectClass}
            >
              <option value="csv">CSV (Excel, Tableau)</option>
              <option value="json">JSON (APIs, Power BI)</option>
            </select>
          </label>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          {DATASETS.find((d) => d.value === dataset)?.hint}
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={path}
            download
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {format === "json" ? (
              <FileJson className="h-4 w-4" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            Download {format.toUpperCase()}
          </a>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-semibold">Live connection URL</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste this URL into Excel, Power BI or Tableau to pull the data live —
          it refreshes automatically when you refresh in your tool.
        </p>

        <div className="mt-3 flex gap-2">
          <input
            readOnly
            value={fullUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 rounded-md border bg-muted/40 px-3 py-2 text-xs font-mono"
          />
          <button
            onClick={copy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-500" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" /> Copy
              </>
            )}
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3 text-sm">
          <div>
            <p className="font-medium">Excel</p>
            <p className="mt-1 text-muted-foreground">
              Data → Get Data → From Other Sources → From Web → paste the URL.
            </p>
          </div>
          <div>
            <p className="font-medium">Power BI</p>
            <p className="mt-1 text-muted-foreground">
              Get Data → Web → paste the URL (use JSON for the cleanest parse).
            </p>
          </div>
          <div>
            <p className="font-medium">Tableau</p>
            <p className="mt-1 text-muted-foreground">
              Download the CSV, then Connect → Text file, or use a Web Data
              Connector.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
