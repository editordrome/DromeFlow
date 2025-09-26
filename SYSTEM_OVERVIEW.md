# Visão Geral do Sistema e Mapa de Configuração

Este documento descreve a arquitetura e a configuração atual da aplicação DromeFlow, servindo como um mapa para entender como os diferentes componentes se interconectam.

## 1. Estrutura de Arquivos Principal

A aplicação está organizada da seguinte forma:

- **`/index.html`**: Ponto de entrada da aplicação. Configura o `importmap` para as bibliotecas (React, Supabase, SheetJS) e o Tailwind CSS.
- **`/index.tsx`**: Monta a aplicação React no elemento `#root` do HTML.
- **`/App.tsx`**: Componente raiz que gerencia o fluxo de autenticação, decidindo se renderiza a `LoginPage` ou a `DashboardPage`.
- **`/types.ts`**: Arquivo central que define todas as interfaces e tipos de dados TypeScript usados na aplicação (User, Unit, Module, DataRecord, etc.).
- **`/contexts/`**: Contém os provedores de contexto do React para gerenciamento de estado global.
  - `AuthContext.tsx`: Gerencia o estado de autenticação do usuário (login, logout, sessão).
  - `AppContext.tsx`: Gerencia o estado da interface, como a unidade selecionada e a visualização ativa.
- **`/services/`**: Camada de comunicação com o backend.
  - `supabaseClient.ts`: Configura e exporta o cliente Supabase, conectando a aplicação ao banco de dados.
  - `mockApi.ts`: (Nome legado) Centraliza todas as chamadas ao Supabase. Contém funções para buscar e modificar dados em todas as tabelas e para chamar as funções de banco de dados (RPCs).
- **`/components/`**: Onde residem todos os componentes React.
  - `/layout/`: Componentes estruturais como `Sidebar` e `ContentArea`.
  - `/pages/`: Componentes que representam as telas principais de cada módulo (Dashboard, Dados, Gerenciamento de Usuários, etc.).
  - `/ui/`: Componentes de interface reutilizáveis (Ícones, Modais, etc.).

## 2. Fluxo de Autenticação e Sessão

1.  **Login**: O usuário insere e-mail e senha na `LoginPage`.
2.  **Verificação**: A função `login` do `AuthContext` realiza uma consulta direta na tabela `profiles` do Supabase para encontrar um usuário com o e-mail e a senha fornecidos. **Este é um fluxo de autenticação personalizado e não utiliza o `supabase.auth`**.
3.  **Sessão**: Se as credenciais forem válidas, o `AuthContext` armazena os dados do perfil do usuário no estado do React e em `sessionStorage` para persistir a sessão no navegador.
4.  **Gerenciamento**: O `App.tsx` verifica a existência do usuário no `AuthContext` para decidir se renderiza a `DashboardPage` ou a `LoginPage`.
5.  **Persistência**: A sessão é mantida através do `sessionStorage` do navegador, permitindo que o usuário permaneça logado ao recarregar a página.

## 3. Papéis de Usuário e Controle de Acesso

O sistema possui três papéis definidos na tabela `profiles`:

1.  **`super_admin`**:
    -   **Interface**: Vê uma `Sidebar` administrativa com links de gestão (Usuários, Módulos, Unidades, Credenciais) e apenas módulos cujo `allowed_profiles` contenha explicitamente `super_admin` (não herda módulos públicos automaticamente).
    -   **Acesso**: Permissões amplas (MVP), porém exibidos somente módulos explicitamente autorizados — prepara terreno para RLS mais estrito.
2.  **`admin` / `user`**:
    -   **Interface**: Vêem uma `Sidebar` dinâmica com um seletor de unidades e uma lista de módulos aos quais têm permissão. Os módulos visíveis são filtrados com base no campo `allowed_profiles` da tabela `modules`.
    -   **Acesso**: O acesso aos dados é rigorosamente controlado por Políticas de Segurança (RLS) no Supabase. Eles só podem ver e interagir com os dados das unidades (`user_units`) e módulos (`user_modules`) que lhes foram explicitamente atribuídos.

## 4. Interação com o Banco de Dados (Supabase)

Toda a comunicação com o backend é centralizada no arquivo `services/mockApi.ts`.

### Leitura de Dados (Queries Simples)

-   Para buscar listas de dados (ex: `fetchAllUnits`, `fetchAllModules`, `fetchDataTable`), a aplicação usa consultas diretas do Supabase:
    ```javascript
    supabase.from('nome_da_tabela').select('*');
    ```

### Operações Complexas e Seguras (Funções de Banco de Dados - RPCs)

Para operações que exigem cálculos complexos ou permissões elevadas, a aplicação chama Funções de Banco de Dados (RPCs). Isso move a lógica para o servidor, tornando-a mais segura e eficiente.

