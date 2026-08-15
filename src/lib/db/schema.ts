import { pgTable, serial, varchar, integer, date, numeric, bigint, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const stocks = pgTable("stocks", {
  stockId: serial("stock_id").primaryKey(),
  symbol: varchar("symbol", { length: 20 }).notNull().unique(),
  companyName: varchar("company_name", { length: 150 }).notNull(),
  sector: varchar("sector", { length: 100 }),
  exchange: varchar("exchange", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const dailyPrices = pgTable("daily_prices", {
  priceId: serial("price_id").primaryKey(),
  stockId: integer("stock_id").notNull().references(() => stocks.stockId, { onDelete: "cascade" }),
  date: date("date").notNull(),
  open: numeric("open", { precision: 12, scale: 2 }).notNull(),
  high: numeric("high", { precision: 12, scale: 2 }).notNull(),
  low: numeric("low", { precision: 12, scale: 2 }).notNull(),
  close: numeric("close", { precision: 12, scale: 2 }).notNull(),
  adjustedClose: numeric("adjusted_close", { precision: 12, scale: 2 }),
  volume: bigint("volume", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueStockDate: uniqueIndex("unique_stock_date").on(table.stockId, table.date),
}));

export const stockMetrics = pgTable("stock_metrics", {
  metricId: serial("metric_id").primaryKey(),
  stockId: integer("stock_id").notNull().references(() => stocks.stockId, { onDelete: "cascade" }),
  date: date("date").notNull(),
  dailyReturn: numeric("daily_return", { precision: 10, scale: 4 }),
  movingAvg7d: numeric("moving_avg_7d", { precision: 12, scale: 2 }),
  movingAvg20d: numeric("moving_avg_20d", { precision: 12, scale: 2 }),
  volatility: numeric("volatility", { precision: 10, scale: 4 }),
  priceChange: numeric("price_change", { precision: 12, scale: 2 }),
  percentChange: numeric("percent_change", { precision: 10, scale: 4 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueStockMetricDate: uniqueIndex("unique_stock_metric_date").on(table.stockId, table.date),
}));

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const watchlist = pgTable("watchlist", {
  watchlistId: serial("watchlist_id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  stockId: integer("stock_id").notNull().references(() => stocks.stockId, { onDelete: "cascade" }),
  addedOn: timestamp("added_on", { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueUserStock: uniqueIndex("unique_user_stock").on(table.userId, table.stockId),
}));

export const pipelineRuns = pgTable("pipeline_runs", {
  runId: serial("run_id").primaryKey(),
  runDate: timestamp("run_date", { withTimezone: true }).defaultNow(),
  status: varchar("status", { length: 20 }).notNull(),
  stocksProcessed: integer("stocks_processed").default(0),
  recordsInserted: integer("records_inserted").default(0),
  recordsUpdated: integer("records_updated").default(0),
  errors: varchar("errors", { length: 2000 }),
  durationSeconds: numeric("duration_seconds", { precision: 10, scale: 2 }),
});

export const dataQualityResults = pgTable("data_quality_results", {
  resultId: serial("result_id").primaryKey(),
  runId: integer("run_id").references(() => pipelineRuns.runId),
  stockId: integer("stock_id").references(() => stocks.stockId),
  checkType: varchar("check_type", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  details: varchar("details", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
