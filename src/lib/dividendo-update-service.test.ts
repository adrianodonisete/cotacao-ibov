import assert from "node:assert/strict";
import { test } from "node:test";
import { deleteDividendo, updateDividendo, type DividendoSupabase } from "./dividendo-update-service";

interface FakeQuery {
  update: (cols: Record<string, unknown>) => FakeQuery;
  insert: (rows: unknown[]) => FakeQuery;
  delete: () => FakeQuery;
  select: (cols?: string) => FakeQuery;
  single: () => FakeQuery;
  eq: (col: string, val: unknown) => FakeQuery;
  in: (col: string, vals: unknown[]) => FakeQuery;
  then: <T>(
    resolve: (v: { data: unknown; error: null | { message: string; code?: string } }) => T
  ) => Promise<T>;
}

interface OpCall {
  table: string;
  method: string;
  args: unknown[];
}

interface Handler {
  update?: (cols: Record<string, unknown>) => { data: unknown; error: null | { message: string; code?: string } };
  delete?: () => { data: unknown; error: null | { message: string; code?: string } };
}

function makeChain(calls: OpCall[], table: string, handler: Handler): FakeQuery {
  let pendingUpdate: Record<string, unknown> | null = null;

  const chain: FakeQuery = {
    update(cols) {
      calls.push({ table, method: "update", args: [cols] });
      pendingUpdate = cols;
      return chain;
    },
    insert(rows) {
      calls.push({ table, method: "insert", args: [rows] });
      return chain;
    },
    delete() {
      calls.push({ table, method: "delete", args: [] });
      return chain;
    },
    select(cols) {
      calls.push({ table, method: "select", args: [cols ?? ""] });
      return chain;
    },
    single() {
      calls.push({ table, method: "single", args: [] });
      return chain;
    },
    eq(col, val) {
      calls.push({ table, method: "eq", args: [col, val] });
      return chain;
    },
    in(col, vals) {
      calls.push({ table, method: "in", args: [col, vals] });
      return chain;
    },
    then(resolve) {
      let r: { data: unknown; error: null | { message: string; code?: string } };
      if (pendingUpdate && handler.update) {
        r = handler.update(pendingUpdate);
        pendingUpdate = null;
      } else if (handler.delete) {
        r = handler.delete();
      } else {
        r = { data: null, error: null };
      }
      return Promise.resolve(resolve(r));
    },
  };
  return chain;
}

function makeSupabase(calls: OpCall[], handler: Handler = {}): DividendoSupabase {
  return {
    from(table: string) {
      if (table !== "dividendos") throw new Error(`unexpected table ${table}`);
      return makeChain(calls, table, handler) as never;
    },
  } as never;
}

const baseInput = {
  payment_date: "2026-08-15",
  quantity: 200,
  total_liquid: 1750,
};

test("updateDividendo chama .update com os 3 campos + updated_at, .eq(id), .select, .single", async () => {
  const calls: OpCall[] = [];
  const supabase = makeSupabase(calls, {
    update: () => ({
      data: { id: 7, code: "BBDC3", ...baseInput, updated_at: "2026-08-20T00:00:00Z" },
      error: null,
    }),
  });

  const result = await updateDividendo(7, baseInput, supabase);

  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.dividendo.id, 7);

  const updateCall = calls.find((c) => c.method === "update");
  assert.ok(updateCall, "update deve ter sido chamado");
  const cols = updateCall!.args[0] as Record<string, unknown>;
  assert.equal(cols.payment_date, "2026-08-15");
  assert.equal(cols.quantity, 200);
  assert.equal(cols.total_liquid, 1750);
  assert.ok(cols.updated_at, "updated_at deve ser definido");

  const eqCall = calls.find((c) => c.method === "eq");
  assert.deepEqual(eqCall?.args, ["id", 7]);

  const selectCall = calls.find((c) => c.method === "select");
  assert.ok(selectCall, ".select deve ter sido chamado");
  assert.ok(calls.find((c) => c.method === "single"), ".single deve ter sido chamado");
});

test("updateDividendo retorna conflito (status 409) quando erro 23505", async () => {
  const supabase = makeSupabase([], {
    update: () => ({
      data: null,
      error: { message: "duplicate key value", code: "23505" },
    }),
  });

  const result = await updateDividendo(7, baseInput, supabase);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 409);
    assert.match(result.error, /duplicad|dividendo/i);
  }
});

test("updateDividendo retorna 500 para outros erros", async () => {
  const supabase = makeSupabase([], {
    update: () => ({ data: null, error: { message: "boom" } }),
  });

  const result = await updateDividendo(7, baseInput, supabase);

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 500);
});

test("deleteDividendo chama .delete e .eq(id)", async () => {
  const calls: OpCall[] = [];
  const supabase = makeSupabase(calls, {
    delete: () => ({ data: null, error: null }),
  });

  const result = await deleteDividendo(7, supabase);

  assert.equal(result.ok, true);

  const deleteCall = calls.find((c) => c.method === "delete");
  assert.ok(deleteCall);

  const eqCall = calls.find((c) => c.method === "eq");
  assert.deepEqual(eqCall?.args, ["id", 7]);
});

test("deleteDividendo retorna 500 em erro do banco", async () => {
  const supabase = makeSupabase([], {
    delete: () => ({ data: null, error: { message: "boom" } }),
  });

  const result = await deleteDividendo(7, supabase);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 500);
    assert.equal(result.error, "boom");
  }
});
