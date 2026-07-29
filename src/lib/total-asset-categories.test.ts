import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TOTAL_ASSET_CATEGORY_SUBTITLES,
  TOTAL_ASSET_CATEGORY_TITLES,
} from "./total-asset-categories";

test("título singular para cada categoria", () => {
  assert.equal(TOTAL_ASSET_CATEGORY_TITLES.acao, "Total por Ações");
  assert.equal(TOTAL_ASSET_CATEGORY_TITLES.fii, "Total por FIIs");
});

test("subtítulo dinâmico por categoria", () => {
  assert.equal(TOTAL_ASSET_CATEGORY_SUBTITLES.acao, "Totais Categoria Ações");
  assert.equal(TOTAL_ASSET_CATEGORY_SUBTITLES.fii, "Totais Categoria FIIs");
});