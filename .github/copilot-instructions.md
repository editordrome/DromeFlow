# Orientações para o Agente de Codificação de IA

Este documento fornece orientações para agentes de codificação de IA que trabalham nesta base de código.

## Arquitetura e Padrões

### Visão Geral

Esta é uma aplicação React (`.tsx`) construída com Vite, usando TypeScript. A interface do usuário é estilizada com Tailwind CSS. O gerenciamento de estado é feito através dos Contextos React, e o backend é fornecido pelo Supabase. A autenticação é personalizada, validando credenciais diretamente na tabela `profiles`.

### Estrutura de Diretórios

-   `components`: Contém componentes React, divididos em `layout`, `pages` e `ui`.
    -   `pages`: Componentes que representam visualizações completas da página.
    -   `layout`: Componentes estruturais como `Sidebar` e `ContentArea`.
    -   `ui`: Componentes de UI reutilizáveis como `Icon`, modais e gráficos.
-   `contexts`: Contém os provedores de Contexto React para gerenciamento de estado global.
    -   `AuthContext.tsx`: Gerencia a autenticação do usuário, perfil e sessões. Lida com um fluxo de login personalizado.
    -   `AppContext.tsx`: Gerencia o estado da aplicação, como a visualização ativa e a unidade selecionada.
-   `services`: Contém módulos para interagir com serviços externos.
    -   `supabaseClient.ts`: Inicializa e exporta o cliente Supabase.
    -   Serviços segmentados por domínio em `services/*/*.service.ts` (analytics, data, auth, units, modules, ingestion, content, access, utils).

### Fluxo de Dados e Gerenciamento de Estado

1.  **Autenticação**: O `App.tsx` envolve a aplicação no `AuthProvider`. O `AuthProvider` (`contexts/AuthContext.tsx`) lida com um fluxo de login/logout personalizado que verifica as credenciais do usuário na tabela `profiles` do Supabase.
2.  **Estado da Aplicação**: O `AppContextProvider` (`contexts/AppContext.tsx`) gerencia o estado da interface do usuário, como a visualização atualmente exibida (`activeView`) e a unidade selecionada.
3.  **Renderização de Conteúdo**: O componente `ContentArea` (`components/layout/ContentArea.tsx`) renderiza dinamicamente os componentes da página com base no `activeView` do `AppContext`. Para visualizações de "módulo", ele busca e exibe conteúdo de um webhook.

### Roteamento e Navegação

A aplicação não usa uma biblioteca de roteamento tradicional como o React Router. Em vez disso, a navegação é controlada pelo estado `activeView` no `AppContext`. O `Sidebar` e outros componentes atualizam essa visualização usando a função `setView` do contexto para alterar o conteúdo exibido no `ContentArea`.

### Integração com o Supabase

-   O cliente Supabase é configurado em `services/supabaseClient.ts`. As credenciais são codificadas, o que é adequado para chaves anônimas públicas, mas deve ser gerenciado com variáveis de ambiente em produção.
-   O `AuthContext` implementa uma lógica de autenticação personalizada, consultando a tabela `profiles` para validar o usuário. **Não utiliza `supabase.auth.signInWithPassword`**.
-   Os dados do perfil do usuário são buscados da tabela `profiles` no Supabase.
-   A lógica de negócios complexa, como o processamento de uploads de planilhas e cálculos de métricas, está nos serviços segmentados (por exemplo, `services/ingestion/upload.service.ts`, `services/analytics/*.service.ts`), que por sua vez chamam funções de banco de dados (RPCs) no Supabase.

## Fluxos de Trabalho de Desenvolvimento

### Confirmação prévia antes de editar (Obrigatório)

Antes de criar/editar/excluir qualquer arquivo, rodar comandos ou aplicar migrações:

- Informe ao usuário exatamente o que pretende fazer, listando:
    - Arquivo(s) a serem alterados e tipo de mudança (ex.: título do cabeçalho, nova prop, ajuste de estilo, etc.).
    - Objetivo e impacto esperado (ex.: alterar o título do módulo para exibir o dia da semana).
    - Passos a executar (ex.: editar arquivo X, atualizar Y, rodar build/teste se aplicável).
