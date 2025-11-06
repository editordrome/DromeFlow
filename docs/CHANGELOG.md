# Changelog

Registro de todas as mudanças notáveis no projeto DromeFlow.

## [2025-11-06] - Correção: RLS Policy para INSERT em Profissionais

### 🐛 Bug Crítico Corrigido

#### Erro ao Criar Nova Profissional
- **Sintoma**: `new row violates row-level security policy for table "profissionais" (Código: 42501)`
- **Contexto**: Ao tentar criar nova profissional no módulo Recrutadora
- **Causa**: Política RLS permitia INSERT apenas para role `authenticated`, mas sistema usa auth customizada com role `anon`

### 🔧 Solução Aplicada

#### Nova Política RLS
```sql
CREATE POLICY profissionais_insert_anon
ON profissionais
FOR INSERT
TO anon
WITH CHECK (true);
```

#### Arquivos Criados
- `docs/sql/2025-11-06_profissionais_insert_anon_fix.sql` - Script de migração
- `docs/FIX_PROFISSIONAIS_INSERT_RLS.md` - Documentação completa do fix

### 📋 Ação Necessária
⚠️ **Executar migração SQL no Supabase antes de criar novas profissionais**

### 🔍 Contexto Técnico
- Sistema usa autenticação customizada (valida em `profiles`)
- Queries executam com chave pública (role `anon`)
- RLS precisa permitir operações para `anon`, não apenas `authenticated`
- Já corrigido anteriormente: UPDATE (2025-10-29)
- Agora corrigido: INSERT (2025-11-06)

---

## [2025-11-05] - Módulo Prestadoras: Aba Atenção e Coluna Último Atendimento

### ✨ Novas Funcionalidades

#### 1. Nova Aba "Atenção" no Módulo Prestadoras
- **Objetivo**: Identificar profissionais ativas que necessitam atenção
- **Critérios**:
  - Profissionais ativas com mais de 15 dias sem atendimento
  - Profissionais ativas que nunca tiveram atendimento
- **Visual**: Botão laranja com ícone de alerta (AlertTriangle)
- **Contador**: Exibe quantidade de profissionais em atenção

#### 2. Nova Coluna "Último" na Tabela de Profissionais
- **Posição**: Entre "WhatsApp" e "Status"
- **Formato**: Data no formato brasileiro (DD/MM/AAAA)
- **Destaque Visual**:
  - 🟠 Laranja + negrito: >15 dias ou "Nunca" (ativas)
  - Normal: ≤15 dias desde último atendimento
  - Cinza: "-" para inativas sem atendimento
- **Fonte de Dados**: Busca diretamente da tabela `processed_data`

#### 3. Reorganização de Cards Principais
- Nova ordem: "Profissionais (ativos)" → "Profissionais atuantes (mês)" → "Recrutadora (cadastros)"
- "Profissionais Atuantes" agora aparece ao lado de "Profissionais"

### 🐛 Correções

#### Toggle de Status na Tabela
- **Problema**: Toggle não funcionava na aba "Atenção" devido a conflito com `onDoubleClick`
- **Solução**: 
  - Adicionado `stopPropagation` na célula `<td>`
  - Melhorado handler do `onClick` do botão
  - Simplificada função `handleToggleStatus`

### 🔧 Mudanças Técnicas

#### Serviço de Analytics
- **Arquivo**: `services/analytics/prestadoras.service.ts`
- **Nova função**: `getLastAppointmentByProfessional(unitCodes: string[])`
  - Busca diretamente de `processed_data`
  - Ordena por `DATA` descendente
  - Agrupa no cliente pegando primeira ocorrência
  - Retorna `Record<string, string>` (nome → data)

#### Componente PrestadorasPage
- **Arquivo**: `components/pages/PrestadorasPage.tsx`
- **Novos estados**:
  - `statusTab`: Tipo atualizado para incluir `'atencao'`
  - `lastAppointments`: `Record<string, string>`
