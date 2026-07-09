'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Textarea } from '@/components/ui/TextInput';
import { H1, Lead, Mono } from '@/components/ui/typography';

interface ParsedAporte {
  code: string;
  qtd: number;
  value_total: number;
  date_operation: string;
  currency: string;
  dolar_value: number;
  info: string;
  status: 'novo' | 'duplicata_lote' | 'duplicata_banco';
}

interface InsertResult {
  inserted: number;
  dbDuplicates: number;
  batchDuplicates: number;
  ignoredCount: number;
}

function parseDate(raw: string): string | null {
  const ddmmyyyy = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim();
  return null;
}

function normalizeCurrency(val: string | undefined): string {
  const v = (val ?? '').trim().toUpperCase();
  return v === 'USD' || v === 'BRL' ? v : 'BRL';
}

function normalizeDolarValue(val: string | undefined): number {
  const n = parseFloat((val ?? '').trim().replace(',', '.'));
  return isNaN(n) ? 0.0 : 0.0;
}

function parseTextarea(text: string): {
  valid: ParsedAporte[];
  ignoredCount: number;
} {
  const lines = text.split('\n');
  const seenKeys = new Set<string>();
  const valid: ParsedAporte[] = [];
  let ignoredCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const cols = trimmed.split(';');
    if (cols.length < 4 || cols.length > 7) {
      ignoredCount++;
      continue;
    }

    const [rawCode, rawQtd, rawValue, rawDate, rawCurrency, rawDolarValue, rawInfo] = cols;
    const code = rawCode.trim().startsWith('Tesouro') ? rawCode.trim() : rawCode.trim().toUpperCase();
    const qtd = parseFloat(rawQtd.trim().replace(',', '.'));
    const value_total = parseFloat(rawValue.trim().replace(',', '.'));
    const date_operation = parseDate(rawDate.trim());

    if (!code || isNaN(qtd) || isNaN(value_total) || !date_operation) {
      ignoredCount++;
      continue;
    }

    const currency = normalizeCurrency(rawCurrency);
    const dolar_value = normalizeDolarValue(rawDolarValue);
    const info = (rawInfo ?? '').trim();

    const key = `${code}|${qtd}|${date_operation}`;
    if (seenKeys.has(key)) {
      valid.push({ code, qtd, value_total, date_operation, currency, dolar_value, info, status: 'duplicata_lote' });
    } else {
      seenKeys.add(key);
      valid.push({ code, qtd, value_total, date_operation, currency, dolar_value, info, status: 'novo' });
    }
  }

  return { valid, ignoredCount };
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

const STATUS_LABEL: Record<ParsedAporte['status'], string> = {
  novo: 'Novo',
  duplicata_lote: 'Duplicata (lote)',
  duplicata_banco: 'Duplicata (banco)',
};

const STATUS_TONE: Record<ParsedAporte['status'], StatusTone> = {
  novo: 'success',
  duplicata_lote: 'warning',
  duplicata_banco: 'error',
};

