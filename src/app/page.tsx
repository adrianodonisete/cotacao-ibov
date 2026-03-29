"use client";

import { useState, FormEvent } from "react";
import { BrapiResult } from "@/types/brapi";

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export default function Home() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<BrapiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/quote?code=${encodeURIComponent(code.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao buscar cotação.");
        return;
      }

      if (!data.results || data.results.length === 0) {
        setError("Ativo não encontrado. Verifique o código digitado.");
        return;
      }

      setResult(data.results[0]);
    } catch {
      setError("Falha na comunicação com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  const isPositive = result ? result.regularMarketChangePercent >= 0 : true;

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Cotação <span className="text-emerald-400">IBOV</span>
          </h1>
          <p className="mt-2 text-gray-400 text-sm">
            Consulte a cotação atual de ações e FIIs da B3
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-3">
          <div className="flex-1">
            <label
              htmlFor="code"
              className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5"
            >
              Ação / FII
            </label>
            <input
              id="code"
              name="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ex: PETR4, ABEV3, XPLG11"
              autoComplete="off"
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed px-6 py-3 font-semibold text-gray-950 transition-colors"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Buscando
                </span>
              ) : (
                "Buscar"
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-6 rounded-lg bg-red-900/40 border border-red-700 px-4 py-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-8 rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {result.symbol}
                </span>
                <h2 className="text-lg font-bold text-white mt-0.5">
                  {result.shortName || result.longName}
                </h2>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-white">
                  {formatCurrency(result.regularMarketPrice)}
                </p>
                <p
                  className={`text-sm font-semibold mt-0.5 ${
                    isPositive ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {formatCurrency(result.regularMarketChange)}{" "}
                  ({formatPercent(result.regularMarketChangePercent)})
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-gray-800">
              <div className="grid grid-rows-2 divide-y divide-gray-800">
                <Stat label="Abertura" value={formatCurrency(result.regularMarketOpen)} />
                <Stat label="Fechamento Ant." value={formatCurrency(result.regularMarketPreviousClose)} />
              </div>
              <div className="grid grid-rows-2 divide-y divide-gray-800">
                <Stat label="Máxima do Dia" value={formatCurrency(result.regularMarketDayHigh)} />
                <Stat label="Mínima do Dia" value={formatCurrency(result.regularMarketDayLow)} />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between text-sm text-gray-400">
              <span>Volume</span>
              <span className="text-white font-medium">{formatNumber(result.regularMarketVolume)}</span>
            </div>

            {(result.fiftyTwoWeekHigh || result.fiftyTwoWeekLow) && (
              <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between text-sm text-gray-400">
                <span>52 semanas</span>
                <span className="text-white font-medium">
                  {formatCurrency(result.fiftyTwoWeekLow)} — {formatCurrency(result.fiftyTwoWeekHigh)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-6 py-4 flex flex-col gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}
