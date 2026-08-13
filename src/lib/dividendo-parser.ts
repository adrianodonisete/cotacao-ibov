import type { DividendoInputWithLine } from "@/types/dividendo";

export type LogStatus =
  | "inserido"
  | "duplicidade"
  | "ignorado"
  | "erro"
  | "vazio"
  | "comentario";

export interface LogEntry {
  code: string;
  payment_date: string;
  quantity: number | string;
  total_liquido: number | string;
  status: LogStatus;
  line_number: number;
}

export interface DividendoParseResult {
  rows: DividendoInputWithLine[];
  outcomes: LogEntry[];
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
  const rows: DividendoInputWithLine[] = [];
  const outcomes: LogEntry[] = [];
  const seenKeys = new Set<string>();
  let duplicityCount = 0;
  let ignoredCount = 0;

  let lineNumber = 0;
  for (const line of text.split("\n")) {
    lineNumber += 1;
    const trimmed = line.trim();

    if (!trimmed) {
      outcomes.push({
        code: "",
        payment_date: "",
        quantity: "",
        total_liquido: "",
        status: "vazio",
        line_number: lineNumber,
      });
      continue;
    }

    if (trimmed.startsWith("#")) {
      outcomes.push({
        code: "",
        payment_date: "",
        quantity: "",
        total_liquido: "",
        status: "comentario",
        line_number: lineNumber,
      });
      continue;
    }

    const cols = trimmed.split(";");
    if (cols.length !== 4) {
      ignoredCount += 1;
      outcomes.push({
        code: cols[0] ?? "",
        payment_date: cols[1] ?? "",
        quantity: cols[2] ?? "",
        total_liquido: cols[3] ?? "",
        status: "ignorado",
        line_number: lineNumber,
      });
      continue;
    }

    const code = cols[0].trim().toUpperCase();
    const payment_date = parseDate(cols[1]);
    const quantity = parseNumber(cols[2]);
    const total_liquid = parseNumber(cols[3]);

    if (!code || !payment_date || quantity === null || total_liquid === null) {
      ignoredCount += 1;
      outcomes.push({
        code: cols[0].trim(),
        payment_date: cols[1].trim(),
        quantity: cols[2].trim(),
        total_liquido: cols[3].trim(),
        status: "ignorado",
        line_number: lineNumber,
      });
      continue;
    }

    const key = `${code}|${quantity}|${payment_date}|${total_liquid}`;
    if (seenKeys.has(key)) {
      duplicityCount += 1;
      outcomes.push({
        code,
        payment_date,
        quantity,
        total_liquido: total_liquid,
        status: "duplicidade",
        line_number: lineNumber,
      });
      continue;
    }
    seenKeys.add(key);
    rows.push({ code, payment_date, quantity, total_liquid, lineNumber });
  }

  return { rows, outcomes, duplicityCount, ignoredCount };
}
