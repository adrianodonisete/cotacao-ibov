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

async function main(): Promise<{ ok: number; fail: number; skipped: number }> {
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