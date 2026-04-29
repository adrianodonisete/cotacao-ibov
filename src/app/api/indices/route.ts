import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { BCB_SERIES } from '@/lib/bcb-service';

const IPCA_CODE = `BCB_${BCB_SERIES.IPCA_12M}`;
const SELIC_CODE = `BCB_${BCB_SERIES.SELIC_META}`;

interface IndiceRow {
	code: string;
	value: number;
	date_update: string;
}

interface IndicesResponse {
	ipca: IndiceRow | null;
	selic: IndiceRow | null;
}

export async function GET(): Promise<NextResponse> {
	const supabase = getSupabaseServer();

	const { data, error } = await supabase
		.from('cotacoes')
		.select('code, value, date_update')
		.in('code', [IPCA_CODE, SELIC_CODE]);

	if (error) {
		return NextResponse.json(
			{ error: `Erro ao buscar índices: ${error.message}` },
			{ status: 500 }
		);
	}

	const rows = (data ?? []) as IndiceRow[];

	const response: IndicesResponse = {
		ipca: rows.find(r => r.code === IPCA_CODE) ?? null,
		selic: rows.find(r => r.code === SELIC_CODE) ?? null,
	};

	return NextResponse.json(response);
}
