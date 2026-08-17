import { db } from "@/lib/db";
import {
  stocks,
  dailyPrices,
  stockMetrics,
  stockForecasts,
} from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Public data export helpers.
 *
 * These power the /data page and /api/export endpoint, letting any visitor pull
 * the cleaned market data into their own tools (Excel, Power BI, Tableau, ...).
 * Only non-personal market data is exposed here — never `profiles`/`watchlist`.
 */

export type ExportRow = Record<string, string | number | null>;

export const EXPORT_DATASETS = [
  "daily",
  "prices",
  "metrics",
  "forecasts",
  "stocks",
] as const;

export type ExportDataset = (typeof EXPORT_DATASETS)[number];

export function isExportDataset(value: string): value is ExportDataset {
  return (EXPORT_DATASETS as readonly string[]).includes(value);
}

/** The tracked stock master list (symbol + company), for UI dropdowns. */
export async function listStocks(): Promise<
  { symbol: string; company: string }[]
> {
  const rows = await db
    .select({ symbol: stocks.symbol, company: stocks.companyName })
    .from(stocks)
    .orderBy(stocks.symbol);
  return rows.map((r) => ({ symbol: r.symbol, company: r.company }));
}

/** Stock master list as export rows. */
export async function exportStocks(): Promise<ExportRow[]> {
  return db
    .select({
      symbol: stocks.symbol,
      company_name: stocks.companyName,
      sector: stocks.sector,
      exchange: stocks.exchange,
    })
    .from(stocks)
    .orderBy(stocks.symbol);
}

/** Daily prices joined with derived metrics — the richest single dataset. */
export async function exportDaily(symbol?: string): Promise<ExportRow[]> {
  return db
    .select({
      symbol: stocks.symbol,
      company_name: stocks.companyName,
      sector: stocks.sector,
      date: dailyPrices.date,
      open: dailyPrices.open,
      high: dailyPrices.high,
      low: dailyPrices.low,
      close: dailyPrices.close,
      adjusted_close: dailyPrices.adjustedClose,
      volume: dailyPrices.volume,
      daily_return: stockMetrics.dailyReturn,
      moving_avg_7d: stockMetrics.movingAvg7d,
      moving_avg_20d: stockMetrics.movingAvg20d,
      volatility: stockMetrics.volatility,
      price_change: stockMetrics.priceChange,
      percent_change: stockMetrics.percentChange,
    })
    .from(dailyPrices)
    .innerJoin(stocks, eq(stocks.stockId, dailyPrices.stockId))
    .leftJoin(
      stockMetrics,
      and(
        eq(stockMetrics.stockId, dailyPrices.stockId),
        eq(stockMetrics.date, dailyPrices.date)
      )
    )
    .where(symbol ? eq(stocks.symbol, symbol) : undefined)
    .orderBy(stocks.symbol, dailyPrices.date);
}

/** OHLCV prices only. */
export async function exportPrices(symbol?: string): Promise<ExportRow[]> {
  return db
    .select({
      symbol: stocks.symbol,
      date: dailyPrices.date,
      open: dailyPrices.open,
      high: dailyPrices.high,
      low: dailyPrices.low,
      close: dailyPrices.close,
      adjusted_close: dailyPrices.adjustedClose,
      volume: dailyPrices.volume,
    })
    .from(dailyPrices)
    .innerJoin(stocks, eq(stocks.stockId, dailyPrices.stockId))
    .where(symbol ? eq(stocks.symbol, symbol) : undefined)
    .orderBy(stocks.symbol, dailyPrices.date);
}

/** Computed metrics only. */
export async function exportMetrics(symbol?: string): Promise<ExportRow[]> {
  return db
    .select({
      symbol: stocks.symbol,
      date: stockMetrics.date,
      daily_return: stockMetrics.dailyReturn,
      moving_avg_7d: stockMetrics.movingAvg7d,
      moving_avg_20d: stockMetrics.movingAvg20d,
      volatility: stockMetrics.volatility,
      price_change: stockMetrics.priceChange,
      percent_change: stockMetrics.percentChange,
    })
    .from(stockMetrics)
    .innerJoin(stocks, eq(stocks.stockId, stockMetrics.stockId))
    .where(symbol ? eq(stocks.symbol, symbol) : undefined)
    .orderBy(stocks.symbol, stockMetrics.date);
}

/** Forecasts from the most recent training run per stock. */
export async function exportForecasts(symbol?: string): Promise<ExportRow[]> {
  const rows = await db
    .select({
      symbol: stocks.symbol,
      company_name: stocks.companyName,
      model_name: stockForecasts.modelName,
      trained_on: stockForecasts.trainedOn,
      target_date: stockForecasts.targetDate,
      horizon: stockForecasts.horizon,
      predicted_close: stockForecasts.predictedClose,
      lower_bound: stockForecasts.lowerBound,
      upper_bound: stockForecasts.upperBound,
    })
    .from(stockForecasts)
    .innerJoin(stocks, eq(stocks.stockId, stockForecasts.stockId))
    .where(symbol ? eq(stocks.symbol, symbol) : undefined)
    .orderBy(stocks.symbol, stockForecasts.targetDate);

  // Keep only the latest training run per symbol (ISO dates sort as strings).
  const latest = new Map<string, string>();
  for (const r of rows) {
    const seen = latest.get(r.symbol);
    if (!seen || (r.trained_on ?? "") > seen) {
      latest.set(r.symbol, r.trained_on ?? "");
    }
  }
  return rows.filter((r) => r.trained_on === latest.get(r.symbol));
}

/** Serialize rows to RFC-4180 CSV (quotes escaped, CRLF line endings). */
export function toCsv(rows: ExportRow[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);

  const escape = (value: string | number | null): string => {
    if (value === null || value === undefined) return "";
    const s = String(value);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h] ?? null)).join(","));
  }
  return lines.join("\r\n");
}
