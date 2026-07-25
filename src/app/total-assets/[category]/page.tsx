'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Category } from '@/types/category';
import {
  isTotalAssetCategory,
  TOTAL_ASSET_CATEGORIES,
  TOTAL_ASSET_CATEGORY_TITLES,
  type TotalAssetCategory,
} from '@/lib/total-asset-categories';
import type { TotalAssetWithInfo } from '@/types/total-asset';
import { H1, Lead, Mono } from '@/components/ui/typography';

function formatCurrency(value: number): string {
  return Number(value).toLocaleString('pt-BR', {
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
  if (n % 1 === 0) return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export default function TotalAssetsByCategoryPage() {
  const params = useParams<{ category: string }>();
  const category = params?.category ?? '';

  const [totals, setTotals] = useState<TotalAssetWithInfo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const valid = isTotalAssetCategory(category);
  const title = valid ? TOTAL_ASSET_CATEGORY_TITLES[category] : 'Categoria inválida';

  const fetchTotals = useCallback(async (cat: TotalAssetCategory) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/total-assets?category=${encodeURIComponent(cat)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Erro ao buscar totais.');
        setTotals([]);
        return;
      }
      setTotals(data.totals ?? []);
      setHasSearched(true);
    } catch {
      setError('Falha na comunicação com o servidor.');
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
    fetch('/api/categories')
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
      <main className="flex-1 flex flex-col items-center px-6 py-16">
        <div className="w-full max-w-5xl">
          <H1 className="text-display-sm">Categoria inválida</H1>
          <Lead className="mt-2 text-muted text-body-md">
            Categorias aceitas: {TOTAL_ASSET_CATEGORIES.join(', ')}.
          </Lead>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col items-center px-6 py-16">
      <div className="w-full">
        <div className="mb-8">
          <H1 className="text-display-sm">{title}</H1>
          <Lead className="mt-2 text-muted text-body-md">
            Categoria:{' '}
            <span className="text-primary">{categoryLabelMap[category] ?? category}</span>
            {' · '}Fonte: <span className="text-body">total_assets_cache</span>
          </Lead>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-error/5 border border-error/30 px-4 py-3 text-error text-body-sm">
            {error}
          </div>
        )}

        {loading && <p className="text-body-sm text-muted">Carregando...</p>}

        {hasSearched && !loading && !error && (
          <>
            {totals.length === 0 ? (
              <div className="text-center py-16 text-muted-soft">
                Nenhum total calculado para esta categoria. Execute o cron{' '}
                <Mono className="text-primary">calculate-totals-by-assets</Mono> em /cache.
              </div>
            ) : (
              <>
                <p className="text-body-sm text-muted mb-4">
                  {totals.length} ativo{totals.length !== 1 ? 's' : ''} listado
                  {totals.length !== 1 ? 's' : ''}
                </p>
                <div>
                  <table className="w-full text-body-sm min-w-max text-ink bg-surface-card border border-hairline rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-surface-cream-strong border-b border-hairline text-caption-uppercase uppercase text-muted">
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
                    <tbody className="divide-y divide-hairline">
                      {totals.map((t) => (
                        <tr key={t.code} className="hover:bg-surface-soft transition-colors">
                          <td className="px-4 py-3 font-mono font-semibold text-ink">{t.code}</td>
                          <td className="px-4 py-3 text-muted">{categoryLabelMap[t.category_name] ?? t.category_name}</td>
                          <td className="px-4 py-3 text-body max-w-xs truncate">{t.info || '—'}</td>
                          <td className="px-4 py-3 text-right text-body">{Number(t.weight).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-body">{formatPercent(t.percentual_objetivo)}</td>
                          <td className="px-4 py-3 text-right text-body">{formatCurrencyBRL(t.montante_objetivo)}</td>
                          <td className="px-4 py-3 text-right text-body">{formatQtd(t.total_qtd)}</td>
                          <td className="px-4 py-3 text-right text-body">{formatCurrencyBRL(t.cotacao)}</td>
                          <td className="px-4 py-3 text-right text-body">{formatCurrencyBRL(t.total_aportado)}</td>
                          <td className="px-4 py-3 text-right text-body">{formatPercent(t.percentual_aportado)}</td>
                          <td className="px-4 py-3 text-right text-body">{formatCurrencyBRL(t.montante_atual)}</td>
                          <td className="px-4 py-3 text-right text-body">{formatPercent(t.percentual_montante_atual)}</td>
                          <td className={`px-4 py-3 text-right font-medium ${t.lucro >= 0 ? 'text-success' : 'text-error'}`}>
                            {formatCurrencyBRL(t.lucro)}
                          </td>
                          <td className={`px-4 py-3 text-right ${t.percentual_lucro >= 0 ? 'text-success' : 'text-error'}`}>
                            {formatPercent(t.percentual_lucro)}
                          </td>
                          <td className="px-4 py-3 text-right text-body">{formatCurrencyBRL(t.montante_falta)}</td>
                          <td className="px-4 py-3 text-right text-body">{formatPercent(t.percentual_falta)}</td>
                          <td className="px-4 py-3 text-center text-body">{formatDate(t.primeiro_aporte)}</td>
                          <td className="px-4 py-3 text-center text-body">{formatDate(t.ultimo_aporte)}</td>
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
