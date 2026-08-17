import { db } from "@/lib/db";
import {
  pipelineRuns,
  dataQualityResults,
  dailyPrices,
  stocks,
} from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { formatDateTime, formatDate, formatNumber } from "@/lib/utils";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Database,
  Gauge,
} from "lucide-react";

// Reads live pipeline telemetry, so never prerender.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pipeline Health - MarketPulse",
  description: "Data pipeline runs, freshness and data-quality checks",
};

function timeAgo(date: Date | string | null): string {
  if (!date) return "never";
  const ms = Date.now() - new Date(date).getTime();
  if (ms < 0) return "just now";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function statusClass(status: string): string {
  const map: Record<string, string> = {
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    partial: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    failed: "bg-red-500/10 text-red-600 dark:text-red-400",
    running: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  };
  return map[status] ?? "bg-muted text-muted-foreground";
}

async function getPipelineData() {
  const runs = await db
    .select()
    .from(pipelineRuns)
    .orderBy(desc(pipelineRuns.runDate))
    .limit(20);

  const lastRun = runs[0] ?? null;

  const [latest] = await db
    .select({ maxDate: sql<string | null>`max(${dailyPrices.date})` })
    .from(dailyPrices);
  const latestDataDate = latest?.maxDate ?? null;

  const [stockCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(stocks);

  const quality = lastRun
    ? await db
        .select()
        .from(dataQualityResults)
        .where(eq(dataQualityResults.runId, lastRun.runId))
    : [];

  const passCount = quality.filter((q) => q.status === "pass").length;
  const failCount = quality.filter((q) => q.status === "fail").length;
  const failures = quality.filter((q) => q.status === "fail").slice(0, 25);

  const successRuns = runs.filter((r) => r.status === "success").length;
  const successRate = runs.length
    ? Math.round((successRuns / runs.length) * 100)
    : 0;

  return {
    runs,
    lastRun,
    latestDataDate,
    totalStocks: Number(stockCount?.count ?? 0),
    passCount,
    failCount,
    failures,
    successRate,
  };
}

export default async function PipelinePage() {
  const {
    runs,
    lastRun,
    latestDataDate,
    totalStocks,
    passCount,
    failCount,
    failures,
    successRate,
  } = await getPipelineData();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Pipeline Health</h1>
          </div>
          <p className="mt-2 text-muted-foreground">
            Live data-engineering telemetry: run history, freshness and
            data-quality checks for the daily ETL job.
          </p>
        </div>
        {lastRun && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${statusClass(
              lastRun.status
            )}`}
          >
            {lastRun.status === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : lastRun.status === "failed" ? (
              <XCircle className="h-4 w-4" />
            ) : (
              <Clock className="h-4 w-4" />
            )}
            Last run: {lastRun.status}
          </span>
        )}
      </div>

      {!lastRun ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          No pipeline runs recorded yet.
        </div>
      ) : (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border bg-card p-4">
              <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Last run
              </div>
              <p className="text-lg font-semibold">{timeAgo(lastRun.runDate)}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(lastRun.runDate)}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Database className="h-3.5 w-3.5" /> Market data as of
              </div>
              <p className="text-lg font-semibold">
                {latestDataDate ? formatDate(latestDataDate) : "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {totalStocks} stocks tracked
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Gauge className="h-3.5 w-3.5" /> Success rate
              </div>
              <p className="text-lg font-semibold">{successRate}%</p>
              <p className="text-xs text-muted-foreground">
                last {runs.length} runs
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5" /> Quality (last run)
              </div>
              <p className="text-lg font-semibold">
                <span className="text-emerald-500">{passCount} pass</span>
                {failCount > 0 && (
                  <span className="text-red-500"> · {failCount} fail</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {lastRun.recordsInserted ?? 0} records inserted
              </p>
            </div>
          </div>

          {failures.length > 0 && (
            <div className="mb-8 rounded-xl border border-red-500/30 bg-red-500/5 p-5">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-red-600 dark:text-red-400">
                <XCircle className="h-4 w-4" /> Failed checks in the last run
              </h2>
              <ul className="space-y-1.5 text-sm">
                {failures.map((f) => (
                  <li key={f.resultId} className="flex gap-2">
                    <span className="shrink-0 rounded bg-red-500/10 px-1.5 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                      {f.checkType}
                    </span>
                    <span className="text-muted-foreground">{f.details}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-xl border bg-card">
            <h2 className="border-b px-5 py-3 font-semibold">Recent runs</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="px-4 py-2.5 font-medium">Run</th>
                    <th className="px-4 py-2.5 font-medium">When</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 text-right font-medium">Stocks</th>
                    <th className="px-4 py-2.5 text-right font-medium">Inserted</th>
                    <th className="px-4 py-2.5 text-right font-medium hidden sm:table-cell">
                      Updated
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium hidden md:table-cell">
                      Duration
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.runId} className="border-b last:border-0">
                      <td className="px-4 py-2.5 font-medium">#{run.runId}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {timeAgo(run.runDate)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(
                            run.status
                          )}`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {run.stocksProcessed ?? 0}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {formatNumber(run.recordsInserted)}
                      </td>
                      <td className="px-4 py-2.5 text-right hidden sm:table-cell">
                        {formatNumber(run.recordsUpdated)}
                      </td>
                      <td className="px-4 py-2.5 text-right hidden md:table-cell text-muted-foreground">
                        {run.durationSeconds ? `${run.durationSeconds}s` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 rounded-xl border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">
              The ETL job runs on GitHub Actions every weekday after the NSE
              close and records each run here. Quality reflects OHLC/volume
              validation and forecast checks written to the{" "}
              <code>data_quality_results</code> table during ingestion.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
