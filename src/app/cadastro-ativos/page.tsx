"use client";

import { useState } from "react";
import { TYPES_ASSETS } from "@/lib/constants";

interface ParsedAsset {
  code: string;
  info: string;
  type: string;
  weight: number;
  status: "novo" | "duplicata_lote" | "duplicata_banco";
}

interface PreviewData {
  assets: ParsedAsset[];
  ignoredCount: number;
}

interface InsertResult {
  inserted: number;
  duplicates: string[];
  ignoredCount: number;
}

function parseTextarea(text: string): { valid: ParsedAsset[]; ignoredCount: number } {
  const lines = text.split("\n");
  const seenCodes = new Set<string>();
  const valid: ParsedAsset[] = [];
  let ignoredCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const cols = trimmed.split(";");
    if (cols.length !== 4) {
      ignoredCount++;
      continue;
    }

    const [rawCode, rawInfo, rawType, rawWeight] = cols;
    const code = rawCode.trim().toUpperCase();
    const info = rawInfo.trim();
    const type = rawType.trim().toLowerCase();
    const weightStr = rawWeight.trim().replace(",", ".");
    const weight = parseFloat(weightStr);

    if (!code || !info || !type || !TYPES_ASSETS[type] || isNaN(weight)) {
      ignoredCount++;
      continue;
    }

    if (seenCodes.has(code)) {
      valid.push({ code, info, type, weight, status: "duplicata_lote" });
    } else {
      seenCodes.add(code);
      valid.push({ code, info, type, weight, status: "novo" });
    }
  }

  return { valid, ignoredCount };
}

const STATUS_LABEL: Record<ParsedAsset["status"], string> = {
  novo: "Novo",
  duplicata_lote: "Duplicata (lote)",
  duplicata_banco: "Duplicata (banco)",
};

const STATUS_CLASS: Record<ParsedAsset["status"], string> = {
  novo: "text-emerald-400",
  duplicata_lote: "text-yellow-400",
  duplicata_banco: "text-red-400",
};

export default function CadastroAtivos() {
  const [rawText, setRawText] = useState("");
  const [view, setView] = useState<"input" | "preview" | "result">("input");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<InsertResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleParse() {
    setError(null);
    setLoading(true);

    const { valid, ignoredCount } = parseTextarea(rawText);

    if (valid.length === 0) {
      setError("Nenhuma linha válida encontrada. Verifique o formato dos dados.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/assets");
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao verificar ativos existentes.");
        setLoading(false);
        return;
      }

      const existingCodes = new Set<string>(
        (data.assets as { code: string }[]).map((a) => a.code)
      );

      const enriched = valid.map((a) =>
        a.status === "novo" && existingCodes.has(a.code)
          ? { ...a, status: "duplicata_banco" as const }
          : a
      );

      setPreview({ assets: enriched, ignoredCount });
      setView("preview");
    } catch {
      setError("Falha ao verificar ativos existentes no banco.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    setError(null);
    setLoading(true);

    const toInsert = preview.assets
      .filter((a) => a.status === "novo")
      .map(({ code, info, type, weight }) => ({ code, info, type, weight }));

    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets: toInsert }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao cadastrar ativos.");
        return;
      }

      setResult({
        inserted: data.inserted,
        duplicates: data.duplicates ?? [],
        ignoredCount: preview.ignoredCount,
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
    setView("input");
  }

  const newCount = preview?.assets.filter((a) => a.status === "novo").length ?? 0;
  const batchDupCount = preview?.assets.filter((a) => a.status === "duplicata_lote").length ?? 0;
  const dbDupCount = preview?.assets.filter((a) => a.status === "duplicata_banco").length ?? 0;

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Cadastro em Lote de Ativos</h1>
          <p className="mt-1 text-gray-400 text-sm">
            Cada linha: <code className="text-emerald-400">código;informação;tipo;peso</code>
            {" — "}tipos aceitos:{" "}
            {Object.keys(TYPES_ASSETS).map((t, i, arr) => (
              <span key={t}>
                <code className="text-emerald-400">{t}</code>
                {i < arr.length - 1 ? ", " : ""}
              </span>
            ))}
            . Linhas com <code className="text-gray-500">#</code> são ignoradas.
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
                htmlFor="list_assets"
                className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5"
              >
                Lista de Ativos
              </label>
              <textarea
                id="list_assets"
                name="list_assets"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={12}
                placeholder={"# Exemplo:\nPETR4;Petrobras PN;acao;10\nHGLG11;CSHG Logística;fii;5\n# linhas com # são ignoradas"}
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
            <div className="flex flex-wrap gap-4 text-sm">
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
              {preview.ignoredCount > 0 && (
                <span className="px-3 py-1.5 rounded-lg bg-gray-700 text-gray-400">
                  {preview.ignoredCount} linha{preview.ignoredCount !== 1 ? "s" : ""} ignorada{preview.ignoredCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Código</th>
                    <th className="px-4 py-3 text-left">Informações</th>
                    <th className="px-4 py-3 text-left">Tipo</th>
                    <th className="px-4 py-3 text-right">Peso</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {preview.assets.map((a, i) => (
                    <tr key={i} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-white">{a.code}</td>
                      <td className="px-4 py-3 text-gray-300 max-w-xs truncate">{a.info}</td>
                      <td className="px-4 py-3 text-gray-400">{TYPES_ASSETS[a.type] ?? a.type}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{a.weight.toFixed(2)}</td>
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
                {loading ? "Salvando..." : `Confirmar (${newCount} ativo${newCount !== 1 ? "s" : ""})`}
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
                <ResultRow label="Ativos cadastrados" value={result.inserted} color="text-emerald-400" />
                <ResultRow
                  label="Duplicatas encontradas"
                  value={result.duplicates.length}
                  color="text-red-400"
                  detail={result.duplicates.length > 0 ? result.duplicates.join(", ") : undefined}
                />
                <ResultRow label="Linhas ignoradas" value={result.ignoredCount} color="text-gray-400" />
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
  detail,
}: {
  label: string;
  value: number;
  color: string;
  detail?: string;
}) {
  return (
    <div className="px-6 py-4">
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-sm">{label}</span>
        <span className={`text-2xl font-bold ${color}`}>{value}</span>
      </div>
      {detail && <p className="mt-1 text-xs text-gray-500 font-mono">{detail}</p>}
    </div>
  );
}
