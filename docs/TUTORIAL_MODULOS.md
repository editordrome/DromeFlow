# 📘 Tutorial Explicativo — Módulos do DromeFlow

> **Versão:** 1.2.0 — Março 2026  
> **Público-alvo:** Usuários administrativos, gestores de unidade e equipe de suporte

---

## Índice

1. [Como o Sistema Funciona](#1-como-o-sistema-funciona)
2. [Acesso e Perfis de Usuário](#2-acesso-e-perfis-de-usuário)
3. [Navegação e Seleção de Unidade](#3-navegação-e-seleção-de-unidade)
4. [Dashboard — Painel de Métricas](#4-dashboard--painel-de-métricas)
5. [Dados — Importação e Gestão](#5-dados--importação-e-gestão)
6. [Agenda — Gestão de Disponibilidade](#6-agenda--gestão-de-disponibilidade)
7. [Agendamentos — Visualização do Dia](#7-agendamentos--visualização-do-dia)
8. [Clientes — Análise de Base](#8-clientes--análise-de-base)
9. [Base de Clientes](#9-base-de-clientes)
10. [Comercial — CRM de Leads](#10-comercial--crm-de-leads)
11. [Pós-Vendas — Acompanhamento](#11-pós-vendas--acompanhamento)
12. [Recrutadora — Kanban de Seleção](#12-recrutadora--kanban-de-seleção)
13. [Profissionais — Cadastro e Gestão](#13-profissionais--cadastro-e-gestão)
14. [Prestadoras — Painel Analítico](#14-prestadoras--painel-analítico)
15. [Financeiro](#15-financeiro)
16. [Umbler — Integração WhatsApp](#16-umbler--integração-whatsapp)
17. [Typebot — Automação de Bot](#17-typebot--automação-de-bot)
18. [Tutoriais — Central de Ajuda](#18-tutoriais--central-de-ajuda)
19. [Fidelidade](#19-fidelidade)
20. [Configurações](#20-configurações)
21. [Módulos Administrativos (Super Admin)](#21-módulos-administrativos-super-admin)
22. [Comportamento Multi-Unidade (ALL)](#22-comportamento-multi-unidade-all)
23. [Glossário Técnico](#glossário-técnico)

---

## 1. Como o Sistema Funciona

O DromeFlow é uma plataforma web de gestão operacional construída em **React + TypeScript**, com banco de dados **Supabase (PostgreSQL)**. Toda a lógica de negócio fica na camada de serviços (`services/`), e o banco de dados usa **RLS (Row Level Security)** e **RPCs** para garantir segurança e performance.

### Fluxo de inicialização

```
Usuário acessa a URL
   ↓
App.tsx detecta se é rota pública (agenda, onboarding, cadastro)
   ↓  (senão)
AuthContext verifica sessão salva no localStorage
   ↓  (com usuário ativo)
AppContext restaura a unidade e o módulo da última sessão
   ↓
DashboardPage monta: Sidebar + ContentArea
   ↓
ContentArea renderiza o módulo ativo (lazy loaded)
```

### Tecnologias principais

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Tailwind CSS |
| Banco de dados | Supabase (PostgreSQL) com RLS |
| Gráficos | Recharts |
| Animações | Framer Motion |
| Upload de planilhas | SheetJS (XLSX) |
| PWA | Vite PWA Plugin + Service Worker |

---

## 2. Acesso e Perfis de Usuário

O sistema possui **3 perfis** com permissões distintas:

### `super_admin`
- Acessa **todos os módulos** marcados como `super_admin` no campo `allowed_profiles`
- Vê **todas as unidades** ativas do sistema
- Pode impersonar a visão de uma unidade específica para ver o que o `admin` vê
- Acesso aos módulos de gestão: Usuários, Módulos, Unidades, Planos, Versões

### `admin`
- Acessa **todos os módulos atribuídos à unidade** (`unit_modules`)
- Não precisa ter atribuição individual — herda tudo da unidade
- Gerencia operações do dia a dia da sua unidade

### `user`
- Acessa apenas a **interseção** entre módulos da unidade (`unit_modules`) E módulos atribuídos individualmente ao perfil (`user_modules`)
- Acesso mais restrito, ideal para colaboradores com função específica

> **Nota:** O login é feito por consulta direta à tabela `profiles` (e-mail + senha). A migração para `supabase.auth` com hash bcrypt está planejada como melhoria futura.

---

## 3. Navegação e Seleção de Unidade

### Sidebar
A barra lateral esquerda é o ponto central de navegação. Ela:
- Exibe o **seletor de unidade** no topo (para `admin`/`user`)
- Lista os **módulos disponíveis** para a unidade selecionada
- Inicia **recolhida** por padrão (hover para expandir)
- Registra acesso a módulos automaticamente via `activityLogger`

### Seleção de Unidade
O sistema suporta **"Todos" (ALL)** — uma visualização agregada de todas as unidades do usuário. Ao selecionar ALL, os módulos que suportam essa visão (Dashboard, Dados, Agendamentos) agregam os dados de todas as unidades.

A unidade selecionada é **persistida no localStorage** e restaurada automaticamente no próximo acesso. A URL também é atualizada com o slug da unidade (ex: `unidade-sp.dromeflow.com`).

---

## 4. Dashboard — Painel de Métricas

**View ID:** `dashboard`  
**Arquivo:** `DashboardMetricsPage.tsx`  
**Fonte de dados:** Tabela `processed_data` via RPC `get_dashboard_metrics`

### O que é
O painel principal de métricas operacionais da unidade. Mostra o desempenho financeiro e de atendimentos do período selecionado.

### Métricas principais (cards superiores)

| Métrica | Descrição |
|---|---|
| **Faturamento** | Soma da receita de todos os atendimentos originais do período |
| **Atendimentos** | Contagem de ATENDIMENTO_IDs únicos (sem registros derivados `_N`) |
| **Clientes** | Número de clientes únicos no período |
| **Repasse** | Soma do repasse de todos os registros (originais + derivados) |

> Cada card é **clicável** — ao clicar, o gráfico anual abaixo muda para exibir submétricas específicas daquela categoria.

### Submétricas por categoria

**Faturamento:**
- Média por Atendimento (Ticket Médio)
- Margem operacional
- Margem por atendimento

**Atendimentos:**
- Início do Mês (agendados antes do dia 1 do período)
- Evolução no mês (agendados durante o período)
- Média por Dia Produtivo

**Clientes:**
- Recorrentes (clientes que também estiveram no mês anterior)
- Atendimentos por Cliente
- Churn (clientes que não retornaram em relação ao mês anterior)

**Repasse:**
- Média por Atendimento
- Média Semanal
- Média por Profissional

### Gráfico anual
- Exibe os dados mês a mês para o ano do período selecionado
- Pode alternar entre **Ano atual** ou **Últimos 12 meses**
- Muda de tipo (Linha / Barra) conforme a submétrica ativa

### Análise de Serviços
Painel expansível com:
- **Cards por dia da semana:** percentual e média de atendimentos por dia
- **Gráfico de evolução diária:** atendimentos de clientes novos vs. clientes antigos por dia do mês
- **Análise por Período:** distribuição dos atendimentos por turno (manhã, tarde, etc.)

### Análise de Clientes
- Distribuição entre Recorrentes, Novos e Churn
- Ranking de profissionais por repasse

### Filtro de Período
Dropdown com seleção de **mês/ano**. Os anos disponíveis são buscados diretamente dos dados reais da unidade.

### Realtime
O Dashboard possui integração com Supabase Realtime — quando um novo registro é inserido em `processed_data`, os dados são atualizados automaticamente sem reload de página.

### Comportamento Multi-Unidade (ALL)
Quando a unidade "Todos" é selecionada:
- Receita, atendimentos e repasse são **somados** entre unidades
- Clientes são **unificados** (sem duplicação por franquia)
- Ticket médio é **recalculado** sobre os totais agregados

---

## 5. Dados — Importação e Gestão

**View ID:** `data`  
**Arquivo:** `DataPage.tsx`  
**Fonte de dados:** Tabela `processed_data`

### O que é
Módulo de visualização e importação dos atendimentos. É a **fonte primária de dados** do sistema — tudo que aparece no Dashboard e nos outros módulos vem desta tabela.

### Visualização
- Tabela paginada com todos os registros da unidade no período selecionado
- Busca e filtros por nome de cliente, profissional, status, etc.
- Duplo clique em uma linha abre o `DataDetailModal` com todos os campos do atendimento
- Exportação para XLSX disponível

### Upload de Planilha (XLSX)
O botão "Importar" abre o `UploadModal`. O processo de upload é:

1. **Leitura do arquivo** com SheetJS
2. **Expansão multi-profissional:** se um atendimento tem múltiplos profissionais, são criados registros derivados com sufixos `_1`, `_2`, etc. no `ATENDIMENTO_ID`
3. **Processamento de repasse:** distribui os valores de repasse entre os registros derivados
4. **Normalização:** padroniza formatos de data e horário
5. **Aplicação de STATUS automático:** registros com turno "tarde" em dias onde todos os atendimentos são desta profissional recebem `STATUS = "esperar"`
6. **Envio em lotes** de 500 registros para a RPC `process_xlsx_upload`
7. **Limpeza seletiva:** remove registros obsoletos cujo `ATENDIMENTO_ID` base não existe mais no arquivo

### Regra de unicidade
A chave lógica é **`(unidade_code, ATENDIMENTO_ID)`**. Ao reimportar:
- Registros **existentes** são atualizados (STATUS preservado se o profissional não mudou)
- Registros **novos** são inseridos
- Registros **ausentes** no novo arquivo são removidos (dentro do período da planilha)

> ⚠️ **Módulo protegido:** Os arquivos `UploadModal.tsx` e `upload.service.ts` não devem ser editados sem solicitação explícita — são críticos para a integridade dos dados.

---

## 6. Agenda — Gestão de Disponibilidade

**View ID:** `agenda`  
**Arquivo:** `AgendaPage.tsx`  
**Fonte de dados:** `processed_data`, `agenda_settings`, `agenda_disponibilidade`

### O que é
Módulo de gestão operacional da agenda de profissionais. Permite que administradores visualizem a disponibilidade da equipe e organizem os atendimentos do dia via **drag & drop**.

### Layout de 3 colunas

| Coluna | Conteúdo |
|---|---|
| **Esquerda (50%)** | Calendário de navegação + Quadro de Métricas Semanais |
| **Centro (25%)** | Profissionais Livres (disponíveis para arrastar) |
| **Direita (25%)** | Atendimentos do Dia (recebe os profissionais) |

### Aba Agenda Principal
- Navega pelo calendário para selecionar o dia
- O quadro de métricas semanais exibe contagens de profissionais disponíveis por dia
- **Drag & Drop:** arraste uma profissional da coluna "Livres" para um atendimento na coluna "Atendimentos" para fazer a atribuição
- Regra de compatibilidade: profissionais com disponibilidade de 6h ou 4h **não podem** ser atribuídas a atendimentos de 8h
- O filtro "Turno Vencido" remove automaticamente profissionais do turno manhã após as 13h

### Aba Gestão
- Exibe a tabela de disponibilidade: profissionais que confirmaram (SIM/NÃO) para cada dia
- Conflitos (profissional marcou NÃO mas tem atendimento) são destacados com "ATENÇÃO!"
- Clique em "ATENÇÃO!" abre modal com detalhes do conflito

### Aba Configurações
- O administrador seleciona quais datas (do mês atual) estão abertas para que as profissionais informem disponibilidade
- Ao salvar, o sistema **inativa versões anteriores** e cria um novo registro (versionamento automático)
- A tabela "Últimos Envios" é imutável: exibe as respostas originais das profissionais sem permitir edição

### App Profissional (Público)
Acessível via subdomínio `agenda.` ou rota `/p/agenda/`. Interface mobile simplificada onde a profissional:

1. Informa seu WhatsApp para autenticação (resiliente a DDI e máscaras)
2. Vê os dias disponíveis configurados pelo admin
3. Marca SIM/NÃO para cada dia e envia
4. O app limpa cache e service workers após envio (cache-busting automático)

---

## 7. Agendamentos — Visualização do Dia

**View ID:** `appointments`  
**Arquivo:** `AppointmentsPage.tsx`  
**Fonte de dados:** Tabela `processed_data` filtrada por data e unidade

### O que é
Lista de todos os atendimentos de um dia específico. Foco na operação diária.

### Funcionalidades
- Seleção de data via calendário
- Lista todos os atendimentos com status, cliente, profissional, horário e endereço
- **Realtime:** novos atendimentos aparecem automaticamente (INSERT/UPDATE/DELETE monitorados via Supabase Realtime)
- **Webhook:** disparo manual para integração com automações externas (desabilitado em modo ALL)

---

## 8. Clientes — Análise de Base

**View ID:** `clients`  
**Arquivo:** `ClientsPage.tsx`  
**Fonte de dados:** Tabela `processed_data`

### O que é
Análise de comportamento da base de clientes no período selecionado com foco em recorrência e churn.

### Métricas (cards)

| Card | Definição |
|---|---|
| **Total** | Clientes com pelo menos 1 atendimento no período M |
| **Recorrentes** | Interseção de clientes entre M e M-1 |
| **Novos** | Clientes em M que **não** estavam em M-1 |
| **Atenção (Churn)** | Clientes de M-1 que **não** retornaram em M |

### Tabela de Clientes
- Colunas: Nome, Último Atendimento, Tipo, contagem dos meses M, M-1, M-2
- Clique no card "Atenção" filtra a tabela para mostrar apenas os clientes em risco de churn
- Duplo clique em uma linha abre `ClientDetailModal` com:
  - Aba Dados: informações do cliente
  - Aba Atendimentos: histórico filtrado por período
  - A partir do histórico, duplo clique abre `DataDetailModal` do atendimento

---

## 9. Base de Clientes

**View ID:** `clients_base`  
**Arquivo:** `ClientsBasePage.tsx`  
**Fonte de dados:** Tabela `processed_data`

### O que é
Diretório geral de clientes — lista **todos os clientes** que já tiveram atendimento, independente do período. Útil para consulta histórica.

### Diferença em relação ao módulo Clientes

| Clientes | Base de Clientes |
|---|---|
| Filtrado por período M | Visão histórica completa |
| Análise de recorrência e churn | Diretório de busca |
| Métricas de comportamento | Coluna "Último Atendimento" |

---

## 10. Comercial — CRM de Leads

**View ID:** `comercial`  
**Arquivo:** `ComercialPage.tsx`  
**Fonte de dados:** Tabelas `comercial` e `comercial_columns`

### O que é
CRM em formato **Kanban** para gestão de oportunidades comerciais. Cada coluna representa uma etapa do funil.

### Colunas padrão
`Leads` → `Andamento` → `Ganhos` → `Perdidos` → `Aguardando`

### Funcionalidades
- **Drag & Drop:** mova cards entre colunas para atualizar o status
- A ordenação dentro da coluna é persistida sem refresh de página
- Badge de contagem por coluna no cabeçalho
- Stripe lateral colorido em cada card (identifica a coluna visualmente)
- Duplo clique em um card abre o modal de detalhes com edição completa

### Comportamento "Ganhos"
Quando um lead vai para "Ganhos", um trigger automático no banco espelha os dados em `unit_clients`, mantendo o cadastro de clientes atualizado com `endereço` e `contato`.

---

## 11. Pós-Vendas — Acompanhamento

**View ID:** `pos_vendas`  
**Arquivo:** `PosVendasPage.tsx`  
**Fonte de dados:** Tabela `pos_vendas` (sincronizada com `processed_data`)

### O que é
Módulo de acompanhamento pós-atendimento. Permite registrar o resultado do contato com o cliente após o serviço.

### Como os dados chegam
A cada INSERT em `processed_data`, um **trigger automático** cria o registro espelho em `pos_vendas` com:
- `status = 'pendente'`
- `reagendou = false`

Quando o status em `pos_vendas` é atualizado, um segundo trigger reflete a mudança de volta no campo `"pos vendas"` em `processed_data`.

### Funcionalidades
- Cards filtráveis por status (Pendente, Contatado, Reagendou, etc.)
- Tabela paginada com todos os registros
- Formulário de registro de contato (`PosVendaFormModal`)
- Webhook opcional para integração com automações externas
- Métricas de avaliação de atendimento

---

## 12. Recrutadora — Kanban de Seleção

**View ID:** `recrutadora`  
**Arquivo:** `RecrutadoraPage.tsx`  
**Fonte de dados:** Tabela `recrutadora`

### O que é
Kanban para gestão do processo de recrutamento e seleção de profissionais.

### Colunas (template global imutável)
`Qualificadas` → `Contato` → `Envio Doc` → `Truora` → `Treinamento` → `Finalizado` → `Não Aprovadas` → `Desistentes`

### Funcionalidades
- **Drag & Drop** dentro da mesma unidade
- Cards por unidade — cada unidade mantém seus próprios cards
- Métricas rápidas no cabeçalho: chips com contagem de Hoje / Semana / Mês (por `created_at`)

### Visualização "Todos" (ALL)
- A coluna "Qualificadas" é duplicada por unidade (cada unidade tem sua fila)
- As demais colunas **agregam cards de todas as unidades**
- O Drag & Drop continua restrito por unidade

---

## 13. Profissionais — Cadastro e Gestão

**View ID:** `profissionais`  
**Arquivo:** `ProfissionaisPage.tsx`  
**Fonte de dados:** Tabela `profissionais`

### O que é
CRUD completo da base de profissionais prestadoras de serviço.

### Funcionalidades
- **Listagem** paginada (25 itens/página) com busca por nome ou WhatsApp
- **Filtros por status:** abas Todas / Ativas / Inativas com contadores dinâmicos
- **Toggle de status:** switch para ativar/inativar diretamente na lista (sem abrir modal)
- **Novo Cadastro:** botão abre modal de criação
- **Edição:** duplo clique na linha abre `ProfissionalDetailModal` com 3 abas:

| Aba | Conteúdo |
|---|---|
| **Início** | Dados principais: nome, WhatsApp, tipo, habilidade, preferência |
| **Dados** | Informações pessoais: RG, CPF, nascimento, estado civil, filhos, fumante, endereço |
| **Histórico** | Últimos atendimentos filtráveis por período + métricas de pós-venda (avaliação 0-5 estrelas) |

---

## 14. Prestadoras — Painel Analítico

**View ID:** `prestadoras`  
**Arquivo:** `PrestadorasPage.tsx`  
**Fonte de dados:** `profissionais`, `recrutadora`, `processed_data`

### O que é
Dashboard analítico que cruza dados de Profissionais e Recrutadora para dar uma visão gerencial da força de trabalho.

### Cards de resumo

| Card | Dado |
|---|---|
| **Profissionais** | Total de profissionais ativas |
| **Recrutadora** | Total de cadastros no mês |
| **Atendimentos** | Total de atendimentos no mês atual |

### Painel Profissionais
- Resumo com médias e total de atuantes no período
- **Ranking** ordenável por atendimentos ou por ganhos
- Clique em uma linha do ranking abre modal com todos os atendimentos daquela profissional no período

### Painel Recrutadora
- Métricas mensais inline: cadastros, qualificadas, não aprovadas, desistentes
- Exibe "Ativadas no mês" — profissionais que migraram para ativas naquele período

---

## 15. Financeiro

**View ID:** `financial`  
**Arquivo:** `FinancialPage.tsx`  
**Fonte de dados:** Tabela `payments` e categorias financeiras

### O que é
Módulo de gestão financeira — registro e visualização de receitas e despesas da unidade.

### Funcionalidades
- Registro de entradas e saídas com categorias customizáveis
- `CategoriesManager` para personalizar as categorias financeiras
- Modal de configurações financeiras (`FinancialSettingsModal`)
- Detalhamento por pagamento (`PaymentDetailModal`)

---

## 16. Umbler — Integração WhatsApp

**View ID:** `umbler`  
**Arquivo:** `UmblerPage.tsx`  
**Fonte de dados:** API Umbler Talk + Supabase (`unit_keys`, `umbler_presets`)

### O que é
Interface de administração da integração com o **Umbler Talk** (plataforma de WhatsApp Business). Permite configurar os templates, bots, tags e campos que serão usados nos fluxos de automação.

### Abas do módulo

| Aba | Função |
|---|---|
| **Configurações** | Dados de integração: Organization ID, credenciais, webhook trigger |
| **Bots** | Lista e edição dos bots configurados no Umbler |
| **Tags** | Gerenciamento de tags para classificação de contatos |
| **Campos** | Campos customizados do Umbler |
| **Respostas Rápidas** | Templates de mensagens com variáveis dinâmicas |

### Respostas Rápidas
Interface de duas colunas:
- **Esquerda:** lista de templates existentes com busca
- **Direita:** editor do template com suporte a variáveis dinâmicas (ex: `{{nome_cliente}}`)

Os presets são sincronizados com a tabela `umbler_presets` no Supabase para persistência e compartilhamento entre usuários da unidade.

---

## 17. Typebot — Automação de Bot

**View ID:** `typebot`  
**Arquivo:** `TypebotPage.tsx`  
**Fonte de dados:** Templates em `constants/typebotTemplates.ts`

### O que é
Interface para configuração e visualização de fluxos de bot do **Typebot** — plataforma de criação de chatbots sem código.

### Funcionalidades
- Visualização dos fluxos configurados para a unidade
- Editor de templates de bot
- Integração com as Unit Keys da unidade (`botID` configurado em `unit_keys`)

---

## 18. Tutoriais — Central de Ajuda

**View ID:** `sistema`  
**Arquivo:** `SistemaPage.tsx` e `SistemaAdminPage.tsx`
**Fonte de Dados:** Tabelas `modules` (categorias) e `system_manuals` (conteúdo)

### O que é
A Central de Ajuda é um módulo dinâmico que organiza tutoriais e manuais de uso do sistema. Ela permite que a administração crie guias passo a passo vinculados a módulos específicos ou categorias de suporte geral.

### Estrutura de Conteúdo
O conteúdo é organizado em uma hierarquia de dois níveis:
1.  **Categorias (Módulos):** Agrupadores de tutoriais. Podem ser módulos reais do sistema ou categorias criadas exclusivamente para suporte (com `webhook_url: 'internal://tutorial'`).
2.  **Manuais (Tutoriais):** Páginas de conteúdo em Markdown com suporte a imagens, vídeos e formatação avançada.

### Funcionalidades Administrativas (`super_admin`)
O modo de configuração permite:
- **Gestão de Categorias:** Criar novas categorias independentes para tutoriais gerais.
- **Reordenação (Drag & Drop):** Organizar a ordem de exibição das categorias na barra lateral e dos manuais dentro de cada categoria através de controles de posição (setas).
- **Consolidação em Lote:** Atualizações de posição são feitas via RPC `batch_update_positions` para garantir integridade e performance.
- **Filtro de Perfil:** Módulos exclusivos para administradores são automaticamente ocultados da visão de ajuda do usuário comum.

### Visualização do Usuário
- Navegação lateral intuitiva.
- Conteúdo renderizado via `react-markdown` com suporte a `GFM`.
- Layout otimizado para leitura, com suporte a diferentes posições e tamanhos de imagens de apoio.

---

## 19. Fidelidade

**View ID:** `loyalty`  
**Arquivo:** `LoyaltyPage.tsx`

### O que é
Módulo de programa de fidelidade para clientes. Gerencia pontos, resgates e campanhas de retenção de clientes da unidade.

---

## 20. Configurações

**View ID:** `configuracoes`  
**Arquivo:** `ConfiguracoesPage.tsx`

### O que é
Painel de configurações gerais da unidade acessível ao `admin`. Centraliza ajustes operacionais da unidade que não exigem acesso `super_admin`.

---

## 21. Módulos Administrativos (Super Admin)

Estes módulos são exclusivos do perfil `super_admin` e permitem gestão completa do sistema.

### Usuários — `manage_users`
**Arquivo:** `ManageUsersPage.tsx`

CRUD completo de usuários do sistema:
- Criar, editar e deletar perfis (`profiles`)
- Atribuir unidades (`user_units`) e módulos (`user_modules`) por usuário
- Módulos fora do escopo do admin atual são exibidos como somente leitura

### Módulos — `manage_modules`
**Arquivo:** `ManageModulesPage.tsx`

Gerenciamento dos módulos disponíveis na plataforma:
- Criar novos módulos com código, nome, ícone (Lucide), URL e perfis permitidos
- Reordenar módulos via **Drag & Drop** (persistência via campo `position` denso)
- Ativar/desativar módulos globalmente

### Unidades — `manage_units`
**Arquivo:** `ManageUnitsPage.tsx`

CRUD de unidades + gestão de:
- **Planos** da unidade (`UnitPlanManager`)
- **Integrações** da unidade (`UnitIntegrationsManager`)
- **Keys** da unidade (`unit_keys`): umbler, whatsapp profissional/cliente, botID, organizationID, trigger

### Planos — `manage_plans`
**Arquivo:** `ManagePlansPage.tsx`

Gestão dos planos de assinatura disponíveis para venda às unidades.

### Versões — `manage_versions`
**Arquivo:** `ManageVersionsPage.tsx`

Controle de versões do sistema. Permite registrar changelogs e comunicar atualizações aos usuários via prompt automático (`UpdatePrompt`) ao entrar no sistema.

### Credenciais — `manage_access`
**Arquivo:** `ManageAccessPage.tsx`

Gestão de credenciais de API e acessos externos configurados no sistema.

### Dashboard Sistema — `dashboard_admin`
**Arquivo:** `DashboardSistemaPage.tsx`

Painel analítico exclusivo do `super_admin`. Exibe métricas globais: usuários ativos, acessos por módulo, logs de atividade, performance do sistema (`activity_logs`).

### Comercial Admin — `comercial_admin`
**Arquivo:** `ComercialAdminPage.tsx`

Hub de gestão de produção dos leads comerciais convertidos. Diferente do Comercial (CRM de leads), este módulo acompanha a **implantação** após a venda:

- Kanban com **colunas dinâmicas** (status carregados de `comercial_admin_columns`)
- A mudança de coluna é feita no **modal do card** (não por drag & drop no kanban principal)
- Checklist de implantação: Cadastro ✓ / Pagamento ✓ / Recrutadora ✓ / Umbler ✓
- Atalho direto para WhatsApp do lead (`wa.me`)
- Vinculação à unidade real via `linked_unit_id`

---

## 22. Comportamento Multi-Unidade (ALL)

Quando o usuário seleciona **"Todas as Unidades"** no seletor:

| Módulo | Comportamento |
|---|---|
| **Dashboard** | Agrega métricas por soma; clientes unificados sem duplicação; ticket médio recalculado |
| **Dados** | Consulta com `.in('unidade_code', [...])` unificado e paginado |
| **Agendamentos** | Agrega por data; **webhook desabilitado** por segurança |
| **Clientes** | ⚠️ Não implementado — aviso exibido na tela |
| **Comercial** | Refresh silencioso após drag & drop |
| **Recrutadora** | Coluna "Qualificadas" duplicada por unidade; demais colunas agregadas |
| **Prestadoras** | Agrega dados de todas as unidades automaticamente |

---

## Glossário Técnico

| Termo | Significado |
|---|---|
| `ATENDIMENTO_ID` | Identificador único de um atendimento. Derivados têm sufixo `_1`, `_2`... |
| `IS_DIVISAO` | Flag que indica se o registro é derivado (`SIM`) ou original (`NAO`) |
| `processed_data` | Tabela principal de atendimentos — fonte de verdade do sistema |
| `unit_code` | Código curto da unidade (ex: `MBSP01`) |
| `RLS` | Row Level Security — políticas de acesso a nível de linha no banco |
| `RPC` | Remote Procedure Call — função executada no servidor Supabase |
| `unit_keys` | Tabela com as chaves de integração de cada unidade (Umbler, WhatsApp, etc.) |
| `allowed_profiles` | Array de roles que podem ver um módulo (ex: `["admin", "super_admin"]`) |
| `view_id` | Identificador interno que mapeia um módulo ao componente React correto |
| `system_manuals` | Tabela que armazena o conteúdo dos tutoriais/manuais em Markdown |
| `batch_update` | Operação em lote para atualizar múltiplas posições em uma única chamada de banco |
| `internal://tutorial` | Webhook especial para identificar categorias criadas apenas para o módulo de Ajuda |
| `unit_modules` | Tabela de relacionamento entre unidades e módulos disponíveis |
| `user_modules` | Tabela de relacionamento entre usuários e módulos individualmente atribuídos |
| `Ticket Médio` | Receita (somente originais) dividida pelo número de ATENDIMENTO_IDs únicos |

---

*Documento gerado com base no código-fonte do DromeFlow — v1.2.0 (Março 2026)*