- **Métricas atualizadas**: `profMetrics.atencao`
- **Filtros atualizados**: Suporte para aba "Atenção"
- **Tabela**: 4 colunas (35%, 25%, 20%, 20%)

### 📦 Impacto
- **Sem migração de BD**: Funciona imediatamente sem alterações no banco
- **Performance**: Busca executada uma vez ao carregar lista
- **Cache**: Últimos atendimentos armazenados em estado local
- **Normalização**: Nomes normalizados (lowercase + trim) para matching

### 📚 Documentação
- Criado `docs/features/prestadoras-atencao-ultimo-atendimento.md`
- Documentação completa com exemplos e fluxos de dados

---

## [2025-11-04] - Migração: ATENDIMENTO_ID como Chave Única

### 🔧 Mudança Estrutural
**Substituição de `orcamento` por `ATENDIMENTO_ID` como identificador único**

#### Motivação
- Coluna `orcamento` não existe mais na tabela `processed_data`
- `ATENDIMENTO_ID` já era utilizado como identificador lógico do atendimento
- Necessidade de simplificar constraint e alinhar com estrutura real dos dados

#### Mudanças Aplicadas
1. **Constraint atualizado**: `UNIQUE (unidade_code, ATENDIMENTO_ID)` (antes era `unidade_code, orcamento`)
2. **RPC atualizado**: `process_xlsx_upload` usa `ON CONFLICT (unidade_code, ATENDIMENTO_ID) DO UPDATE`
3. **Migração de dados**: 256 registros existentes receberam sufixos `_1`, `_2` no `ATENDIMENTO_ID` para registros derivados
4. **Trigger atualizado**: `sync_processed_data_to_pos_vendas` ignora registros derivados (regex `_\d+$`)
5. **STATUS automático**: Implementado `applyWaitStatusForAfternoonShifts()` que marca `STATUS="esperar"` para atendimentos "Tarde" quando profissional tem múltiplos atendimentos no dia

#### Configuração Final
- **Função RPC**: `process_xlsx_upload(unit_code_arg text, records_arg jsonb)`
- **Constraint**: `UNIQUE (unidade_code, ATENDIMENTO_ID)`
- **ON CONFLICT**: `(unidade_code, ATENDIMENTO_ID)`
- **Campos atualizados**: DATA, HORARIO, VALOR, SERVIÇO, TIPO, PERÍODO, MOMENTO, CLIENTE, PROFISSIONAL, ENDEREÇO, DIA, REPASSE, whatscliente, CUPOM, ORIGEM, IS_DIVISAO, CADASTRO, unidade, STATUS
- **Campos preservados**: `id`, `created_at` (idempotência)

#### Comportamento de Upload
| Situação | Ação | Descrição |
|----------|------|-----------|
| Novo ATENDIMENTO_ID | INSERT | Cria novo registro |
| ATENDIMENTO_ID existente | UPDATE | Atualiza todos os campos, preserva id/created_at |
| ID não está mais no arquivo | DELETE | `removeObsoleteRecords()` limpa registros obsoletos no período |
| Multi-profissionais | INSERT múltiplos | Original sem sufixo + derivados com `_1`, `_2`, etc. |
| Tarde + múltiplos atend./dia | UPDATE STATUS | `STATUS="esperar"` aplicado automaticamente |

#### Arquivos
- `docs/sql/2025-11-04_migrate_orcamento_to_atendimento_id.sql`: Script de migração completo
- `docs/sql/2025-11-04_fix_pos_vendas_trigger_derivados.sql`: Atualização do trigger
- `services/ingestion/upload.service.ts`: Lógica de upload com STATUS automático
- `.github/copilot-instructions.md`: Documentação atualizada

#### Benefícios
- ✅ Alinhamento com estrutura real da tabela
- ✅ Constraint simplificado e eficiente
- ✅ Upsert correto por ATENDIMENTO_ID
- ✅ Trigger de pós-vendas ignora derivados corretamente
- ✅ STATUS automático para gestão operacional
- ✅ Idempotência garantida (re-upload não duplica)

---

## [2025-11-03] - Fix: Restauração da Configuração de Upload