- Aguarde uma confirmação explícita do usuário (ex.: “Pode prosseguir”, “Aprovado”).
- Apenas após a confirmação execute as alterações e comandos.
- Se houver múltiplas opções de implementação, apresente as alternativas e peça a escolha do usuário.
- Não inicie servidores, nem execute comandos potencialmente destrutivos (mutações em dados, migrações, resets) sem aprovação explícita.
- Respostas puramente explicativas (sem editar arquivos) são permitidas sem confirmação; caso, depois, decida aplicar mudanças, retorne e solicite aprovação antes de executar.

### Executando a Aplicação

Para executar a aplicação localmente, siga os passos no `README.md`:

1.  Instale as dependências:
    ```bash
    npm install
    ```
2.  Execute o servidor de desenvolvimento:
    ```bash
    npm run dev
    ```

Não há um passo de build explícito mencionado para desenvolvimento, pois o Vite lida com isso com seu servidor de desenvolvimento.

### Convenções de Código

-   **TypeScript**: A base de código usa TypeScript. Os tipos são definidos em `types.ts`.
-   **Estilo**: O Tailwind CSS é usado para estilização.
-   **Componentes**: Os componentes são funcionais e usam Hooks do React.
-   **Nomenclatura de Arquivos**: Os componentes e contextos são nomeados em PascalCase (`MeuComponente.tsx`), enquanto os serviços são em camelCase (`meuServico.ts`).

## Pontos Importantes (Atualizados)

- **Segurança de Conteúdo**: `ContentArea.tsx` só injeta HTML de URLs iniciando com `internal://`.
- **Camada de Acesso a Dados** (serviços segmentados):
    - Upload XLSX: expansão multi-profissional (sufixos `_N` no `ATENDIMENTO_ID`), divisão de repasse e limpeza baseada em IDs base.
    - Sincronização: `removeObsoleteRecords` elimina registros cujo `ATENDIMENTO_ID` base não está mais presente no arquivo importado.
    - Métricas: `fetchDashboardMetrics` e `fetchMonthlyChartData` recalculam contagem de serviços (IDs base, ignorando derivados) e repasse (soma total de originais + derivados).
    - Ordenação de Módulos: drag & drop persistido via `updateModulesOrder` atualiza `position`.
- **Mescla de Módulos**: Lógica no `AuthContext` já entrega a lista final (atribuições + `allowed_profiles` + públicos). Sidebar apenas filtra `is_active`.
- **Gerenciamento de Estado**: Novos estados globais — decidir entre `AuthContext` (identidade/permissões) e `AppContext` (UI / view / unidade).
 - **Chave Lógica de Sincronização**: Usar `ATENDIMENTO_ID` (com sufixos `_1`, `_2` para derivados) como identificador único por unidade. Constraint: `UNIQUE (unidade_code, ATENDIMENTO_ID)`.
 - **Configuração de Upload (Atendimentos Existentes)**:
   - Chave única: `(unidade_code, ATENDIMENTO_ID)` — registros com mesmo ID na mesma unidade são atualizados (upsert).
   - RPC: `process_xlsx_upload(unit_code_arg text, records_arg jsonb)` usa `ON CONFLICT (unidade_code, ATENDIMENTO_ID) DO UPDATE`.
   - Campos atualizados: DATA, HORARIO, VALOR, SERVIÇO, TIPO, PERÍODO, MOMENTO, CLIENTE, PROFISSIONAL, ENDEREÇO, DIA, REPASSE, whatscliente, CUPOM, ORIGEM, IS_DIVISAO, CADASTRO, unidade.
   - Campos preservados: `id`, `created_at`.
   - **STATUS condicional**: Preservado se PROFISSIONAL não mudou; atualizado se PROFISSIONAL mudou (permite reatribuição de atendimentos).
   - Limpeza de obsoletos: `removeObsoleteRecords()` remove registros cujo `ATENDIMENTO_ID` base não está mais presente no arquivo (escopo: período do arquivo + unidade).
   - STATUS automático: `applyWaitStatusForAfternoonShifts()` marca STATUS="esperar" para atendimentos onde MOMENTO contém "tarde" quando a mesma profissional tem múltiplos atendimentos no mesmo dia.
