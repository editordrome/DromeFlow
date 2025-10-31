const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ewtsiufrrhobxmnqbsbz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHNpdWZycmhvYnhtbnFic2J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjYzNDgxODAsImV4cCI6MjA0MTkyNDE4MH0.PcxjINbuYW6_s6BDwzmkL9S_FrbqcTle-CrJqxHD_4Y';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTableStructure() {
  try {
    // Busca um registro para ver a estrutura
    const { data, error } = await supabase
      .from('processed_data')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Erro:', error);
      return;
    }
    
    if (data && data.length > 0) {
      console.log('=== ESTRUTURA DA TABELA processed_data ===\n');
      console.log('Colunas disponíveis:');
      const columns = Object.keys(data[0]);
      columns.forEach(col => {
        const value = data[0][col];
        const type = typeof value;
        console.log(`  - ${col} (${type}): ${value !== null ? JSON.stringify(value).substring(0, 50) : 'null'}`);
      });
      
      console.log('\n=== Buscando colunas relacionadas a PERÍODO/TIPO ===\n');
      const periodRelated = columns.filter(col => 
        col.toLowerCase().includes('period') || 
        col.toLowerCase().includes('tipo') ||
        col.toLowerCase().includes('hora') ||
        col === 'PERÍODO' ||
        col === 'PERIODO'
      );
      
      if (periodRelated.length > 0) {
        console.log('Colunas encontradas:', periodRelated);
        periodRelated.forEach(col => {
          console.log(`  ${col}: ${data[0][col]}`);
        });
      } else {
        console.log('Nenhuma coluna relacionada encontrada');
      }
    } else {
      console.log('Nenhum registro encontrado na tabela');
    }
  } catch (err) {
    console.error('Erro ao verificar estrutura:', err);
  }
}

checkTableStructure();
