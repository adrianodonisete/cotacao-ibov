import { NextRequest, NextResponse } from "next/server";
import { BrapiResponse } from "@/types/brapi";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code || code.trim() === "") {
    return NextResponse.json(
      { error: "O campo 'code' é obrigatório." },
      { status: 400 }
    );
  }

  const token = process.env.BRAPI_TOKEN;

  if (!token) {
    return NextResponse.json(
      { error: "Token da API não configurado." },
      { status: 500 }
    );
  }

  const ticker = code.trim().toUpperCase();
  const url = `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}?token=${token}`;

  const res = await fetch(url, { next: { revalidate: 60 } });
  const data: BrapiResponse = await res.json();

  return NextResponse.json(data, { status: res.status });
}