- **Expansão de Profissionais**: Registro original mantém `VALOR` e `ATENDIMENTO_ID` sem sufixo; derivados recebem `VALOR = 0`, `ATENDIMENTO_ID` com sufixo (`_1`, `_2`...) e mesma proporção de `REPASSE`.
- **Contagem de Serviços**: Baseada exclusivamente em registros originais (`IS_DIVISAO != 'SIM'` ou `ATENDIMENTO_ID` sem sufixo).
- **Repasse**: Sempre soma todos os registros (originais + derivados) para refletir distribuição integral.
- **Futuro (Planejado)**: hash de senha, migração para `auth.users` + triggers, RPC batch para ordenação, políticas RLS restritivas e índices analíticos.
 - **Super Admin**: Exibe apenas módulos cujo `allowed_profiles` contém `super_admin` (sem herdar públicos automaticamente).
 - **Ordenação densa**: Após drag & drop reatribuir `position` como sequência contínua (1..n); evitar gaps.
 - **Webhook Agendamentos**: Fluxo preferencial POST JSON completo; fallback automático GET com payload compactado + chunking (limite ~3000 chars) em falha de rede/CORS; inclui campo `endereco` e forma compacta (`e`).
 - **Compat de Serviços**: O barrel `services/index.ts` e `services/mockApi.ts` permanecem ativos até a Fase 6 (limpeza). Não remova nem altere imports globalmente sem PR dedicado à Fase 6.
 - **Unit Keys Admin**: Serviços administrativos expostos em `services/units/unitKeysAdmin.service.ts` (p.ex. `getUnitKeysColumnsStats`, rename/add/drop, set status) e UI correspondente em `components/pages/UnitKeysPage.tsx`.
- **Centralização**: Qualquer nova regra de upload / métricas deve ir para os serviços segmentados apropriados (por exemplo, `services/ingestion/upload.service.ts` ou `services/analytics/*.service.ts`), não duplique em componentes.
 - **Evolução**: Próxima otimização para reorder será RPC única (batch JSON) reduzindo round-trips.
 - **Sincronização Pós-Vendas**: 
   - Fluxo bidirecional via triggers: `processed_data` (INSERT) → `pos_vendas` (criação automática) e `pos_vendas` (UPDATE status) → `processed_data` (coluna `"pos vendas"`).
   - Chave: `ATENDIMENTO_ID` sem sufixos (apenas registros originais, `IS_DIVISAO = 'NAO'`); registros derivados com sufixo (`_1`, `_2`) são ignorados pelo trigger.
   - Campos auto-populados: `nome` (CLIENTE), `contato` (whatscliente), `unit_id` (lookup via unidade_code), `data` (DATA).
   - Status padrão: `pendente`; reagendamento: `false`.
   - População retroativa: Script SQL [`populate_pos_vendas_from_processed_data()`](../docs/sql/2025-10-31_populate_pos_vendas.sql).

## Padrão de Modais (UI/UX Otimizado)

Todos os modais da aplicação seguem um padrão compacto e consistente para melhor experiência do usuário:

### Estrutura Padrão

1. **Header Compacto**:
   - Gradiente sutil: `bg-gradient-to-r from-accent-primary/5 to-brand-cyan/5`
   - Título em negrito (`text-lg font-bold`)
   - Metadados (unidade, etc.) ao lado do título com ícone
   - Status/campo-chave no header (direita, ao lado do botão fechar)
   - Botão fechar com `mt-5` para alinhamento com select de status
   - Padding: `px-5 py-3.5`

2. **Body com Scroll**:
   - Container: `max-h-[65vh] overflow-y-auto px-5 py-4`
   - Mensagens de erro no topo com ícone de alerta
   - Campos em `space-y-3`
   - Labels: `text-xs font-medium text-text-secondary`
   - Inputs: `rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm`
   - Campos obrigatórios marcados com asterisco vermelho

