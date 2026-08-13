import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDividendosText } from "./dividendo-parser";

test("parseDividendosText ignora linhas vazias e comentarios com #", () => {
  const result = parseDividendosText(
    "\nBBDC3;2026-07-31;100;890.00\n   \n# exemplo de comentario\nITUB3;2026-07-01;800;350,00\n"
  );
  assert.equal(result.ignoredCount, 0);
  assert.equal(result.duplicityCount, 0);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].code, "BBDC3");
  assert.equal(result.rows[1].code, "ITUB3");
  assert.equal(result.rows[0].lineNumber, 2);
  assert.equal(result.rows[1].lineNumber, 5);
  assert.equal(result.outcomes.length, 4);
  assert.equal(result.outcomes[0].status, "vazio");
  assert.equal(result.outcomes[0].line_number, 1);
  assert.equal(result.outcomes[1].status, "vazio");
  assert.equal(result.outcomes[1].line_number, 3);
  assert.equal(result.outcomes[2].status, "comentario");
  assert.equal(result.outcomes[2].line_number, 4);
  assert.equal(result.outcomes[3].status, "vazio");
  assert.equal(result.outcomes[3].line_number, 6);
});

test("parseDividendosText ignora linhas com != 4 colunas", () => {
  const result = parseDividendosText(
    [
      "BBDC3;2026-07-31;100;890.00",
      "PETR4;2026-07-31;100;1;extra",
      "VALE3;2026-07-31;100",
      "WEGE3;2026-07-31",
    ].join("\n")
  );
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].code, "BBDC3");
  assert.equal(result.ignoredCount, 3);
  assert.equal(result.outcomes.length, 3);
  assert.equal(result.outcomes[0].status, "ignorado");
  assert.equal(result.outcomes[0].line_number, 2);
  assert.equal(result.outcomes[0].code, "PETR4");
  assert.equal(result.outcomes[1].status, "ignorado");
  assert.equal(result.outcomes[1].line_number, 3);
  assert.equal(result.outcomes[1].quantity, "100");
  assert.equal(result.outcomes[2].status, "ignorado");
  assert.equal(result.outcomes[2].line_number, 4);
  assert.equal(result.outcomes[2].total_liquido, "");
});

test("parseDividendosText faz upper e trim no codigo", () => {
  const result = parseDividendosText("  bbdc3 ;2026-07-31;100;890.00");
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].code, "BBDC3");
  assert.equal(result.rows[0].lineNumber, 1);
});

test("parseDividendosText aceita datas dd/mm/yyyy e yyyy-mm-dd e ignora invalidas", () => {
  const result = parseDividendosText(
    ["BBDC3;31/07/2026;100;890.00", "ITUB3;2026-08-01;200;120,00", "FDXB11;31-07-2026;1;1,00"].join("\n")
  );
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].payment_date, "2026-07-31");
  assert.equal(result.rows[1].payment_date, "2026-08-01");
  assert.equal(result.ignoredCount, 1);
  assert.equal(result.outcomes.length, 1);
  assert.equal(result.outcomes[0].status, "ignorado");
  assert.equal(result.outcomes[0].line_number, 3);
  assert.equal(result.outcomes[0].payment_date, "31-07-2026");
});

test("parseDividendosText aceita virgula e ponto nos numeros e ignora NaN", () => {
  const result = parseDividendosText(
    ["BBDC3;2026-07-31;100,5;890.50", "ITUB3;2026-07-01;800;350,75", "FDXB11;2026-07-01;abc;100", "VALE3;2026-07-01;1;;100"].join("\n")
  );
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].quantity, 100.5);
  assert.equal(result.rows[0].total_liquid, 890.5);
  assert.equal(result.rows[1].total_liquid, 350.75);
  assert.equal(result.ignoredCount, 2);
  assert.equal(result.outcomes.length, 2);
  assert.equal(result.outcomes[0].status, "ignorado");
  assert.equal(result.outcomes[0].quantity, "abc");
  assert.equal(result.outcomes[1].status, "ignorado");
  assert.equal(result.outcomes[1].quantity, "1");
  assert.equal(result.outcomes[1].total_liquido, "");
});

test("parseDividendosText ignora segunda ocorrencia no mesmo lote", () => {
  const result = parseDividendosText(
    ["BBDC3;2026-07-31;100;890.00", "BBDC3;2026-07-31;100;890.00", "BBDC3;2026-07-31;100;890.00"].join("\n")
  );
  assert.equal(result.rows.length, 1);
  assert.equal(result.duplicityCount, 2);
  assert.equal(result.ignoredCount, 0);
  assert.equal(result.outcomes.length, 2);
  assert.equal(result.outcomes[0].status, "duplicidade");
  assert.equal(result.outcomes[0].line_number, 2);
  assert.equal(result.outcomes[1].status, "duplicidade");
  assert.equal(result.outcomes[1].line_number, 3);
});

test("parseDividendosText ignora codigo vazio", () => {
  const result = parseDividendosText(";2026-07-31;100;890.00\n   ;2026-07-31;100;890.00");
  assert.equal(result.rows.length, 0);
  assert.equal(result.ignoredCount, 2);
  assert.equal(result.outcomes.length, 2);
  assert.equal(result.outcomes[0].status, "ignorado");
  assert.equal(result.outcomes[0].code, "");
  assert.equal(result.outcomes[1].status, "ignorado");
  assert.equal(result.outcomes[1].line_number, 2);
});

test("parseDividendosText entrada vazia produz apenas uma linha de log vazia", () => {
  const result = parseDividendosText("");
  assert.equal(result.rows.length, 0);
  assert.equal(result.duplicityCount, 0);
  assert.equal(result.ignoredCount, 0);
  assert.equal(result.outcomes.length, 1);
  assert.equal(result.outcomes[0].status, "vazio");
  assert.equal(result.outcomes[0].line_number, 1);
});

test("parseDividendosText numera linhas a partir de 1", () => {
  const result = parseDividendosText("BBDC3;2026-07-31;100;890.00\nITUB3;2026-08-01;200;120.00\nPETR4;2026-09-01;300;350.00");
  assert.equal(result.rows[0].lineNumber, 1);
  assert.equal(result.rows[1].lineNumber, 2);
  assert.equal(result.rows[2].lineNumber, 3);
});
