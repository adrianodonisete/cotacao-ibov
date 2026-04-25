import { log } from 'console';

const BASE_URL = 'https://api.radaropcoes.com/bonds';

export interface TesouroDiretoQuote {
	value: number;
	date_update: string; // yyyy-mm-dd (data local da consulta — API não devolve data)
	maturity_date: string | null; // yyyy-mm-dd
}

interface RadarOpcoesBondResponse {
	unitaryRedemptionValue: number;
	unitaryInvestmentValue: number;
	maturityDate?: string | null;
}

function isValidBondResponse(body: unknown): body is RadarOpcoesBondResponse {
	return (
		typeof body === 'object' &&
		body !== null &&
		typeof (body as RadarOpcoesBondResponse).unitaryRedemptionValue === 'number' &&
		typeof (body as RadarOpcoesBondResponse).unitaryInvestmentValue === 'number'
	);
}

/**
 * Busca a cotação de um título do Tesouro Direto via api.radaropcoes.com.
 *
 * Por padrão retorna `unitaryRedemptionValue` (valor de resgate).
 * Passe `valueType: 'investment'` para obter `unitaryInvestmentValue`.
 *
 * Converte a lógica original de `.vscode/tesouro.js` (Google Sheets) para
 * TypeScript server-side com `fetch` nativo.
 */
export async function fetchTesouroDiretoQuote(
	bondName: string,
	valueType: 'redemption' | 'investment' = 'redemption',
): Promise<TesouroDiretoQuote> {
	const code = bondName.trim();
	if (!code) {
		throw new Error('Nome do título do Tesouro Direto não pode ser vazio.');
	}

	const url = `${BASE_URL}/${encodeURIComponent(code)}`;
	console.log(url);
	const res = await fetch(url);

	if (!res.ok) {
		throw new Error(`[TesouroDiretoService] HTTP ${res.status} ao buscar "${code}".`);
	}

	const body: unknown = await res.json();

	if (!isValidBondResponse(body)) {
		throw new Error(`[TesouroDiretoService] Resposta inesperada da API para "${code}".`);
	}

	const value = valueType === 'investment' ? body.unitaryInvestmentValue : body.unitaryRedemptionValue;
	const maturity_date = body.maturityDate ? new Date(body.maturityDate).toISOString().split('T')[0]! : null;
	const date_update = new Date().toISOString().split('T')[0]!;

	return { value, date_update, maturity_date };
}
