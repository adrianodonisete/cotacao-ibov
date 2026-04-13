import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase para uso exclusivo no servidor (API Routes, Server Components).
 * Usa a service role key: ignora RLS e deve NUNCA ser importado em código de cliente.
 */
let serverClient: SupabaseClient | null = null;

export function getSupabaseServer(): SupabaseClient {
  if (serverClient) return serverClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias no servidor. Configure em .env.local."
    );
  }

  serverClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return serverClient;
}

export async function checkSupabaseConnection(): Promise<string | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return "Variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não configuradas.";
  }

  try {
    const supabase = getSupabaseServer();
    const { error } = await supabase.from("ativos").select("id").limit(1);

    if (error) {
      if (error.code === "42P01") {
        return "Tabela 'ativos' não encontrada. Execute o script db/supabase/create_table_ativos.sql no painel SQL do Supabase.";
      }
      return `Erro ao acessar o banco de dados: ${error.message}`;
    }

    return null;
  } catch (e) {
    return `Falha ao conectar ao Supabase: ${e instanceof Error ? e.message : String(e)}`;
  }
}
