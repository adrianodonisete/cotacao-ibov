import assert from "node:assert/strict";
import { test } from "node:test";
import { APIError } from "brapi";
import { isBrapiNotFoundError } from "./sync-cotacoes-error";

test("identifica erro 404 da Brapi como ativo não encontrado", () => {
  const error = new APIError(404, undefined, "Not found", undefined);

  assert.equal(isBrapiNotFoundError(error), true);
});

test("não classifica outros erros como ativo não encontrado", () => {
  const error = new APIError(500, undefined, "Server error", undefined);

  assert.equal(isBrapiNotFoundError(error), false);
});