3. **Footer Compacto**:
   - Fundo: `bg-bg-tertiary`
   - Padding: `px-5 py-3`
   - À esquerda: Indicador "* Obrigatório" com ícone de info
   - À direita: Botões de ação (apenas ícones)
   - Botão deletar (se aplicável): Ícone de delete vermelho com borda
   - Botão salvar: Ícone Check com spinner durante loading

4. **Auto-save de Status** (quando aplicável):
   - Mudanças no status salvam automaticamente para registros existentes
   - Atualização local do estado sem reload da página
   - Rollback em caso de erro
   - Não chama `onSaved()` para evitar tela branca

### Exemplos de Implementação

- **ComercialCardModal**: Modal de oportunidades comerciais (referência principal)
- **EditRecordModal**: Modal de edição de atendimentos
- Ambos seguem o mesmo padrão de layout e interação

### Diretrizes de Estilo

- Espaçamento: `gap-3` para campos relacionados
- Border radius: `rounded-lg` para inputs e cards
- Transições: `transition-all` em elementos interativos
- Focus: `focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20`
- Cores de status: Usar variáveis CSS do tema (accent-primary, brand-cyan, etc.)

## Guia Rápido: Criar um Novo Módulo (padrão)

Ao adicionar um novo “módulo” de negócio (aparece na Sidebar), siga este padrão para manter a consistência:

1) Banco de Dados (tabela `modules`)
- Crie/ajuste um registro com os campos:
    - `code` (string única, usada como chave de view)
    - `name` (rótulo na UI)
    - `description` (opcional)
    - `icon_name` (nome do ícone lucide, ex: "BarChart3")
    - `allowed_profiles` (array: ["admin", "user"], inclua "super_admin" apenas quando exclusivo)
    - `position` (número; mantido denso pelo reorder)
    - `is_active` (boolean)

2) Página de UI
- Crie `components/pages/SeuModuloPage.tsx` seguindo o padrão de páginas existentes (com hook de período/unidade quando aplicável). Ex.: filtros no topo, cards e tabela ou gráfico. Estilização com Tailwind.

3) Serviço(s) de Dados
- Caso precise de dados, crie um serviço por domínio em `services/<dominio>/<nome>.service.ts`.
    - Exemplos: `services/analytics/seuModulo.service.ts` (regras de métricas), `services/data/seuModulo.service.ts` (CRUD/listas).
    - Consuma o `supabaseClient` e mantenha a lógica de negócio no serviço (não no componente).

4) Navegação/Renderização
- O `AuthContext` compõe a lista de módulos base via `userModules`; a função `getModulesForUnit(unitId)` filtra por unidade.
- A `Sidebar` mostra apenas módulos `is_active` filtrados pela unidade selecionada.
- O `ContentArea` renderiza a página com base em `activeView` (normalmente, igual ao `code` do módulo) ou carrega HTML externo quando a origem começar com `internal://`.

5) Permissões (Hierarquia de Acesso a Módulos - Sistema Unit-Based Access Control)

## Estrutura de Banco de Dados
- **Tabela `unit_modules`**: Composite PK (unit_id, module_id), define módulos disponíveis por unidade
  - Campos: unit_id, module_id, created_at, updated_at
  - 3 índices: idx_unit_modules_unit, idx_unit_modules_module, idx_unit_modules_lookup
  - RLS policies: Permissivas para MVP (authenticated users podem ler)
  - Trigger: auto-atualiza updated_at
  - RPCs disponíveis:
    * `get_unit_modules(p_unit_id uuid)` - lista módulos de uma unidade
    * `assign_modules_to_unit(p_unit_id uuid, p_module_ids uuid[])` - atribui múltiplos módulos
    * `check_unit_module_access(p_unit_id uuid, p_module_id uuid)` - verifica acesso
  - View: `unit_modules_summary` - agrega estatísticas (unit_id, module_count, module_names)

