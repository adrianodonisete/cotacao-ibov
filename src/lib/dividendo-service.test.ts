import assert from "node:assert/strict";
import { test } from "node:test";
import type { DividendoInput } from "@/types/dividendo";
import { processDividendosBatch, type ProcessSupabase } from "./dividendo-service";

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

const baseRow: DividendoInput = {
  code: "BBDC3",
  payment_date: "2026-07-31",
  quantity: 100,
  total_liquid: 890,
};

test("processDividendosBatch insere todas as linhas sem duplicata", async () => {
  const { supabase, recorder } = makeStub({
    select: () => ({ data: [], error: null }),
    insert: (rows) => ({ data: rows.map((_, i) => ({ id: i + 1 })), error: null }),
  });

  const result = await processDividendosBatch(supabase, [baseRow]);

  assert.equal(recorder.insertPayloads.length, 1);
  assert.equal(recorder.insertPayloads[0].length, 1);
  assert.deepEqual(recorder.insertPayloads[0][0], baseRow);
  assert.equal(result.inserted, 1);
  assert.equal(result.dbDuplicates, 0);
  assert.equal(result.errorCount, 0);
});

test("processDividendosBatch filtra duplicata ja existente no banco", async () => {
  const { supabase, recorder } = makeStub({
    select: () => ({ data: [{ id: 1 }], error: null }),
    insert: () => ({ data: [], error: null }),
  });

  const result = await processDividendosBatch(supabase, [baseRow]);

  assert.equal(recorder.insertPayloads.length, 0);
  assert.equal(result.inserted, 0);
  assert.equal(result.dbDuplicates, 1);
  assert.equal(result.errorCount, 0);
});

test("processDividendosBatch faz uma query de verificacao por linha com .limit(1)", async () => {
  let queryCount = 0;
  const { supabase, recorder } = makeStub({
    select: () => {
      queryCount += 1;
      return { data: [], error: null };
    },
    insert: () => ({ data: [], error: null }),
  });

  const rows = [
    baseRow,
    { ...baseRow, payment_date: "2026-08-01" },
    { ...baseRow, payment_date: "2026-09-01" },
  ];

  const result = await processDividendosBatch(supabase, rows);

  assert.equal(queryCount, 3);
  assert.equal(recorder.selectCalls.every((c) => c === "id"), true);
  assert.equal(recorder.insertPayloads.length, 3);
  assert.ok(recorder.insertPayloads.every((p) => p.length === 1));
  assert.equal(result.inserted, 3);
});

test("processDividendosBatch mistura duplicatas e insercoes na mesma chamada", async () => {
  const input = [
    baseRow,
    { ...baseRow, payment_date: "2026-08-01" },
    { ...baseRow, payment_date: "2026-09-01" },
  ];
  const callIndex = { value: 0 };
  const duplicatesAt = new Set([1]);

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
  ]);

  assert.equal(result.inserted, 3);
  assert.equal(result.dbDuplicates, 1);
  assert.equal(result.errorCount, 0);
  assert.equal(recorder.insertPayloads.length, 3);
});

test("processDividendosBatch nao faz insert quando todas as linhas sao duplicatas", async () => {
  const { supabase, recorder } = makeStub({
    select: () => ({ data: [{ id: 1 }], error: null }),
    insert: () => ({ data: [], error: null }),
  });

  const result = await processDividendosBatch(supabase, [baseRow]);

  assert.equal(recorder.insertPayloads.length, 0);
  assert.equal(result.inserted, 0);
  assert.equal(result.dbDuplicates, 1);
  assert.equal(result.errorCount, 0);
});

test("processDividendosBatch conta erro de insert sem parar o processamento", async () => {
  const insertCallIndex = { value: 0 };
  const failingIndexes = new Set([1]);

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
    { ...baseRow, payment_date: "2026-08-01" },
    { ...baseRow, payment_date: "2026-09-01" },
  ];

  const result = await processDividendosBatch(supabase, rows);

  assert.equal(recorder.insertPayloads.length, 3);
  assert.equal(result.inserted, 2);
  assert.equal(result.dbDuplicates, 0);
  assert.equal(result.errorCount, 1);
});

test("processDividendosBatch continua processamento quando todos os inserts falham", async () => {
  const { supabase, recorder } = makeStub({
    select: () => ({ data: [], error: null }),
    insert: () => ({ data: [], error: { message: "boom" } }),
  });

  const rows = [
    baseRow,
    { ...baseRow, payment_date: "2026-08-01" },
  ];

  const result = await processDividendosBatch(supabase, rows);

  assert.equal(recorder.insertPayloads.length, 2);
  assert.equal(result.inserted, 0);
  assert.equal(result.errorCount, 2);
});

test("processDividendosBatch propaga erro da verificacao de duplicidade", async () => {
  const supabase: ProcessSupabase = {
    from() {
      let pendingInsertRows: DividendoInput[] = [];
      const chain = {
        select: () => chain,
        insert: (rows: DividendoInput[]) => {
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
    async () => processDividendosBatch(supabase, [baseRow]),
    /verificacao falhou/
  );
});
