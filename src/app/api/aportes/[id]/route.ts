import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

type RouteParams = { params: Promise<{ id: string }> };

function normalizeCurrency(val: string | undefined): string {
  const v = (val ?? "").trim().toUpperCase();
  return v === "USD" || v === "BRL" ? v : "BRL";
}

function normalizeDolarValue(val: unknown): number {
  const n = parseFloat(String(val ?? "").replace(",", "."));
  return isNaN(n) ? 0.0 : n;
}

function normalizeInfo(val: unknown): string {
  return String(val ?? "").trim();
}

// PUT /api/aportes/[id] → edita qtd, value_total, date_operation, currency, dolar_value, info
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const supabase = getSupabaseServer();
  const { id } = await params;
  const body = await request.json();
  const { qtd, value_total, date_operation, currency, dolar_value, info } = body;

  const qtdNum = parseFloat(String(qtd).replace(",", "."));
  const valueTotalNum = parseFloat(String(value_total).replace(",", "."));

  if (isNaN(qtdNum)) {
    return NextResponse.json({ error: "Quantidade inválida." }, { status: 400 });
  }
  if (isNaN(valueTotalNum)) {
    return NextResponse.json({ error: "Valor total inválido." }, { status: 400 });
  }
  if (!date_operation?.trim()) {
    return NextResponse.json(
      { error: "Data da operação é obrigatória." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("aportes")
    .update({
      qtd: qtdNum,
      value_total: valueTotalNum,
      date_operation,
      currency: normalizeCurrency(currency),
      dolar_value: normalizeDolarValue(dolar_value),
      info: normalizeInfo(info),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        {
          error:
            "Já existe um aporte com esse código, quantidade e data. Verifique os valores.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ aporte: data });
}

// DELETE /api/aportes/[id] → exclui um aporte
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const supabase = getSupabaseServer();
  const { id } = await params;

  const { error } = await supabase.from("aportes").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
