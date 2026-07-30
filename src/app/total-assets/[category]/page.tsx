'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  isTotalAssetCategory,
  TOTAL_ASSET_CATEGORIES,
  TOTAL_ASSET_CATEGORY_TITLES,
  type TotalAssetCategory,
} from '@/lib/total-asset-categories';
import {
  calculateCategoryPerformance,
  sortTotalAssets,
  type SortDirection,
  type SortableField,
} from '@/lib/total-assets';
import type {
  TotalAssetsApiResponse,
  TotalCategoryTotals,
  TotalAssetWithInfo,
} from '@/types/total-asset';
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
  return `${Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
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

type SortState = { field: SortableField; direction: SortDirection };

type ColumnDef = {
  field: SortableField;
  label: string;
  align: 'left' | 'right' | 'center';
  format: (row: TotalAssetWithInfo) => string;
  valueClass: string;
};

const COLUMNS: ColumnDef[] = [
  {
    field: 'code',
    label: 'Código',
    align: 'left',
    format: (row) => row.code,
    valueClass: 'font-mono font-semibold text-ink',
  },
  {
    field: 'info',
    label: 'Informações',
    align: 'left',
    format: (row) => row.info || '—',
    valueClass: 'text-body max-w-xs truncate',
  },
  {
    field: 'weight',
    label: 'Peso',
    align: 'right',
    format: (row) => Number(row.weight).toFixed(2),
    valueClass: 'text-body',
  },
  {
    field: 'percentual_objetivo',
    label: '% Objetivo',
    align: 'right',
    format: (row) => formatPercent(row.percentual_objetivo),
    valueClass: 'text-body',
  },
  {
    field: 'montante_objetivo',
    label: 'R$ Objetivo',
    align: 'right',
    format: (row) => formatCurrencyBRL(row.montante_objetivo),
    valueClass: 'text-body',
  },
  {
    field: 'total_qtd',
    label: 'Quantidade',
    align: 'right',
    format: (row) => formatQtd(row.total_qtd),
    valueClass: 'text-body',
  },
  {
    field: 'cotacao',
    label: 'Cotação',
    align: 'right',
    format: (row) => formatCurrencyBRL(row.cotacao),
    valueClass: 'text-body',
  },
  {
    field: 'total_aportado',
    label: 'R$ Aportado',
    align: 'right',
    format: (row) => formatCurrencyBRL(row.total_aportado),
    valueClass: 'text-body',
  },
  {
    field: 'percentual_aportado',
    label: '% Aportado',
    align: 'right',
    format: (row) => formatPercent(row.percentual_aportado),
    valueClass: 'text-body',
  },
  {
    field: 'montante_atual',
    label: 'R$ Montante Atual',
    align: 'right',
    format: (row) => formatCurrencyBRL(row.montante_atual),
    valueClass: 'text-body',
  },
  {
    field: 'percentual_montante_atual',
    label: '% Montante Atual',
    align: 'right',
    format: (row) => formatPercent(row.percentual_montante_atual),
    valueClass: 'text-body',
  },
  {
    field: 'lucro',
    label: 'R$ Lucro',
    align: 'right',
    format: (row) => formatCurrencyBRL(row.lucro),
    valueClass: 'font-medium',
  },
  {
    field: 'percentual_lucro',
    label: '% Lucro',
    align: 'right',
    format: (row) => formatPercent(row.percentual_lucro),
    valueClass: '',
  },
  {
    field: 'montante_falta',
    label: 'R$ Montante Falta',
    align: 'right',
    format: (row) => formatCurrencyBRL(row.montante_falta),
    valueClass: 'text-body',
  },
  {
    field: 'percentual_falta',
    label: '% Montante Falta',
    align: 'right',
    format: (row) => formatPercent(row.percentual_falta),
    valueClass: 'text-body',
  },
  {
    field: 'primeiro_aporte',
    label: 'Primeiro Aporte',
    align: 'center',
    format: (row) => formatDate(row.primeiro_aporte),
    valueClass: 'text-body',
  },
  {
    field: 'ultimo_aporte',
    label: 'Último Aporte',
    align: 'center',
    format: (row) => formatDate(row.ultimo_aporte),
    valueClass: 'text-body',
  },
];

export default function TotalAssetsByCategoryPage() {
  const params = useParams<{ category: string }>();
  const category = params?.category ?? '';

  const [totals, setTotals] = useState<TotalAssetWithInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [categoryTotals, setCategoryTotals] = useState<TotalCategoryTotals | null>(
    null,
  );
  const [sort, setSort] = useState<SortState>({
    field: 'code',
    direction: 'asc',
  });

  const valid = isTotalAssetCategory(category);
  const title = valid ? TOTAL_ASSET_CATEGORY_TITLES[category] : 'Categoria inválida';

  const fetchTotals = useCallback(async (cat: TotalAssetCategory) => {
    setLoading(true);
    setError(null);
    setCategoryTotals(null);
    try {
      const res = await fetch(`/api/total-assets?category=${encodeURIComponent(cat)}`);
      const data: TotalAssetsApiResponse = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Erro ao buscar totais.');
        setTotals([]);
        return;
      }
      setTotals(data.totals ?? []);
      if (data.categoryTotals) setCategoryTotals(data.categoryTotals);
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
    setSort({ field: 'code', direction: 'asc' });
  }, [category]);

  const sortedTotals = useMemo(
    () => sortTotalAssets(totals, sort.field, sort.direction),
    [totals, sort],
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
          {categoryTotals && (
            <SummaryLine totals={categoryTotals} />
          )}
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
                        {COLUMNS.map((col) => {
                          const isActive = sort.field === col.field;
                          const arrow = isActive
                            ? sort.direction === 'asc'
                              ? '↑'
                              : '↓'
                            : '↕';
                          const ariaSort: 'ascending' | 'descending' | 'none' = isActive
                            ? sort.direction === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none';
                          return (
                            <th
                              key={col.field}
                              scope="col"
                              aria-sort={ariaSort}
                              className={`px-4 py-3 text-${col.align}`}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setSort((prev) => ({
                                    field: col.field,
                                    direction:
                                      prev.field === col.field && prev.direction === 'asc'
                                        ? 'desc'
                                        : 'asc',
                                  }))
                                }
                                className={`inline-flex items-center gap-1 uppercase tracking-wider text-caption-uppercase ${
                                  isActive
                                    ? 'text-ink'
                                    : 'text-muted hover:text-ink'
                                } focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm`}
                              >
                                <span>{col.label}</span>
                                <span aria-hidden className={isActive ? '' : 'opacity-60'}>
                                  {arrow}
                                </span>
                              </button>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {sortedTotals.map((row) => (
                        <tr key={row.code} className="hover:bg-surface-soft transition-colors">
                          {COLUMNS.map((col) => {
                            const cellClass = `${col.valueClass} ${cellColorClass(col.field, row)}`.trim();
                            return (
                              <td
                                key={col.field}
                                className={`px-4 py-3 text-${col.align} ${cellClass}`}
                              >
                                {col.format(row)}
                              </td>
                            );
                          })}
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

function SummaryLine({ totals }: { totals: TotalCategoryTotals }) {
  const performance = calculateCategoryPerformance(totals);
  const profitClass = performance.lucro >= 0 ? 'text-success' : 'text-error';
  const separator = (
    <span className="mx-3 text-muted-soft" aria-hidden>
      ·
    </span>
  );
  return (
    <p className="mt-3 text-body-sm text-muted flex flex-wrap items-center gap-x-3 gap-y-1">
      <span>
        Total Aportado:{' '}
        <span className="text-ink font-medium">{formatCurrencyBRL(totals.totalAportado)}</span>
      </span>
      {separator}
      <span>
        Total Atual:{' '}
        <span className="text-ink font-medium">{formatCurrencyBRL(totals.totalAtual)}</span>
      </span>
      {separator}
      <span>
        Lucro: <span className={`font-medium ${profitClass}`}>{formatCurrencyBRL(performance.lucro)}</span>
      </span>
      {separator}
      <span>
        % Lucro: <span className={`font-medium ${profitClass}`}>{formatPercent(performance.percentualLucro)}</span>
      </span>
      {separator}
      <span>
        Total Peso: <span className="text-ink font-medium">{totals.totalPeso.toFixed(2)}</span>
      </span>
    </p>
  );
}

function cellColorClass(field: SortableField, row: TotalAssetWithInfo): string {
  const positiveClass = 'text-success';
  const negativeClass = 'text-error';
  if (field === 'lucro')
    return row.lucro >= 0 ? positiveClass : negativeClass;
  if (field === 'percentual_lucro')
    return row.percentual_lucro >= 0 ? positiveClass : negativeClass;
  if (field === 'percentual_objetivo')
    return row.percentual_objetivo >= 0 ? positiveClass : negativeClass;
  if (field === 'montante_objetivo')
    return row.montante_objetivo >= 0 ? positiveClass : negativeClass;
  if (field === 'percentual_falta')
    return row.percentual_falta >= 0 ? positiveClass : negativeClass;
  if (field === 'montante_falta')
    return row.montante_falta >= 0 ? positiveClass : negativeClass;
  return '';
}
