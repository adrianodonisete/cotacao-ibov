export const URL_API_BRAPI = 'https://brapi.dev/api/quote/';

export const TYPES_ASSETS: Record<string, string> = {
	acao: 'Ação',
	fii: 'FII',
	stock: 'Stock',
	reit: 'REIT',
	td: 'Tesouro Direto',
};

export type AssetType = keyof typeof TYPES_ASSETS;

export const CURRENCIES: Record<string, string> = {
	BRL: 'BRL',
	USD: 'USD',
};
