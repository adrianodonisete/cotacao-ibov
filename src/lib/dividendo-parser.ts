export interface DividendoInput {
  code: string;
  payment_date: string; // ISO yyyy-mm-dd
  quantity: number;
  total_liquid: number;
}

export interface DividendoParseResult {
  rows: DividendoInput[];
  duplicityCount: number;
  ignoredCount: number;
}

function parseDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const ddmmyyyy = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;

  return null;
}

function parseNumber(raw: string): number | null {
  const n = parseFloat(raw.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function parseDividendosText(text: string): DividendoParseResult {
  const rows: DividendoInput[] = [];
  const seenKeys = new Set<string>();
  let duplicityCount = 0;
  let ignoredCount = 0;

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const cols = trimmed.split(";");
    if (cols.length !== 4) {
      ignoredCount++;
      continue;
    }

    const code = cols[0].trim().toUpperCase();
    const payment_date = parseDate(cols[1]);
    const quantity = parseNumber(cols[2]);
    const total_liquid = parseNumber(cols[3]);

    if (!code || !payment_date || quantity === null || total_liquid === null) {
      ignoredCount++;
      continue;
    }

    const key = `${code}|${quantity}|${payment_date}|${total_liquid}`;
    if (seenKeys.has(key)) {
      duplicityCount++;
      continue;
    }
    seenKeys.add(key);
    rows.push({ code, payment_date, quantity, total_liquid });
  }

  return { rows, duplicityCount, ignoredCount };
}
