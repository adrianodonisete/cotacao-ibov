/**
 * Cliente para a API SGS do Banco Central (api.bcb.gov.br).
 * Não requer token. Endpoint pega a última cotação publicada de uma série.
 *
 * Séries usadas pelo projeto:
 *   - 13522 = IPCA acumulado em 12 meses (% a.a.)
 *   - 432   = Meta SELIC definida pelo Copom (% a.a.)
 *
 * Catálogo: https://www3.bcb.gov.br/sgspub/
 */

const BASE_URL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs';
const PTAX_BASE_URL = 'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata';

export const BCB_SERIES = {
	IPCA_12M: 13522,
	SELIC_META: 432,
} as const;

export interface BcbQuote {
	value: number;
	date_update: string; // yyyy-mm-dd
}

interface BcbApiRow {
	data: string; // dd/MM/yyyy
	valor: string;
}

function isValidBcbResponse(body: unknown): body is BcbApiRow[] {
	return (
		Array.isArray(body) &&
		body.length > 0 &&
		typeof (body[0] as BcbApiRow).data === 'string' &&
		typeof (body[0] as BcbApiRow).valor === 'string'
	);
}

/** "01/03/2026" -> "2026-03-01". Lança erro se a string não bater no padrão. */
function parseBrDate(br: string): string {
	const match = br.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
	if (!match) {
		throw new Error(`[BcbService] Data inválida: "${br}".`);
	}
	const [, dd, mm, yyyy] = match;
	return `${yyyy}-${mm}-${dd}`;
}

/**
 * Busca a última cotação publicada de uma série SGS do BCB.
 *
 * @param serie Código numérico da série (ex.: 13522 IPCA, 432 SELIC).
 * @returns `{ value, date_update }` com data já normalizada para `yyyy-mm-dd`.
 */
export async function fetchBcbLatest(serie: number): Promise<BcbQuote> {
	if (!Number.isFinite(serie) || serie <= 0) {
		throw new Error(`[BcbService] Código de série inválido: ${serie}.`);
	}

	const url = `${BASE_URL}.${serie}/dados/ultimos/1?formato=json`;
	const res = await fetch(url);

	if (!res.ok) {
		throw new Error(`[BcbService] HTTP ${res.status} ao buscar série ${serie}.`);
	}

	const body: unknown = await res.json();

	if (!isValidBcbResponse(body)) {
		throw new Error(`[BcbService] Resposta inesperada da API para série ${serie}.`);
	}

	const row = body[0]!;
	const value = Number(row.valor.replace(',', '.'));

	if (!Number.isFinite(value)) {
		throw new Error(`[BcbService] Valor não numérico para série ${serie}: "${row.valor}".`);
	}

	return {
		value,
		date_update: parseBrDate(row.data),
	};
}

interface PtaxRow {
	cotacaoCompra: number;
	cotacaoVenda: number;
	dataHoraCotacao: string; // "yyyy-MM-dd HH:mm:ss.SSS"
}

interface PtaxResponse {
	value?: PtaxRow[];
}

function isValidPtaxResponse(body: unknown): body is PtaxResponse {
	return typeof body === 'object' && body !== null && 'value' in body;
}

/** `Date` -> "MM-DD-YYYY" (formato exigido pelo Olinda PTAX). */
function formatPtaxDate(d: Date): string {
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	const yyyy = d.getFullYear();
	return `${mm}-${dd}-${yyyy}`;
}

/**
 * Busca a última cotação PTAX de compra do dólar publicada.
 *
 * PTAX só publica em dias úteis; em fins de semana / feriados a API responde
 * com `value: []`. Esta função tenta D-0, D-1, ..., até `maxDaysBack` dias atrás
 * e retorna a primeira data com cotação disponível.
 *
 * @param maxDaysBack Número máximo de dias para retroceder (default 7).
 * @returns `{ value, date_update }` com `value` = `cotacaoCompra` e `date_update` em `yyyy-mm-dd`.
 */
export async function fetchPtaxUsdLatest(maxDaysBack = 7): Promise<BcbQuote> {
	const today = new Date();

	for (let i = 0; i <= maxDaysBack; i++) {
		const target = new Date(today);
		target.setDate(today.getDate() - i);

		const url =
			`${PTAX_BASE_URL}/CotacaoDolarDia(dataCotacao=@dataCotacao)` +
			`?@dataCotacao=%27${formatPtaxDate(target)}%27&$top=1&$format=json`;

		const res = await fetch(url);

		if (!res.ok) continue;

		const body: unknown = await res.json();
		if (!isValidPtaxResponse(body)) continue;

		const row = body.value?.[0];
		if (!row) continue;

		const value = Number(row.cotacaoCompra);
		if (!Number.isFinite(value)) continue;

		const date_update = row.dataHoraCotacao.split(' ')[0];
		if (!date_update) continue;

		return { value, date_update };
	}

	throw new Error(`[BcbService] PTAX sem cotacao nos ultimos ${maxDaysBack} dias.`);
}
