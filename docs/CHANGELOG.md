# Changelog

Registro de todas as mudanças notáveis no projeto DromeFlow.

## [2025-11-03] - Trigger Automático: processed_data → pos_vendas

### ✨ Nova Funcionalidade
**Sincronização automática de atendimentos para pós-vendas**

#### Descrição
Implementado trigger `auto_create_pos_vendas_from_processed` que cria automaticamente registros em `pos_vendas` quando novos atendimentos são inseridos em `processed_data` com `ATENDIMENTO_ID` válido.

#### Comportamento
- **Trigger**: `AFTER INSERT` em `processed_data`
- **Condição**: `ATENDIMENTO_ID` não nulo e não vazio
- **Ação**: INSERT em `pos_vendas` com dados mapeados (nome, contato, unidade, data)
- **Conflitos**: `ON CONFLICT (ATENDIMENTO_ID) DO NOTHING` (ignora duplicados)
- **Status padrão**: `pendente`
- **Reagendamento**: `false`

#### Mapeamento de Campos
| pos_vendas | Origem | Observação |
|-----------|--------|------------|
| `ATENDIMENTO_ID` | `processed_data.ATENDIMENTO_ID` | Chave única |
| `nome` | `processed_data.CLIENTE` | - |
| `contato` | `processed_data.whatscliente` | - |
| `unit_id` | `units.id` | Lookup via `unidade_code` |
| `data` | `processed_data.DATA` | Cast para timestamp |
| `status` | `'pendente'` | Fixo |
| `reagendou` | `false` | Fixo |

#### Arquivos Criados
- `docs/sql/2025-11-03_auto_sync_processed_to_pos_vendas.sql`

#### Benefícios
- ✅ Elimina necessidade de população manual
- ✅ Garante consistência entre tabelas
- ✅ Reduz erros humanos no processo
- ✅ Mantém histórico completo desde o primeiro atendimento

#### Compatibilidade
- Fluxo existente `pos_vendas → processed_data` (trigger `sync_pos_vendas_status`) mantido
- População retroativa via [`populate_pos_vendas_from_processed_data()`](docs/sql/2025-10-31_populate_pos_vendas.sql) permanece válida para dados históricos

---

## [2025-11-03] - Nova Feature: Tabela Específica para Contatados

### ✨ Nova Funcionalidade
**Tabela otimizada para visualização de registros contatados**

#### Descrição
Implementada tabela dedicada para exibir atendimentos com status 'contatado' no módulo Pós-Vendas, com colunas específicas para facilitar o acompanhamento de contatos realizados.

#### Colunas Implementadas
1. **Data** - Data do atendimento original
2. **ID** - Identificador do atendimento (ATENDIMENTO_ID)
3. **Cliente** - Nome do cliente
4. **Data de Envio** - Data da última atualização (updated_at)
5. **Ações** - Botões para editar/excluir

#### Características
- ✅ Exibe todos os registros do mês (sem limite)
- ✅ Filtro automático por período e unidade
- ✅ Layout otimizado (5 colunas vs 6 da tabela padrão)
- ✅ Contador de registros no rodapé
- ✅ ID exibido com fonte monospace para melhor legibilidade
- ✅ Mensagem quando não há registros
- ✅ Responsivo com scroll horizontal

#### Comportamento
- Ativa quando o card "Contatado" é clicado
- Atualiza automaticamente ao mudar período/unidade
- Integração com Realtime para updates instantâneos

#### Arquivos Modificados
- `components/pages/PosVendasPage.tsx`
  - Nova função: `renderContatadosTable()`
  - Renderização condicional atualizada
- `docs/features/pos-vendas-contatados-table.md` (documentação detalhada)

#### Benefícios
- Visualização focada nos dados relevantes para contatos
- Rastreamento da data de envio do contato
- Melhor organização da informação

---

## [2025-11-02] - Correção de Bug Crítico em Pós-Vendas

### 🐛 Bug Corrigido
**Métrica de "Contatados" sempre exibia zero**

#### Descrição do Problema
O card de métricas "Contatados" na página de Pós-Vendas sempre exibia 0, mesmo quando existiam registros com status `contatado` no banco de dados para o período selecionado.

#### Causa Raiz
A função `getMetrics()` em `services/posVendas/posVendas.service.ts` estava fazendo uma query Supabase que:
1. Aplicava filtros de data usando `.gte()` e `.lte()` no campo `data`
2. **MAS não incluía o campo `data` no `.select()`**

```typescript
// ❌ ANTES (incorreto)
.select('nota, reagendou, status')
```

O cliente Supabase JS não aplica corretamente filtros de intervalo em campos que não estão incluídos na seleção, resultando em 0 registros retornados.

#### Solução Implementada
Adicionado o campo `data` ao `.select()` da query:

```typescript
// ✅ DEPOIS (correto)
.select('data, nota, reagendou, status')
```

#### Testes Realizados
1. **Query SQL direta no banco**: Confirmado que existia 1 registro com status `contatado` para outubro/2025
2. **Verificação de filtros**: 
   - `unit_id`: `6b9769ab-9088-469b-b31a-d174ed766682` ✓
   - `startDate`: `2025-10-01` ✓
   - `endDate`: `2025-10-31` ✓
3. **Query PostgreSQL**: Retornou corretamente 320 registros (1 contatado + 319 pendentes)

#### Impacto
- **Antes**: Métricas incorretas, impossível monitorar contatos realizados
- **Depois**: Métricas precisas, contagem correta de status 'contatado'

#### Arquivos Modificados
- `services/posVendas/posVendas.service.ts` (linha ~282)

#### Lições Aprendidas
⚠️ **Importante**: Ao usar o cliente Supabase JS com filtros de intervalo (`.gte()`, `.lte()`, `.gt()`, `.lt()`), sempre incluir o campo filtrado no `.select()`. O PostgREST pode otimizar a query e ignorar filtros em campos não selecionados.

---

## Boas Práticas para Queries Supabase

### ✅ Correto
```typescript
const query = supabase
  .from('tabela')
  .select('campo_filtrado, campo1, campo2')  // Incluir campo_filtrado
  .gte('campo_filtrado', valor_min)
  .lte('campo_filtrado', valor_max);
```

### ❌ Incorreto
```typescript
const query = supabase
  .from('tabela')
  .select('campo1, campo2')  // Faltando campo_filtrado
  .gte('campo_filtrado', valor_min)
  .lte('campo_filtrado', valor_max);
```

---

## Próximos Passos
- [ ] Revisar outras queries em `services/*/*.service.ts` para garantir consistência
- [ ] Adicionar testes automatizados para métricas de pós-vendas
- [ ] Documentar padrões de query no guia de contribuição
