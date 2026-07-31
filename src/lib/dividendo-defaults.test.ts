import assert from "node:assert/strict";
import { test } from "node:test";
import { previousMonthRange } from "./dividendo-defaults";

test("previousMonthRange retorna abril quando testado em maio de 2026", () => {
  const { start, end } = previousMonthRange(new Date(2026, 4, 12, 10));
  assert.equal(start, "2026-04-01");
  assert.equal(end, "2026-04-30");
});

test("previousMonthRange vira o ano quando testado em janeiro", () => {
  const { start, end } = previousMonthRange(new Date(2026, 0, 5));
  assert.equal(start, "2025-12-01");
  assert.equal(end, "2025-12-31");
});

test("previousMonthRange com referencia padrao (hoje) gera datas validas", () => {
  const { start, end } = previousMonthRange();
  assert.match(start, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(end, /^\d{4}-\d{2}-\d{2}$/);
});
