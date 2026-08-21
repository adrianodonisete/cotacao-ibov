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

type AtivoRow = { code: string; type: string };
type CategoryRow = { name: string };
type DividendoRow = { code: string; payment_date: string; total_liquid: number };
type CotacaoRow = { code: string; value: number };
type ExistingCacheRow = { chave: string; opcao: string; periodo: string };

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

  const [ativosRes, catRes, divsRes, cotRes, cacheRes] = await Promise.all([
    supabase.from("ativos").select("code, type").neq("type", "td"),
    supabase
      .from("categories")
      .select("name")
      .in("name", ["acao", "fii", "stock", "reit"]),
    supabase
      .from("dividendos")
      .select("code, payment_date, total_liquid")
      .gte("payment_date", first)
      .lte("payment_date", last),
    supabase.from("cotacoes").select("code, value").eq("code", "USD_BRL"),
    supabase.from("total_dividends_cache").select("chave, opcao, periodo"),
  ]);

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

  return { ok: 0, fail: 0, skipped: 0 };
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