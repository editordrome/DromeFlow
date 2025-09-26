// filepath: services/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMessage = "As credenciais do Supabase (URL e Chave Anônima) não foram configuradas nas variáveis de ambiente (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).";
  console.error(errorMessage);
  // O alerta foi removido, mas um erro no console é mantido caso as chaves sejam removidas.
  throw new Error(errorMessage);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);