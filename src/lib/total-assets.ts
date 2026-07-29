import type { TotalAsset, TotalAssetWithInfo } from "@/types/total-asset";

export type { TotalAsset, TotalAssetWithInfo };

export type TotalCategoryTotals = {
  totalAportado: number;
  totalAtual: number;
  totalPeso: number;
};

type SupabaseTotalsRow = {
  total_assets_value_aported: string | number | null;
  total_assets_value_current: string | number | null;
  total_assets_weight: string | number | null;
} | null;

export function normalizeTotalCategoryTotals(
  row: SupabaseTotalsRow,
): TotalCategoryTotals {
  if (!row) return { totalAportado: 0, totalAtual: 0, totalPeso: 0 };
  const toNumber = (value: string | number | null | undefined): number => {
    if (value === null || value === undefined || value === "") return 0;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    totalAportado: toNumber(row.total_assets_value_aported),
    totalAtual: toNumber(row.total_assets_value_current),
    totalPeso: toNumber(row.total_assets_weight),
  };
}

export type CategoryPerformance = {
  lucro: number;
  percentualLucro: number;
};

export function calculateCategoryPerformance(
  totals: TotalCategoryTotals,
): CategoryPerformance {
  const lucro = totals.totalAtual - totals.totalAportado;
  const percentualLucro =
    totals.totalAportado !== 0 ? (lucro / totals.totalAportado) * 100 : 0;
  return { lucro, percentualLucro };
}

export type SortDirection = "asc" | "desc";

export type SortableField = keyof TotalAssetWithInfo;

function compareValues(a: unknown, b: unknown): number {
  const aNull = a === null || a === undefined;
  const bNull = b === null || b === undefined;
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const aStr = String(a);
  const bStr = String(b);
  return aStr.localeCompare(bStr, "pt-BR", { numeric: true });
}

export function sortTotalAssets<T extends TotalAssetWithInfo>(
  rows: readonly T[],
  field: SortableField,
  direction: SortDirection,
): T[] {
  const sorted = [...rows];
  sorted.sort((rowA, rowB) => {
    const aValue = rowA[field];
    const bValue = rowB[field];
    const aNull = aValue === null || aValue === undefined;
    const bNull = bValue === null || bValue === undefined;
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;
    const result = compareValues(aValue, bValue);
    return direction === "asc" ? result : -result;
  });
  return sorted;
}