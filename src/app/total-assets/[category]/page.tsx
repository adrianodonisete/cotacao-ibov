"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Category } from "@/types/category";
import {
  isTotalAssetCategory,
  TOTAL_ASSET_CATEGORIES,
  TOTAL_ASSET_CATEGORY_TITLES,
  type TotalAssetCategory,
} from "@/lib/total-asset-categories";
import type { TotalAssetWithInfo } from "@/types/total-asset";

function formatCurrency(value: number): string {
  return Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCurrencyBRL(value: number): string {
  return `R$ ${formatCurrency(value)}`;
}

function formatPercent(value: number): string {
  return `${Number(value).toFixed(2)}%`;
}

function formatQtd(value: number): string {
  const n = Number(value);
  if (n % 1 === 0)
    return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export default function TotalAssetsByCategoryPage() {
  const params = useParams<{ category: string }>();
  const category = params?.category ?? "";

  const [totals, setTotals] = useState<TotalAssetWithInfo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const valid = isTotalAssetCategory(category);
  const title = valid ? TOTAL_ASSET_CATEGORY_TITLES[category] : "Categoria inválida";

  const fetchTotals = useCallback(async (cat: TotalAssetCategory) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/total-assets?category=${encodeURIComponent(cat)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao buscar totais.");
        setTotals([]);
        return;
      }
      setTotals(data.totals ?? []);
      setHasSearched(true);
    } catch {
      setError("Falha na comunicação com o servidor.");
      setTotals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!valid) return;
    fetchTotals(category);
  }, [category, valid, fetchTotals]);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => {
        if (d.categories) setCategories(d.categories);
      })
      .catch(() => {});
  }, []);

  const categoryLabelMap: Record<string, string> = Object.fromEntries(
    categories.map((c) => [c.name, c.label])
  );

  if (!valid) {
    return (
      <main className="flex-1 flex flex-col items-center px-4 py-12">
        <div className="w-full max-w-5xl">
          <h1 className="text-3xl font-bold text-white">Categoria inválida</h1>
          <p className="mt-2 text-gray-400 text-sm">
            Categorias aceitas: {TOTAL_ASSET_CATEGORIES.join(", ")}.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">{title}</h1>
          <p className="mt-1 text-gray-400 text-sm">
            Categoria:{" "}
            <span className="text-emerald-400">
              {categoryLabelMap[category] ?? category}
            </span>
            {" · "}Fonte: <span className="text-gray-300">total_assets_cache</span>
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-900/40 border border-red-700 px-4 py-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        {loading && <p className="text-sm text-gray-400">Carregando...</p>}

        {hasSearched && !loading && !error && (
          <>
            {totals.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                Nenhum total calculado para esta categoria. Execute o cron{" "}
                <code className="text-emerald-400">
                  calculate-totals-by-assets
                </code>{" "}
                em /cache.
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-400 mb-4">
                  {totals.length} ativo{totals.length !== 1 ? "s" : ""} listado
                  {totals.length !== 1 ? "s" : ""}
                </p>
                <div className="rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm min-w-max">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                        <th className="px-4 py-3 text-left">Código</th>
                        <th className="px-4 py-3 text-left">Categoria</th>
                        <th className="px-4 py-3 text-left">Informações</th>
                        <th className="px-4 py-3 text-right">Peso</th>
                        <th className="px-4 py-3 text-right">% Objetivo</th>
                        <th className="px-4 py-3 text-right">R$ Objetivo</th>
                        <th className="px-4 py-3 text-right">Quantidade</th>
                        <th className="px-4 py-3 text-right">Cotação</th>
                        <th className="px-4 py-3 text-right">R$ Aportado</th>
                        <th className="px-4 py-3 text-right">% Aportado</th>
                        <th className="px-4 py-3 text-right">R$ Montante Atual</th>
                        <th className="px-4 py-3 text-right">% Montante Atual</th>
                        <th className="px-4 py-3 text-right">R$ Lucro</th>
                        <th className="px-4 py-3 text-right">% Lucro</th>
                        <th className="px-4 py-3 text-right">R$ Montante Falta</th>
                        <th className="px-4 py-3 text-right">% Montante Falta</th>
                        <th className="px-4 py-3 text-center">Primeiro Aporte</th>
                        <th className="px-4 py-3 text-center">Último Aporte</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {totals.map((t) => (
                        <tr
                          key={t.code}
                          className="hover:bg-gray-800/50 transition-colors"
                        >
                          <td className="px-4 py-3 font-mono font-semibold text-white">
                            {t.code}
                          </td>
                          <td className="px-4 py-3 text-gray-400">
                            {categoryLabelMap[t.category_name] ?? t.category_name}
                          </td>
                          <td className="px-4 py-3 text-gray-300 max-w-xs truncate">
                            {t.info || "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">
                            {Number(t.weight).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">
                            {formatPercent(t.percentual_objetivo)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">
                            {formatCurrencyBRL(t.montante_objetivo)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">
                            {formatQtd(t.total_qtd)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">
                            {formatCurrencyBRL(t.cotacao)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">
                            {formatCurrencyBRL(t.total_aportado)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">
                            {formatPercent(t.percentual_aportado)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">
                            {formatCurrencyBRL(t.montante_atual)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">
                            {formatPercent(t.percentual_montante_atual)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-medium ${
                              t.lucro >= 0 ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {formatCurrencyBRL(t.lucro)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right ${
                              t.percentual_lucro >= 0
                                ? "text-emerald-400"
                                : "text-red-400"
                            }`}
                          >
                            {formatPercent(t.percentual_lucro)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">
                            {formatCurrencyBRL(t.montante_falta)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">
                            {formatPercent(t.percentual_falta)}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-300">
                            {formatDate(t.primeiro_aporte)}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-300">
                            {formatDate(t.ultimo_aporte)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
