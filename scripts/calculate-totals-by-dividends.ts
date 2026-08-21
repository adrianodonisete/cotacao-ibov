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
  console.log(`Period: ${period.first} → ${period.last}`);

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