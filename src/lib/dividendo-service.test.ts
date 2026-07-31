import assert from "node:assert/strict";
import { test } from "node:test";
import type { DividendoInput } from "@/types/dividendo";
import { processDividendosBatch, type ProcessSupabase } from "./dividendo-service";

interface Recorder {
  insertPayloads: DividendoInput[][];
}

function makeStub(handlers: {
  select: (cols: string) => { data: unknown; error: null };
  insert: (rows: DividendoInput[]) => { data: { id: number }[]; error: null };
}) {
  const recorder: Recorder = { insertPayloads: [] };
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
});

test("processDividendosBatch filtra duplicatas ja existentes no banco", async () => {
  const { supabase, recorder } = makeStub({
    select: () => ({
      data: [
        {
          code: "BBDC3",
          quantity: 100,
          payment_date: "2026-07-31",
          total_liquid: 890,
        },
      ],
      error: null,
    }),
    insert: () => ({ data: [], error: null }),
  });

  const result = await processDividendosBatch(supabase, [baseRow]);

  assert.equal(recorder.insertPayloads.length, 0);
  assert.equal(result.inserted, 0);
  assert.equal(result.dbDuplicates, 1);
});

test("processDividendosBatch propaga erro do insert", async () => {
  const supabase: ProcessSupabase = {
    from() {
      const chain = {
        select: () => chain,
        insert: () => chain,
        in: () => chain,
        eq: () => chain,
        then<TResolve>(
          resolve: (v: { data: unknown; error: { message: string } }) => TResolve
        ): Promise<TResolve> {
          return Promise.resolve(resolve({ data: null, error: { message: "boom" } }));
        },
      } as const;
      return chain as unknown as ReturnType<ProcessSupabase["from"]>;
    },
  };

  await assert.rejects(async () => processDividendosBatch(supabase, [baseRow]), /boom/);
});
