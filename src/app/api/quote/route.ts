import { NextRequest, NextResponse } from "next/server";
import { APIError } from "brapi";
import { fetchQuoteForTicker } from "@/lib/brapi-service";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code || code.trim() === "") {
    return NextResponse.json({ error: "O campo 'code' é obrigatório." }, { status: 400 });
  }

  try {
    const data = await fetchQuoteForTicker(code);
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    if (err instanceof APIError) {
      const status = typeof err.status === "number" ? err.status : 500;
      return NextResponse.json(
        { error: err.message || "Erro na API Brapi." },
        { status }
      );
    }
    if (err instanceof Error && err.message.includes("BRAPI_TOKEN")) {
      return NextResponse.json({ error: "Token da API não configurado." }, { status: 500 });
    }
    return NextResponse.json({ error: "Erro ao buscar cotação." }, { status: 500 });
  }
}
