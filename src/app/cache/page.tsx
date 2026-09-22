'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { CronJobError, CronJobStatusResponse } from '@/types/cron-job';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Modal } from '@/components/ui/Modal';
import { H1, Lead } from '@/components/ui/typography';

const POLL_INTERVAL_MS = 2000;

interface CronCard {
  cron: string;
  label: string;
  description: string;
  types: string[];
  source: string;
}

const CRON_CARDS: CronCard[] = [
  { cron: 'sync-cotacoes', label: 'Sync Cotações BR', description: 'Sincroniza cotações de ações e FIIs via Brapi.', types: ['acao', 'fii'], source: 'Brapi' },
  { cron: 'sync-cotacoes-us', label: 'Sync Cotações US', description: 'Sincroniza cotações de Stocks e REITs via Twelve Data (lotes de 6 — 60s entre lotes).', types: ['stock', 'reit'], source: 'Twelve Data' },
  { cron: 'sync-cotacoes-td', label: 'Sync Cotações Tesouro Direto', description: 'Sincroniza cotações de títulos do Tesouro Direto via Radar Opções (sequencial, um título por vez).', types: ['td'], source: 'Radar Opções' },
  { cron: 'sync-cotacoes-indices', label: 'Sync Cotações Índices (IPCA, SELIC, Dólar)', description: 'Sincroniza IPCA 12M, SELIC meta e cotação PTAX do dólar (compra) via APIs do Banco Central.', types: ['indice'], source: 'BCB (api.bcb.gov.br + olinda.bcb.gov.br)' },
  { cron: 'calculate-totals-by-category', label: 'Calcular Totais por Categoria', description: 'Calcula e atualiza os totais agregados (aportes, valor atual, peso) para cada categoria de ativo.', types: ['acao', 'fii', 'stock', 'reit', 'td'], source: 'Supabase (agregação)' },
  { cron: 'calculate-totals-by-assets', label: 'Calcular Totais por Ativo', description: 'Calcula montante objetivo, aporte, lucro, montante faltante e datas do primeiro/último aporte para cada ativo, gravando em total_assets_cache.', types: ['acao', 'fii', 'stock', 'reit', 'td'], source: 'Supabase (agregação)' },
  { cron: 'calculate-totals-by-dividends', label: 'Calcular Totais de Dividendos por Período', description: 'Calcula e grava em total_dividends_cache o total mensal e anual de dividendos por ativo e por categoria (acao/fii/stock/reit). Stock/reit convertidos para USD via cotação USD_BRL.', types: ['acao', 'fii', 'stock', 'reit'], source: 'Supabase (agregação por período)' },
];

