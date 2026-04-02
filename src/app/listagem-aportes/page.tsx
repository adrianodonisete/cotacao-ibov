"use client";

import { useState, useEffect, useCallback } from "react";
import { TYPES_ASSETS, CURRENCIES } from "@/lib/constants";
import { Aporte } from "@/types/aporte";
import { Asset } from "@/types/asset";

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function daysAgoStr(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
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

function formatValue(value: number): string {
  return Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatWithCurrency(value: number, currency: string): string {
  const formatted = formatValue(value);
  return currency === "USD" ? `US$ ${formatted}` : `R$ ${formatted}`;
}

function formatDolarValue(dolarValue: number, currency: string): string {
  if (currency !== "USD" || Number(dolarValue) <= 0) return "—";
  return `R$ ${formatValue(dolarValue)}`;
}

function calcUnitValue(valueTotal: number, qtd: number, currency: string): string {
  const q = Number(qtd);
  if (q === 0) return formatWithCurrency(0, currency);
  return formatWithCurrency(Number(valueTotal) / q, currency);
}

const PER_PAGE_OPTIONS = [10, 20, 50, 100];

export default function ListagemAportes() {
  const [filterType, setFilterType] = useState("todos");
  const [filterCode, setFilterCode] = useState("");
  const [filterDateStart, setFilterDateStart] = useState(daysAgoStr(30));
  const [filterDateEnd, setFilterDateEnd] = useState(todayStr());
  const [filterCurrency, setFilterCurrency] = useState("todos");
  const [filterInfo, setFilterInfo] = useState("");
  const [sortBy, setSortBy] = useState("date_operation");
  const [sortDir, setSortDir] = useState("desc");
  const [perPage, setPerPage] = useState(20);
  const [page, setPage] = useState(1);

  const [aportes, setAportes] = useState<Aporte[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [assetTypeMap, setAssetTypeMap] = useState<Record<string, string>>({});

  const [editingAporte, setEditingAporte] = useState<Aporte | null>(null);
  const [editQtd, setEditQtd] = useState("");
  const [editValueTotal, setEditValueTotal] = useState("");
  const [editDateOperation, setEditDateOperation] = useState("");
  const [editCurrency, setEditCurrency] = useState("BRL");
  const [editDolarValue, setEditDolarValue] = useState("");
  const [editInfo, setEditInfo] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingAporte, setDeletingAporte] = useState<Aporte | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Fetch all assets once to build code→type map
  useEffect(() => {
    fetch("/api/assets")
      .then((r) => r.json())
      .then((d) => {
        if (d.assets) {
          const map: Record<string, string> = {};
          (d.assets as Asset[]).forEach((a) => {
            map[a.code] = a.type;
          });
          setAssetTypeMap(map);
        }
      })
      .catch(() => {});
  }, []);

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
      if (filterCode.trim()) params.set("code", filterCode.trim());
      if (filterCurrency !== "todos") params.set("currency", filterCurrency);
      if (filterInfo.trim()) params.set("info", filterInfo.trim());
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
          setError(data.error ?? "Erro ao buscar aportes.");
          setAportes([]);
          setTotal(0);
          return;
        }

        setAportes(data.aportes ?? []);
        setTotal(data.total ?? 0);
        setHasSearched(true);
      } catch {
        setError("Falha na comunicação com o servidor.");
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
    setEditCurrency(aporte.currency ?? "BRL");
    setEditDolarValue(aporte.dolar_value ? String(aporte.dolar_value) : "");
    setEditInfo(aporte.info ?? "");
    setEditError(null);
  }

  async function handleEditSave() {
    if (!editingAporte) return;
    setEditLoading(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/aportes/${editingAporte.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
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
        setEditError(data.error ?? "Erro ao salvar.");
        return;
      }

      setEditingAporte(null);
      fetchAportes(page);
    } catch {
      setEditError("Falha na comunicação com o servidor.");
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
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        setDeleteError(data.error ?? "Erro ao excluir.");
        return;
      }

      setDeletingAporte(null);
      fetchAportes(page);
    } catch {
      setDeleteError("Falha na comunicação com o servidor.");
    } finally {
      setDeleteLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageStart = total === 0 ? 0 : (page - 1) * perPage + 1;
  const pageEnd = Math.min(page * perPage, total);

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Listagem de Aportes</h1>
        </div>

        {/* Filters */}
        <div className="rounded-2xl bg-gray-900 border border-gray-800 p-5 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <FilterField label="Tipo do Ativo">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              >
                <option value="todos">Todos</option>
                {Object.entries(TYPES_ASSETS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Código">
              <input
                type="text"
                value={filterCode}
                onChange={(e) => setFilterCode(e.target.value.toUpperCase())}
                placeholder="Ex: PETR4"
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </FilterField>

            <FilterField label="Data Inicial">
              <input
                type="date"
                value={filterDateStart}
                onChange={(e) => setFilterDateStart(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </FilterField>

            <FilterField label="Data Final">
              <input
                type="date"
                value={filterDateEnd}
                onChange={(e) => setFilterDateEnd(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </FilterField>

            <FilterField label="Moeda">
              <select
                value={filterCurrency}
                onChange={(e) => setFilterCurrency(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              >
                <option value="todos">Todos</option>
                {Object.keys(CURRENCIES).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Informação">
              <input
                type="text"
                value={filterInfo}
                onChange={(e) => setFilterInfo(e.target.value)}
                placeholder="Informe a informação"
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </FilterField>

            <FilterField label="Ordenar Por">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              >
                <option value="date_operation">Data</option>
                <option value="code">Código</option>
              </select>
            </FilterField>

            <FilterField label="Direção">
              <select
                value={sortDir}
                onChange={(e) => setSortDir(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              >
                <option value="desc">Decrescente</option>
                <option value="asc">Crescente</option>
              </select>
            </FilterField>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Resultados por página:</span>
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-lg bg-gray-800 border border-gray-700 px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              >
                {PER_PAGE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed px-6 py-2.5 font-semibold text-gray-950 text-sm transition-colors"
            >
              {loading ? "Buscando..." : "Buscar"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-900/40 border border-red-700 px-4 py-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Results */}
        {hasSearched && !loading && (
          <>
            {aportes.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                Nenhum aporte encontrado com esses filtros.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-400">
                    Mostrando{" "}
                    <span className="text-white font-medium">
                      {pageStart}–{pageEnd}
                    </span>{" "}
                    de{" "}
                    <span className="text-white font-medium">{total}</span>{" "}
                    aportes
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm min-w-max">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
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
                    <tbody className="divide-y divide-gray-800">
                      {aportes.map((aporte) => {
                        const assetType = assetTypeMap[aporte.code];
                        const typeLabel = assetType
                          ? (TYPES_ASSETS[assetType] ?? assetType)
                          : "—";
                        const currency = aporte.currency ?? "BRL";
                        return (
                          <tr
                            key={aporte.id}
                            className="hover:bg-gray-800/50 transition-colors"
                          >
                            <td className="px-4 py-3 text-center text-gray-300">
                              {formatDate(aporte.date_operation)}
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-xs">
                              {typeLabel}
                            </td>
                            <td className="px-4 py-3 font-mono font-semibold text-white">
                              {aporte.code}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-300">
                              {formatQtd(aporte.qtd)}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-300">
                              {currency}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-300">
                              {formatWithCurrency(aporte.value_total, currency)}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-300">
                              {calcUnitValue(aporte.value_total, aporte.qtd, currency)}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-300">
                              {formatDolarValue(aporte.dolar_value, currency)}
                            </td>
                            <td className="px-4 py-3 text-left text-gray-400 text-xs max-w-[160px] truncate">
                              {aporte.info || "—"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => openEdit(aporte)}
                                  className="px-3 py-1 rounded text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => {
                                    setDeleteError(null);
                                    setDeletingAporte(aporte);
                                  }}
                                  className="px-3 py-1 rounded text-xs font-medium bg-red-900/40 hover:bg-red-900/70 text-red-400 hover:text-red-300 transition-colors"
                                >
                                  Excluir
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <button
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page <= 1}
                      className="px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      ← Anterior
                    </button>
                    <span className="px-4 py-2 text-sm text-gray-400">
                      Página{" "}
                      <span className="text-white font-medium">{page}</span> de{" "}
                      <span className="text-white font-medium">{totalPages}</span>
                    </span>
                    <button
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= totalPages}
                      className="px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Próxima →
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Modal: Editar */}
      {editingAporte && (
        <Modal
          title={`Editar Aporte — ${editingAporte.code}`}
          onClose={() => setEditingAporte(null)}
        >
          <div className="space-y-4">
            <ModalField label="Quantidade">
              <input
                type="text"
                value={editQtd}
                onChange={(e) => setEditQtd(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </ModalField>
            <ModalField label="Valor Total">
              <input
                type="text"
                value={editValueTotal}
                onChange={(e) => setEditValueTotal(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </ModalField>
            <ModalField label="Data da Operação">
              <input
                type="date"
                value={editDateOperation}
                onChange={(e) => setEditDateOperation(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </ModalField>
            <ModalField label="Moeda">
              <select
                value={editCurrency}
                onChange={(e) => setEditCurrency(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              >
                {Object.keys(CURRENCIES).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </ModalField>
            <ModalField label="Dólar no Dia">
              <input
                type="text"
                value={editDolarValue}
                onChange={(e) => setEditDolarValue(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </ModalField>
            <ModalField label="Informação">
              <input
                type="text"
                value={editInfo}
                onChange={(e) => setEditInfo(e.target.value)}
                placeholder="Informação adicional (opcional)"
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </ModalField>
            {editError && <p className="text-red-400 text-sm">{editError}</p>}
            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setEditingAporte(null)}
                className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditSave}
                disabled={editLoading}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-700 disabled:text-gray-500 text-gray-950 text-sm font-semibold transition-colors"
              >
                {editLoading ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Excluir */}
      {deletingAporte && (
        <Modal title="Confirmar Exclusão" onClose={() => setDeletingAporte(null)}>
          <div className="space-y-4">
            <p className="text-gray-300 text-sm">
              Deseja excluir o aporte{" "}
              <span className="font-mono font-semibold text-white">
                {deletingAporte.code}
              </span>{" "}
              de{" "}
              <span className="font-semibold text-white">
                {formatDate(deletingAporte.date_operation)}
              </span>
              ? Esta ação não pode ser desfeita.
            </p>
            {deleteError && <p className="text-red-400 text-sm">{deleteError}</p>}
            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setDeletingAporte(null)}
                className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-semibold transition-colors"
              >
                {deleteLoading ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-2xl bg-gray-900 border border-gray-800 p-6 shadow-xl">
        <h3 className="text-lg font-bold text-white mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function ModalField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
