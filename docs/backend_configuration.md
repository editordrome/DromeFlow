# Documentação da Estrutura de Backend (Supabase)

Esta documentação detalha a estrutura autal do banco de dados, incluindo tabelas, funções de segurança e políticas de acesso (RLS).

## 1. Visão Geral da Segurança

O sistema utiliza um modelo de segurança baseado em **Row Level Security (RLS)** robusto, combinando verificação de unidade (`unit_id`) com papéis de usuário (`roles`).

### Funções de Controle de Acesso
Funções personalizadas (`Stored Procedures`) são usadas para encapsular a lógica de permissão complexa:

- **`is_super_admin()`**
  - **Lógica:** Verifica se o usuário atual (`auth.uid()`) possui o papel `super_admin` na tabela `profiles`.
  - **Uso:** Permite contornar restrições de unidade para administradores globais.

- **`is_unit_member(_unit_id uuid)`**
  - **Lógica:** Retorna `TRUE` se:
    1. O usuário é `super_admin` OU `admin` (via tabela `profiles`).
    2. OU o usuário está explicitamente vinculado à unidade na tabela `user_units`.
  - **Uso:** Principal barreira de segurança para tabelas particionadas por unidade (ex: `financial_categories`).

## 2. Tabelas Principais

### Financeiro
#### `financial_categories`
Armazena a árvore de categorias financeiras (Receitas/Despesas).
- **Colunas:**
  - `id` (uuid, PK)
  - `unit_id` (uuid, FK -> `units.id`): Unidade dona da categoria.
  - `parent_id` (uuid, FK -> `financial_categories.id`): Auto-relacionamento para hierarquia.
  - `name` (text): Nome da categoria.
  - `type` (text): 'receita' ou 'despesa'.
  - `classification` (text): Classificação contábil (ex: 'Custo Fixo').
  - `is_operational` (bool): Define se conta para o resultado operacional.
  - `show_in_dre` (bool): Visibilidade em relatórios.
  - `active` (bool): Status de uso.
- **Políticas RLS:**
  - `Enable select/insert/update/delete for all users`: Políticas permissivas ("públicas") para alinhar com `payment_records` e facilitar o uso no módulo financeiro.

#### `payment_records`
Registros de pagamentos e transações.
- **Políticas RLS:**
  - Possui políticas abertas para `UPDATE` e `SELECT` publicamente (Nota: Recomenda-se revisar para restringir por unidade futuramente).

#### `invoices`
Faturas geradas.
- **Relacionamentos:** Clientes (`unit_clients`), Unidades (`units`), Pagamentos (`payment_records`).

### Gestão de Unidades e Usuários
#### `profiles`
Perfil estendido do usuário autenticado.
- **Colunas Importantes:** `email`, `role` (user, admin, super_admin).
- **Segurança:** Políticas permitem leitura/alteração própria e modificação por Super Admins.

#### `units`
Cadastro das unidades/franquias.

#### `user_units`
Tabela de ligação N:N entre Usuários e Unidades.
- **Função:** Determina a quais unidades um usuário "comum" tem acesso explícito.

#### `unit_modules` e `user_modules`
Controlam quais módulos (features) estão habilitados para uma unidade ou usuário específico.

### Operacional - Clientes e Profissionais
#### `processed_data`
Tabela volumosa para dados brutos/processados (provavelmente de importações ou logs).
- **Dados:** Cliente, Profissional, Valor, Serviço, etc.

#### `profissionais`
Cadastro de prestadores de serviço.
- **RLS:** Leitura pública/autenticada, mas escrita restrita a autenticados.

#### `unit_clients`
Carteira de clientes por unidade.

## 3. Configurações Especiais e Utilitários

### Extensões Ativas
- **`pg_trgm`:** Habilitada para busca textual eficiente (fuzzy search), utilizada em funções de similaridade.

### Webhooks e Integrações
- **Tabela `modules`:** Armazena configurações globais de módulos, incluindo `webhook_url` para o módulo financeiro (usado para disparar cobranças).

## 4. Auditoria
#### `activity_logs` e `actions`
Tabelas destinadas ao registro de atividades e ações dos usuários no sistema.
- **RLS:** Escrita permitida para usuários autenticados.

---
**Nota Técnica:** A estrutura está evoluindo para um modelo "Multi-tenant" seguro via RLS. A recente atualização na função `is_unit_member` foi crítica para permitir que Admins gerenciem dados de unidades sem precisarem de vínculos redundantes na tabela `user_units`.
