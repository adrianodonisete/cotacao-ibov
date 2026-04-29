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
