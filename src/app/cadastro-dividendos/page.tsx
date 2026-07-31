'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Textarea } from '@/components/ui/TextInput';
import { H1, Lead, Mono } from '@/components/ui/typography';
import { parseDividendosText } from '@/lib/dividendo-parser';

interface SubmitResult {
  inserted: number;
  dbDuplicates: number;
  batchDuplicates: number;
  ignoredCount: number;
}

export default function CadastroDividendos() {
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const { rows, batchDuplicates, ignoredCount } = parseDividendosText(rawText);

    if (rows.length === 0) {
      setError(
        'Nenhuma linha válida encontrada. Verifique o formato: código;data pagamento;quantidade;total líquido'
      );
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/dividendos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dividendos: rows }),
      });
      const data = (await res.json()) as
        | SubmitResult
        | { error: string };

      if (!res.ok || 'error' in data) {
        setError('error' in data ? data.error : 'Erro ao cadastrar dividendos.');
        setLoading(false);
        return;
      }

      setSuccess({ ...data, batchDuplicates, ignoredCount });
      setRawText('');
    } catch {
      setError('Falha na comunicação com o servidor.');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setRawText('');
    setError(null);
    setSuccess(null);
  }

  return (
    <main className="flex-1 flex flex-col items-center px-6 py-16">
      <div className="w-full max-w-6xl">
        <div className="mb-8">
          <H1 className="text-display-sm">Cadastro de Dividendos</H1>
          <Lead className="mt-2 text-muted text-body-md">
            Cada linha:{' '}
            <Mono className="text-primary">código;data pagamento;quantidade;total líquido</Mono>
            {' — '}data aceita em <Mono className="text-primary">dd/mm/aaaa</Mono> ou{' '}
            <Mono className="text-primary">aaaa-mm-dd</Mono>. Separador decimal:{' '}
            <Mono className="text-primary">.</Mono> ou <Mono className="text-primary">,</Mono>.
            Linhas com <Mono className="text-muted-soft">#</Mono> são ignoradas.
          </Lead>
        </div>

        {error && (
          <div className="mb-6">
            <StatusBanner tone="error">{error}</StatusBanner>
          </div>
        )}

        {success && (
          <div className="mb-6 space-y-2">
            <StatusBanner tone="success">
              {success.inserted} dividendo{success.inserted !== 1 ? 's' : ''} cadastrado
              {success.inserted !== 1 ? 's' : ''}
              {success.ignoredCount > 0 || success.batchDuplicates > 0 || success.dbDuplicates > 0
                ? ` · ${success.ignoredCount} linha${success.ignoredCount !== 1 ? 's' : ''} ignorada${success.ignoredCount !== 1 ? 's' : ''}`
                : ''}
              {success.batchDuplicates > 0
                ? ` · ${success.batchDuplicates} duplicata${success.batchDuplicates !== 1 ? 's' : ''} no lote`
                : ''}
              {success.dbDuplicates > 0
                ? ` · ${success.dbDuplicates} duplicata${success.dbDuplicates !== 1 ? 's' : ''} no banco`
                : ''}
            </StatusBanner>
          </div>
        )}

        <div className="space-y-4">
          <Textarea
            id="list_dividendos"
            name="list_dividendos"
            label="Lista de Dividendos"
            value={rawText}
            onInput={e => setRawText(e.currentTarget.value.replace(/\t/g, ';'))}
            rows={12}
            placeholder={'BBDC3;2026-07-31;100;890.00\nITUB3;2026-07-01;800;350,00'}
          />
          <div className="flex justify-end gap-3">
            {(rawText || success || error) && (
              <Button variant="secondary" onClick={handleReset} disabled={loading}>
                Limpar
              </Button>
            )}
            <Button onClick={handleSubmit} disabled={loading || !rawText.trim()}>
              {loading ? 'Cadastrando...' : 'Cadastrar'}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
