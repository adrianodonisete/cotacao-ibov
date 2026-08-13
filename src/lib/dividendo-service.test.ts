import assert from "node:assert/strict";
import { test } from "node:test";
import type { DividendoInput, DividendoInputWithLine } from "@/types/dividendo";
import { processDividendosBatch, type ProcessSupabase, type LogFileWriter } from "./dividendo-service";
import type { LogEntry } from "./dividendo-parser";

interface Recorder {
  insertPayloads: DividendoInput[][];
  selectCalls: string[];
}

function makeStub(handlers: {
  select: (cols: string) => { data: unknown; error: null };
  insert: (rows: DividendoInput[]) => { data: { id: number }[]; error: null | { message: string } };
}) {
  const recorder: Recorder = { insertPayloads: [], selectCalls: [] };
  let pendingInsertRows: DividendoInput[] = [];
  let pendingSelectCols: string | null = null;

  const chain = {
    select(cols?: string) {
      pendingSelectCols = cols ?? "";
      return chain;
    },
    insert(rows: DividendoInput[]) {
      pendingInsertRows = rows;
      return chain;
    },
    in() {
      return chain;
    },
    eq() {
      return chain;
    },
    limit() {
      return chain;
    },
    then<TResolve>(
      resolve: (v: { data: unknown; error: unknown }) => TResolve
    ): Promise<TResolve> {
      if (pendingInsertRows.length > 0) {
        const rows = pendingInsertRows;
        const r = handlers.insert(rows);
        recorder.insertPayloads.push(rows);
        pendingInsertRows = [];
        pendingSelectCols = null;
        return Promise.resolve(resolve({ data: r.data, error: r.error }));
      }
      const cols = pendingSelectCols ?? "";
      recorder.selectCalls.push(cols);
      pendingSelectCols = null;
      const r = handlers.select(cols);
      return Promise.resolve(resolve({ data: r.data, error: r.error }));
    },
  } as const;

  const supabase: ProcessSupabase = {
    from(table) {
      if (table !== "dividendos") throw new Error(`unexpected table ${table}`);
      return chain as unknown as ReturnType<ProcessSupabase["from"]>;
    },
  };

  return { supabase, recorder };
}

const baseRow: DividendoInputWithLine = {
  code: "BBDC3",
  payment_date: "2026-07-31",
  quantity: 100,
  total_liquid: 890,
  lineNumber: 1,
};

function makeWriter() {
  let writtenPath: string | null = null;
  let writtenContent: string | null = null;
  const writer: LogFileWriter = (p, content) => {
    writtenPath = p;
    writtenContent = content;
  };
  return { writer, getPath: () => writtenPath, getContent: () => writtenContent };
}

test("processDividendosBatch insere todas as linhas sem duplicata", async () => {
  const { writer, getPath, getContent } = makeWriter();
  const fixedNow = new Date("2026-08-13T14:30:22Z");
  const expectedTimestamp =
    `${fixedNow.getFullYear()}` +
    `${String(fixedNow.getMonth() + 1).padStart(2, "0")}` +
    `${String(fixedNow.getDate()).padStart(2, "0")}` +
    `${String(fixedNow.getHours()).padStart(2, "0")}` +
    `${String(fixedNow.getMinutes()).padStart(2, "0")}` +
    `${String(fixedNow.getSeconds()).padStart(2, "0")}`;

  const { supabase, recorder } = makeStub({
    select: () => ({ data: [], error: null }),
    insert: (rows) => ({ data: rows.map((_, i) => ({ id: i + 1 })), error: null }),
  });

  const result = await processDividendosBatch(
    supabase,
    [baseRow],
    [],
    writer,
    () => fixedNow
  );

  assert.equal(recorder.insertPayloads.length, 1);
  assert.equal(recorder.insertPayloads[0].length, 1);
  assert.equal(recorder.insertPayloads[0][0].code, "BBDC3");
  assert.equal(result.inserted, 1);
  assert.equal(result.dbDuplicates, 0);
  assert.equal(result.errorCount, 0);
  const lines = getContent()!.split("\n");
  assert.equal(lines[0], "codigo;data_pagamento;quantidade;total_liquido;status;line_number");
  assert.equal(lines[1], "BBDC3;2026-07-31;100;890;inserido;1");
  assert.ok(getPath()!.endsWith(`dividendos_${expectedTimestamp}.csv`));
});

