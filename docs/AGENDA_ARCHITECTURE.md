# Módulo Agenda — DromeFlow

Visão geral técnica e arquitetural do módulo de Agenda (interna e externa).

---

## 1. Roteamento e Subdomínio (Frontend)

O aplicativo usa uma SPA única. O roteamento é resolvido em `App.tsx`:

```typescript
const isAgendaSubdomain = hostname.startsWith('agenda.');
const hasAgendaPrefix = pathname.startsWith('/p/agenda/') || pathname.startsWith('/agenda/');

if (isAgendaSubdomain || hasAgendaPrefix) {
  setIsPublicRoute(true); // Exibe apenas AgendaExternaPage
}
```

### 1.1 Configuração Hostinger
- Subdomínio: `agenda.dromeflow.com`
- **Document Root:** `/public_html` (**não** `/public_html/agenda`)
- O código detecta `agenda.` no hostname e ativa `isPublicRoute = true` automaticamente.
- URL pública da profissional: `https://agenda.dromeflow.com/{unit_code}`

---

## 2. Banco de Dados (Supabase — projeto `DromeSTART`)

### Tabela: `agenda_settings`
Registra cada "abertura de agenda" criada pelo administrador da unidade.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | Identificador da versão desta abertura |
| `unit_id` | uuid (FK → `units.id`) | Unidade dona da agenda |
| `dias_liberados` | jsonb | Array de datas ISO liberadas. Ex: `["2024-03-20","2024-03-21"]` |
| `periodos_cadastrados` | jsonb | Períodos disponíveis pelo admin. Default banco: `["Manhã","Tarde"]` — **não usado pela lógica de botões do app externo**, que usa opções fixas no frontend. |
| `is_link_active` | boolean | Controla se o link de agendamento está ativo. Default: `false` |
| `created_at` | timestamptz | Data da abertura |
| `updated_at` | timestamptz | Última atualização |

> **Importante:** Cada clique em "Salvar Alterações" cria um **novo registro** (INSERT, não UPDATE). Isso garante isolamento histórico por `settings_id`.

---

### Tabela: `agenda_disponibilidade`
Respostas individuais das profissionais para uma abertura de agenda.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | — |
| `unit_id` | uuid (FK → `units.id`) | Unidade |
| `profissional_id` | uuid (FK → `profissionais.id`) | Profissional que respondeu |
| `settings_id` | uuid (FK → `agenda_settings.id`, nullable) | Versão da agenda à qual pertence a resposta |
| `data` | date | Data selecionada pela profissional |
| `periodos` | jsonb | Array com a opção escolhida, ex: `["8 horas"]` ou `["NÃO DISPONIVEL"]` |
| `status_manha` | text | Status derivado do período para o turno Manhã |
| `status_tarde` | text | Status derivado do período para o turno Tarde |
| `conflito` | boolean | `true` se a data cruza com atendimento em `processed_data` |
| `created_at` / `updated_at` | timestamptz | — |

**Constraint exclusiva:** `UNIQUE (settings_id, profissional_id, data)`

---

## 3. Fluxo de Conversão: `periodos` → `status_manha` / `status_tarde`

Este é o mecanismo central da agenda. A coluna `periodos` é o que a profissional seleciona; `status_manha` e `status_tarde` são os valores derivados e persistidos no banco pelo serviço.

### 3.1 Mapeamento de Períodos (definido em `agenda.service.ts`)

```typescript
const PERIODOS_MANHA = ['8 horas', '6 horas', '4 horas manhã'];
const PERIODOS_TARDE = ['8 horas', '6 horas', '4 horas tarde'];
const PERIODOS_NAO   = ['NÃO DISPONIVEL'];
```

### 3.2 Resultado do Upsert (`saveDisponibilidades`)

| Período Selecionado | `status_manha` | `status_tarde` |
|---|---|---|
| `8 horas` | `LIVRE` (ou `CLIENTE` se há atendimento) | `LIVRE` (ou `CLIENTE`) |
| `6 horas` | `LIVRE` (ou `CLIENTE`) | `LIVRE` (ou `CLIENTE`) |
| `4 horas manhã` | `LIVRE` (ou `CLIENTE`) | `null` |
| `4 horas tarde` | `null` | `LIVRE` (ou `CLIENTE`) |
| `NÃO DISPONIVEL` | `NÃO` | `NÃO` |

> A detecção de conflito com `processed_data` é feita em tempo real durante o save: se o horário do atendimento sobrepõe o período, `LIVRE` torna-se `CLIENTE` e o campo `conflito = true`.

### 3.3 Prioridade de Exibição no Painel (`AgendaPage` — `getPeriodStatus`)

```
1. Status manual (CANCELOU / FALTOU / NÃO / LIVRE) → máxima prioridade
2. Sobreposição de atendimento real no período      → CLIENTE (azul)
3. periodos[] inclui valor de MANHA ou TARDE        → LIVRE (verde)
4. periodos[] inclui NÃO DISPONIVEL                 → NÃO (preto)
5. Sem registro                                     → — (cinza)
```

O status manual pode ser alterado diretamente pelo administrador clicando na célula de Manhã ou Tarde na **Tabela de Disponibilidade Semanal**, que agora exibe uma visualização contínua de Domingo a Sábado para facilitar o planejamento em massa.

---

## 4. Fluxo da Profissional (App Externo — `AgendaExternaPage`)

```
1. Acessa: agenda.dromeflow.com/{unit_code}
2. Digita o WhatsApp → authenticateProfissional()
   ├── Valida unit_code → busca units
   ├── Filtra profissional pelo WhatsApp (normalização de máscara local)
   ├── Busca último agenda_settings da unidade
   └── Verifica dias já respondidos para este settings_id
3. Se jaEnviou = true → tela de resumo (somente leitura)
4. Se diasPendentes > 0 → exibe formulário com botões fixos:
   - 8 HORAS / 6 HORAS / 4 HORAS MANHÃ / 4 HORAS TARDE / NÃO DISPONIVEL
5. Submissão → saveDisponibilidades() → upsert com onConflict(settings_id, profissional_id, data)
```

---

## 5. Métricas do Painel (`AgendaPage`)

| Métrica | Fonte |
|---|---|
| **Agendados** | Contagem de `atendimentos` em `processed_data` para a data selecionada |
| **Disponíveis** | Profissionais com `status_manha = 'LIVRE'` ou `status_tarde = 'LIVRE'` e `conflito = false` |
| **Possíveis** | Agendados + Disponíveis |
| **Disp. Semana** | Registros com `status_manha = 'LIVRE'` ou `status_tarde = 'LIVRE'` no range da semana (Dom–Sáb) |
| **Faltas** | Registros com `status_manha = 'FALTOU'` ou `status_tarde = 'FALTOU'` na data |

### 5.1 Dashboard de Profissional (Modal Interativo)

Foi removido o antigo "Painel Lateral de Informativos". Agora, as métricas detalhadas de um profissional (Confiabilidade D7, D30, Geral, Faltas, Cancelamentos, Perfil Predominante e Atendimentos Hoje) são consultadas dando um **Duplo Clique (double-click)** no card do profissional localizado na coluna esquerda da Tabela de Profissionais Livres ou da Aba de Métricas. Isso levanta um `Modal Z-50` limpo e focado, desobstruindo a visualização da tela principal.

---

## 6. Gestão de Cache (PWA)

`AgendaExternaPage` limpa automaticamente caches e Service Workers após o envio do formulário, garantindo que a próxima visita da profissional sempre carregue a versão mais recente do app.