- **Tabela `user_modules`**: Composite PK (user_id, module_id), atribuições individuais de usuário
  - Campos: user_id, module_id, created_at
  - Não possui relação com unit_id (atribuição global por usuário)

## Hierarquia de Permissões (AuthContext.getModulesForUnit)
1. **Super Admin**: 
   - Vê APENAS módulos com 'super_admin' em `allowed_profiles`
   - Ignora `unit_modules` e `user_modules`
   - Não herda módulos de outros perfis automaticamente

2. **Admin**: 
   - Acessa TODOS os módulos da unidade via `unit_modules`
   - Não precisa de atribuição em `user_modules`
   - Query: `SELECT module_id FROM unit_modules WHERE unit_id = ?`

3. **User**: 
   - Acessa apenas **interseção** de `user_modules` ∩ `unit_modules`
   - Precisa estar em ambas as tabelas para ter acesso
   - Query: módulos onde user_id E unit_id coincidem

## Gerenciamento via UI

### ManageUnitsPage - Aba "Módulos"
- Local: Modal de edição de unidade → Aba "Módulos"
- Interface: Grid de checkboxes (2 colunas, responsivo)
- Funcionalidade:
  * Lista todos os módulos ativos (`is_active = true`)
  * Checkboxes pré-selecionados baseados em `unit_modules`
  * Botão "Salvar Módulos" com feedback visual (Salvando... → Salvo! → Salvar Módulos)
  * Estados: modulesLoading, modulesError, savingModules, modulesSaved
- Serviço: `unitModules.service.ts → updateUnitModules(unitId, moduleIds[])`
- Persistência: Delete all + Insert batch (transacional)

### UserFormModal - Aba "Módulos" (Multi-unit)
- Local: Modal de criação/edição de usuário → Aba "Módulos"
- Interface: 
  * Dropdown para selecionar unidade (quando usuário tem múltiplas)
  * Grid de checkboxes filtrado por unidade selecionada
  * Módulos disponíveis = `unit_modules` da unidade escolhida
- Funcionalidade:
  * Super Admin: Checkboxes desabilitados (acesso automático)
  * Admin: Vê módulos da unidade (não salva em user_modules pois herda tudo)
  * User: Marca módulos que terá acesso (salva em user_modules)
- Estado: `modulesByUnit` (Map<unitId, Set<moduleId>>) para gerenciar múltiplas unidades
- Serviço: `users.service.ts → updateUserAssignments(userId, unitIds, moduleIds)`
- Lógica de salvamento:
  * Delete all `user_modules` WHERE user_id
  * Insert novos módulos em batch
  * Módulos salvos globalmente (sem unit_id), mas filtrados por unidade na UI

## Navegação e Sidebar
- **AuthContext**: Função `getModulesForUnit(unitId)` retorna módulos filtrados por perfil
- **AppContext**: 
  * Inicialização: Carrega primeiro módulo ativo da unidade ao fazer login
  * Detecção de `view_id`: Se módulo tem view_id, navega direto (sem webhook)
  * Mudança de unidade: Recarrega automaticamente o primeiro módulo ativo da nova unidade
- **Sidebar**: 
  * Filtra módulos por `is_active = true`
  * Lista dinâmica baseada em `getModulesForUnit(selectedUnitId)`
  * Atualiza automaticamente ao mudar unidade selecionada

## Fluxo Completo de Atribuição

### 1. Atribuir módulos à unidade (Admin/Super Admin):
```
ManageUnitsPage → Editar Unidade → Aba "Módulos" → Marcar checkboxes → Salvar
↓
updateUnitModules(unitId, moduleIds) 
↓
DELETE FROM unit_modules WHERE unit_id = ?
INSERT INTO unit_modules (unit_id, module_id) VALUES (?, ?)...
```

### 2. Atribuir módulos ao usuário (Admin):
```
ManageUsersPage → Editar Usuário → Aba "Módulos" → Selecionar Unidade → Marcar checkboxes → Salvar
↓
updateUserAssignments(userId, unitIds, moduleIds)
↓
DELETE FROM user_modules WHERE user_id = ?
INSERT INTO user_modules (user_id, module_id) VALUES (?, ?)...
```

