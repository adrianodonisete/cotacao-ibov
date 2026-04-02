"use client";

import { useState } from "react";

interface ParsedAporte {
  code: string;
  qtd: number;
  value_total: number;
  date_operation: string; // yyyy-mm-dd
  currency: string;
  dolar_value: number;
  info: string;
  status: "novo" | "duplicata_lote" | "duplicata_banco";
}

interface InsertResult {
  inserted: number;
  dbDuplicates: number;
  batchDuplicates: number;
  ignoredCount: number;
}

function parseDate(raw: string): string | null {
  const ddmmyyyy = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim();
  return null;
}

function normalizeCurrency(val: string | undefined): string {
  const v = (val ?? "").trim().toUpperCase();
  return v === "USD" || v === "BRL" ? v : "BRL";
}

function normalizeDolarValue(val: string | undefined): number {
  const n = parseFloat((val ?? "").trim().replace(",", "."));
  return isNaN(n) ? 0.0 : n;
}

function parseTextarea(text: string): {
  valid: ParsedAporte[];
  ignoredCount: number;
} {
  const lines = text.split("\n");
  const seenKeys = new Set<string>();
  const valid: ParsedAporte[] = [];
  let ignoredCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const cols = trimmed.split(";");
    if (cols.length < 4 || cols.length > 7) {
      ignoredCount++;
      continue;
    }

    const [rawCode, rawQtd, rawValue, rawDate, rawCurrency, rawDolarValue, rawInfo] = cols;
    const code = rawCode.trim().toUpperCase();
    const qtd = parseFloat(rawQtd.trim().replace(",", "."));
    const value_total = parseFloat(rawValue.trim().replace(",", "."));
    const date_operation = parseDate(rawDate.trim());

    if (!code || isNaN(qtd) || isNaN(value_total) || !date_operation) {
      ignoredCount++;
      continue;
    }

    const currency = normalizeCurrency(rawCurrency);
    const dolar_value = normalizeDolarValue(rawDolarValue);
    const info = (rawInfo ?? "").trim();

    const key = `${code}|${qtd}|${date_operation}`;
    if (seenKeys.has(key)) {
      valid.push({ code, qtd, value_total, date_operation, currency, dolar_value, info, status: "duplicata_lote" });
    } else {
      seenKeys.add(key);
      valid.push({ code, qtd, value_total, date_operation, currency, dolar_value, info, status: "novo" });
    }
  }

  return { valid, ignoredCount };
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function formatQtd(value: number): string {
  const n = Number(value);
  if (n % 1 === 0) return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function formatValue(value: number): string {
  return Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const STATUS_LABEL: Record<ParsedAporte["status"], string> = {
  novo: "Novo",
  duplicata_lote: "Duplicata (lote)",
  duplicata_banco: "Duplicata (banco)",
};

const STATUS_CLASS: Record<ParsedAporte["status"], string> = {
  novo: "text-emerald-400",
  duplicata_lote: "text-yellow-400",
  duplicata_banco: "text-red-400",
};

export default function CadastroAportes() {
  const [rawText, setRawText] = useState("");
  const [view, setView] = useState<"input" | "preview" | "result">("input");
  const [preview, setPreview] = useState<ParsedAporte[] | null>(null);
  const [ignoredCount, setIgnoredCount] = useState(0);
  const [result, setResult] = useState<InsertResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleParse() {
    setError(null);
    setLoading(true);

    const { valid, ignoredCount: ignored } = parseTextarea(rawText);
    setIgnoredCount(ignored);

    if (valid.length === 0) {
      setError("Nenhuma linha válida encontrada. Verifique o formato: código;quantidade;valor total;data[;moeda[;dólar[;info]]]");
      setLoading(false);
      return;
    }

    // Check DB duplicates only for "novo" items (not already batch duplicates)
    const toCheck = valid.filter((a) => a.status === "novo");

    try {
      const res = await fetch("/api/aportes/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aportes: toCheck.map(({ code, qtd, date_operation }) => ({
            code,
            qtd,
            date_operation,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao verificar duplicatas no banco.");
        setLoading(false);
        return;
      }

      const dbDupKeys = new Set<string>(
        (data.duplicates as { code: string; qtd: number; date_operation: string }[]).map(
          (d) => `${d.code}|${Number(d.qtd)}|${d.date_operation}`
        )
      );

      const enriched = valid.map((a) => {
        if (a.status === "novo" && dbDupKeys.has(`${a.code}|${a.qtd}|${a.date_operation}`)) {
          return { ...a, status: "duplicata_banco" as const };
        }
        return a;
      });

      setPreview(enriched);
      setView("preview");
    } catch {
      setError("Falha ao verificar duplicatas.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    setError(null);
    setLoading(true);

    const toInsert = preview
      .filter((a) => a.status === "novo")
      .map(({ code, qtd, value_total, date_operation, currency, dolar_value, info }) => ({
        code,
        qtd,
        value_total,
        date_operation,
        currency,
        dolar_value,
        info,
      }));

    const batchDuplicates = preview.filter((a) => a.status === "duplicata_lote").length;
    const dbDuplicates = preview.filter((a) => a.status === "duplicata_banco").length;

    try {
      const res = await fetch("/api/aportes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aportes: toInsert }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao cadastrar aportes.");
        return;
      }

      setResult({
        inserted: data.inserted,
        dbDuplicates: dbDuplicates + (data.duplicates?.length ?? 0),
        batchDuplicates,
        ignoredCount,
      });
      setView("result");
    } catch {
      setError("Falha na comunicação com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setRawText("");
    setPreview(null);
    setResult(null);
    setError(null);
    setIgnoredCount(0);
    setView("input");
  }

  const newCount = preview?.filter((a) => a.status === "novo").length ?? 0;
  const batchDupCount = preview?.filter((a) => a.status === "duplicata_lote").length ?? 0;
  const dbDupCount = preview?.filter((a) => a.status === "duplicata_banco").length ?? 0;

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Cadastro Aportes</h1>
          <p className="mt-1 text-gray-400 text-sm">
            Cada linha:{" "}
            <code className="text-emerald-400">código;quantidade;valor total;data[;moeda[;dólar[;info]]]</code>
            {" — "}data aceita em{" "}
            <code className="text-emerald-400">dd/mm/aaaa</code> ou{" "}
            <code className="text-emerald-400">aaaa-mm-dd</code>. Moeda:{" "}
            <code className="text-emerald-400">BRL</code> ou{" "}
            <code className="text-emerald-400">USD</code> (padrão: BRL). Linhas com{" "}
            <code className="text-gray-500">#</code> são ignoradas.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-900/40 border border-red-700 px-4 py-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* VIEW: INPUT */}
        {view === "input" && (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="list_aportes"
                className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5"
              >
                Lista de Aportes
              </label>
              <textarea
                id="list_aportes"
                name="list_aportes"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={12}
                placeholder={"# Exemplos:\nPETR4;100;3250,00;15/01/2025\nVALE3;50;4100,50;2025-01-20;BRL\nIVVB11;10;2500,00;2025-01-20;USD;5.10;ETF S&P500\n# linhas com # são ignoradas"}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-600 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition resize-y"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleParse}
                disabled={loading || !rawText.trim()}
                className="rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed px-6 py-3 font-semibold text-gray-950 transition-colors"
              >
                {loading ? "Verificando..." : "Cadastrar"}
              </button>
            </div>
          </div>
        )}

        {/* VIEW: PREVIEW */}
        {view === "preview" && preview && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                {newCount} novo{newCount !== 1 ? "s" : ""}
              </span>
              {batchDupCount > 0 && (
                <span className="px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
                  {batchDupCount} duplicata{batchDupCount !== 1 ? "s" : ""} no lote
                </span>
              )}
              {dbDupCount > 0 && (
                <span className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
                  {dbDupCount} duplicata{dbDupCount !== 1 ? "s" : ""} no banco
                </span>
              )}
              {ignoredCount > 0 && (
                <span className="px-3 py-1.5 rounded-lg bg-gray-700 text-gray-400">
                  {ignoredCount} linha{ignoredCount !== 1 ? "s" : ""} ignorada{ignoredCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-max">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Código</th>
                    <th className="px-4 py-3 text-right">Quantidade</th>
                    <th className="px-4 py-3 text-right">Valor Total</th>
                    <th className="px-4 py-3 text-center">Data</th>
                    <th className="px-4 py-3 text-center">Moeda</th>
                    <th className="px-4 py-3 text-right">Dólar</th>
                    <th className="px-4 py-3 text-left">Info</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {preview.map((a, i) => (
                    <tr key={i} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-white">{a.code}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{formatQtd(a.qtd)}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{formatValue(a.value_total)}</td>
                      <td className="px-4 py-3 text-center text-gray-300">{formatDate(a.date_operation)}</td>
                      <td className="px-4 py-3 text-center text-gray-300">{a.currency}</td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {a.dolar_value > 0 ? formatValue(a.dolar_value) : "—"}
                      </td>
                      <td className="px-4 py-3 text-left text-gray-300">{a.info || "—"}</td>
                      <td className={`px-4 py-3 text-right font-medium ${STATUS_CLASS[a.status]}`}>
                        {STATUS_LABEL[a.status]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={handleReset}
                className="rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 px-6 py-3 font-semibold transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading || newCount === 0}
                className="rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed px-6 py-3 font-semibold text-gray-950 transition-colors"
              >
                {loading
                  ? "Salvando..."
                  : `Confirmar (${newCount} aporte${newCount !== 1 ? "s" : ""})`}
              </button>
            </div>
          </div>
        )}

        {/* VIEW: RESULT */}
        {view === "result" && result && (
          <div className="space-y-6">
            <div className="rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-800">
                <h2 className="text-lg font-bold text-white">Resultado do Cadastro</h2>
              </div>
              <div className="divide-y divide-gray-800">
                <ResultRow
                  label="Aportes cadastrados"
                  value={result.inserted}
                  color="text-emerald-400"
                />
                <ResultRow
                  label="Duplicatas encontradas (banco)"
                  value={result.dbDuplicates}
                  color="text-red-400"
                />
                <ResultRow
                  label="Duplicatas encontradas (lote)"
                  value={result.batchDuplicates}
                  color="text-yellow-400"
                />
                <ResultRow
                  label="Linhas ignoradas"
                  value={result.ignoredCount}
                  color="text-gray-400"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleReset}
                className="rounded-lg bg-emerald-500 hover:bg-emerald-400 px-6 py-3 font-semibold text-gray-950 transition-colors"
              >
                Novo Cadastro
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function ResultRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="px-6 py-4 flex items-center justify-between">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
    </div>
  );
}
