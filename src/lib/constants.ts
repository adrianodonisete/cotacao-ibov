export const URL_API_BRAPI = "https://brapi.dev/api/quote/";

export const TYPES_ASSETS: Record<string, string> = {
  acao: "Ação",
  fii: "FII",
  stock: "Stock",
  reit: "REIT",
};

export type AssetType = keyof typeof TYPES_ASSETS;
