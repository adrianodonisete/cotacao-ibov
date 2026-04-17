'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { CronJobStatusResponse } from '@/types/cron-job';

const POLL_INTERVAL_MS = 2000;
const STALE_JOB_MINUTES = 15;

interface CronCard {
	cron: string;
	label: string;
	description: string;
	types: string[];
	source: string;
}

const CRON_CARDS: CronCard[] = [
	{
		cron: 'sync-cotacoes',
		label: 'Sync Cotações BR',
		description: 'Sincroniza cotações de ações e FIIs via Brapi.',
		types: ['acao', 'fii'],
		source: 'Brapi',
	},
	{
		cron: 'sync-cotacoes-us',
		label: 'Sync Cotações US',
		description: 'Sincroniza cotações de Stocks e REITs via Twelve Data (lotes de 6 — 60s entre lotes).',
		types: ['stock', 'reit'],
		source: 'Twelve Data',
	},
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

function isStale(startedAt: string): boolean {
	const diff = (Date.now() - new Date(startedAt).getTime()) / 1000 / 60;
	return diff > STALE_JOB_MINUTES;
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

	const startPolling = useCallback(() => {
		if (pollRef.current) return;
		pollRef.current = setInterval(async () => {
			const data = await fetchStatus();
			if (!data) return;
			const allDone = data.status !== 'running' || (data.total_steps > 0 && data.finished_steps >= data.total_steps);
			if (allDone) stopPolling();
		}, POLL_INTERVAL_MS);
	}, [fetchStatus]);

	function stopPolling() {
		if (pollRef.current) {
			clearInterval(pollRef.current);
			pollRef.current = null;
		}
	}

	useEffect(() => {
		fetchStatus().then(data => {
			if (data?.status === 'running') startPolling();
		});
		return () => stopPolling();
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
	const stale = isRunning && job && isStale(job.started_at);
	const buttonDisabled = isRunning || triggering;

	return (
		<div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col gap-4">
			{/* Header */}
			<div>
				<h2 className="text-lg font-semibold text-white">{card.label}</h2>
				<p className="text-sm text-gray-400 mt-1">{card.description}</p>
				<p className="text-xs text-gray-500 mt-1">
					Tipos: <span className="text-gray-300">{card.types.join(', ')}</span>
					{' · '}
					Fonte: <span className="text-gray-300">{card.source}</span>
				</p>
			</div>

			{/* Last run info */}
			{!loading && job && (
				<div className="text-xs text-gray-400">
					Último: <span className="text-gray-200">{formatDateTime(job.started_at)}</span>
					{' — '}
					{job.status === 'running' ? (
						<span className="text-yellow-400">Executando...</span>
					) : job.status === 'done' ? (
						<span className="text-emerald-400">Concluído em {formatDuration(job.started_at, job.finished_at)}</span>
					) : (
						<span className="text-red-400">Erro — {formatDuration(job.started_at, job.finished_at)}</span>
					)}
				</div>
			)}

			{/* Progress bar */}
			{job && (isRunning || job.status === 'done' || job.status === 'error') && (
				<div className="flex flex-col gap-1">
					<div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
						<div
							className={`h-3 rounded-full transition-all duration-500 ${
								job.status === 'error' ? 'bg-red-500' : job.status === 'done' ? 'bg-emerald-500' : 'bg-blue-500'
							}`}
							style={{ width: `${job.percent}%` }}
						/>
					</div>
					<div className="flex justify-between text-xs text-gray-400">
						<span>
							{job.finished_steps} de {job.total_steps} tickers
						</span>
						<span className="font-medium text-gray-200">{job.percent}%</span>
					</div>
				</div>
			)}

			{/* Stale warning */}
			{stale && (
				<p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded px-3 py-2">
					Job travado — iniciado há mais de {STALE_JOB_MINUTES} min sem concluir. Pode ter falhado.
				</p>
			)}

			{/* Error message */}
			{error && (
				<p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">{error}</p>
			)}

			{/* Trigger button */}
			<button
				onClick={handleTrigger}
				disabled={buttonDisabled}
				className={`mt-auto self-start px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
					buttonDisabled
						? 'bg-gray-700 text-gray-500 cursor-not-allowed'
						: 'bg-emerald-600 hover:bg-emerald-500 text-white'
				}`}>
				{triggering ? 'Iniciando...' : isRunning ? 'Executando...' : 'Executar'}
			</button>
		</div>
	);
}

export default function CachePage() {
	return (
		<main className="max-w-4xl mx-auto px-4 py-8">
			<div className="mb-8">
				<h1 className="text-2xl font-bold text-white">Cache Conteúdo</h1>
				<p className="text-gray-400 mt-1 text-sm">
					Dispare os jobs de sincronização de cotações manualmente e acompanhe o progresso em tempo real.
				</p>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				{CRON_CARDS.map(card => (
					<CronCardComponent
						key={card.cron}
						card={card}
					/>
				))}
			</div>
		</main>
	);
}
