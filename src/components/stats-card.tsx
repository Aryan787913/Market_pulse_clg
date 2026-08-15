"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, BarChart3, Clock, Activity, type LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  Activity,
};

interface StatsCardProps {
  title: string;
  value: string;
  subtitle?: string;
  change?: number;
  iconName: string;
  className?: string;
}

export function StatsCard({ title, value, subtitle, change, iconName, className }: StatsCardProps) {
  const Icon = iconMap[iconName] || BarChart3;
  const isPositive = change !== undefined && change >= 0;

  return (
    <div className={cn("rounded-xl border bg-card p-5 shadow-sm", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="rounded-lg bg-primary/10 p-2">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
      {change !== undefined && (
        <div className="mt-3 flex items-center gap-1 text-sm">
          {isPositive ? (
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
          <span className={isPositive ? "text-emerald-500" : "text-red-500"}>
            {isPositive ? "+" : ""}{change.toFixed(2)}%
          </span>
        </div>
      )}
    </div>
  );
}