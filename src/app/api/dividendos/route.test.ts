import assert from "node:assert/strict";
import { test } from "node:test";
import { getDividendos, type GetDividendosSupabase } from "./route";

type OpCall = { table: string; method: string; args: unknown[] };

interface FakeQuery {
  select: (cols: string) => FakeQuery;
  eq: (col: string, val: string) => FakeQuery;
  gte: (col: string, val: string) => FakeQuery;
  lte: (col: string, val: string) => FakeQuery;
  ilike: (col: string, pattern: string) => FakeQuery;
  in: (col: string, values: string[]) => FakeQuery;
  order: (col: string, opts?: { ascending?: boolean }) => FakeQuery;
  range: (from: number, to: number) => FakeQuery;
  then: <T>(resolve: (v: { data: unknown; error: null | { message: string }; count: number | null }) => T) => Promise<T>;
}

type Handler = {
  data: unknown;
  error: null | { message: string };
  count?: number;
};

function makeChain(calls: OpCall[], table: string, handler: Handler): FakeQuery {
  const chain: FakeQuery = {
    select(cols) { calls.push({ table, method: "select", args: [cols] }); return chain; },
    eq(col, val) { calls.push({ table, method: "eq", args: [col, val] }); return chain; },
    gte(col, val) { calls.push({ table, method: "gte", args: [col, val] }); return chain; },
    lte(col, val) { calls.push({ table, method: "lte", args: [col, val] }); return chain; },
    ilike(col, pattern) { calls.push({ table, method: "ilike", args: [col, pattern] }); return chain; },
    in(col, values) { calls.push({ table, method: "in", args: [col, values] }); return chain; },
    order(col, opts) { calls.push({ table, method: "order", args: [col, opts] }); return chain; },
    range(from, to) { calls.push({ table, method: "range", args: [from, to] }); return chain; },
    then(resolve) {
      return Promise.resolve(
        resolve({ data: handler.data, error: handler.error, count: handler.count ?? 0 })
      );
    },
  };
  return chain;
}

interface StubOptions {
  ativos?: { data?: unknown; error?: { message: string } | null };
  dividendos?: { data?: unknown; error?: { message: string } | null; count?: number };
}

async function callGet(url: string, stub: StubOptions = {}) {
  const calls: OpCall[] = [];

  const ativosHandler: Handler = {
    data: stub.ativos?.data ?? [],
    error: stub.ativos?.error ?? null,
  };
  const dividendosHandler: Handler = {
    data: stub.dividendos?.data ?? [],
    error: stub.dividendos?.error ?? null,
    count: stub.dividendos?.count ?? 0,
  };

  const supabase: GetDividendosSupabase = {
    from(table: string): FakeQuery {
      if (table === "ativos") return makeChain(calls, "ativos", ativosHandler);
      if (table === "dividendos") return makeChain(calls, "dividendos", dividendosHandler);
      throw new Error(`unexpected table ${table}`);
    },
  } as never;

  const params = new URL(url).searchParams;
  const res = await getDividendos(params, supabase);
  const body = await res.json();
  return { calls, res, body };
}

