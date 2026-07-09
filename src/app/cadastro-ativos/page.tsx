'use client';

import { useState, useEffect } from 'react';
import { Category } from '@/types/category';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Textarea } from '@/components/ui/TextInput';
import { H1, Lead, Mono } from '@/components/ui/typography';

interface ParsedAsset {
  code: string;
  info: string;
  type: string;
  weight: number;
  status: 'novo' | 'duplicata_lote' | 'duplicata_banco';
}

interface PreviewData {
  assets: ParsedAsset[];
  ignoredCount: number;
}

interface InsertResult {
  inserted: number;
  duplicates: string[];
  ignoredCount: number;
}

function parseTextarea(text: string, categoryMap: Record<string, string>): { valid: ParsedAsset[]; ignoredCount: number } {
  const lines = text.split('\n');
  const seenCodes = new Set<string>();
  const valid: ParsedAsset[] = [];
  let ignoredCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const cols = trimmed.split(';');
    if (cols.length !== 4) {
      ignoredCount++;
      continue;
    }

    const [rawCode, rawInfo, rawType, rawWeight] = cols;
    const info = rawInfo.trim();
    const type = rawType.trim().toLowerCase();
    const code = type === 'td' ? rawCode.trim() : rawCode.trim().toUpperCase();
    const weightStr = rawWeight.trim().replace(',', '.');
    const weight = parseFloat(weightStr);

    if (!code || !info || !type || !categoryMap[type] || isNaN(weight)) {
      ignoredCount++;
      continue;
    }

    if (seenCodes.has(code)) {
      valid.push({ code, info, type, weight, status: 'duplicata_lote' });
    } else {
      seenCodes.add(code);
      valid.push({ code, info, type, weight, status: 'novo' });
    }
  }

  return { valid, ignoredCount };
}

const STATUS_LABEL: Record<ParsedAsset['status'], string> = {
  novo: 'Novo',
  duplicata_lote: 'Duplicata (lote)',
  duplicata_banco: 'Duplicata (banco)',
};

const STATUS_TONE: Record<ParsedAsset['status'], StatusTone> = {
  novo: 'success',
  duplicata_lote: 'warning',
  duplicata_banco: 'error',
};

