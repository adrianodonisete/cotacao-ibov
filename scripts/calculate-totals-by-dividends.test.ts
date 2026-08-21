import { test } from "node:test";
import assert from "node:assert/strict";
import {
  monthsBetween,
  yearsBetween,
  currentMonthLabel,
  currentYearLabel,
  shouldRecalculate,
  convert,
} from "./calculate-totals-by-dividends";

test("monthsBetween retorna meses inclusivos no mesmo ano", () => {
  assert.deepEqual(monthsBetween("2025-01-15", "2025-03-04"), [
    "2025-01",
    "2025-02",
    "2025-03",
  ]);
});

test("monthsBetween cruza virada de ano", () => {
  assert.deepEqual(monthsBetween("2025-11-20", "2026-02-10"), [
    "2025-11",
    "2025-12",
    "2026-01",
    "2026-02",
  ]);
});

test("monthsBetween retorna um único mês quando first == last", () => {
  assert.deepEqual(monthsBetween("2026-08-01", "2026-08-31"), ["2026-08"]);
});

test("yearsBetween retorna anos inclusivos", () => {
  assert.deepEqual(yearsBetween("2025-06-01", "2027-01-01"), ["2025", "2026", "2027"]);
});

test("currentMonthLabel formata YYYY-MM", () => {
  assert.equal(currentMonthLabel(new Date("2026-08-21T00:00:00Z")), "2026-08");
});

test("currentYearLabel retorna YYYY", () => {
  assert.equal(currentYearLabel(new Date("2026-08-21T00:00:00Z")), "2026");
});

test("shouldRecalculate: mês atual é true (mensal)", () => {
  assert.equal(
    shouldRecalculate("2026-08", "mensal", new Date("2026-08-21T00:00:00Z")),
    true
  );
});

test("shouldRecalculate: mês passado é false (mensal)", () => {
  assert.equal(
    shouldRecalculate("2026-07", "mensal", new Date("2026-08-21T00:00:00Z")),
    false
  );
});

test("shouldRecalculate: ano atual é true (anual)", () => {
  assert.equal(
    shouldRecalculate("2026", "anual", new Date("2026-08-21T00:00:00Z")),
    true
  );
});

test("shouldRecalculate: ano passado é false (anual)", () => {
  assert.equal(
    shouldRecalculate("2025", "anual", new Date("2026-08-21T00:00:00Z")),
    false
  );
});

test("convert: stock com usdBrl > 0 divide pelo dolar", () => {
  assert.equal(convert(1000, "stock", 5), 200);
  assert.equal(convert(1000, "reit", 5), 200);
});

test("convert: acao/fii nunca divide pelo dolar", () => {
  assert.equal(convert(1000, "acao", 5), 1000);
  assert.equal(convert(1000, "fii", 5), 1000);
  assert.equal(convert(1000, "td", 5), 1000);
});

test("convert: stock/reit sem usdBrl mantem valor em BRL", () => {
  assert.equal(convert(1000, "stock", 0), 1000);
  assert.equal(convert(1000, "reit", -1), 1000);
});