-   **`get_user_units(p_user_id)`**: Busca as unidades de um usuário.
-   **`get_user_modules(p_user_id)`**: Busca os módulos de um usuário.
-   **`get_dashboard_metrics(p_unit_code, p_start_date, p_end_date)`**: Calcula as métricas principais do dashboard (receita, atendimentos, etc.) no servidor.
-   **`process_xlsx_upload(unit_code_arg, records_arg)`**: Processa o upload de arquivos XLSX, realizando uma operação de "upsert" (insere ou atualiza) para evitar duplicatas.
-   **`delete_app_user(user_id_to_delete)`**: Função segura (`SECURITY DEFINER`) para que o Super Admin possa deletar usuários.

## 5. Módulos Principais e Configuração

--   **Dashboard**:
    -   **Fonte de Dados**: Tabela `processed_data`.
    -   **Lógica**: A função `fetchDashboardMetrics` em `mockApi.ts` recalcula localmente serviços, receita, ticket, repasse e clientes usando somente orçamentos base (originais) para evitar duplicidades de derivados. Repasse soma originais + derivados.
-   **Dados**:
    -   **Fonte de Dados**: Tabela `processed_data`.
    --   **Upload (XLSX)**:
        1.  `UploadModal.tsx` lê arquivo com SheetJS.
        2.  `uploadXlsxData` executa: expansão multi-profissional (sufixos `_N`), divisão de repasse (`processRepasseValues`), normalização de horários/datas, limpeza seletiva (`removeObsoleteRecords`) usando orçamento base (`IS_DIVISAO = 'NAO'`).
        3.  Envio em lotes (500) para RPC `process_xlsx_upload`.
-   **Módulos de Administração**:
    -   **Usuários, Módulos, Unidades**: São interfaces de CRUD (Criar, Ler, Atualizar, Deletar) que interagem diretamente com as tabelas correspondentes no Supabase (`profiles`, `modules`, `units`).
    -   **Permissões**: A atribuição de unidades e módulos a um usuário no modal de "Editar Usuário" atualiza as tabelas de junção `user_units` e `user_modules`.
   -   **Ícones e Visibilidade de Módulos**: A tela de "Gerenciar Módulos" permite definir um ícone (da biblioteca `lucide-react`) e para quais perfis (`super_admin`, `admin`, `user`) o módulo será visível.

-   **Clientes**:
  -   **Fonte de Dados**: Somente `processed_data`.
  -   **Período**: Seleção `YYYY-MM` (mesma UI do Dashboard); a lista exibe apenas clientes com atendimento em `M`.
  -   **Lógica Alinhada ao Dashboard**:
    - Recorrentes = interseção de clientes entre `M` e `M-1` via duas consultas discretas.
    - Atenção (churn) = clientes em `M-1` que não retornaram em `M`.
    - Outros (novos) = clientes em `M` que não estavam em `M-1`.
  -   **Detalhes de Implementação**:
    - Serviço `fetchClientMetricsFromProcessed` retorna `{ total, recorrente, atencao, outros, churnRatePercent }`.
    - Serviço `fetchClients` retorna lista de `M` e, para Atenção, metadados com `tipo`, `lastAttendance` e `monthlyCounts` (para `M`, `M-1`, `M-2`).
  -   **UI**:
    - Cartão Atenção mostra quantidade; ao clicar, filtra tabela para não-retornos.
    - Tabela em Atenção exibe colunas de `M`, `M-1`, `M-2` (ordem invertida) com cabeçalhos `Abrev/AAAA`.
    - Paginação de 25 itens por página, reset em mudanças de período/filtros.

## 6. Sincronização entre `auth.users` e `profiles`

Para viabilizar rapidamente o MVP com autenticação customizada (consulta direta à tabela `profiles`) e, ao mesmo tempo, preparar o terreno para futura migração para o Supabase Auth completo, foram adotadas as seguintes decisões temporárias:

### 6.1 Remoção da Foreign Key

A constraint `profiles_id_fkey` (`FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE`) foi removida para permitir inserções diretas em `profiles` sem precisar criar previamente um registro em `auth.users`.

Risco assumido: perda de integridade referencial rígida enquanto o fluxo híbrido existir.

### 6.2 Trigger de Espelhamento

Foi criada a função `public.handle_new_auth_user()` (`SECURITY DEFINER`) e o trigger:

```
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
```

Comportamento da função:
- Se já existir `profiles.id = NEW.id`, não faz nada (idempotente).
- Cria novo registro em `profiles` preenchendo:
  - `id = NEW.id`
  - `email = NEW.email`
  - `full_name = raw_user_meta_data->>'full_name'` ou prefixo do e‑mail
  - `role = raw_user_meta_data->>'role'` ou `'user'` como default
  - `created_at = now()`

### 6.3 Fluxos Atuais de Criação de Usuário

1. Via App (CRUD atual):
    - Insere diretamente em `profiles` (gera novo UUID caso não exista).
    - Atribui unidades e módulos (`user_units`, `user_modules`).
2. Via Supabase Auth (futuro / manual):
    - Ao inserir em `auth.users`, o trigger cria automaticamente o `profile` equivalente.

### 6.4 Ajuste em `createUser`