export default function CadastroAportes() {
  const [rawText, setRawText] = useState('');
  const [view, setView] = useState<'input' | 'preview' | 'result'>('input');
  const [preview, setPreview] = useState<ParsedAporte[] | null>(null);
  const [ignoredCount, setIgnoredCount] = useState(0);
  const [result, setResult] = useState<InsertResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleParse() {
    setError(null);
    setLoading(true);

    const { valid, ignoredCount: ignored } = parseTextarea(rawText);
    setIgnoredCount(ignored);

    if (valid.length === 0) {
      setError(
        'Nenhuma linha válida encontrada. Verifique o formato: código;quantidade;valor total;data[;moeda[;dólar[;info]]]',
      );
      setLoading(false);
      return;
    }

    const toCheck = valid.filter(a => a.status === 'novo');

    try {
      const res = await fetch('/api/aportes/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aportes: toCheck.map(({ code, qtd, date_operation }) => ({
            code,
            qtd,
            date_operation,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Erro ao verificar duplicatas no banco.');
        setLoading(false);
        return;
      }

      const dbDupKeys = new Set<string>(
        (data.duplicates as { code: string; qtd: number; date_operation: string }[]).map(
          d => `${d.code}|${Number(d.qtd)}|${d.date_operation}`,
        ),
      );

      const enriched = valid.map(a => {
        if (a.status === 'novo' && dbDupKeys.has(`${a.code}|${a.qtd}|${a.date_operation}`)) {
          return { ...a, status: 'duplicata_banco' as const };
        }
        return a;
      });

      setPreview(enriched);
      setView('preview');
    } catch {
      setError('Falha ao verificar duplicatas.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    setError(null);
    setLoading(true);

    const toInsert = preview
      .filter(a => a.status === 'novo')
      .map(({ code, qtd, value_total, date_operation, currency, dolar_value, info }) => ({
        code,
        qtd,
        value_total,
        date_operation,
        currency,
        dolar_value,
        info,
      }));

    const batchDuplicates = preview.filter(a => a.status === 'duplicata_lote').length;
    const dbDuplicates = preview.filter(a => a.status === 'duplicata_banco').length;

    try {
      const res = await fetch('/api/aportes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aportes: toInsert }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Erro ao cadastrar aportes.');
        return;
      }

      setResult({
        inserted: data.inserted,
        dbDuplicates: dbDuplicates + (data.duplicates?.length ?? 0),
        batchDuplicates,
        ignoredCount,
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
    setIgnoredCount(0);
    setView('input');
  }

  const newCount = preview?.filter(a => a.status === 'novo').length ?? 0;
  const batchDupCount = preview?.filter(a => a.status === 'duplicata_lote').length ?? 0;
  const dbDupCount = preview?.filter(a => a.status === 'duplicata_banco').length ?? 0;

  return (
    <main className="flex-1 flex flex-col items-center px-6 py-16">
      <div className="w-full max-w-6xl">
        <div className="mb-8">
          <H1 className="text-display-sm">Cadastro de Aportes</H1>
          <Lead className="mt-2 text-muted text-body-md">
            Cada linha: <Mono className="text-primary">código;quantidade;valor total;data[;moeda[;dólar[;info]]]</Mono>
            {' — '}data aceita em <Mono className="text-primary">dd/mm/aaaa</Mono> ou{' '}
            <Mono className="text-primary">aaaa-mm-dd</Mono>. Moeda: <Mono className="text-primary">BRL</Mono>{' '}
            ou <Mono className="text-primary">USD</Mono> (padrão: BRL). Linhas com{' '}
            <Mono className="text-muted-soft">#</Mono> são ignoradas.
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
              id="list_aportes"
              name="list_aportes"
              label="Lista de Aportes"
              value={rawText}
              onInput={e => setRawText(e.currentTarget.value.replace(/\t/g, ';'))}
              rows={12}
              placeholder={'# Exemplos:\nPETR4;100;3250,00;15/01/2025\nVALE3;50;4100,50;2025-01-20;BRL\nIVVB11;10;2500,00;2025-01-20;USD;5.10;ETF S&P500\n# linhas com # são ignoradas'}
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
              <StatusBadge tone="success">{newCount} novo{newCount !== 1 ? 's' : ''}</StatusBadge>
              {batchDupCount > 0 && (
                <StatusBadge tone="warning">{batchDupCount} duplicata{batchDupCount !== 1 ? 's' : ''} no lote</StatusBadge>
              )}
              {dbDupCount > 0 && (
                <StatusBadge tone="error">{dbDupCount} duplicata{dbDupCount !== 1 ? 's' : ''} no banco</StatusBadge>
              )}
              {ignoredCount > 0 && (
                <StatusBadge tone="muted">
                  {ignoredCount} linha{ignoredCount !== 1 ? 's' : ''} ignorada{ignoredCount !== 1 ? 's' : ''}
                </StatusBadge>
              )}
            </div>

            <Card variant="feature" padding="none" className="overflow-x-auto">
              <table className="w-full text-body-sm min-w-max">
                <thead>
                  <tr className="border-b border-hairline text-caption-uppercase uppercase text-muted">
                    <th className="px-4 py-3 text-left">Código</th>
                    <th className="px-4 py-3 text-right">Quantidade</th>
                    <th className="px-4 py-3 text-right">Valor Total</th>
                    <th className="px-4 py-3 text-center">Data</th>
                    <th className="px-4 py-3 text-center">Moeda</th>
                    <th className="px-4 py-3 text-right">Dólar</th>
                    <th className="px-4 py-3 text-left">Info</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {preview.map((a, i) => (
                    <tr key={i} className="hover:bg-surface-soft transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-ink">{a.code}</td>
                      <td className="px-4 py-3 text-right text-body">{formatQtd(a.qtd)}</td>
                      <td className="px-4 py-3 text-right text-body">{formatValue(a.value_total)}</td>
                      <td className="px-4 py-3 text-center text-body">{formatDate(a.date_operation)}</td>
                      <td className="px-4 py-3 text-center text-body">{a.currency}</td>
                      <td className="px-4 py-3 text-right text-body">
                        {a.dolar_value > 0 ? formatValue(a.dolar_value) : '—'}
                      </td>
                      <td className="px-4 py-3 text-left text-body">{a.info || '—'}</td>
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
                {loading ? 'Salvando...' : `Confirmar (${newCount} aporte${newCount !== 1 ? 's' : ''})`}
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
                <ResultRow label="Aportes cadastrados" value={result.inserted} tone="success" />
                <ResultRow label="Duplicatas encontradas (banco)" value={result.dbDuplicates} tone="error" />
                <ResultRow label="Duplicatas encontradas (lote)" value={result.batchDuplicates} tone="warning" />
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

function ResultRow({ label, value, tone }: { label: string; value: number; tone: StatusTone }) {
  const colorClass = tone === 'success' ? 'text-success' : tone === 'error' ? 'text-error' : tone === 'warning' ? 'text-warning' : 'text-muted';
  return (
    <div className="px-8 py-4 flex items-center justify-between">
      <span className="text-muted text-body-sm">{label}</span>
      <span className={`text-2xl font-display ${colorClass}`}>{value}</span>
    </div>
  );
}