test("processDividendosBatch filtra duplicata ja existente no banco", async () => {
  const { writer, getContent } = makeWriter();
  const { supabase, recorder } = makeStub({
    select: () => ({ data: [{ id: 1 }], error: null }),
    insert: () => ({ data: [], error: null }),
  });

  const result = await processDividendosBatch(supabase, [baseRow], [], writer);

  assert.equal(recorder.insertPayloads.length, 0);
  assert.equal(result.inserted, 0);
  assert.equal(result.dbDuplicates, 1);
  assert.equal(result.errorCount, 0);
  const lines = getContent()!.split("\n");
  assert.equal(lines[1], "BBDC3;2026-07-31;100;890;duplicidade;1");
});

test("processDividendosBatch faz uma query de verificacao por linha com .limit(1)", async () => {
  let queryCount = 0;
  const { writer } = makeWriter();
  const { supabase, recorder } = makeStub({
    select: () => {
      queryCount += 1;
      return { data: [], error: null };
    },
    insert: () => ({ data: [], error: null }),
  });

  const rows = [
    baseRow,
    { ...baseRow, payment_date: "2026-08-01", lineNumber: 2 },
    { ...baseRow, payment_date: "2026-09-01", lineNumber: 3 },
  ];

  await processDividendosBatch(supabase, rows, [], writer);

  assert.equal(queryCount, 3);
  assert.equal(recorder.selectCalls.every((c) => c === "id"), true);
  assert.equal(recorder.insertPayloads.length, 3);
  assert.ok(recorder.insertPayloads.every((p) => p.length === 1));
});

test("processDividendosBatch mistura duplicatas e insercoes na mesma chamada", async () => {
  const input = [
    baseRow,
    { ...baseRow, payment_date: "2026-08-01", lineNumber: 2 },
    { ...baseRow, payment_date: "2026-09-01", lineNumber: 3 },
  ];
  const callIndex = { value: 0 };
  const duplicatesAt = new Set([1]);
  const { writer } = makeWriter();

  const { supabase, recorder } = makeStub({
    select: () => {
      const i = callIndex.value;
      callIndex.value += 1;
      return { data: duplicatesAt.has(i) ? [{ id: 1 }] : [], error: null };
    },
    insert: (rowsToInsert) => ({
      data: rowsToInsert.map((_, i) => ({ id: i + 1 })),
      error: null,
    }),
  });

  const result = await processDividendosBatch(supabase, [
    input[0],
    input[1],
    input[0],
    input[2],
  ], [], writer);

  assert.equal(result.inserted, 3);
  assert.equal(result.dbDuplicates, 1);
  assert.equal(result.errorCount, 0);
  assert.equal(recorder.insertPayloads.length, 3);
});

test("processDividendosBatch nao faz insert quando todas as linhas sao duplicatas", async () => {
  const { writer } = makeWriter();
  const { supabase, recorder } = makeStub({
    select: () => ({ data: [{ id: 1 }], error: null }),
    insert: () => ({ data: [], error: null }),
  });

  const result = await processDividendosBatch(supabase, [baseRow], [], writer);

  assert.equal(recorder.insertPayloads.length, 0);
  assert.equal(result.inserted, 0);
  assert.equal(result.dbDuplicates, 1);
  assert.equal(result.errorCount, 0);
});

test("processDividendosBatch conta erro de insert sem parar o processamento", async () => {
  const insertCallIndex = { value: 0 };
  const failingIndexes = new Set([1]);
  const { writer, getContent } = makeWriter();

  const { supabase, recorder } = makeStub({
    select: () => ({ data: [], error: null }),
    insert: (rows) => {
      const i = insertCallIndex.value;
      insertCallIndex.value += 1;
      if (failingIndexes.has(i)) {
        return {
          data: [],
          error: { message: 'duplicate key value violates unique constraint "dividendos_unique"' },
        };
      }
      return { data: rows.map((_, j) => ({ id: j + 1 })), error: null };
    },
  });

  const rows = [
    baseRow,
    { ...baseRow, payment_date: "2026-08-01", lineNumber: 2 },
    { ...baseRow, payment_date: "2026-09-01", lineNumber: 3 },
  ];

  const result = await processDividendosBatch(supabase, rows, [], writer);

  assert.equal(recorder.insertPayloads.length, 3);
  assert.equal(result.inserted, 2);
  assert.equal(result.dbDuplicates, 0);
  assert.equal(result.errorCount, 1);
  const lines = getContent()!.split("\n");
  assert.equal(lines[1], "BBDC3;2026-07-31;100;890;inserido;1");
  assert.equal(lines[2], "BBDC3;2026-08-01;100;890;erro;2");
  assert.equal(lines[3], "BBDC3;2026-09-01;100;890;inserido;3");
});

