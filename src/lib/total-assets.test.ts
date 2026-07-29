import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateCategoryPerformance,
  normalizeTotalCategoryTotals,
  sortTotalAssets,
  type TotalAssetWithInfo,
} from "./total-assets";

const baseAsset: TotalAssetWithInfo = {
  code: "AAA",
  category_name: "acao",
  percentual_objetivo: 0,
  montante_objetivo: 0,
  total_qtd: 0,
  cotacao: 0,
  total_aportado: 100,
  percentual_aportado: 0,
  montante_atual: 125,
  percentual_montante_atual: 0,
  lucro: 25,
  percentual_lucro: 25,
  montante_falta: 0,
  percentual_falta: 0,
  primeiro_aporte: null,
  ultimo_aporte: null,
  info: "",
  weight: 0,
};

test("normalizeTotalCategoryTotals converte strings numéricas e mantém null como zeros", () => {
  const result = normalizeTotalCategoryTotals({
    total_assets_value_aported: "100.5",
    total_assets_value_current: "125.5",
    total_assets_weight: "12.345",
  });
  assert.deepEqual(result, {
    totalAportado: 100.5,
    totalAtual: 125.5,
    totalPeso: 12.345,
  });
});

test("normalizeTotalCategoryTotals aceita valores já numéricos", () => {
  const result = normalizeTotalCategoryTotals({
    total_assets_value_aported: 100,
    total_assets_value_current: 110,
    total_assets_weight: 5.4,
  });
  assert.deepEqual(result, { totalAportado: 100, totalAtual: 110, totalPeso: 5.4 });
});

test("normalizeTotalCategoryTotals devolve zeros quando registro ausente", () => {
  assert.deepEqual(normalizeTotalCategoryTotals(null), {
    totalAportado: 0,
    totalAtual: 0,
    totalPeso: 0,
  });
});

test("calculateCategoryPerformance: lucro positivo", () => {
  const perf = calculateCategoryPerformance({ totalAportado: 100, totalAtual: 125, totalPeso: 12.5 });
  assert.equal(perf.lucro, 25);
  assert.equal(perf.percentualLucro, 25);
});

test("calculateCategoryPerformance: lucro negativo", () => {
  const perf = calculateCategoryPerformance({ totalAportado: 100, totalAtual: 80, totalPeso: 0 });
  assert.equal(perf.lucro, -20);
  assert.equal(perf.percentualLucro, -20);
});

test("calculateCategoryPerformance: aporte zero evita NaN", () => {
  const perf = calculateCategoryPerformance({ totalAportado: 0, totalAtual: 0, totalPeso: 0 });
  assert.equal(perf.lucro, 0);
  assert.equal(perf.percentualLucro, 0);
});

test("sortTotalAssets ASC por código (texto)", () => {
  const rows: TotalAssetWithInfo[] = [
    { ...baseAsset, code: "BBB" },
    { ...baseAsset, code: "AAA" },
    { ...baseAsset, code: "CCC" },
  ];
  const sorted = sortTotalAssets(rows, "code", "asc").map((r) => r.code);
  assert.deepEqual(sorted, ["AAA", "BBB", "CCC"]);
});

test("sortTotalAssets DESC por total_aportado (número)", () => {
  const rows: TotalAssetWithInfo[] = [
    { ...baseAsset, code: "A", total_aportado: 10 },
    { ...baseAsset, code: "B", total_aportado: 30 },
    { ...baseAsset, code: "C", total_aportado: 20 },
  ];
  const sorted = sortTotalAssets(rows, "total_aportado", "desc").map((r) => r.code);
  assert.deepEqual(sorted, ["B", "C", "A"]);
});

test("sortTotalAssets coloca nulos por último em ASC e DESC para datas", () => {
  const rows: TotalAssetWithInfo[] = [
    { ...baseAsset, code: "A", primeiro_aporte: null },
    { ...baseAsset, code: "B", primeiro_aporte: "2024-01-01" },
    { ...baseAsset, code: "C", primeiro_aporte: "2025-05-05" },
  ];
  assert.deepEqual(sortTotalAssets(rows, "primeiro_aporte", "asc").map((r) => r.code), ["B", "C", "A"]);
  assert.deepEqual(sortTotalAssets(rows, "primeiro_aporte", "desc").map((r) => r.code), ["C", "B", "A"]);
});

test("sortTotalAssets não muta o array original", () => {
  const rows: TotalAssetWithInfo[] = [{ ...baseAsset, code: "B" }, { ...baseAsset, code: "A" }];
  const original = [...rows];
  sortTotalAssets(rows, "code", "asc");
  assert.deepEqual(rows, original);
});