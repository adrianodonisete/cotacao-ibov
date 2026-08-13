import type { SupabaseClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import path from "node:path";
import type { DividendoInput, DividendoInputWithLine } from "@/types/dividendo";
import type { LogEntry } from "./dividendo-parser";

type FetchError = { message?: string } | null | undefined;
type FetchResult = { data: unknown; error: FetchError };

interface SupabaseQuery<T> {
  select(cols?: string): SupabaseQuery<T>;
  insert(rows: T[]): SupabaseQuery<T>;
  in(col: string, values: string[]): SupabaseQuery<T>;
  eq(col: string, value: string): SupabaseQuery<T>;
  limit(n: number): SupabaseQuery<T>;
  then<U>(resolve: (value: FetchResult) => U): Promise<U>;
}

export interface ProcessSupabase {
  from(table: "dividendos"): SupabaseQuery<DividendoInput>;
}

export interface DividendoBatchResult {
  inserted: number;
  dbDuplicates: number;
  errorCount: number;
  logPath: string | null;
}

export type LogFileWriter = (path: string, content: string) => void;

const defaultFileWriter: LogFileWriter = (p, content) => {
  writeFileSync(p, content, "utf8");
};

function formatCsvLine(entry: LogEntry): string {
  return [
    entry.code,
    entry.payment_date,
    String(entry.quantity),
    String(entry.total_liquido),
    entry.status,
    entry.line_number,
    entry.detalhe_erro,
  ].join(";");
}

function sanitizeError(message: string): string {
  return message.replace(/;/g, ",").replace(/[\r\n]/g, " ");
}

function timestampForFilename(date: Date): string {
  const Y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const H = String(date.getHours()).padStart(2, "0");
  const i = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${Y}${m}${d}${H}${i}${s}`;
}

async function rowExists(
  supabase: ProcessSupabase | SupabaseClient,
  row: DividendoInput
): Promise<boolean> {
  const { data, error } = (await supabase
    .from("dividendos")
    .select("id")
    .eq("code", row.code)
    .eq("payment_date", row.payment_date)
    .eq("quantity", row.quantity)
    .eq("total_liquid", row.total_liquid)
    .limit(1)) as FetchResult;

  if (error) {
    throw new Error(error.message ?? "Erro ao verificar dividendos no banco.");
  }

  return Array.isArray(data) && data.length > 0;
}

export async function processDividendosBatch(
  supabase: ProcessSupabase | SupabaseClient,
  rows: DividendoInputWithLine[],
  outcomes: LogEntry[] = [],
  writer: LogFileWriter = defaultFileWriter,
  now: () => Date = () => new Date()
): Promise<DividendoBatchResult> {
  const toInsert: DividendoInputWithLine[] = [];
  const serverOutcomes: LogEntry[] = [];
  let dbDuplicates = 0;

  for (const row of rows) {
    if (await rowExists(supabase, row)) {
      dbDuplicates += 1;
      serverOutcomes.push({
        code: row.code,
        payment_date: row.payment_date,
        quantity: row.quantity,
        total_liquido: row.total_liquid,
        status: "duplicidade",
        line_number: row.lineNumber,
        detalhe_erro: "",
      });
      continue;
    }
    toInsert.push(row);
  }

  let inserted = 0;
  let errorCount = 0;

  for (const row of toInsert) {
    const payload: DividendoInput = {
      code: row.code,
      payment_date: row.payment_date,
      quantity: row.quantity,
      total_liquid: row.total_liquid,
    };
    const { error } = (await supabase
      .from("dividendos")
      .insert([payload])
      .select()) as FetchResult;

    if (error) {
      errorCount += 1;
      serverOutcomes.push({
        code: row.code,
        payment_date: row.payment_date,
        quantity: row.quantity,
        total_liquido: row.total_liquid,
        status: "erro",
        line_number: row.lineNumber,
        detalhe_erro: sanitizeError(error.message || "Erro desconhecido"),
      });
      continue;
    }
    inserted += 1;
    serverOutcomes.push({
      code: row.code,
      payment_date: row.payment_date,
      quantity: row.quantity,
      total_liquido: row.total_liquid,
      status: "inserido",
      line_number: row.lineNumber,
      detalhe_erro: "",
    });
  }

  const allOutcomes = [...outcomes, ...serverOutcomes].sort(
    (a, b) => a.line_number - b.line_number
  );

  let logPath: string | null = null;
  try {
    const filename = `dividendos_${timestampForFilename(now())}.csv`;
    const fullPath = path.join(process.cwd(), "log", "cadastro", filename);
    const header = "codigo;data_pagamento;quantidade;total_liquido;status;line_number;detalhe_erro";
    const body = allOutcomes.map(formatCsvLine).join("\n");
    const content = allOutcomes.length > 0 ? `${header}\n${body}\n` : `${header}\n`;
    writer(fullPath, content);
    logPath = fullPath;
  } catch (err) {
    console.error("Erro ao gravar log de dividendos:", err);
  }

  return { inserted, dbDuplicates, errorCount, logPath };
}
