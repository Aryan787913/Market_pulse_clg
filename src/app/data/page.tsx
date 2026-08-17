import { listStocks } from "@/lib/export";
import { ExportPanel } from "@/components/export-panel";
import { Database } from "lucide-react";

// Reads the tracked stock list from the database at request time.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Data Export - MarketPulse",
  description: "Download or connect the cleaned market dataset to Excel, Power BI or Tableau",
};

export default async function DataPage() {
  const stocks = await listStocks();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <Database className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Data Export</h1>
        </div>
        <p className="mt-2 text-muted-foreground">
          Pull the cleaned dataset for {stocks.length} NSE stocks into your own
          tools. Download a file, or connect it live to Excel, Power BI or
          Tableau — no account or API key required.
        </p>
      </div>

      <ExportPanel stocks={stocks} />

      <div className="mt-8 rounded-xl border bg-muted/30 p-4">
        <p className="text-xs text-muted-foreground">
          This feed exposes only public market data and derived metrics —
          sourced from Yahoo Finance via yfinance and refreshed each trading day.
          It contains no personal or account information. Forecasts are
          statistical extrapolations for academic purposes and are not investment
          advice.
        </p>
      </div>
    </div>
  );
}