### 🔧 Correção Crítica
**[OBSOLETO - Ver migração 2025-11-04 acima]**

Esta entrada foi substituída pela migração para `ATENDIMENTO_ID` como chave única.

---

## [2025-11-03] - Módulo Agendamentos: Atualização em Tempo Real

### ✨ Nova Funcionalidade
**Sincronização automática da tabela de agendamentos via Realtime**

#### Descrição
Implementado sistema de atualização em tempo real para o módulo Agendamentos usando Supabase Realtime. A tabela agora reflete mudanças no banco de dados instantaneamente, sem necessidade de recarregar a página.

#### Funcionalidades Implementadas

##### 1. Subscription Realtime
- **Hook**: `useRealtimeSubscription` configurado para tabela `processed_data`
- **Eventos Monitorados**:
  - INSERT: Novos agendamentos aparecem automaticamente
  - UPDATE: Mudanças de status refletem instantaneamente
  - DELETE: Registros removidos desaparecem da lista
- **Filtros Inteligentes**:
  - Por data ativa (YYYY-MM-DD)
  - Por unidade selecionada (suporta "Todos")
  - Evita duplicatas na lista

##### 2. Sincronização de Status
- **Tempo Real**: Status (Pendente, Aguardando, Confirmado, Recusado) atualiza automaticamente
- **Multi-Usuário**: Mudanças feitas por outros usuários aparecem instantaneamente
- **Performance**: Apenas registros relevantes (data + unidade) são monitorados
- **Logs**: Console logs para debugging (INSERT/UPDATE/DELETE)

#### Configuração do Supabase
- **SQL**: `docs/sql/2025-11-03_enable_realtime_processed_data.sql`
- **Comando**: `ALTER PUBLICATION supabase_realtime ADD TABLE processed_data;`
- **Nota**: Requer execução no Supabase Dashboard ou CLI

#### Arquivos Modificados
- `components/pages/AppointmentsPage.tsx`: Implementação do hook de realtime
- `hooks/useRealtimeSubscription.ts`: Hook reutilizável (já existente)

#### Benefícios
- ✅ Eliminação de refresh manual da página
- ✅ Experiência multi-usuário sincronizada
- ✅ Feedback instantâneo de mudanças
- ✅ Redução de chamadas desnecessárias ao servidor
- ✅ UX moderna e responsiva

#### Casos de Uso
- Atendente atualiza status → Todos veem a mudança imediatamente
- Novo agendamento criado → Aparece na lista automaticamente
- Status alterado por webhook → Interface reflete mudança sem delay

---

# Changelog

Registro de todas as mudanças notáveis no projeto DromeFlow.

## [2025-11-03] - Correção Crítica: process_xlsx_upload (Tratamento de NULL)

### 🐛 Correção de Bug
**Erro no upload XLSX com valores NULL em orcamento**

#### Problema Identificado
- **Erro**: `there is no unique or exclusion constraint matching the ON CONFLICT specification`
- **Causa**: RPC `process_xlsx_upload` usava `ON CONFLICT (unidade_code, orcamento)` mas UNIQUE constraints não funcionam com valores NULL
- **Impacto**: Upload falhava quando planilha continha linhas com orçamento vazio/NULL

#### Solução Aplicada
- **Validação Prévia**: Verificar se `orcamento` é NULL ou vazio antes do INSERT
- **Comportamento**: Registros sem orçamento são ignorados e contabilizados separadamente
```sql
-- Validação adicionada
IF orcamento_val IS NULL OR orcamento_val = '' THEN
    ignored_count := ignored_count + 1;
    CONTINUE;
END IF;
```

#### Arquivos Criados
- `docs/sql/2025-11-03_fix_process_xlsx_upload_null_handling.sql`

#### Resultado
- ✅ Upload funciona mesmo com linhas sem orçamento
- ✅ Estatísticas incluem contagem de registros ignorados
- ✅ Não gera mais erro de constraint

---

## [2025-11-03] - Correção Crítica: Trigger pos_vendas (Campo CONTATO)

