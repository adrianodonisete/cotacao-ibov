import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDividendoId, parseDividendoNumber } from "./dividendo-input";

test("parseDividendoNumber aceita ponto", () => {
  assert.equal(parseDividendoNumber("100.50"), 100.5);
});

test("parseDividendoNumber aceita virgula", () => {
  assert.equal(parseDividendoNumber("100,50"), 100.5);
});

test("parseDividendoNumber faz trim", () => {
  assert.equal(parseDividendoNumber("  42,5  "), 42.5);
});

test("parseDividendoNumber retorna null para vazio, NaN e texto", () => {
  assert.equal(parseDividendoNumber(""), null);
  assert.equal(parseDividendoNumber("   "), null);
  assert.equal(parseDividendoNumber("abc"), null);
  assert.equal(parseDividendoNumber(undefined), null);
  assert.equal(parseDividendoNumber(null), null);
});

test("parseDividendoId aceita numero positivo", () => {
  assert.equal(parseDividendoId("42"), 42);
  assert.equal(parseDividendoId("  7  "), 7);
});

test("parseDividendoId retorna null para vazio, zero, negativo e NaN", () => {
  assert.equal(parseDividendoId(""), null);
  assert.equal(parseDividendoId("   "), null);
  assert.equal(parseDividendoId("0"), null);
  assert.equal(parseDividendoId("-3"), null);
  assert.equal(parseDividendoId("abc"), null);
  assert.equal(parseDividendoId(undefined), null);
  assert.equal(parseDividendoId(null), null);
});
