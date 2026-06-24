import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

// GET /api/categories → todas as categorias
export async function GET() {
  const supabase = getSupabaseServer();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ categories: data ?? [] });
}