function formatDuration(startedAt: string, finishedAt: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const secs = Math.round((end - start) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}m ${rem}s`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface CardState {
  job: CronJobStatusResponse | null;
  loading: boolean;
  triggering: boolean;
  error: string | null;
}

function CronCardComponent({ card }: { card: CronCard }) {
  const [state, setState] = useState<CardState>({
    job: null,
    loading: true,
    triggering: false,
    error: null,
  });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/cache/status?cron=${card.cron}`);
      if (res.status === 404) {
        setState(prev => ({ ...prev, job: null, loading: false }));
        return null;
      }
      if (!res.ok) {
        const body = await res.json();
        setState(prev => ({ ...prev, error: body.error ?? 'Erro ao buscar status.', loading: false }));
        return null;
      }
      const data: CronJobStatusResponse = await res.json();
      setState(prev => ({ ...prev, job: data, loading: false, error: null }));
      return data;
    } catch {
      setState(prev => ({ ...prev, error: 'Erro de rede.', loading: false }));
      return null;
    }
  }, [card.cron]);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const data = await fetchStatus();
      if (!data) return;
      const allDone = data.status !== 'running' || (data.total_steps > 0 && data.finished_steps >= data.total_steps);
      if (allDone) stopPolling();
    }, POLL_INTERVAL_MS);
  }, [fetchStatus]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchStatus().then(data => {
        if (data?.status === 'running') startPolling();
      });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      stopPolling();
    };
  }, [fetchStatus, startPolling]);

  useEffect(() => {
    if (state.job?.status === 'running') {
      startPolling();
    }
  }, [state.job?.status, startPolling]);

  async function handleTrigger() {
    setState(prev => ({ ...prev, triggering: true, error: null }));
    try {
      const res = await fetch(`/api/cache/trigger?cron=${card.cron}`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) {
        setState(prev => ({ ...prev, triggering: false, error: body.error ?? 'Erro ao iniciar.' }));
        return;
      }
      setState(prev => ({ ...prev, triggering: false }));
      await fetchStatus();
      startPolling();
    } catch {
      setState(prev => ({ ...prev, triggering: false, error: 'Erro de rede ao iniciar cron.' }));
    }
  }

  const { job, loading, triggering, error } = state;
  const isRunning = job?.status === 'running';
  const jobErrors = job?.errors ?? [];
  const buttonDisabled = isRunning || triggering;

  return (
    <Card variant="feature" padding="lg" className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-title-md text-ink">{card.label}</h2>
        <p className="text-body-sm text-muted mt-1">{card.description}</p>
        <p className="text-caption text-muted-soft mt-2">
          Tipos: <span className="text-body">{card.types.join(', ')}</span>
          {' · '}
          Fonte: <span className="text-body">{card.source}</span>
        </p>
      </div>

      {!loading && job && (
        <div className="text-caption text-muted">
          Último: <span className="text-body">{formatDateTime(job.started_at)}</span>
          {' — '}
          {job.status === 'running' ? (
            <span className="text-warning">Executando...</span>
          ) : job.status === 'done' ? (
            <span className="text-success">Concluído em {formatDuration(job.started_at, job.finished_at)}</span>
          ) : (
            <span className="text-error">Erro — {formatDuration(job.started_at, job.finished_at)}</span>
          )}
        </div>
      )}

      {job && (isRunning || job.status === 'done' || job.status === 'error') && (
        <div className="flex flex-col gap-2">
          <ProgressBar
            value={job.percent}
            tone={job.status === 'error' ? 'error' : job.status === 'done' ? 'done' : 'running'}
            showLabel={`Progresso do job ${card.label}`}
          />
          <div className="flex justify-between text-caption text-muted">
            <span>{job.finished_steps} de {job.total_steps} tickers</span>
            <span className="font-medium text-body">{job.percent}%</span>
          </div>
        </div>
      )}

      {jobErrors.length > 0 && (
        <StatusBanner tone="warning">
          Concluído com {jobErrors.length} ocorrência(s) que precisam de atenção.
          <Button variant="text-link" size="sm" className="ml-2" onClick={() => setDetailsOpen(true)}>
            Ver detalhes
          </Button>
        </StatusBanner>
      )}

      {error && <StatusBanner tone="error">{error}</StatusBanner>}

      <div className="mt-auto">
        <Button onClick={handleTrigger} disabled={buttonDisabled} size="sm">
          {triggering ? 'Iniciando...' : isRunning ? 'Executando...' : 'Executar'}
        </Button>
      </div>

      <Modal
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title={`Detalhes das ocorrências — ${card.label}`}
        size="lg"
        footer={<Button variant="secondary" size="sm" onClick={() => setDetailsOpen(false)}>Fechar</Button>}
      >
        <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
          {jobErrors.map((item, index) => (
            <ErrorDetail key={`${item.batch}-${item.code ?? item.codes?.join('-') ?? index}`} error={item} />
          ))}
        </div>
      </Modal>
    </Card>
  );
}

function ErrorDetail({ error }: { error: CronJobError }) {
  const codes = error.code ?? error.codes?.join(', ');
  return (
    <div className="rounded-md border border-hairline bg-surface-soft px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-caption text-muted">
        <span>{error.batch}</span>
        <span className="uppercase">{error.kind}</span>
      </div>
      {codes && <p className="mt-1 font-medium text-ink">{codes}</p>}
      <p className="mt-1 text-body-sm text-body">{error.message}</p>
    </div>
  );
}

export default function CachePage() {
  return (
    <main className="flex-1 flex flex-col items-center px-6 py-16">
      <div className="w-full max-w-5xl">
        <div className="mb-10">
          <H1 className="text-display-sm">Cache Conteúdo</H1>
          <Lead className="mt-2 text-muted text-body-md">
            Dispare os jobs de sincronização de cotações manualmente e acompanhe o progresso em tempo real.
          </Lead>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {CRON_CARDS.map(card => (
            <CronCardComponent key={card.cron} card={card} />
          ))}
        </div>
      </div>
    </main>
  );
}
