import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function checkSupabaseConnection(): Promise<string | null> {
  if (!supabaseUrl || !supabaseKey) {
    return "Variáveis de ambiente SUPABASE_URL e SUPABASE_PUBLISHABLE_DEFAULT_KEY não configuradas.";
  }

  try {
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
