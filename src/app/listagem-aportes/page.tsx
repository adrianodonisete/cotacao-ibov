'use client';

import { useState, useEffect, useCallback } from 'react';
import { CURRENCIES } from '@/lib/constants';
import { Aporte } from '@/types/aporte';
import { Asset } from '@/types/asset';
import { Category } from '@/types/category';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { TextInput } from '@/components/ui/TextInput';
import { H1, Caption, Mono } from '@/components/ui/typography';

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function daysAgoStr(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function formatQtd(value: number): string {
  const n = Number(value);
  if (n % 1 === 0) return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function formatValue(value: number): string {
  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatWithCurrency(value: number, currency: string): string {
  const formatted = formatValue(value);
  return currency === 'USD' ? `US$ ${formatted}` : `R$ ${formatted}`;
}

function formatDolarValue(dolarValue: number, currency: string): string {
  if (currency !== 'USD' || Number(dolarValue) <= 0) return '—';
  return `R$ ${formatValue(dolarValue)}`;
}

function calcUnitValue(valueTotal: number, qtd: number, currency: string): string {
  const q = Number(qtd);
  if (q === 0) return formatWithCurrency(0, currency);
  return formatWithCurrency(Number(valueTotal) / q, currency);
}

const PER_PAGE_OPTIONS = [10, 20, 50, 100];

export default function ListagemAportes() {
  const [filterType, setFilterType] = useState('todos');
  const [filterCode, setFilterCode] = useState('');
  const [filterDateStart, setFilterDateStart] = useState(daysAgoStr(30));
  const [filterDateEnd, setFilterDateEnd] = useState(todayStr());
  const [filterCurrency, setFilterCurrency] = useState('todos');
  const [filterInfo, setFilterInfo] = useState('');
  const [sortBy, setSortBy] = useState('date_operation');
  const [sortDir, setSortDir] = useState('desc');
  const [perPage, setPerPage] = useState(20);
  const [page, setPage] = useState(1);

  const [aportes, setAportes] = useState<Aporte[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [assetTypeMap, setAssetTypeMap] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<Category[]>([]);

  const [editingAporte, setEditingAporte] = useState<Aporte | null>(null);
  const [editQtd, setEditQtd] = useState('');
  const [editValueTotal, setEditValueTotal] = useState('');
  const [editDateOperation, setEditDateOperation] = useState('');
  const [editCurrency, setEditCurrency] = useState('BRL');
  const [editDolarValue, setEditDolarValue] = useState('');
  const [editInfo, setEditInfo] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingAporte, setDeletingAporte] = useState<Aporte | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/assets')
      .then((r) => r.json())
      .then((d) => {
        if (d.assets) {
          const map: Record<string, string> = {};
          (d.assets as Asset[]).forEach((a) => { map[a.code] = a.type; });
          setAssetTypeMap(map);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => { if (d.categories) setCategories(d.categories); })
      .catch(() => {});
  }, []);

  const categoryMap: Record<string, string> = Object.fromEntries(
    categories.map(c => [c.name, c.label])
  );

  const buildQuery = useCallback(
    (currentPage: number) => {
      const params = new URLSearchParams({
        type: filterType,
        date_start: filterDateStart,
        date_end: filterDateEnd,
        sort_by: sortBy,
        sort_dir: sortDir,
        page: String(currentPage),
        per_page: String(perPage),
      });
      if (filterCode.trim()) params.set('code', filterCode.trim());
      if (filterCurrency !== 'todos') params.set('currency', filterCurrency);
      if (filterInfo.trim()) params.set('info', filterInfo.trim());
      return `/api/aportes?${params.toString()}`;
    },
    [filterType, filterCode, filterDateStart, filterDateEnd, filterCurrency, filterInfo, sortBy, sortDir, perPage]
  );

  const fetchAportes = useCallback(
    async (currentPage: number) => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(buildQuery(currentPage));
        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? 'Erro ao buscar aportes.');
          setAportes([]);
          setTotal(0);
          return;
        }

        setAportes(data.aportes ?? []);
        setTotal(data.total ?? 0);
        setHasSearched(true);
      } catch {
        setError('Falha na comunicação com o servidor.');
        setAportes([]);
      } finally {
        setLoading(false);
      }
    },
    [buildQuery]
  );

  useEffect(() => {
    fetchAportes(1);
  }, [fetchAportes]);

  function handleSearch() {
    setPage(1);
    fetchAportes(1);
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    fetchAportes(newPage);
  }

  function openEdit(aporte: Aporte) {
    setEditingAporte(aporte);
    setEditQtd(String(aporte.qtd));
    setEditValueTotal(String(aporte.value_total));
    setEditDateOperation(aporte.date_operation);
    setEditCurrency(aporte.currency ?? 'BRL');
    setEditDolarValue(aporte.dolar_value ? String(aporte.dolar_value) : '');
    setEditInfo(aporte.info ?? '');
    setEditError(null);
  }

  async function handleEditSave() {
    if (!editingAporte) return;
    setEditLoading(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/aportes/${editingAporte.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qtd: editQtd,
          value_total: editValueTotal,
          date_operation: editDateOperation,
          currency: editCurrency,
          dolar_value: editDolarValue,
          info: editInfo,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setEditError(data.error ?? 'Erro ao salvar.');
        return;
      }

      setEditingAporte(null);
      fetchAportes(page);
    } catch {
      setEditError('Falha na comunicação com o servidor.');
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingAporte) return;
    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/aportes/${deletingAporte.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        setDeleteError(data.error ?? 'Erro ao excluir.');
        return;
      }

      setDeletingAporte(null);
      fetchAportes(page);
    } catch {
      setDeleteError('Falha na comunicação com o servidor.');
    } finally {
      setDeleteLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageStart = total === 0 ? 0 : (page - 1) * perPage + 1;
  const pageEnd = Math.min(page * perPage, total);

  return (
    <main className="flex-1 flex flex-col items-center px-6 py-16">
      <div className="w-full max-w-7xl">
        <div className="mb-8">
          <H1 className="text-display-sm">Listagem de Aportes</H1>
        </div>

        <Card variant="feature" padding="lg" className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Caption as="span" className="text-caption-uppercase uppercase text-muted block mb-1.5">
                Tipo do Ativo
              </Caption>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="select-standard w-full">
                <option value="todos">Todos</option>
                {categories.map((c) => (
                  <option key={c.name} value={c.name}>{c.label}</option>
                ))}
              </select>
            </div>

            <TextInput
              label="Código"
              value={filterCode}
              onChange={(e) => setFilterCode(e.target.value.toUpperCase())}
              placeholder="Ex: PETR4"
            />

            <TextInput
              label="Data Inicial"
              type="date"
              value={filterDateStart}
              onChange={(e) => setFilterDateStart(e.target.value)}
            />

            <TextInput
              label="Data Final"
              type="date"
              value={filterDateEnd}
              onChange={(e) => setFilterDateEnd(e.target.value)}
            />

            <div>
              <Caption as="span" className="text-caption-uppercase uppercase text-muted block mb-1.5">
                Moeda
              </Caption>
              <select value={filterCurrency} onChange={(e) => setFilterCurrency(e.target.value)} className="select-standard w-full">
                <option value="todos">Todos</option>
                {Object.keys(CURRENCIES).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <TextInput
              label="Informação"
              value={filterInfo}
              onChange={(e) => setFilterInfo(e.target.value)}
              placeholder="Informe a informação"
            />

            <div>
              <Caption as="span" className="text-caption-uppercase uppercase text-muted block mb-1.5">
                Ordenar Por
              </Caption>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="select-standard w-full">
                <option value="date_operation">Data</option>
                <option value="code">Código</option>
              </select>
            </div>

            <div>
              <Caption as="span" className="text-caption-uppercase uppercase text-muted block mb-1.5">
                Direção
              </Caption>
              <select value={sortDir} onChange={(e) => setSortDir(e.target.value)} className="select-standard w-full">
                <option value="desc">Decrescente</option>
                <option value="asc">Crescente</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-6 border-t border-hairline flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-caption text-muted-soft">Resultados por página:</span>
              <select
                value={perPage}
                onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                className="select-standard"
              >
                {PER_PAGE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? 'Buscando...' : 'Buscar'}
            </Button>
          </div>
        </Card>

        {error && (
          <div className="mb-6">
            <StatusBanner tone="error">{error}</StatusBanner>
          </div>
        )}

        {hasSearched && !loading && (
          <>
            {aportes.length === 0 ? (
              <div className="text-center py-16 text-muted-soft">
                Nenhum aporte encontrado com esses filtros.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-body-sm text-muted">
                    Mostrando{' '}
                    <span className="text-ink font-medium">{pageStart}–{pageEnd}</span> de{' '}
                    <span className="text-ink font-medium">{total}</span> aportes
                  </p>
                </div>

                <Card variant="feature" padding="none" className="overflow-x-auto">
                  <table className="w-full text-body-sm min-w-max">
                    <thead>
                      <tr className="border-b border-hairline text-caption-uppercase uppercase text-muted">
                        <th className="px-4 py-3 text-center">Data</th>
                        <th className="px-4 py-3 text-left">Tipo</th>
                        <th className="px-4 py-3 text-left">Código</th>
                        <th className="px-4 py-3 text-right">Quantidade</th>
                        <th className="px-4 py-3 text-center">Moeda</th>
                        <th className="px-4 py-3 text-right">Valor Total</th>
                        <th className="px-4 py-3 text-right">Valor Unit.</th>
                        <th className="px-4 py-3 text-right">Dólar no Dia</th>
                        <th className="px-4 py-3 text-left">Informação</th>
                        <th className="px-4 py-3 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {aportes.map((aporte) => {
                        const assetType = assetTypeMap[aporte.code];
                        const typeLabel = assetType ? (categoryMap[assetType] ?? assetType) : '—';
                        const currency = aporte.currency ?? 'BRL';
                        return (
                          <tr key={aporte.id} className="hover:bg-surface-soft transition-colors">
                            <td className="px-4 py-3 text-center text-body">{formatDate(aporte.date_operation)}</td>
                            <td className="px-4 py-3 text-muted text-caption">{typeLabel}</td>
                            <td className="px-4 py-3 font-mono font-semibold text-ink">{aporte.code}</td>
                            <td className="px-4 py-3 text-right text-body">{formatQtd(aporte.qtd)}</td>
                            <td className="px-4 py-3 text-center text-body">{currency}</td>
                            <td className="px-4 py-3 text-right text-body">{formatWithCurrency(aporte.value_total, currency)}</td>
                            <td className="px-4 py-3 text-right text-body">{calcUnitValue(aporte.value_total, aporte.qtd, currency)}</td>
                            <td className="px-4 py-3 text-right text-body">{formatDolarValue(aporte.dolar_value, currency)}</td>
                            <td className="px-4 py-3 text-left text-muted text-caption max-w-[160px] truncate">
                              {aporte.info || '—'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Button size="sm" variant="secondary" onClick={() => openEdit(aporte)}>
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => { setDeleteError(null); setDeletingAporte(aporte); }}
                                  className="!text-error hover:!border-error"
                                >
                                  Excluir
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Card>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page <= 1}
                    >
                      ← Anterior
                    </Button>
                    <span className="px-4 py-2 text-body-sm text-muted">
                      Página <span className="text-ink font-medium">{page}</span> de{' '}
                      <span className="text-ink font-medium">{totalPages}</span>
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= totalPages}
                    >
                      Próxima →
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <Modal
        open={editingAporte !== null}
        onClose={() => setEditingAporte(null)}
        title={editingAporte ? `Editar Aporte — ${editingAporte.code}` : ''}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingAporte(null)}>
              Cancelar
            </Button>
            <Button onClick={handleEditSave} disabled={editLoading}>
              {editLoading ? 'Salvando...' : 'Salvar'}
            </Button>
          </>
        }
      >
        {editingAporte && (
          <div className="space-y-4">
            <TextInput label="Quantidade" value={editQtd} onChange={(e) => setEditQtd(e.target.value)} />
            <TextInput label="Valor Total" value={editValueTotal} onChange={(e) => setEditValueTotal(e.target.value)} />
            <TextInput
              label="Data da Operação"
              type="date"
              value={editDateOperation}
              onChange={(e) => setEditDateOperation(e.target.value)}
            />
            <div>
              <Caption as="span" className="text-caption-uppercase uppercase text-muted block mb-1.5">
                Moeda
              </Caption>
              <select value={editCurrency} onChange={(e) => setEditCurrency(e.target.value)} className="select-standard w-full">
                {Object.keys(CURRENCIES).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <TextInput
              label="Dólar no Dia"
              value={editDolarValue}
              onChange={(e) => setEditDolarValue(e.target.value)}
              placeholder="0.00"
            />
            <TextInput
              label="Informação"
              value={editInfo}
              onChange={(e) => setEditInfo(e.target.value)}
              placeholder="Informação adicional (opcional)"
            />
            {editError && <StatusBanner tone="error">{editError}</StatusBanner>}
          </div>
        )}
      </Modal>

      <Modal
        open={deletingAporte !== null}
        onClose={() => setDeletingAporte(null)}
        title="Confirmar Exclusão"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingAporte(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm} disabled={deleteLoading}>
              {deleteLoading ? 'Excluindo...' : 'Excluir'}
            </Button>
          </>
        }
      >
        {deletingAporte && (
          <div className="space-y-4">
            <p className="text-body text-body-sm">
              Deseja excluir o aporte{' '}
              <Mono className="text-ink font-semibold">{deletingAporte.code}</Mono> de{' '}
              <span className="font-semibold text-ink">{formatDate(deletingAporte.date_operation)}</span>? Esta ação não pode ser desfeita.
            </p>
            {deleteError && <StatusBanner tone="error">{deleteError}</StatusBanner>}
          </div>
        )}
      </Modal>
    </main>
  );
}
