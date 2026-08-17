import { NextResponse } from "next/server";
import {
  exportDaily,
  exportPrices,
  exportMetrics,
  exportForecasts,
  exportStocks,
  isExportDataset,
  toCsv,
  type ExportRow,
} from "@/lib/export";

// Public, read-only data feed. Dynamic because it reads query params; responses
// are CDN-cached for an hour (data only changes once per weekday run).
export const dynamic = "force-dynamic";

async function loadDataset(
  dataset: string,
  symbol: string | undefined
): Promise<ExportRow[]> {
  switch (dataset) {
    case "daily":
      return exportDaily(symbol);
    case "prices":
      return exportPrices(symbol);
    case "metrics":
      return exportMetrics(symbol);
    case "forecasts":
      return exportForecasts(symbol);
    case "stocks":
      return exportStocks();
    default:
      return [];
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dataset = (searchParams.get("dataset") || "daily").toLowerCase();
    const format = (searchParams.get("format") || "csv").toLowerCase();
    const symbolParam = searchParams.get("symbol");
    const symbol = symbolParam ? symbolParam.toUpperCase() : undefined;

    if (!isExportDataset(dataset)) {
      return NextResponse.json(
        { error: `Unknown dataset. Use one of: daily, prices, metrics, forecasts, stocks.` },
        { status: 400 }
      );
    }

    const rows = await loadDataset(dataset, symbol);

    // A specific symbol that yields nothing is almost certainly a typo.
    if (symbol && dataset !== "stocks" && rows.length === 0) {
      return NextResponse.json(
        { error: `No data for symbol "${symbol}".` },
        { status: 404 }
      );
    }

    const stamp = new Date().toISOString().slice(0, 10);
    const suffix = symbol ? `_${symbol.replace(/[^A-Z0-9]/gi, "")}` : "_all";
    const filename = `marketpulse_${dataset}${suffix}_${stamp}`;
    const cache = "public, s-maxage=3600, stale-while-revalidate=86400";

    if (format === "json") {
      return NextResponse.json(
        { dataset, symbol: symbol ?? null, count: rows.length, data: rows },
        { headers: { "Cache-Control": cache } }
      );
    }

    if (format !== "csv") {
      return NextResponse.json(
        { error: "Unknown format. Use csv or json." },
        { status: 400 }
      );
    }

    const csv = toCsv(rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
        "Cache-Control": cache,
      },
    });
  } catch (error) {
    console.error("Error exporting data:", error);
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    );
  }
}
