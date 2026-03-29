"use client";

import { useState, useEffect, useCallback } from "react";
import { TYPES_ASSETS } from "@/lib/constants";
import { Asset, AssetWithPercent } from "@/types/asset";

function calcPercent(assets: Asset[]): AssetWithPercent[] {
  const total = assets.reduce((sum, a) => sum + Number(a.weight), 0);
  return assets.map((a) => ({
    ...a,
    weightPercent: total > 0 ? (Number(a.weight) / total) * 100 : 0,
  }));
}

export default function ListagemAtivos() {
  const [selectedType, setSelectedType] = useState("acao");
  const [assets, setAssets] = useState<AssetWithPercent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editInfo, setEditInfo] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingAsset, setDeletingAsset] = useState<Asset | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchAssets = useCallback(async (type: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/assets?type=${encodeURIComponent(type)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao buscar ativos.");
        setAssets([]);
        return;
      }

      setAssets(calcPercent(data.assets ?? []));
      setHasSearched(true);
    } catch {
      setError("Falha na comunicação com o servidor.");
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssets("acao");
  }, [fetchAssets]);

  function handleSearch() {
    fetchAssets(selectedType);
  }

  function openEdit(asset: Asset) {
    setEditingAsset(asset);
    setEditInfo(asset.info);
    setEditWeight(String(asset.weight));
    setEditError(null);
  }

  async function handleEditSave() {
    if (!editingAsset) return;
    const weightNum = parseFloat(editWeight.replace(",", "."));

    if (!editInfo.trim()) {
      setEditError("O campo Informações é obrigatório.");
      return;
    }
    if (isNaN(weightNum)) {
      setEditError("Peso inválido.");
      return;
    }

    setEditLoading(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/assets/${editingAsset.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ info: editInfo.trim(), weight: weightNum }),
      });

      const data = await res.json();

      if (!res.ok) {
        setEditError(data.error ?? "Erro ao salvar.");
        return;
      }

      setEditingAsset(null);
      fetchAssets(selectedType);
    } catch {
      setEditError("Falha na comunicação com o servidor.");
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingAsset) return;
    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/assets/${deletingAsset.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        setDeleteError(data.error ?? "Erro ao excluir.");
        return;
      }

      setDeletingAsset(null);
      fetchAssets(selectedType);
    } catch {
      setDeleteError("Falha na comunicação com o servidor.");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Listagem de Ativos</h1>
        </div>

        {/* Filter */}
        <div className="flex gap-3 mb-8">
          <div>
            <label
              htmlFor="type-filter"
              className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5"
            >
              Tipo de Ativo
            </label>
            <select
              id="type-filter"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            >
              {Object.entries(TYPES_ASSETS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed px-6 py-3 font-semibold text-gray-950 transition-colors"
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
            {assets.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                Nenhum ativo cadastrado.
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-400 mb-4">
                  {assets.length} ativo{assets.length !== 1 ? "s" : ""} encontrado
                  {assets.length !== 1 ? "s" : ""}
                </p>
                <div className="rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                        <th className="px-4 py-3 text-left">Código</th>
                        <th className="px-4 py-3 text-left">Informações</th>
                        <th className="px-4 py-3 text-left">Tipo</th>
                        <th className="px-4 py-3 text-right">Peso</th>
                        <th className="px-4 py-3 text-right">Peso %</th>
                        <th className="px-4 py-3 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {assets.map((asset) => (
                        <tr key={asset.id} className="hover:bg-gray-800/50 transition-colors">
                          <td className="px-4 py-3 font-mono font-semibold text-white">
                            {asset.code}
                          </td>
                          <td className="px-4 py-3 text-gray-300 max-w-xs">{asset.info}</td>
                          <td className="px-4 py-3 text-gray-400">
                            {TYPES_ASSETS[asset.type] ?? asset.type}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">
                            {Number(asset.weight).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">
                            {asset.weightPercent.toFixed(2)}%
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openEdit(asset)}
                                className="px-3 py-1 rounded text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => {
                                  setDeleteError(null);
                                  setDeletingAsset(asset);
                                }}
                                className="px-3 py-1 rounded text-xs font-medium bg-red-900/40 hover:bg-red-900/70 text-red-400 hover:text-red-300 transition-colors"
                              >
                                Excluir
                              </button>
                            </div>
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

      {/* Modal: Editar */}
      {editingAsset && (
        <Modal title={`Editar Ativo — ${editingAsset.code}`} onClose={() => setEditingAsset(null)}>
          <div className="space-y-4">
            <Field label="Código">
              <p className="font-mono text-white">{editingAsset.code}</p>
            </Field>
            <Field label="Tipo">
              <p className="text-gray-400">{TYPES_ASSETS[editingAsset.type] ?? editingAsset.type}</p>
            </Field>
            <Field label="Informações">
              <input
                type="text"
                value={editInfo}
                onChange={(e) => setEditInfo(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition text-sm"
              />
            </Field>
            <Field label="Peso">
              <input
                type="text"
                value={editWeight}
                onChange={(e) => setEditWeight(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition text-sm"
              />
            </Field>
            {editError && (
              <p className="text-red-400 text-sm">{editError}</p>
            )}
            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setEditingAsset(null)}
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
      {deletingAsset && (
        <Modal title="Confirmar Exclusão" onClose={() => setDeletingAsset(null)}>
          <div className="space-y-4">
            <p className="text-gray-300 text-sm">
              Deseja excluir o ativo{" "}
              <span className="font-mono font-semibold text-white">
                {deletingAsset.code}
              </span>
              ? Esta ação não pode ser desfeita.
            </p>
            {deleteError && (
              <p className="text-red-400 text-sm">{deleteError}</p>
            )}
            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setDeletingAsset(null)}
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

function Field({
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
