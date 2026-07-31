'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { TextInput } from '@/components/ui/TextInput';
import { H1, Caption, Mono } from '@/components/ui/typography';
import { Category } from '@/types/category';

interface Dividendo {
  id: number;
  code: string;
  payment_date: string;
  quantity: number;
  total_liquid: number;
}

const PER_PAGE_OPTIONS = [10, 20, 50, 100];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'payment_date', label: 'Data Pagamento' },
  { value: 'code', label: 'Código' },
  { value: 'quantity', label: 'Quantidade' },
  { value: 'total_liquid', label: 'Total Líquido' },
];

function previousMonthRange(): { start: string; end: string } {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const end = new Date(today.getFullYear(), today.getMonth(), 0);
  const fmt = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  return { start: fmt(start), end: fmt(end) };
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function formatQuantity(value: number): string {
  const n = Number(value);
  if (n % 1 === 0) return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function formatValue(value: number): string {
  return `R$ ${Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function ListagemDividendos() {
  const initialRange = previousMonthRange();

  const [filterType, setFilterType] = useState('todos');
  const [filterDateStart, setFilterDateStart] = useState(initialRange.start);
  const [filterDateEnd, setFilterDateEnd] = useState(initialRange.end);
  const [filterCode, setFilterCode] = useState('');
  const [sortBy, setSortBy] = useState('payment_date');
  const [sortDir, setSortDir] = useState('desc');
  const [perPage, setPerPage] = useState(20);
  const [page, setPage] = useState(1);

  const [dividendos, setDividendos] = useState<Dividendo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  const [editingDividendo, setEditingDividendo] = useState<Dividendo | null>(null);
  const [editPaymentDate, setEditPaymentDate] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editTotalLiquid, setEditTotalLiquid] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingDividendo, setDeletingDividendo] = useState<Dividendo | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => { if (d.categories) setCategories(d.categories as Category[]); })
      .catch(() => {});
  }, []);

  const availableCategories = categories.filter(c => c.name !== 'td');

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
      return `/api/dividendos?${params.toString()}`;
    },
    [filterType, filterCode, filterDateStart, filterDateEnd, sortBy, sortDir, perPage]
  );

  const fetchDividendos = useCallback(
    async (currentPage: number) => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(buildQuery(currentPage));
        const data = await res.json() as { dividendos?: Dividendo[]; total?: number; error?: string };

        if (!res.ok) {
          setError(data.error ?? 'Erro ao buscar dividendos.');
          setDividendos([]);
          setTotal(0);
          return;
        }

        setDividendos(data.dividendos ?? []);
        setTotal(data.total ?? 0);
        setHasSearched(true);
      } catch {
        setError('Falha na comunicação com o servidor.');
        setDividendos([]);
      } finally {
        setLoading(false);
      }
    },
    [buildQuery]
  );

  useEffect(() => {
    fetchDividendos(1);
  }, [fetchDividendos]);

  function handleSearch() {
    setPage(1);
    fetchDividendos(1);
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    fetchDividendos(newPage);
  }

  function openEdit(d: Dividendo) {
    setEditingDividendo(d);
    setEditPaymentDate(d.payment_date);
    setEditQuantity(String(d.quantity));
    setEditTotalLiquid(String(d.total_liquid));
    setEditError(null);
  }

  async function handleEditSave() {
    if (!editingDividendo) return;
    setEditLoading(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/dividendos/${editingDividendo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_date: editPaymentDate,
          quantity: editQuantity,
          total_liquid: editTotalLiquid,
        }),
      });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setEditError(data.error ?? 'Erro ao salvar.');
        return;
      }

      setEditingDividendo(null);
      fetchDividendos(page);
    } catch {
      setEditError('Falha na comunicação com o servidor.');
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingDividendo) return;
    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/dividendos/${deletingDividendo.id}`, {
        method: 'DELETE',
      });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setDeleteError(data.error ?? 'Erro ao excluir.');
        return;
      }

      setDeletingDividendo(null);
      const nextPage = dividendos.length === 1 && page > 1 ? page - 1 : page;
      if (nextPage !== page) setPage(nextPage);
      fetchDividendos(nextPage);
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
          <H1 className="text-display-sm">Listagem de Dividendos</H1>
        </div>

        <Card variant="feature" padding="lg" className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Caption as="span" className="text-caption-uppercase uppercase text-muted block mb-1.5">
                Tipo do Ativo
              </Caption>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="select-standard w-full"
              >
                <option value="todos">Todos</option>
                {availableCategories.map((c) => (
                  <option key={c.name} value={c.name}>{c.label}</option>
                ))}
              </select>
            </div>

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

            <TextInput
              label="Código"
              value={filterCode}
              onChange={(e) => setFilterCode(e.target.value.toUpperCase())}
              placeholder="Ex: PETR4"
            />

            <div>
              <Caption as="span" className="text-caption-uppercase uppercase text-muted block mb-1.5">
                Ordenar Por
              </Caption>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="select-standard w-full"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <Caption as="span" className="text-caption-uppercase uppercase text-muted block mb-1.5">
                Direção
              </Caption>
              <select
                value={sortDir}
                onChange={(e) => setSortDir(e.target.value)}
                className="select-standard w-full"
              >
                <option value="desc">Descendente</option>
                <option value="asc">Ascendente</option>
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
            {dividendos.length === 0 ? (
              <div className="text-center py-16 text-muted-soft">
                Nenhum dividendo encontrado com esses filtros.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-body-sm text-muted">
                    Mostrando{' '}
                    <span className="text-ink font-medium">{pageStart}–{pageEnd}</span> de{' '}
                    <span className="text-ink font-medium">{total}</span> dividendos
                  </p>
                </div>

                <Card variant="feature" padding="none" className="overflow-x-auto">
                  <table className="w-full text-body-sm min-w-max">
                    <thead>
                      <tr className="border-b border-hairline text-caption-uppercase uppercase text-muted">
                        <th className="px-4 py-3 text-left">Código</th>
                        <th className="px-4 py-3 text-center">Data Pagamento</th>
                        <th className="px-4 py-3 text-right">Quantidade</th>
                        <th className="px-4 py-3 text-right">Total Líquido</th>
                        <th className="px-4 py-3 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {dividendos.map((d) => (
                        <tr key={d.id} className="hover:bg-surface-soft transition-colors">
                          <td className="px-4 py-3 font-mono font-semibold text-ink">{d.code}</td>
                          <td className="px-4 py-3 text-center text-body">{formatDate(d.payment_date)}</td>
                          <td className="px-4 py-3 text-right text-body">{formatQuantity(d.quantity)}</td>
                          <td className="px-4 py-3 text-right text-body">{formatValue(d.total_liquid)}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Button size="sm" variant="secondary" onClick={() => openEdit(d)}>
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => { setDeleteError(null); setDeletingDividendo(d); }}
                                className="!text-error hover:!border-error"
                              >
                                Excluir
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
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
            {total > 0 && (
              <div className="mt-6 text-center text-caption text-muted-soft">
                Soma de <Mono className="text-ink">Total Líquido</Mono> no recorte atual: {' '}
                <Mono className="text-ink">
                  {formatValue(dividendos.reduce((acc, d) => acc + d.total_liquid, 0))}
                </Mono>
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        open={editingDividendo !== null}
        onClose={() => setEditingDividendo(null)}
        title={editingDividendo ? `Editar Dividendo — ${editingDividendo.code}` : ''}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingDividendo(null)}>
              Cancelar
            </Button>
            <Button onClick={handleEditSave} disabled={editLoading}>
              {editLoading ? 'Salvando...' : 'Salvar'}
            </Button>
          </>
        }
      >
        {editingDividendo && (
          <div className="space-y-4">
            <TextInput
              label="Data Pagamento"
              type="date"
              value={editPaymentDate}
              onChange={(e) => setEditPaymentDate(e.target.value)}
            />
            <TextInput
              label="Quantidade"
              value={editQuantity}
              onChange={(e) => setEditQuantity(e.target.value)}
              placeholder="0"
            />
            <TextInput
              label="Total Líquido"
              value={editTotalLiquid}
              onChange={(e) => setEditTotalLiquid(e.target.value)}
              placeholder="0.00"
            />
            {editError && <StatusBanner tone="error">{editError}</StatusBanner>}
          </div>
        )}
      </Modal>

      <Modal
        open={deletingDividendo !== null}
        onClose={() => setDeletingDividendo(null)}
        title="Confirmar Exclusão"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingDividendo(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm} disabled={deleteLoading}>
              {deleteLoading ? 'Excluindo...' : 'Excluir'}
            </Button>
          </>
        }
      >
        {deletingDividendo && (
          <div className="space-y-4">
            <p className="text-body text-body-sm">
              Deseja excluir o dividendo de{' '}
              <Mono className="text-ink font-semibold">{deletingDividendo.code}</Mono> com data{' '}
              <span className="font-semibold text-ink">{formatDate(deletingDividendo.payment_date)}</span>
              ? Esta ação não pode ser desfeita.
            </p>
            {deleteError && <StatusBanner tone="error">{deleteError}</StatusBanner>}
          </div>
        )}
      </Modal>
    </main>
  );
}
