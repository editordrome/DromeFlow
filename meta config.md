# 📘 DOCUMENTAÇÃO COMPLETA — INTEGRAÇÃO WHATSAPP CLOUD API (COEXISTÊNCIA)

## 🎯 Objetivo

Implementar em um sistema SaaS a funcionalidade de conexão do WhatsApp do cliente (modo coexistência), permitindo que:

- O cliente conecte seu próprio WhatsApp Business
- Continue usando o app normalmente
- Utilize o WhatsApp dentro do sistema (inbox, automações, etc.)
- Os dados sejam armazenados no Supabase
- O sistema opere via WhatsApp Cloud API (Meta)

---

# 🧠 CONCEITO DE COEXISTÊNCIA

Coexistência = o mesmo número funciona em:

- 📱 WhatsApp Business App (celular)
- 💻 Seu sistema (via API)

---

# 🏗️ ARQUITETURA GERAL

## Camadas

### Frontend
- Tela "Conectar WhatsApp"
- Botão de conexão
- Tela de inbox

### Backend
- Endpoint OAuth callback
- Endpoint webhook
- Integração com Meta API

### Banco de Dados
- Supabase (PostgreSQL)

### Automação
- n8n (webhook + automações)

---

# 🌐 DOMÍNIOS (CRÍTICO)

## Domínio principal do sistema
www.dromeflow.com


## Regras

| Função        | Domínio                        |
|--------------|-------------------------------|
| Frontend     | www.dromeflow.com             |
| OAuth        | www.dromeflow.com             |
| Callback     | www.dromeflow.com             |
| Webhook      | paineldromedario.top (n8n)    |

---

# ⚠️ REGRA DE OURO

👉 OAuth e Callback DEVEM estar no mesmo domínio do sistema

❌ NÃO usar:

Frontend → dromeflow.com
Callback → paineldromedario.top


✔ CORRETO:

Frontend → dromeflow.com
Callback → dromeflow.com/api/meta/callback


# 🔘 BOTÃO "CONECTAR WHATSAPP"

## Comportamento

Ao clicar:

1. Inicia fluxo OAuth da Meta
2. Usuário loga
3. Autoriza acesso
4. Meta redireciona para callback

---

# 🔁 FLUXO COMPLETO


Usuário → dromeflow.com
↓
Clique "Conectar WhatsApp"
↓
Meta OAuth
↓
Redirect → /api/meta/callback
↓
Backend processa
↓
Salva no Supabase
↓
Webhook começa a receber mensagens


---

# 🔧 BACKEND

## Endpoint Callback


GET /api/meta/callback


## Responsabilidades

- Capturar `code`
- Validar usuário logado
- Trocar por token
- Capturar:
  - waba_id
  - phone_number_id
- Salvar no banco
- Redirecionar usuário

---

# 🗄️ BANCO DE DADOS (SUPABASE)

## Tabela: whatsapp_connections

```sql
create table whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  user_id uuid,
  waba_id text not null,
  phone_number_id text not null,
  phone_number text,
  access_token text not null,
  status text default 'connected',
  created_at timestamptz default now()
);
Tabela: whatsapp_contacts
create table whatsapp_contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  phone text not null,
  name text,
  created_at timestamptz default now()
);
Tabela: whatsapp_messages
create table whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  contact_id uuid,
  direction text,
  body text,
  created_at timestamptz default now()
);
🔐 SEGURANÇA (OBRIGATÓRIO)
Nunca fazer

❌ Salvar token no frontend
❌ Expor access_token

Sempre fazer

✔ Salvar token no backend
✔ Usar variáveis de ambiente

🔒 RLS (ROW LEVEL SECURITY)
alter table whatsapp_connections enable row level security;

Exemplo de política:

create policy "own_data"
on whatsapp_connections
for select
using (account_id = auth.uid());
🔔 WEBHOOK (META → SISTEMA)
Endpoint
POST /api/meta/webhook
Funções
Receber mensagens
Salvar eventos
Atualizar status
Evento importante

✔ messages

📩 ENVIO DE MENSAGEM
Endpoint Meta
POST https://graph.facebook.com/v22.0/{PHONE_NUMBER_ID}/messages
Exemplo
{
  "messaging_product": "whatsapp",
  "to": "5543999999999",
  "type": "text",
  "text": {
    "body": "Mensagem enviada"
  }
}