test("processDividendosBatch continua processamento quando todos os inserts falham", async () => {
  const { writer } = makeWriter();
  const { supabase, recorder } = makeStub({
    select: () => ({ data: [], error: null }),
    insert: () => ({ data: [], error: { message: "boom" } }),
  });

  const rows = [
    baseRow,
    { ...baseRow, payment_date: "2026-08-01", lineNumber: 2 },
  ];

  const result = await processDividendosBatch(supabase, rows, [], writer);

  assert.equal(recorder.insertPayloads.length, 2);
  assert.equal(result.inserted, 0);
  assert.equal(result.errorCount, 2);
});

test("processDividendosBatch combina outcomes do parser e do service ordenados por line_number", async () => {
  const { writer, getContent } = makeWriter();
  const { supabase } = makeStub({
    select: () => ({ data: [], error: null }),
    insert: () => ({ data: [], error: null }),
  });

  const parserOutcomes: LogEntry[] = [
    { code: "", payment_date: "", quantity: "", total_liquido: "", status: "vazio", line_number: 2 },
    { code: "", payment_date: "", quantity: "", total_liquido: "", status: "comentario", line_number: 4 },
    { code: "PETR4", payment_date: "31-07-2026", quantity: "100", total_liquido: "abc", status: "ignorado", line_number: 5 },
  ];

  const result = await processDividendosBatch(supabase, [baseRow], parserOutcomes, writer);

  assert.equal(result.inserted, 1);
  const lines = getContent()!.split("\n");
  assert.equal(lines[0], "codigo;data_pagamento;quantidade;total_liquido;status;line_number");
  assert.equal(lines[1], "BBDC3;2026-07-31;100;890;inserido;1");
  assert.equal(lines[2], ";;;;vazio;2");
  assert.equal(lines[3], ";;;;comentario;4");
  assert.equal(lines[4], "PETR4;31-07-2026;100;abc;ignorado;5");
});

test("processDividendosBatch nao falha quando writer lanca erro", async () => {
  const failingWriter: LogFileWriter = () => {
    throw new Error("disk full");
  };
  const { supabase } = makeStub({
    select: () => ({ data: [], error: null }),
    insert: () => ({ data: [], error: null }),
  });

  const result = await processDividendosBatch(supabase, [baseRow], [], failingWriter);

  assert.equal(result.inserted, 1);
  assert.equal(result.logPath, null);
});

test("processDividendosBatch remove lineNumber antes do insert no Supabase", async () => {
  const { writer } = makeWriter();
  const { supabase, recorder } = makeStub({
    select: () => ({ data: [], error: null }),
    insert: () => ({ data: [], error: null }),
  });

  await processDividendosBatch(supabase, [baseRow], [], writer);

  const payload = recorder.insertPayloads[0][0];
  assert.equal(payload.code, "BBDC3");
  assert.equal(payload.payment_date, "2026-07-31");
  assert.equal(payload.quantity, 100);
  assert.equal(payload.total_liquid, 890);
  assert.equal("lineNumber" in payload, false);
});

test("processDividendosBatch propaga erro da verificacao de duplicidade", async () => {
  const { writer } = makeWriter();
  const supabase: ProcessSupabase = {
    from() {
      let pendingInsertRows: DividendoInputWithLine[] = [];
      const chain = {
        select: () => chain,
        insert: (rows: DividendoInputWithLine[]) => {
          pendingInsertRows = rows;
          return chain;
        },
        in: () => chain,
        eq: () => chain,
        limit: () => chain,
        then<TResolve>(
          resolve: (v: { data: unknown; error: { message: string } | null }) => TResolve
        ): Promise<TResolve> {
          if (pendingInsertRows.length > 0) {
            pendingInsertRows = [];
            return Promise.resolve(resolve({ data: [], error: null }));
          }
          return Promise.resolve(
            resolve({ data: null, error: { message: "verificacao falhou" } })
          );
        },
      } as const;
      return chain as unknown as ReturnType<ProcessSupabase["from"]>;
    },
  };

  await assert.rejects(
    async () => processDividendosBatch(supabase, [baseRow], [], writer),
    /verificacao falhou/
  );
});
