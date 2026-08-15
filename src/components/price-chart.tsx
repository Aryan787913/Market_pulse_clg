"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from "recharts";
import { DailyPrice, StockMetric } from "@/types";
import { formatCurrency } from "@/lib/utils";

interface PriceChartProps {
  prices: DailyPrice[];
  metrics: StockMetric[];
  showMovingAvg?: boolean;
}

export function PriceChart({ prices, metrics, showMovingAvg = true }: PriceChartProps) {
  const data = prices.map((price) => {
    const metric = metrics.find((m) => m.date === price.date);
    return {
      date: new Date(price.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
      close: parseFloat(price.close),
      open: parseFloat(price.open),
      high: parseFloat(price.high),
      low: parseFloat(price.low),
      volume: price.volume,
      ma7: metric?.movingAvg7d ? parseFloat(metric.movingAvg7d) : null,
      ma20: metric?.movingAvg20d ? parseFloat(metric.movingAvg20d) : null,
    };
  });

  return (
    <div className="w-full h-[350px] sm:h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickMargin={8}
            minTickGap={30}
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(value) => `₹${value.toLocaleString("en-IN")}`}
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
            formatter={(value: number, name: string) => {
              if (name === "volume") return [value.toLocaleString("en-IN"), "Volume"];
              return [formatCurrency(value), name];
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Area
            type="monotone"
            dataKey="close"
            stroke="hsl(var(--primary))"
            fillOpacity={1}
            fill="url(#colorClose)"
            strokeWidth={2}
            name="Close Price"
          />
          {showMovingAvg && (
            <>
              <Line
                type="monotone"
                dataKey="ma7"
                stroke="#f59e0b"
                strokeWidth={1.5}
                dot={false}
                name="7-Day MA"
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="ma20"
                stroke="#10b981"
                strokeWidth={1.5}
                dot={false}
                name="20-Day MA"
                connectNulls
              />
            </>
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
