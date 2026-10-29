// Script para explorar a estrutura do banco de dados Supabase
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uframhbsgtxckdxttofo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmcmFtaGJzZ3R4Y2tkeHR0b2ZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNjAxMTIsImV4cCI6MjA3MzYzNjExMn0.UCBI51MS6IlL-bacOPUfdVl9FI4O_FkzKuc9-wSve4M';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function exploreDatabaseStructure() {
    console.log('🔍 Explorando estrutura do banco de dados DromeFlow...\n');

    try {
        // 1. Listar todas as tabelas do schema public
        console.log('📊 TABELAS DO SCHEMA PUBLIC:');
        console.log('='.repeat(80));

        const { data: tables, error: tablesError } = await supabase
            .rpc('get_table_list');

        if (tablesError) {
            console.log('⚠️  Não foi possível listar tabelas via RPC, tentando método alternativo...\n');

            // Listar tabelas conhecidas da documentação
            const knownTables = [
                'profiles',
                'units',
                'modules',
                'user_units',
                'user_modules',
                'unit_modules',
                'unit_keys',
                'processed_data',
                'pos_vendas',
                'profissionais',
                'recrutadora',
                'comercial',
                'comercial_columns',
                'unit_clients',
                'activity_logs',
                'n8n_logs',
                'error_logs',
                'actions'
            ];

            console.log('Tabelas conhecidas do projeto:');
            for (const table of knownTables) {
                // Tentar contar registros de cada tabela
                const { count, error } = await supabase
                    .from(table)
                    .select('*', { count: 'exact', head: true });

                if (!error) {
                    console.log(`  ✅ ${table.padEnd(25)} - ${count || 0} registros`);
                } else {
                    console.log(`  ❌ ${table.padEnd(25)} - Sem acesso ou não existe`);
                }
            }
        } else {
            console.log(tables);
        }

        console.log('\n' + '='.repeat(80));

        // 2. Explorar estrutura de tabelas principais
        console.log('\n📋 ESTRUTURA DAS TABELAS PRINCIPAIS:\n');

        const tablesToExplore = [
            { name: 'profiles', description: 'Usuários do sistema' },
            { name: 'units', description: 'Unidades/Filiais' },
            { name: 'modules', description: 'Módulos do sistema' },
            { name: 'processed_data', description: 'Atendimentos processados' },
            { name: 'pos_vendas', description: 'Pós-vendas' },
            { name: 'profissionais', description: 'Cadastro de profissionais' }
        ];

        for (const table of tablesToExplore) {
            console.log(`\n🔹 ${table.name.toUpperCase()} (${table.description})`);
            console.log('-'.repeat(80));

            const { data, error } = await supabase
                .from(table.name)
                .select('*')
                .limit(1);

            if (!error && data && data.length > 0) {
                const columns = Object.keys(data[0]);
                console.log(`Colunas (${columns.length}):`);
                columns.forEach(col => {
                    const value = data[0][col];
                    const type = typeof value;
                    console.log(`  - ${col.padEnd(30)} (${type})`);
                });
            } else if (error) {
                console.log(`  ❌ Erro ao acessar: ${error.message}`);
            } else {
                console.log('  ⚠️  Tabela vazia');
            }
        }

        // 3. Estatísticas gerais
        console.log('\n\n📈 ESTATÍSTICAS GERAIS:');
        console.log('='.repeat(80));

        const stats = [
            { table: 'profiles', label: 'Usuários cadastrados' },
            { table: 'units', label: 'Unidades ativas' },
            { table: 'modules', label: 'Módulos disponíveis' },
            { table: 'processed_data', label: 'Atendimentos processados' },
            { table: 'profissionais', label: 'Profissionais cadastrados' },
            { table: 'pos_vendas', label: 'Registros pós-venda' }
        ];

        for (const stat of stats) {
            const { count } = await supabase
                .from(stat.table)
                .select('*', { count: 'exact', head: true });

            console.log(`  ${stat.label.padEnd(35)}: ${count || 0}`);
        }

        console.log('\n✅ Exploração concluída!\n');

    } catch (error) {
        console.error('❌ Erro ao explorar banco de dados:', error);
    }
}

// Executar exploração
exploreDatabaseStructure();
