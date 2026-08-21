import "./env";
import { getSupabaseServer } from "../src/lib/supabase";
import { parseJobId, updateJobProgress, finishJob } from "./job-progress";

type Opcao = "mensal" | "anual";

export function monthsBetween(firstISO: string, lastISO: string): string[] {
  const [fy, fm] = firstISO.split("-").map(Number);
  const [ly, lm] = lastISO.split("-").map(Number);
  const out: string[] = [];
  let y = fy;
  let m = fm;
  while (y < ly || (y === ly && m <= lm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

export function yearsBetween(firstISO: string, lastISO: string): string[] {
  const start = parseInt(firstISO.slice(0, 4), 10);
  const end = parseInt(lastISO.slice(0, 4), 10);
  const out: string[] = [];
  for (let y = start; y <= end; y++) out.push(String(y));
  return out;
}

export function currentMonthLabel(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function currentYearLabel(now: Date = new Date()): string {
  return String(now.getUTCFullYear());
}

export function shouldRecalculate(
  periodo: string,
  opcao: Opcao,
  now: Date = new Date()
): boolean {
  if (opcao === "mensal") return periodo === currentMonthLabel(now);
  return periodo === currentYearLabel(now);
}

async function resolvePeriod(): Promise<{ first: string; last: string }> {
  const supabase = getSupabaseServer();
  const { data: firstRows, error: e1 } = await supabase
    .from("dividendos")
    .select("payment_date")
    .order("payment_date", { ascending: true })
    .limit(1);
  const { data: lastRows, error: e2 } = await supabase
    .from("dividendos")
    .select("payment_date")
    .order("payment_date", { ascending: false })
    .limit(1);
  if (e1 || e2) {
    throw new Error(
      `Erro ao consultar dividendos: ${e1?.message ?? e2?.message ?? "unknown"}`
    );
  }

  const now = new Date();
  const ym = currentMonthLabel(now);
  const fallback = `${ym}-01`;

  const first = (firstRows ?? [])[0] as { payment_date: string } | undefined;
  const last = (lastRows ?? [])[0] as { payment_date: string } | undefined;
  if (!first || !last) return { first: fallback, last: fallback };
  return {
    first: String(first.payment_date).slice(0, 10),
    last: String(last.payment_date).slice(0, 10),
  };
}

async function fetchAllDividendos(
  supabase: ReturnType<typeof getSupabaseServer>,
  first: string,
  last: string
): Promise<{ data: DividendoRow[]; error: { message: string } | null }> {
  const PAGE = 1000;
  const out: DividendoRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("dividendos")
      .select("code, payment_date, total_liquid")
      .gte("payment_date", first)
      .lte("payment_date", last)
      .order("payment_date", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return { data: [], error };
    const rows = (data ?? []) as DividendoRow[];
    out.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return { data: out, error: null };
}

type AtivoRow = { code: string; type: string };
type CategoryRow = { name: string };
type DividendoRow = { code: string; payment_date: string; total_liquid: number };
type CotacaoRow = { code: string; value: number };
type ExistingCacheRow = { chave: string; opcao: string; periodo: string };

type UpsertPayload = {
  chave: string;
  opcao: Opcao;
  periodo: string;
  total_dividends: number;
  updated_at: string;
};

export function convert(total: number, type: string, usdBrl: number): number {
  if ((type === "stock" || type === "reit") && usdBrl > 0) return total / usdBrl;
  return total;
}

async function upsertBatch(
  supabase: ReturnType<typeof getSupabaseServer>,
  rows: UpsertPayload[]
): Promise<{ ok: number; err: string | null }> {
  if (rows.length === 0) return { ok: 0, err: null };
  const { error } = await supabase
    .from("total_dividends_cache")
    .upsert(rows, { onConflict: "chave,opcao,periodo" });
  return { ok: rows.length, err: error?.message ?? null };
}

async function main(): Promise<{ ok: number; fail: number; skipped: number }> {
  const supabase = getSupabaseServer();
  const jobId = parseJobId();

  let period: { first: string; last: string };
  try {
    period = await resolvePeriod();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[calculate-totals-by-dividends]", msg);
    if (jobId !== null) await finishJob(supabase, jobId, "error");
    process.exit(1);
  }
  const { first, last } = period;
  console.log(`Period: ${first} → ${last}`);

  const [ativosRes, catRes, cotRes, cacheRes] = await Promise.all([
    supabase.from("ativos").select("code, type").neq("type", "td"),
    supabase
      .from("categories")
      .select("name")
      .in("name", ["acao", "fii", "stock", "reit"]),
    supabase.from("cotacoes").select("code, value").eq("code", "USD_BRL"),
    supabase.from("total_dividends_cache").select("chave, opcao, periodo"),
  ]);

  const divsRes = await fetchAllDividendos(supabase, first, last);

  if (
    ativosRes.error ||
    catRes.error ||
    divsRes.error ||
    cotRes.error ||
    cacheRes.error
  ) {
    const msg =
      ativosRes.error?.message ??
      catRes.error?.message ??
      divsRes.error?.message ??
      cotRes.error?.message ??
      cacheRes.error?.message ??
      "unknown";
    console.error("Erro pré-carregando dados:", msg);
    if (jobId !== null) await finishJob(supabase, jobId, "error");
    process.exit(1);
  }

  const ativosList: AtivoRow[] = (ativosRes.data ?? []) as AtivoRow[];
  const categorias: string[] = ((catRes.data ?? []) as CategoryRow[]).map(
    (c) => c.name
  );

  const byCodeMonth = new Map<string, Map<string, number>>();
  const byCodeYear = new Map<string, Map<string, number>>();
  for (const d of (divsRes.data ?? []) as DividendoRow[]) {
    const ymd = String(d.payment_date).slice(0, 10);
    const month = ymd.slice(0, 7);
    const year = ymd.slice(0, 4);
    const total = Number(d.total_liquid ?? 0);

    const bm = byCodeMonth.get(d.code) ?? new Map<string, number>();
    bm.set(month, (bm.get(month) ?? 0) + total);
    byCodeMonth.set(d.code, bm);

    const by = byCodeYear.get(d.code) ?? new Map<string, number>();
    by.set(year, (by.get(year) ?? 0) + total);
    byCodeYear.set(d.code, by);
  }

  const usdBrl = Number(
    ((cotRes.data ?? [])[0] as CotacaoRow | undefined)?.value ?? 0
  );
  if (usdBrl <= 0) {
    console.warn(
      "[calculate-totals-by-dividends] cotacoes.value para USD_BRL ausente; " +
        "ativos stock/reit manterão valor em BRL."
    );
  }

  const existing = new Set<string>();
  for (const r of (cacheRes.data ?? []) as ExistingCacheRow[]) {
    existing.add(`${r.chave}|${r.opcao}|${r.periodo}`);
  }

  console.log(
    `Carregados: ${ativosList.length} ativos, ${categorias.length} categorias, ${
      (divsRes.data ?? []).length
    } dividendos.`
  );

  const meses = monthsBetween(first, last);
  const anos = yearsBetween(first, last);
  const now = new Date();
  const upserts: UpsertPayload[] = [];
  let skipped = 0;

  function push(
    chave: string,
    opcao: Opcao,
    periodo: string,
    raw: number,
    type: string
  ): void {
    const key = `${chave}|${opcao}|${periodo}`;
    const isCurrent = shouldRecalculate(periodo, opcao, now);
    if (!isCurrent && existing.has(key)) {
      skipped++;
      return;
    }
    if (raw <= 0 && !isCurrent) return;
    upserts.push({
      chave,
      opcao,
      periodo,
      total_dividends: convert(raw, type, usdBrl),
      updated_at: new Date().toISOString(),
    });
  }

  for (const a of ativosList) {
    for (const m of meses) {
      push(a.code, "mensal", m, byCodeMonth.get(a.code)?.get(m) ?? 0, a.type);
    }
    for (const y of anos) {
      push(a.code, "anual", y, byCodeYear.get(a.code)?.get(y) ?? 0, a.type);
    }
  }

  for (const cat of categorias) {
    const codes = ativosList.filter((a) => a.type === cat).map((a) => a.code);
    for (const m of meses) {
      let soma = 0;
      for (const c of codes) soma += byCodeMonth.get(c)?.get(m) ?? 0;
      push(cat, "mensal", m, soma, cat);
    }
    for (const y of anos) {
      let soma = 0;
      for (const c of codes) soma += byCodeYear.get(c)?.get(y) ?? 0;
      push(cat, "anual", y, soma, cat);
    }
  }

  const BATCH = 500;
  let ok = 0;
  let fail = 0;
  for (let i = 0; i < upserts.length; i += BATCH) {
    const slice = upserts.slice(i, i + BATCH);
    const r = await upsertBatch(supabase, slice);
    if (r.err) {
      console.error(
        `[batch ${i}-${i + slice.length}] upsert falhou:`,
        r.err
      );
      fail += slice.length;
    } else {
      ok += r.ok;
      console.log(`[batch ${i}-${i + slice.length}] OK (${r.ok} rows)`);
    }
    if (jobId !== null) await updateJobProgress(supabase, jobId, ok + skipped, fail);
  }

  console.log(
    `Done: upserted=${ok} skipped(existing)=${skipped} failed=${fail} planned=${upserts.length}`
  );
  if (jobId !== null) await finishJob(supabase, jobId, fail > 0 ? "error" : "done");
  return { ok, fail, skipped };
}

if (require.main === module) {
  main()
    .then((r) => process.exit(r.fail > 0 ? 1 : 0))
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Falha fatal no calculate-totals-by-dividends:", msg);
      process.exit(1);
    });
}