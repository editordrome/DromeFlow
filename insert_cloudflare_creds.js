import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uframhbsgtxckdxttofo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmcmFtaGJzZ3R4Y2tkeHR0b2ZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNjAxMTIsImV4cCI6MjA3MzYzNjExMn0.UCBI51MS6IlL-bacOPUfdVl9FI4O_FkzKuc9-wSve4M';

const supabase = createClient(supabaseUrl, supabaseKey);

async function insertCredentials() {
  const credentials = [
    { name: 'cloudflare_account_id', type: 'TOKEN', value: '624e5c7de1b1fab5c5800582597443ea', description: 'Cloudflare Account ID' },
    { name: 'cloudflare_api_token', type: 'API_KEY', value: 'RKqKMjbapBxZDMr6Mq84yhnrsev4qRrxf0MlEhB_', description: 'Cloudflare API Token' },
    { name: 'cloudflare_d1_database_id', type: 'TOKEN', value: '476f8189-5d28-4041-9a2d-d6a46f65fe9b', description: 'Cloudflare D1 Database ID' },
    { name: 'cloudflare_r2_access_key_id', type: 'API_KEY', value: '627a67b32b025359f5aec433dbaa2d8e', description: 'Cloudflare R2 S3 Access Key ID' },
    { name: 'cloudflare_r2_secret_access_key', type: 'API_KEY', value: '44f53aacecbcba2211e84f01da55aafcef727ee2d3c327dbd02e9e74152d1f9b', description: 'Cloudflare R2 S3 Secret Access Key' },
    { name: 'cloudflare_r2_endpoint', type: 'LINK', value: 'https://624e5c7de1b1fab5c5800582597443ea.r2.cloudflarestorage.com', description: 'Cloudflare R2 S3-compatible Endpoint' }
  ];

  console.log('🔄 Inserindo credenciais Cloudflare no DromeFlow...\n');

  // Primeiro, deletar credenciais antigas
  const { error: deleteError } = await supabase
    .from('access_credentials')
    .delete()
    .like('name', 'cloudflare%');

  if (deleteError) {
    console.error('❌ Erro ao deletar credenciais antigas:', deleteError.message);
  }

  // Inserir novas credenciais
  const { data, error } = await supabase
    .from('access_credentials')
    .insert(credentials);

  if (error) {
    console.error('❌ Erro ao inserir credenciais:', error.message);
  } else {
    console.log('✅ Todas as 6 credenciais inseridas com sucesso!');
  }

  console.log('\n🔍 Verificando credenciais inseridas...\n');
  
  const { data: allCreds, error: fetchError } = await supabase
    .from('access_credentials')
    .select('name, value, created_at')
    .like('name', 'cloudflare%')
    .order('name');

  if (fetchError) {
    console.error('❌ Erro ao buscar credenciais:', fetchError.message);
  } else {
    console.log(`✅ Total de credenciais Cloudflare: ${allCreds.length}\n`);
    allCreds.forEach(c => {
      console.log(`  • ${c.name}: ${c.value.substring(0, 40)}...`);
    });
  }
}

insertCredentials().catch(console.error);