### 🐛 Correção de Bug
**Erro no trigger de sincronização processed_data → pos_vendas**

#### Problema Identificado
- **Erro**: `record "new" has no field "CONTATO"`
- **Causa**: Trigger `auto_create_pos_vendas_from_processed` estava tentando acessar campo `NEW."CONTATO"` que não existe na tabela `processed_data`
- **Impacto**: Upload de arquivos XLSX falhava ao tentar inserir dados em `processed_data`

#### Solução Aplicada
- **Campo correto**: `whatscliente` (não `CONTATO`)
- **Arquivo corrigido**: `docs/sql/2025-11-03_auto_sync_processed_to_pos_vendas.sql`
- **Script de fix**: `docs/sql/2025-11-03_fix_trigger_contato_field.sql`

#### Para Aplicar a Correção no Supabase
Execute o script SQL no Editor SQL do Supabase:
```sql
CREATE OR REPLACE FUNCTION sync_processed_data_to_pos_vendas()
RETURNS TRIGGER AS $$
DECLARE
  v_unit_id uuid;
BEGIN
  SELECT id INTO v_unit_id FROM units WHERE unit_code = NEW.unidade_code LIMIT 1;
  IF v_unit_id IS NULL THEN
    RAISE WARNING 'Unidade não encontrada para unit_code: %', NEW.unidade_code;
  END IF;
  
  INSERT INTO pos_vendas (
    "ATENDIMENTO_ID", unit_id, nome, contato, data, status, nota, reagendou, feedback, created_at, updated_at
  )
  VALUES (
    NEW."ATENDIMENTO_ID", v_unit_id, NEW."CLIENTE", NEW.whatscliente, NEW."DATA",
    COALESCE(NEW."pos vendas", 'pendente')::text, NULL, FALSE, NULL, NOW(), NOW()
  )
  ON CONFLICT ("ATENDIMENTO_ID") DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## [2025-11-03] - Módulo Profissionais: CRUD Completo e Toggle de Status

### ✨ Nova Funcionalidade
**Cadastro de profissionais e toggle de status aprimorado**

#### Descrição
Implementado sistema completo de gerenciamento de profissionais com capacidade de criar novos cadastros e alternância intuitiva de status ativa/inativa.

#### Funcionalidades Implementadas

##### 1. Cadastro de Novos Profissionais
- **Botão "Novo Cadastro"**: Adicionado no cabeçalho da página Profissionais
- **Modal de Criação**: `ProfissionalDetailModal` adaptado para suportar modo criação (quando `profissional` é `null`)
- **Campos disponíveis**:
  - Nome (obrigatório)
  - WhatsApp, RG, CPF
  - Data de Nascimento
  - Tipo, Preferência, Habilidade
  - Estado Civil, Fumante, Filhos
  - Endereço, Contatos de Recado
  - Observações
- **Status padrão**: Ativa
- **Validação**: Nome obrigatório, campos opcionais

##### 2. Toggle Switch de Status
- **Substituição do botão**: Botão clicável substituído por toggle switch moderno
- **Visual intuitivo**: 
  - Verde quando ativa
  - Cinza quando inativa
  - Animação suave de transição
- **Label clara**: Texto "Ativa"/"Inativa" ao lado do toggle
- **Loading integrado**: Spinner durante atualização
- **Acessibilidade**: Atributos `role="switch"` e `aria-checked`

#### Arquivos Modificados
- `services/profissionais/profissionais.service.ts`: Função `createProfissional()` adicionada
- `components/ui/ProfissionalDetailModal.tsx`: Suporte para modo criação
- `components/pages/ProfissionaisPage.tsx`: Botão "Novo Cadastro" e toggle switch

#### Benefícios
- ✅ CRUD completo para profissionais (Create, Read, Update, Delete/Status)
- ✅ UX moderna e intuitiva com toggle switch
- ✅ Processo de cadastro simplificado
- ✅ Feedback visual claro do status
- ✅ Validação de campos obrigatórios

---

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
