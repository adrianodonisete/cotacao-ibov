export interface Cotacao {
  id: number;
  code: string;
  date_update: string; // yyyy-mm-dd
  value: number;
  maturity_date?: string | null; // yyyy-mm-dd
}

export type CotacaoUpsertInput = Omit<Cotacao, "id">;

export interface CotacaoSyncResult {
  total: number;
  ok: number;
  fail: number;
}

/**
 * Tipo de resposta padrão para futuras APIs de cotação.
 */
export interface CotacaoApiResponse {
  cotacao?: Cotacao;
  cotacoes?: Cotacao[];
  total?: number;
  message?: string;
  error?: string;
}
