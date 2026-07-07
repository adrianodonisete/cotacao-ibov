export interface TotalAsset {
  code: string;
  category_name: string;
  percentual_objetivo: number;
  montante_objetivo: number;
  total_qtd: number;
  cotacao: number;
  total_aportado: number;
  percentual_aportado: number;
  montante_atual: number;
  percentual_montante_atual: number;
  lucro: number;
  percentual_lucro: number;
  montante_falta: number;
  percentual_falta: number;
  primeiro_aporte: string | null;
  ultimo_aporte: string | null;
}

export interface TotalAssetWithInfo extends TotalAsset {
  info: string;
  weight: number;
}

export interface TotalAssetsApiResponse {
  totals?: TotalAssetWithInfo[];
  category?: string;
  error?: string;
}