### 3. Login e Visualização (Qualquer usuário):
```
AuthContext.login() → carrega profile
↓
AppContext.initialize() → chama getModulesForUnit(selectedUnit)
↓
AuthContext.getModulesForUnit():
  - super_admin: módulos com 'super_admin' em allowed_profiles
  - admin: SELECT * FROM unit_modules WHERE unit_id = ?
  - user: SELECT * FROM user_modules WHERE user_id IN (SELECT module_id FROM unit_modules WHERE unit_id = ?)
↓
Sidebar renderiza módulos filtrados
↓
Navega para primeiro módulo ativo (view_id ou webhook)
```

## Serviços TypeScript

### services/units/unitModules.service.ts (9 funções)
1. `fetchUnitModules(unitId)` - lista módulos de uma unidade
2. `assignModulesToUnit(unitId, moduleIds)` - atribui múltiplos (RPC)
3. `assignModuleToUnit(unitId, moduleId)` - atribui único
4. `removeModuleFromUnit(unitId, moduleId)` - remove único
5. `checkUnitModuleAccess(unitId, moduleId)` - verifica acesso (RPC)
6. `fetchUnitModulesSummary()` - estatísticas agregadas (VIEW)
7. `fetchUnitModuleAssignments()` - todas as atribuições
8. `updateUnitModules(unitId, moduleIds)` - delete all + insert batch
9. `fetchUnitModuleIds(unitId)` - retorna apenas IDs

### services/auth/users.service.ts
- `updateUserAssignments(userId, unitIds, moduleIds)`:
  * Delete-then-insert pattern para user_units e user_modules
  * Logging abrangente para debug (console.log em cada etapa)
  * Tratamento de conflitos com composite PKs

## Boas Práticas e Debugging

### Console Logs (Debug Mode)
- `[UserFormModal] Módulos carregados do usuário: [...]` - IDs carregados do banco
- `[UserFormModal] modulesByUnit inicializado: Map(...)` - distribuição por unidade
- `[handleModuleToggle] Toggling module: ...` - interação com checkboxes
- `[Render checkbox Dashboard] isChecked: true/false` - estado de renderização
- `[updateUserAssignments] user_modules inseridos com sucesso` - confirmação de salvamento

### Validações Importantes
1. Sempre usar `new Set()` ao atualizar estados com Sets (imutabilidade React)
2. Filtrar `null`/`undefined` em `.map()` antes de renderizar listas
3. Recarregar dados ANTES de fechar modais (evita tela branca)
4. Adicionar `selectedUnit` como dependência em callbacks que filtram por unidade
5. Usar `hasInitialized` flag para evitar dupla inicialização em AppContext

### Troubleshooting
- **Módulos não aparecem na Sidebar**: Verificar `unit_modules` no banco e `getModulesForUnit` no AuthContext
- **Checkboxes não marcam**: Verificar imutabilidade de Sets (`new Set(oldSet)`)
- **Tela branca ao salvar**: Garantir `await loadUsers()` antes de `handleCloseModal()`
- **Navegação errada ao mudar unidade**: Verificar lógica de `view_id` detection no AppContext

6) Ordem de Exibição
- Arraste na UI de “Gerenciar Módulos”; o serviço `updateModulesOrder` persistirá `position` como 1..n.

7) Boas práticas
- Tipos no `types.ts` sempre que expor novas estruturas de dados.
- Evite duplicar regras nos componentes — centralize em `services/*/*.service.ts`.
- Para gráficos reutilize `components/ui/MonthlyComparisonChart.tsx` quando fizer sentido.

## Progressive Web App (PWA)

O DromeFlow é uma PWA completa configurada via `vite-plugin-pwa`:

### Características
- ✅ **Instalável**: Pode ser instalado como app nativo (desktop/mobile)
- ✅ **Offline-capable**: Service Worker com cache estratégico
- ✅ **Auto-update**: Atualizações automáticas (registerType: 'autoUpdate')
- ✅ **Manifest completo**: Ícones 192x192 e 512x512, tema #010d32

