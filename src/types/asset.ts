export interface Asset {
  id: number;
  code: string;
  info: string;
  type: string;
  weight: number;
}

export interface AssetWithPercent extends Asset {
  weightPercent: number;
}
