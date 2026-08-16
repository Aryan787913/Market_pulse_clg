"use client";

import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { DailyPrice, StockForecast } from "@/types";
import { formatCurrency } from "@/lib/utils";

interface ForecastChartProps {
  /** Recent history, ascending by date. */
  prices: DailyPrice[];
  forecasts: StockForecast[];
  /** How many trailing history points to show for context. */
  historyPoints?: number;
}

const MODEL_COLORS: Record<string, string> = {
  ARIMA: "#f59e0b",
  XGBoost: "#8b5cf6",
};

/**
 * A chart row holds the x-axis label plus one key per series. Model forecast
 * keys are dynamic, and interval keys hold a [low, high] tuple for Recharts'
 * range area.
 */
type ChartRow = {
  date: string;
} & Record<string, string | number | [number, number] | null | undefined>;

export function ForecastChart({ prices, forecasts, historyPoints = 40 }: ForecastChartProps) {
  const models = Array.from(new Set(forecasts.map((f) => f.modelName))).sort();

  const label = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", { month: "short", day: "numeric" });

  const history = prices.slice(-historyPoints).map((price) => ({
    date: label(price.date),
    actual: parseFloat(price.close),
  }));

  // Anchor every predicted line to the last actual close so the series joins up
  // visually instead of starting from a floating point.
  const lastClose = prices.length > 0
    ? parseFloat(prices[prices.length - 1]!.close)
    : null;

  const byDate = new Map<string, ChartRow>();

  for (const forecast of forecasts) {
    const key = label(forecast.targetDate);
    const row: ChartRow = byDate.get(key) ?? { date: key };
    row[forecast.modelName] = parseFloat(forecast.predictedClose);

    if (forecast.lowerBound && forecast.upperBound) {
      row[`${forecast.modelName}_range`] = [
        parseFloat(forecast.lowerBound),
        parseFloat(forecast.upperBound),
      ];
    }
    byDate.set(key, row);
  }

  const futureRows = Array.from(byDate.values());

  // The join row carries the last actual value under every model key.
  if (history.length > 0 && lastClose !== null) {
    const joinRow: ChartRow = { ...history[history.length - 1]! };
    for (const model of models) joinRow[model] = lastClose;
    history[history.length - 1] = joinRow as { date: string; actual: number };
  }

  const data: ChartRow[] = [...history, ...futureRows];

  return (
    <div className="w-full h-[320px] sm:h-[360px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickMargin={8}
            minTickGap={24}
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(value) => `₹${Number(value).toLocaleString("en-IN")}`}
            stroke="hsl(var(--muted-foreground))"
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value: number | [number, number], name: string) => {
              if (Array.isArray(value)) {
                return [`${formatCurrency(value[0])} – ${formatCurrency(value[1])}`, name];
              }
              return [formatCurrency(value), name];
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />

          {history.length > 0 && (
            <ReferenceLine
              x={history[history.length - 1]!.date}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              label={{ value: "today", fontSize: 10, position: "insideTopRight" }}
            />
          )}

          {models.map((model) =>
            data.some((row) => `${model}_range` in row) ? (
              <Area
                key={`${model}_range`}
                dataKey={`${model}_range`}
                stroke="none"
                fill={MODEL_COLORS[model] ?? "#64748b"}
                fillOpacity={0.12}
                name={`${model} 95% interval`}
                connectNulls
              />
            ) : null
          )}

          <Line
            type="monotone"
            dataKey="actual"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            name="Actual close"
            connectNulls
          />

          {models.map((model) => (
            <Line
              key={model}
              type="monotone"
              dataKey={model}
              stroke={MODEL_COLORS[model] ?? "#64748b"}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={{ r: 2.5 }}
              name={`${model} forecast`}
              connectNulls
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