### Estratégias de Cache (Workbox)
```
Google Fonts:     CacheFirst - 1 ano
Imagens:          CacheFirst - 30 dias
API Supabase:     NetworkFirst - 5min (timeout 10s)
Assets estáticos: Pré-cache automático
```

### Arquivos PWA
- `vite.config.ts` - Configuração VitePWA completa
- `/public/pwa-192x192.png` e `/public/pwa-512x512.png` - Ícones
- Service Worker gerado automaticamente no build

### ⚠️ Desenvolvimento
Em dev, Service Worker pode causar confusão com cache. Use DevTools → Application → Service Workers → Clear para limpar quando necessário.

## Build e Otimizações de Produção

### Code Splitting
```javascript
manualChunks: {
  'vendor-react': ['react', 'react-dom'],      // ~150KB gzipped
  'vendor-supabase': ['@supabase/supabase-js'] // ~80KB gzipped
}
```

### Compressão Dual
- **Brotli** (`.br`): ~20% melhor que gzip, suportado por navegadores modernos
- **Gzip** (`.gz`): Fallback para servidores/browsers antigos
- **Threshold**: 10KB (arquivos menores não são comprimidos)

### Terser Minification
```javascript
terserOptions: {
  compress: {
    drop_console: true,    // ⚠️ Remove TODOS console.log em produção
    drop_debugger: true
  }
}
```

### Configurações Build
- ❌ Source maps desabilitados (sourcemap: false)
- ❌ Report de tamanho comprimido desabilitado (build mais rápido)
- ⚡ Chunk size limit: 1000KB

### TypeScript - Path Alias
```typescript
// tsconfig.json: "@/*": ["./*"]
// Uso:
import { fetchUsers } from '@/services/auth/users.service';
import { DataRecord } from '@/types';
```

**Benefício**: Imports mais limpos, sem `../../../`

## Realtime - Troubleshooting Crítico

### ⚠️ Problema: Infinite Loading Spinner

**Sintoma**: Abrir modal → Editar → Salvar → Fechar → Spinner infinito

**Causa**: Dupla atualização (manual loadData() + subscription automática)

**Fix**:
```typescript
// ❌ ERRADO - Com Realtime ativo
const handleCloseModal = () => {
  setIsModalOpen(false);
  loadData(); // Duplicação!
};

// ✅ CORRETO
const handleCloseModal = () => {
  setIsModalOpen(false);
  // Realtime atualiza automaticamente via subscription
};
```

### Regra Geral
- **COM Realtime**: ❌ Nunca chamar `loadData()` após CRUD operations
- **SEM Realtime**: ✅ Manter `loadData()` após save/delete
- **Error handlers**: ✅ Sempre permitir reload manual em caso de erro

### Debugging Realtime
```typescript
// Verificar se subscription está ativa:
1. useRealtimeSubscription presente no componente?
2. Filter correto? (`unit_id=eq.${unitId}`)
3. Callback funciona? (adicionar console.log)
4. Realtime habilitado no Supabase? (Table Settings)
```

## Dependências e Limpeza Futura

### ⚠️ AWS SDK Não Usado
```json
"@aws-sdk/client-s3": "^3.932.0",
"@aws-sdk/s3-request-presigner": "^3.932.0"
```

**Status**: Instalado mas não usado (anteriormente para storage alternativo)

**Ação Fase 6**: Remover se não houver planos de uso AWS (~2MB a menos no bundle)

### Barrel Services (Temporário)
```
services/index.ts - Barrel export (será removido)
services/mockApi.ts - Compatibilidade (será removido)
```

**Nota**: Não remover até PR dedicado à Fase 6 atualizar todos os imports.

## Variáveis de Ambiente - Referência Completa

### .env.local (Estrutura Completa)
```bash
# === OBRIGATÓRIAS ===
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# === OPCIONAIS ===
# Data Drome (N8N Logs)
VITE_DATA_DROME_URL=https://logs.supabase.co
VITE_DATA_DROME_ANON_KEY=eyJ...

# Gemini AI (se usado)
GEMINI_API_KEY=AIza...
```

