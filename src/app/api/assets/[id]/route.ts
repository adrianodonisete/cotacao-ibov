import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/assets/[id] → edita info e weight
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json();
  const { info, weight } = body;

  if (!info?.trim() || weight === undefined || weight === null) {
    return NextResponse.json(
      { error: "Campos 'info' e 'weight' são obrigatórios." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("ativos")
    .update({ info: info.trim(), weight: Number(weight) })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ asset: data });
}

// DELETE /api/assets/[id] → exclui um ativo
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const { error } = await supabase.from("ativos").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
