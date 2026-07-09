'use client';

import { useState, useEffect, useCallback } from 'react';
import { Asset, AssetWithPercent } from '@/types/asset';
import { Category } from '@/types/category';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CategoryTab } from '@/components/ui/CategoryTab';
import { Modal } from '@/components/ui/Modal';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { TextInput } from '@/components/ui/TextInput';
import { H1, Caption, Mono } from '@/components/ui/typography';

function calcPercent(assets: Asset[]): AssetWithPercent[] {
  const total = assets.reduce((sum, a) => sum + Number(a.weight), 0);
  return assets.map((a) => ({
    ...a,
    weightPercent: total > 0 ? (Number(a.weight) / total) * 100 : 0,
  }));
}

export default function ListagemAtivos() {
  const [selectedType, setSelectedType] = useState('acao');
  const [assets, setAssets] = useState<AssetWithPercent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editInfo, setEditInfo] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingAsset, setDeletingAsset] = useState<Asset | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  const fetchAssets = useCallback(async (type: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/assets?type=${encodeURIComponent(type)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Erro ao buscar ativos.');
        setAssets([]);
        return;
      }

      setAssets(calcPercent(data.assets ?? []));
      setHasSearched(true);
    } catch {
      setError('Falha na comunicação com o servidor.');
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssets(selectedType);
  }, [selectedType, fetchAssets]);

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => { if (d.categories) setCategories(d.categories); })
      .catch(() => {});
  }, []);

  const categoryMap: Record<string, string> = Object.fromEntries(
    categories.map(c => [c.name, c.label])
  );

  const tabOptions = [
    ...categories.map(c => ({ value: c.name, label: c.label })),
  ];

  function openEdit(asset: Asset) {
    setEditingAsset(asset);
    setEditInfo(asset.info);
    setEditWeight(String(asset.weight));
    setEditError(null);
  }

  async function handleEditSave() {
    if (!editingAsset) return;
    const weightNum = parseFloat(editWeight.replace(',', '.'));

    if (!editInfo.trim()) {
      setEditError('O campo Informações é obrigatório.');
      return;
    }
    if (isNaN(weightNum)) {
      setEditError('Peso inválido.');
      return;
    }

    setEditLoading(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/assets/${editingAsset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ info: editInfo.trim(), weight: weightNum }),
      });

      const data = await res.json();

      if (!res.ok) {
        setEditError(data.error ?? 'Erro ao salvar.');
        return;
      }

      setEditingAsset(null);
      fetchAssets(selectedType);
    } catch {
      setEditError('Falha na comunicação com o servidor.');
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
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        setDeleteError(data.error ?? 'Erro ao excluir.');
        return;
      }

      setDeletingAsset(null);
      fetchAssets(selectedType);
    } catch {
      setDeleteError('Falha na comunicação com o servidor.');
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center px-6 py-16">
      <div className="w-full max-w-6xl">
        <div className="mb-8">
          <H1 className="text-display-sm">Listagem de Ativos</H1>
        </div>

        <div className="mb-6">
          <Caption as="span" className="text-caption-uppercase uppercase text-muted block mb-2">
            Tipo de Ativo
          </Caption>
          <div className="flex items-center gap-3 flex-wrap">
            <CategoryTab
              options={tabOptions}
              value={selectedType}
              onChange={setSelectedType}
              size="md"
            />
            {loading && <span className="text-body-sm text-muted">Carregando...</span>}
          </div>
        </div>

        {error && (
          <div className="mb-6">
            <StatusBanner tone="error">{error}</StatusBanner>
          </div>
        )}

        {hasSearched && !loading && (
          <>
            {assets.length === 0 ? (
              <div className="text-center py-16 text-muted-soft">
                Nenhum ativo cadastrado.
              </div>
            ) : (
              <>
                <p className="text-body-sm text-muted mb-4">
                  {assets.length} ativo{assets.length !== 1 ? 's' : ''} encontrado
                  {assets.length !== 1 ? 's' : ''}
                </p>
                <Card variant="feature" padding="none" className="overflow-x-auto">
                  <table className="w-full text-body-sm min-w-max">
                    <thead>
                      <tr className="border-b border-hairline text-caption-uppercase uppercase text-muted">
                        <th className="px-4 py-3 text-left">Código</th>
                        <th className="px-4 py-3 text-left">Informações</th>
                        <th className="px-4 py-3 text-left">Categoria</th>
                        <th className="px-4 py-3 text-right">Peso</th>
                        <th className="px-4 py-3 text-right">Peso %</th>
                        <th className="px-4 py-3 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {assets.map((asset) => (
                        <tr key={asset.id} className="hover:bg-surface-soft transition-colors">
                          <td className="px-4 py-3 font-mono font-semibold text-ink">{asset.code}</td>
                          <td className="px-4 py-3 text-body max-w-xs">{asset.info}</td>
                          <td className="px-4 py-3 text-muted">{categoryMap[asset.type] ?? asset.type}</td>
                          <td className="px-4 py-3 text-right text-body">{Number(asset.weight).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-body">{asset.weightPercent.toFixed(2)}%</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Button size="sm" variant="secondary" onClick={() => openEdit(asset)}>
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => { setDeleteError(null); setDeletingAsset(asset); }}
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
              </>
            )}
          </>
        )}
      </div>

      <Modal
        open={editingAsset !== null}
        onClose={() => setEditingAsset(null)}
        title={editingAsset ? `Editar Ativo — ${editingAsset.code}` : ''}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingAsset(null)}>
              Cancelar
            </Button>
            <Button onClick={handleEditSave} disabled={editLoading}>
              {editLoading ? 'Salvando...' : 'Salvar'}
            </Button>
          </>
        }
      >
        {editingAsset && (
          <div className="space-y-4">
            <div>
              <Caption as="span" className="text-caption-uppercase uppercase text-muted block mb-1.5">
                Código
              </Caption>
              <Mono className="text-ink">{editingAsset.code}</Mono>
            </div>
            <div>
              <Caption as="span" className="text-caption-uppercase uppercase text-muted block mb-1.5">
                Tipo
              </Caption>
              <p className="text-muted text-body-sm">{categoryMap[editingAsset.type] ?? editingAsset.type}</p>
            </div>
            <TextInput
              label="Informações"
              value={editInfo}
              onChange={(e) => setEditInfo(e.target.value)}
            />
            <TextInput
              label="Peso"
              value={editWeight}
              onChange={(e) => setEditWeight(e.target.value)}
            />
            {editError && <StatusBanner tone="error">{editError}</StatusBanner>}
          </div>
        )}
      </Modal>

      <Modal
        open={deletingAsset !== null}
        onClose={() => setDeletingAsset(null)}
        title="Confirmar Exclusão"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingAsset(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm} disabled={deleteLoading}>
              {deleteLoading ? 'Excluindo...' : 'Excluir'}
            </Button>
          </>
        }
      >
        {deletingAsset && (
          <div className="space-y-4">
            <p className="text-body text-body-sm">
              Deseja excluir o ativo{' '}
              <Mono className="text-ink font-semibold">{deletingAsset.code}</Mono>? Esta ação não pode ser desfeita.
            </p>
            {deleteError && <StatusBanner tone="error">{deleteError}</StatusBanner>}
          </div>
        )}
      </Modal>
    </main>
  );
}
