import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { parseDividendoId, parseDividendoNumber } from "@/lib/dividendo-input";
import { deleteDividendo, updateDividendo } from "@/lib/dividendo-update-service";

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/dividendos/[id] → atualiza payment_date, quantity, total_liquid
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const supabase = getSupabaseServer();
  const { id } = await params;

  const idNum = parseDividendoId(id);
  if (idNum === null) {
    return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const { payment_date, quantity, total_liquid } = body as {
    payment_date?: string;
    quantity?: string;
    total_liquid?: string;
  };

  const dateStr = typeof payment_date === "string" ? payment_date.trim() : "";
  if (!dateStr) {
    return NextResponse.json(
      { error: "Data de pagamento é obrigatória." },
      { status: 400 }
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json(
      { error: "Data de pagamento inválida (esperado aaaa-mm-dd)." },
      { status: 400 }
    );
  }

  const quantityNum = parseDividendoNumber(quantity);
  if (quantityNum === null) {
    return NextResponse.json({ error: "Quantidade inválida." }, { status: 400 });
  }
  const totalLiquidNum = parseDividendoNumber(total_liquid);
  if (totalLiquidNum === null) {
    return NextResponse.json({ error: "Total líquido inválido." }, { status: 400 });
  }

  const result = await updateDividendo(
    idNum,
    { payment_date: dateStr, quantity: quantityNum, total_liquid: totalLiquidNum },
    supabase
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ dividendo: result.dividendo });
}

// DELETE /api/dividendos/[id] → remove um dividendo
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const supabase = getSupabaseServer();
  const { id } = await params;

  const idNum = parseDividendoId(id);
  if (idNum === null) {
    return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
  }

  const result = await deleteDividendo(idNum, supabase);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true });
}