### Regras de Nomenclatura
- **Prefixo `VITE_`**: Exposto ao cliente (incluído no bundle JS)
- **Sem prefixo**: Apenas build-time, não exposto ao cliente

### ⚠️ Segurança
- ✅ `.env.local` está no `.gitignore`
- ❌ Nunca commitar chaves de API
- ⚠️ Variáveis com `VITE_` são públicas (visíveis no bundle)
- ✅ Usar Supabase RLS para proteção real de dados

## Padrões de Nomenclatura - Convenções do Projeto

### Arquivos
```
Pages:     DashboardMetricsPage.tsx
Modals:    UserFormModal.tsx
Services:  dashboard.service.ts
Utils:     dates.ts
Contexts:  AuthContext.tsx
```

### Funções e Variáveis
```typescript
// Funções: camelCase
function fetchDashboardMetrics() { }
const handleSaveUser = () => { };

// Tipos: PascalCase
interface DataRecord { }
type UserRole = 'admin' | 'user';

// Constantes: UPPER_SNAKE_CASE
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const DEFAULT_PAGE_SIZE = 25;

// React Components: PascalCase
const DashboardPage = () => { };
```

### Console Logs Padronizados
```typescript
// Formato: [ComponentName] Action: details
console.log('[UserFormModal] Módulos carregados:', moduleIds);
console.log('[AuthContext] Login successful:', profile);
console.log('[handleModuleToggle] Toggling module:', moduleId);
```

**⚠️ Produção**: Todos console.log são removidos automaticamente via terser (drop_console: true)

## Estatísticas do Projeto

### Contagem de Arquivos
```
Páginas (components/pages):      19 arquivos
Modais/UI (components/ui):       15 arquivos
Serviços (services):             26 arquivos
Scripts SQL (docs/sql):          39 arquivos
Documentação (docs/*.md):        12 arquivos
```

### Estrutura de Serviços (26 arquivos)
```
services/
├── supabaseClient.ts
├── auth/ (1 serviço)
├── units/ (4 serviços)
├── modules/ (1 serviço)
├── analytics/ (6 serviços)
├── data/ (2 serviços)
├── ingestion/ (1 serviço)
├── profissionais/ (1 serviço)
├── recrutadora/ (1 serviço)
├── comercial/ (1 serviço)
├── posVendas/ (2 serviços)
├── access/ (1 serviço)
├── content/ (1 serviço)
├── integration/ (1 serviço)
└── utils/ (1 serviço)
```

## Deploy - Checklist Essencial

### Pré-Deploy
```
✅ npm run build (sem erros)
✅ npm run preview (testar local)
✅ Variáveis de ambiente configuradas
✅ Supabase RLS policies revisadas
✅ Secrets não commitados
✅ CHANGELOG atualizado
```

### Build Output
```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js (+ .br + .gz)
│   ├── vendor-react-[hash].js
│   ├── vendor-supabase-[hash].js
│   └── index-[hash].css
└── workbox-[hash].js (Service Worker)
```

### Pós-Deploy
```
✅ Lighthouse audit (PWA, Performance > 90)
✅ Testar em múltiplos browsers
✅ Verificar Service Worker (DevTools)
✅ Console sem erros
✅ Realtime funcionando
✅ Upload XLSX testado
```

## Documentação Adicional

Para informações mais detalhadas, consulte:

- **ANALISE_ESTRUTURA_COMPLETA.md** - Análise abrangente da arquitetura
- **COMPLEMENTO_COPILOT_INSTRUCTIONS.md** - Detalhes técnicos avançados
- **README.md** - Setup e configuração geral
- **SYSTEM_OVERVIEW.md** - Visão geral do sistema
- **docs/CHANGELOG.md** - Histórico de mudanças
- **docs/REALTIME_STATUS.md** - Status e guias Realtime
- **docs/UNIT_BASED_ACCESS_CONTROL.md** - Sistema de permissões

---

**Última atualização das instruções complementares:** 2025-11-16
