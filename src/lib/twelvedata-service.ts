import twelvedata from "twelvedata";

export interface TwelvedataTickerResult {
  price: number;
  date_update: string; // yyyy-mm-dd (today — /price has no timestamp)
}

type RawSingleResponse = { price: string };
type RawTickerEntry = { price: string } | { code: number; message: string; status: "error" };
type RawMultiResponse = Record<string, RawTickerEntry>;

function isErrorEntry(entry: RawTickerEntry): entry is { code: number; message: string; status: "error" } {
  return (entry as { status?: string }).status === "error";
}

function isSingleResponse(body: unknown): body is RawSingleResponse {
  return (
    typeof body === "object" &&
    body !== null &&
    "price" in body &&
    typeof (body as RawSingleResponse).price === "string"
  );
}

function getClient() {
  const key = process.env.TWELVEDATA_API_KEY?.trim();
  if (!key) {
    throw new Error("TWELVEDATA_API_KEY não configurado. Configure em .env.local.");
  }
  return twelvedata({ key });
}

/**
 * Fetches real-time prices for a batch of tickers using the `twelvedata` library.
 * Costs 1 credit per ticker (free tier: 8 credits/min).
 *
 * Returns a map: code → { price, date_update } | null
 * null means the API returned an error for that specific ticker.
 */
export async function fetchPricesForTickers(
  tickers: string[]
): Promise<Record<string, TwelvedataTickerResult | null>> {
  if (tickers.length === 0) return {};

  const client = getClient();
  const today = new Date().toISOString().split("T")[0]!;

  const body: unknown = await client.price({ symbol: tickers.join(",") });

  const result: Record<string, TwelvedataTickerResult | null> = {};

  if (tickers.length === 1) {
    const code = tickers[0]!;
    if (isSingleResponse(body)) {
      const price = parseFloat(body.price);
      result[code] = isNaN(price) ? null : { price, date_update: today };
    } else {
      result[code] = null;
    }
    return result;
  }

  // Multi-symbol response
  const multi = body as RawMultiResponse;
  for (const code of tickers) {
    const entry = multi[code];
    if (!entry) {
      result[code] = null;
      continue;
    }
    if (isErrorEntry(entry)) {
      result[code] = null;
      continue;
    }
    const price = parseFloat((entry as RawSingleResponse).price);
    result[code] = isNaN(price) ? null : { price, date_update: today };
  }

  return result;
}
