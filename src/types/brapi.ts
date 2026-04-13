export interface BrapiResult {
  symbol: string;
  shortName: string;
  longName: string;
  currency: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  regularMarketVolume: number;
  regularMarketPreviousClose: number;
  regularMarketOpen: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  /** ISO 8601 — usado para derivar `date_update` em `cotacoes`. */
  regularMarketTime?: string;
  logourl?: string;
}

export interface BrapiResponse {
  results: BrapiResult[];
  requestedAt: string;
  took: string;
}
