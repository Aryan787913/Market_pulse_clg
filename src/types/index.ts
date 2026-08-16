export interface Stock {
  stockId: number;
  symbol: string;
  companyName: string;
  sector: string | null;
  exchange: string | null;
  createdAt: Date | null;
}

export interface DailyPrice {
  priceId: number;
  stockId: number;
  date: string;
  open: string;
  high: string;
  low: string;
  close: string;
  adjustedClose: string | null;
  volume: number;
  createdAt: Date | null;
}

export interface StockMetric {
  metricId: number;
  stockId: number;
  date: string;
  dailyReturn: string | null;
  movingAvg7d: string | null;
  movingAvg20d: string | null;
  volatility: string | null;
  priceChange: string | null;
  percentChange: string | null;
  createdAt: Date | null;
}

export interface StockWithPrice extends Stock {
  latestPrice?: DailyPrice | null;
  latestMetric?: StockMetric | null;
}

export interface MarketSummary {
  totalStocks: number;
  topGainers: StockWithPrice[];
  topLosers: StockWithPrice[];
  mostActive: StockWithPrice[];
  lastUpdated: string | null;
}

export interface WatchlistItem {
  watchlistId: number;
  userId: string;
  stockId: number;
  addedOn: Date | null;
  stock: Stock | null;
  latestPrice?: DailyPrice | null;
  latestMetric?: StockMetric | null;
}

export interface PipelineRun {
  runId: number;
  runDate: Date | null;
  status: string;
  stocksProcessed: number | null;
  recordsInserted: number | null;
  recordsUpdated: number | null;
  errors: string | null;
  durationSeconds: string | null;
}

export interface DataQualityResult {
  resultId: number;
  runId: number | null;
  stockId: number | null;
  checkType: string;
  status: string;
  details: string | null;
  createdAt: Date | null;
}
