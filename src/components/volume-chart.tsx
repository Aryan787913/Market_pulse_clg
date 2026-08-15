"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { DailyPrice } from "@/types";

interface VolumeChartProps {
  prices: DailyPrice[];
}

export function VolumeChart({ prices }: VolumeChartProps) {
  const data = prices.map((price) => ({
    date: new Date(price.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
    volume: price.volume,
  }));

  return (
    <div className="w-full h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
            tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
            stroke="hsl(var(--muted-foreground))"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value: number) => [value.toLocaleString("en-IN"), "Volume"]}
          />
          <Bar dataKey="volume" fill="hsl(var(--primary))" opacity={0.7} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