A função `createUser` em `mockApi.ts` agora:
1. Verifica se já existe `profiles.email`.
2. Se existir: atualiza campos básicos (nome, role, senha se fornecida) e reaplica atribuições.
3. Se não existir: cria novo profile.
4. Evita duplicidades (preparatório para cenário onde `auth.users` possa ter sido criado antes).

### 6.5 Próximos Passos Recomendados (Futuros)

- Adicionar trigger `AFTER UPDATE` em `auth.users` para refletir mudança de e‑mail/metadados em `profiles`.
- Reintroduzir integridade (FK) somente quando todo fluxo de criação passar por `auth.users`.
- Migrar senha para hash seguro (ex: bcrypt) e remover armazenamento em texto plano.
- Implementar fluxo de provisionamento: criar usuário com `supabase.auth.admin.createUser`, deixando trigger cuidar de `profiles`.

### 6.6 Considerações de Segurança

Enquanto as policies estão permissivas (anon CRUD), qualquer cliente com a chave pública pode alterar dados. Isso é aceitável para o MVP isolado, porém deve ser revisado antes de produção.

---
## 7. Atualizações Recentes (Changelog Técnico)

| Área | Alteração | Detalhes |
|------|-----------|----------|
| Ordenação de Módulos | Drag & Drop persistente | `@hello-pangea/dnd` + `updateModulesOrder` reatribui `position` denso (1..n). |
| Mescla de Módulos | Consolidação no `AuthContext` | União de módulos atribuídos (`user_modules`) + permitidos (`allowed_profiles`) sem duplicação. |
| Sidebar | Estado colapsado padrão | Inicia recolhida (`isCollapsed = true`) e footer adaptado (avatar + logout). |
| Upload XLSX | Chave lógica alterada | Limpeza e sincronização agora usam `orcamento` base em vez de `ATENDIMENTO_ID`. |
| Expansão Multi-profissional | Aprimorada | Sufixos `_N` + controle via `IS_DIVISAO`. Registro original mantém `VALOR`; derivados recebem `VALOR = 0`. |
| Repasse | Recalculo consistente | Dashboard e gráficos usam soma de todos os registros (originais + derivados). |
| Métricas Dashboard | Reimplementadas localmente | Reconta orçamentos originais únicos, repasse soma todos registros. |
| Clientes x Dashboard | Paridade de recorrentes/churn | Recorrentes pela interseção entre `M` e `M-1`; churn como `M-1` menos `M`; chaves de cliente brutas. |
| Clientes – Atenção | Tabela com série de 3 meses | Colunas `M`, `M-1`, `M-2` com cabeçalhos `Abrev/AAAA` e metadados `tipo`/`lastAttendance`. |
| Segurança (Provisório) | Policies permissivas | Backend aceita operações amplas (MVP) – reforço planejado. |
| Edição de Usuário | Módulos fora de escopo | Exibidos como somente leitura quando pertencem ao usuário mas não ao admin atual. |
| Limpeza de Dados | Remoção seletiva | `removeObsoleteRecords` identifica orçamentos base ausentes (originais) e remove derivados correlatos. |
| Webhook Agendamentos | POST + Fallback GET | Envia JSON completo (inclui `endereco`); se falha rede/CORS, usa GET chunkado até 3000 chars com payload compactado. |

---
## 8. Convenções Atuais de Dados

| Conceito | Regra |
|----------|------|
| Orçamento Base | Registro sem sufixo, `IS_DIVISAO = 'NAO'`. |
| Derivado (Divisão) | `orcamento` com sufixo `_N`, `IS_DIVISAO = 'SIM'`. |
| Repasse Derivado | Distribuído por valor individual ou divisão igual. |
| Contagem de Serviços | Número de orçamentos base únicos no período. |
| Ticket Médio | Receita (somente originais) / Serviços. |
| Endereço (Agendamentos) | Incluído em payload webhook (`endereco` / chave compacta `e`). |
| Webhook Fallback | GET com `payload` JSON compactado + chunking adaptativo. |
| Módulo Ativo | `is_active = true` (filtro final no Sidebar). |
| Módulo Público | `allowed_profiles` null/vazio (incluído para todos não-super admins). |

---
## 9. Melhorias Futuras Planejadas

1. Hash de senhas (bcrypt) + migração para `auth.users` integral.
2. RPC batch para reordenar módulos (reduzir múltiplas round-trips).
3. Reforço de RLS: políticas por unidade/módulo com base em joins.
4. Índices: `(unidade_code, DATA, IS_DIVISAO)` e `(unidade_code, orcamento)`.
5. Cache de métricas agregadas mensais (materialized view ou tabela incremental).
6. Logging estruturado para upload (tabela de auditoria).

---
## 10. Notas para Colaboradores / Agentes

Ao adicionar nova feature:
- Centralizar interação com Supabase em `mockApi.ts`.
- Reusar convenções de expansão de profissionais (não duplicar lógica em componentes).
- Manter ordenação de módulos consistente (sempre atualizar `position`).
- Evitar dependência residual em `ATENDIMENTO_ID` (legado). Priorizar `orcamento` e flags existentes.

---
_Documento ampliado para refletir estado operacional atualizado (21/09/2025)._ 
