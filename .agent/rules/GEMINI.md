---
trigger: always_on
description: dromeflow-rules
---

Perfeito 👍
Abaixo está **um novo arquivo `GEMINI.md` totalmente reescrito**, **otimizado**, **mais leve**, **mais executável** e **100% orientado para Português (Brasil)** — mantendo toda a inteligência de agentes, skills e workflows que você construiu.

Você pode **copiar e substituir diretamente** o atual.

---

# 📘 GEMINI.md — Antigravity Kit (PT-BR)

> Este arquivo define **como a IA deve pensar, decidir e agir** dentro deste workspace.
> Ele é a **autoridade máxima de comportamento** do sistema.

---

## 🔴 AUTORIDADE DO SISTEMA (P0)

### Hierarquia de Regras (Obrigatória)

```
P0 → GEMINI.md (este arquivo)
P1 → Arquivo do Agent (.agent/agents/*.md)
P2 → SKILL.md (dentro de .agent/skills/)
```

❌ Nenhuma regra de nível inferior pode sobrescrever uma superior.
✅ Em caso de conflito, **P0 sempre vence**.

---

## 🧠 PROTOCOLO DE AGENTES E SKILLS (REGRA CENTRAL)

### Fluxo obrigatório de ativação

```
Pedido do usuário
→ Selecionar Agent adequado
→ Ler Agent.md
→ Ler SKILL.md (índice)
→ Carregar SOMENTE as seções necessárias
→ Executar
```

### Regras importantes

* ❌ Nunca carregar todas as skills
* ❌ Nunca executar sem ler o Agent
* ✅ Sempre seguir: **Ler → Entender → Aplicar**

---

## 📥 CLASSIFICAÇÃO AUTOMÁTICA DE PEDIDOS

Antes de qualquer resposta, o pedido deve ser classificado:

| Tipo                | Exemplos                                 | Ação                     |
| ------------------- | ---------------------------------------- | ------------------------ |
| Pergunta            | “o que é”, “como funciona”               | Resposta direta          |
| Análise             | “analise”, “liste”, “explique o sistema” | Leitura e explicação     |
| Ajuste simples      | “corrija”, “altere”                      | Edição pontual           |
| Construção complexa | “crie”, “implemente”, “refatore”         | Planejamento obrigatório |
| Design/UI           | “layout”, “dashboard”                    | Agent de design          |
| Comando             | /plan, /debug                            | Workflow específico      |

---

## 🤖 ROTEAMENTO INTELIGENTE DE AGENTS (PADRÃO)

A seleção de agentes é **automática**, a menos que o usuário force `@agent`.

### Lógica

1. Detectar domínio (frontend, backend, infra, produto, etc.)
2. Escolher o **menor número possível de agentes**
3. Carregar apenas as skills necessárias

### Comunicação ao usuário

Sempre que um agent for aplicado:

```md
🤖 Aplicando conhecimento de `@[nome-do-agent]`
```

Sem explicações técnicas adicionais.

---

## 🌐 IDIOMA (OBRIGATÓRIO)

* 🧠 Tradução interna se necessário
* 🗣️ Responder **sempre em Português (Brasil)**
* 💻 Código, variáveis e comentários técnicos permanecem em **inglês**

---

## 🧹 CLEAN CODE (GLOBAL)

Aplica-se **somente quando houver código**.

* Código simples, legível e direto
* Nada de overengineering
* Testes obrigatórios apenas quando há lógica nova
* Performance só é otimizada após medição

---

## 🛑 GATE SOCRÁTICO (MODO INTELIGENTE)

### O gate **SÓ É ATIVADO** quando:

* Novo recurso
* Mudança estrutural
* Múltiplos arquivos
* Decisão arquitetural
* Orquestração de agentes

### O gate **NÃO SE APLICA** a:

* Perguntas
* Análises
* Explicações
* Ajustes simples

Quando aplicado:

* Máximo **3 perguntas**
* Foco em **escopo, impacto e bordas**
* Não iniciar execução sem resposta

---

## 🧩 MODO PLANO (QUANDO NECESSÁRIO)

Ativado quando:

* Pedido é complexo
* Usuário pede explicitamente
* Sistema detecta risco de escopo

### Fases obrigatórias

1. **Análise**
2. **Planejamento** → `{task}.md`
3. **Solução (sem código)**
4. **Implementação**

❌ Nenhum código antes da fase 4.

---

## ⚙️ EXECUÇÃO DE SCRIPTS (SOB DEMANDA)

Scripts **não são carregados por padrão**.

Somente usar quando necessário:

| Situação      | Script           |
| ------------- | ---------------- |
| Segurança     | security_scan.py |
| Pré-deploy    | checklist.py     |
| UI            | ux_audit.py      |
| API / Backend | test_runner.py   |

---

## 🎭 MODOS → AGENTES

| Modo | Agent           |
| ---- | --------------- |
| ask  | nenhum          |
| plan | project-planner |
| edit | orchestrator    |

---

## 📁 CONSCIÊNCIA DE ESTRUTURA

Estrutura esperada:

```
.agent/
 ├─ agents/
 ├─ skills/
 ├─ workflows/
 ├─ scripts/
 └─ ARCHITECTURE.md
```

📌 `ARCHITECTURE.md` deve ser lido **uma vez por sessão**.