test("getDividendos defaults aplicam mes anterior e ordenacao padrao", async () => {
  const fixedDate = new Date(2026, 4, 12, 10);
  const realDate = globalThis.Date;
  globalThis.Date = class extends realDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(fixedDate.getTime());
      // @ts-expect-error spread
      else super(...args);
    }
    static now() { return fixedDate.getTime(); }
  } as unknown as DateConstructor;

  try {
    const { calls, res, body } = await callGet("http://localhost/api/dividendos", {
      dividendos: {
        data: [{ id: 1, code: "BBDC3", payment_date: "2026-04-30", quantity: 100, total_liquid: 890, created_at: "", updated_at: "" }],
        count: 1,
      },
    });

    assert.equal(res.status, 200);
    assert.equal(body.total, 1);
    assert.equal(body.dividendos.length, 1);

    const ativosSelect = calls.find((c) => c.table === "ativos");
    assert.equal(ativosSelect, undefined, "todos nao deve consultar ativos");

    const selectCall = calls.find((c) => c.table === "dividendos" && c.method === "select");
    assert.equal(
      selectCall?.args[0],
      "code, payment_date, quantity, total_liquid, created_at, updated_at, id"
    );

    const gte = calls.find((c) => c.method === "gte");
    assert.equal(gte?.args[0], "payment_date");
    assert.equal(gte?.args[1], "2026-04-01");

    const lte = calls.find((c) => c.method === "lte");
    assert.equal(lte?.args[1], "2026-04-30");

    const orders = calls.filter((c) => c.method === "order");
    assert.deepEqual(orders[0]?.args, ["payment_date", { ascending: false }]);
    assert.deepEqual(orders[1]?.args, ["id", { ascending: false }]);

    const range = calls.find((c) => c.method === "range");
    assert.deepEqual(range?.args, [0, 19]);
  } finally {
    globalThis.Date = realDate;
  }
});

test("getDividendos com type=acao consulta ativos, aplica .in(code) e ilike quando code informado", async () => {
  const { calls, body } = await callGet(
    "http://localhost/api/dividendos?type=acao&code=bbd&sort_by=total_liquid&sort_dir=asc&page=3&per_page=50",
    {
      ativos: { data: [{ code: "BBDC3" }, { code: "PETR4" }] },
      dividendos: { data: [], count: 0 },
    }
  );

  assert.equal(body.total, 0);

  const ativosEq = calls.find((c) => c.table === "ativos" && c.method === "eq");
  assert.deepEqual(ativosEq?.args, ["type", "acao"]);

  const dividendosIn = calls.find((c) => c.table === "dividendos" && c.method === "in");
  assert.deepEqual(dividendosIn?.args, ["code", ["BBDC3"]]);

  const ilike = calls.find((c) => c.method === "ilike");
  assert.deepEqual(ilike?.args, ["code", "%BBD%"]);

  const orders = calls.filter((c) => c.method === "order");
  assert.deepEqual(orders[0]?.args, ["total_liquid", { ascending: true }]);
  assert.deepEqual(orders[1]?.args, ["id", { ascending: true }]);

  const range = calls.find((c) => c.method === "range");
  assert.deepEqual(range?.args, [100, 149]);
});

test("getDividendos com type que nao tem ativos retorna lista vazia sem consultar dividendos", async () => {
  const { calls, res, body } = await callGet("http://localhost/api/dividendos?type=stock", {
    ativos: { data: [] },
    dividendos: { data: [{ id: 1 }], count: 1 },
  });

  assert.equal(res.status, 200);
  assert.equal(body.total, 0);
  assert.equal(body.dividendos.length, 0);
  const dividendosSelect = calls.find((c) => c.table === "dividendos" && c.method === "select");
  assert.equal(dividendosSelect, undefined);
});

test("getDividendos per_page fora da lista cai em 20 e sort_by invalido em payment_date", async () => {
  const { calls } = await callGet("http://localhost/api/dividendos?per_page=77&sort_by=banana");
  const range = calls.find((c) => c.method === "range");
  assert.deepEqual(range?.args, [0, 19]);

  const orders = calls.filter((c) => c.method === "order");
  assert.deepEqual(orders[0]?.args, ["payment_date", { ascending: false }]);
});

test("getDividendos retorna 500 quando query de dividendos falha", async () => {
  const { res, body } = await callGet("http://localhost/api/dividendos", {
    dividendos: { error: { message: "kaboom" } },
  });
  assert.equal(res.status, 500);
  assert.equal(body.error, "kaboom");
});

test("getDividendos retorna 500 quando ativos falha", async () => {
  const { res, body } = await callGet("http://localhost/api/dividendos?type=acao", {
    ativos: { error: { message: "ativos kaboom" } },
  });
  assert.equal(res.status, 500);
  assert.equal(body.error, "ativos kaboom");
});
