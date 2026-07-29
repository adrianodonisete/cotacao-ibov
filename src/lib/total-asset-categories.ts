export type TotalAssetCategory = "acao" | "fii";

export const TOTAL_ASSET_CATEGORIES: readonly TotalAssetCategory[] = [
  "acao",
  "fii",
] as const;

export const TOTAL_ASSET_CATEGORY_TITLES: Record<TotalAssetCategory, string> = {
  acao: "Total por Ações",
  fii: "Total por FIIs",
};

export const TOTAL_ASSET_CATEGORY_SUBTITLES: Record<TotalAssetCategory, string> = {
  acao: "Totais Categoria Ações",
  fii: "Totais Categoria FIIs",
};

export function isTotalAssetCategory(value: string): value is TotalAssetCategory {
  return (TOTAL_ASSET_CATEGORIES as readonly string[]).includes(value);
}