export default function CadastroAtivos() {
  const [rawText, setRawText] = useState('');
  const [view, setView] = useState<'input' | 'preview' | 'result'>('input');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<InsertResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(d => { if (d.categories) setCategories(d.categories); })
      .catch(() => {});
  }, []);

  const categoryMap: Record<string, string> = Object.fromEntries(
    categories.map(c => [c.name, c.label])
  );

  async function handleParse() {
    setError(null);
    setLoading(true);

    const { valid, ignoredCount } = parseTextarea(rawText, categoryMap);

    if (valid.length === 0) {
      setError('Nenhuma linha válida encontrada. Verifique o formato dos dados.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/assets');
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Erro ao verificar ativos existentes.');
        setLoading(false);
        return;
      }

      const existingCodes = new Set<string>((data.assets as { code: string }[]).map(a => a.code));

      const enriched = valid.map(a =>
        a.status === 'novo' && existingCodes.has(a.code) ? { ...a, status: 'duplicata_banco' as const } : a,
      );

      setPreview({ assets: enriched, ignoredCount });
      setView('preview');
    } catch {
      setError('Falha ao verificar ativos existentes no banco.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    setError(null);
    setLoading(true);

    const toInsert = preview.assets
      .filter(a => a.status === 'novo')
      .map(({ code, info, type, weight }) => ({ code, info, type, weight }));

    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets: toInsert }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Erro ao cadastrar ativos.');
        return;
      }

      setResult({
        inserted: data.inserted,
        duplicates: data.duplicates ?? [],
        ignoredCount: preview.ignoredCount,
      });
      setView('result');
    } catch {
      setError('Falha na comunicação com o servidor.');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setRawText('');
    setPreview(null);
    setResult(null);
    setError(null);
    setView('input');
  }

  const newCount = preview?.assets.filter(a => a.status === 'novo').length ?? 0;
  const batchDupCount = preview?.assets.filter(a => a.status === 'duplicata_lote').length ?? 0;
  const dbDupCount = preview?.assets.filter(a => a.status === 'duplicata_banco').length ?? 0;

  return (
    <main className="flex-1 flex flex-col items-center px-6 py-16">
      <div className="w-full max-w-5xl">
        <div className="mb-8">
          <H1 className="text-display-sm">Cadastro de Ativos</H1>
          <Lead className="mt-2 text-muted text-body-md">
            Cada linha: <Mono className="text-primary">código;informação;tipo;peso</Mono>
            {' — '}tipos aceitos:{' '}
            {categories.map((c, i, arr) => (
              <span key={c.name}>
                <Mono className="text-primary">{c.name}</Mono>
                {i < arr.length - 1 ? ', ' : ''}
              </span>
            ))}
            . Linhas com <Mono className="text-muted-soft">#</Mono> são ignoradas.
          </Lead>
        </div>

        {error && (
          <div className="mb-6">
            <StatusBanner tone="error">{error}</StatusBanner>
          </div>
        )}

        {view === 'input' && (
          <div className="space-y-4">
            <Textarea
              id="list_assets"
              name="list_assets"
              label="Lista de Ativos"
              value={rawText}
              onInput={e => setRawText(e.currentTarget.value.replace(/\t/g, ';'))}
              rows={12}
              placeholder={'# Exemplo:\nPETR4;Petrobras PN;acao;10\nHGLG11;CSHG Logística;fii;5\n# linhas com # são ignoradas'}
            />
            <div className="flex justify-end">
              <Button onClick={handleParse} disabled={loading || !rawText.trim()}>
                {loading ? 'Verificando...' : 'Cadastrar'}
              </Button>
            </div>
          </div>
        )}

        {view === 'preview' && preview && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-3 text-body-sm">
              <StatusBadge tone="success">
                {newCount} novo{newCount !== 1 ? 's' : ''}
              </StatusBadge>
              {batchDupCount > 0 && (
                <StatusBadge tone="warning">
                  {batchDupCount} duplicata{batchDupCount !== 1 ? 's' : ''} no lote
                </StatusBadge>
              )}
              {dbDupCount > 0 && (
                <StatusBadge tone="error">
                  {dbDupCount} duplicata{dbDupCount !== 1 ? 's' : ''} no banco
                </StatusBadge>
              )}
              {preview.ignoredCount > 0 && (
                <StatusBadge tone="muted">
                  {preview.ignoredCount} linha{preview.ignoredCount !== 1 ? 's' : ''} ignorada
                  {preview.ignoredCount !== 1 ? 's' : ''}
                </StatusBadge>
              )}
            </div>

            <Card variant="feature" padding="none" className="overflow-x-auto">
              <table className="w-full text-body-sm min-w-max">
                <thead>
                  <tr className="border-b border-hairline text-caption-uppercase uppercase text-muted">
                    <th className="px-4 py-3 text-left">Código</th>
                    <th className="px-4 py-3 text-left">Informações</th>
                    <th className="px-4 py-3 text-left">Tipo</th>
                    <th className="px-4 py-3 text-right">Peso</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {preview.assets.map((a, i) => (
                    <tr key={i} className="hover:bg-surface-soft transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-ink">{a.code}</td>
                      <td className="px-4 py-3 text-body max-w-xs truncate">{a.info}</td>
                      <td className="px-4 py-3 text-muted">{categoryMap[a.type] ?? a.type}</td>
                      <td className="px-4 py-3 text-right text-body">{a.weight.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">
                        <StatusBadge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={handleReset}>
                Voltar
              </Button>
              <Button onClick={handleConfirm} disabled={loading || newCount === 0}>
                {loading ? 'Salvando...' : `Confirmar (${newCount} ativo${newCount !== 1 ? 's' : ''})`}
              </Button>
            </div>
          </div>
        )}

        {view === 'result' && result && (
          <div className="space-y-6">
            <Card variant="feature" padding="none">
              <CardHeader>
                <h2 className="font-display text-title-md text-ink">Resultado do Cadastro</h2>
              </CardHeader>
              <div className="divide-y divide-hairline">
                <ResultRow label="Ativos cadastrados" value={result.inserted} tone="success" />
                <ResultRow
                  label="Duplicatas encontradas"
                  value={result.duplicates.length}
                  tone="error"
                  detail={result.duplicates.length > 0 ? result.duplicates.join(', ') : undefined}
                />
                <ResultRow label="Linhas ignoradas" value={result.ignoredCount} tone="muted" />
              </div>
            </Card>
            <div className="flex justify-end">
              <Button onClick={handleReset}>Novo Cadastro</Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function ResultRow({ label, value, tone, detail }: { label: string; value: number; tone: StatusTone; detail?: string }) {
  const colorClass = tone === 'success' ? 'text-success' : tone === 'error' ? 'text-error' : 'text-muted';
  return (
    <div className="px-8 py-4">
      <div className="flex items-center justify-between">
        <span className="text-muted text-body-sm">{label}</span>
        <span className={`text-2xl font-display ${colorClass}`}>{value}</span>
      </div>
      {detail && (
        <p className="mt-1.5 text-caption text-muted-soft font-mono">{detail}</p>
      )}
    </div>
  );
}
