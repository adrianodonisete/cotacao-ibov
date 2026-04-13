import Brapi from "brapi";
import type { BrapiResponse } from "@/types/brapi";

function getToken(explicit?: string): string {
  const token = explicit ?? process.env.BRAPI_TOKEN;
  if (!token?.trim()) {
    throw new Error("BRAPI_TOKEN não configurado.");
  }
  return token.trim();
}

/** Cliente Brapi; use `apiKey` com o token do dashboard (projeto usa `BRAPI_TOKEN`). */
export function createBrapiClient(apiKey?: string): Brapi {
  return new Brapi({ apiKey: getToken(apiKey) });
}

/**
 * Cotação de um único ticker (ação/FII etc.), formato compatível com {@link BrapiResponse}.
 * Todas as chamadas à API Brapi no servidor devem passar por aqui.
 */
export async function fetchQuoteForTicker(
  ticker: string,
  apiKey?: string
): Promise<BrapiResponse> {
  const code = ticker.trim().toUpperCase();
  if (!code) {
    throw new Error("Código do ativo vazio.");
  }
  const client = createBrapiClient(apiKey);
  const data = await client.quote.retrieve(code);
  return data as BrapiResponse;
}
