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
  logourl?: string;
}

export interface BrapiResponse {
  results: BrapiResult[];
  requestedAt: string;
  took: string;
}
