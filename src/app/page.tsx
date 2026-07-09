"use client";

import { useState, FormEvent } from "react";
import { BrapiResult } from "@/types/brapi";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { TextInput } from "@/components/ui/TextInput";
import { H1, Lead, Caption, Mono } from "@/components/ui/typography";

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
    <main className="flex-1 flex flex-col items-center px-6 py-16">
      <div className="w-full max-w-2xl">
        <div className="mb-12 text-center">
          <H1 className="text-display-lg">
            Cotação <span className="text-primary">IBOV</span>
          </H1>
          <Lead className="mt-3 text-muted">
            Consulte a cotação atual de ações e FIIs da B3
          </Lead>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
          <div className="flex-1">
            <TextInput
              id="code"
              name="code"
              label="Ação / FII"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ex: PETR4, ABEV3, XPLG11"
              autoComplete="off"
            />
          </div>
          <Button type="submit" disabled={loading || !code.trim()} className="sm:h-10">
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
          </Button>
        </form>

        {error && (
          <div className="mt-6">
            <StatusBanner tone="error">{error}</StatusBanner>
          </div>
        )}

        {result && (
          <Card variant="feature" padding="none" className="mt-10">
            <div className="px-8 py-6 border-b border-hairline flex items-start justify-between gap-6 flex-wrap">
              <div>
                <Caption as="span" className="text-caption-uppercase uppercase text-muted">
                  {result.symbol}
                </Caption>
                <h2 className="font-display text-title-lg text-ink mt-1">
                  {result.shortName || result.longName}
                </h2>
              </div>
              <div className="text-right">
                <p className="font-display text-display-sm text-ink">
                  {formatCurrency(result.regularMarketPrice)}
                </p>
                <p className={`text-body-sm font-medium mt-1 ${isPositive ? "text-success" : "text-error"}`}>
                  {formatCurrency(result.regularMarketChange)}{" "}
                  ({formatPercent(result.regularMarketChangePercent)})
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-hairline">
              <div className="grid grid-rows-2 divide-y divide-hairline">
                <Stat label="Abertura" value={formatCurrency(result.regularMarketOpen)} />
                <Stat label="Fechamento Ant." value={formatCurrency(result.regularMarketPreviousClose)} />
              </div>
              <div className="grid grid-rows-2 divide-y divide-hairline">
                <Stat label="Máxima do Dia" value={formatCurrency(result.regularMarketDayHigh)} />
                <Stat label="Mínima do Dia" value={formatCurrency(result.regularMarketDayLow)} />
              </div>
            </div>

            <div className="px-8 py-4 border-t border-hairline flex items-center justify-between text-body-sm">
              <span className="text-muted">Volume</span>
              <Mono className="text-ink font-semibold">{formatNumber(result.regularMarketVolume)}</Mono>
            </div>

            {(result.fiftyTwoWeekHigh || result.fiftyTwoWeekLow) && (
              <div className="px-8 py-4 border-t border-hairline flex items-center justify-between text-body-sm">
                <span className="text-muted">52 semanas</span>
                <Mono className="text-ink font-semibold">
                  {formatCurrency(result.fiftyTwoWeekLow)} — {formatCurrency(result.fiftyTwoWeekHigh)}
                </Mono>
              </div>
            )}
          </Card>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-8 py-4 flex flex-col gap-1">
      <span className="text-caption text-muted-soft">{label}</span>
      <Mono className="text-ink font-semibold">{value}</Mono>
    </div>
  );
}
