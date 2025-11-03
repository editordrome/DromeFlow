# Correções de Upload XLSX - 2025-11-03

## 🐛 Problemas Identificados e Resolvidos

### 1. Campo PROFISSIONAL vazio causava erro de constraint
**Erro:** `there is no unique or exclusion constraint matching the ON CONFLICT specification`

**Causa:** Frontend enviava `PROFISSIONAL: ""` (string vazia), mas a constraint UNIQUE esperava `NULL` para registros sem profissional.

**Constraint do banco:**
```sql
UNIQUE (unit_id, "ATENDIMENTO_ID", "IS_DIVISAO", "PROFISSIONAL")
```

**Solução:**
- **Frontend (`UploadModal.tsx`)**: Converte string vazia em `null`
- **Types (`types.ts`)**: Atualizado para aceitar `PROFISSIONAL: string | null`
- **Serviço (`upload.service.ts`)**: Preserva `null` durante processamento

**Arquivos alterados:**
- `components/ui/UploadModal.tsx` (linha ~230)
- `types.ts` (linhas 107, 157)
- `services/ingestion/upload.service.ts` (linhas 48-80)

---

### 2. Tabela pos_vendas sem constraint UNIQUE
**Erro:** `there is no unique or exclusion constraint matching the ON CONFLICT specification`

**Causa:** Trigger `sync_processed_data_to_pos_vendas` usava:
```sql
ON CONFLICT ("ATENDIMENTO_ID") DO NOTHING
```
Mas a tabela `pos_vendas` não tinha constraint UNIQUE em `ATENDIMENTO_ID`.

**Solução:**
```sql
ALTER TABLE pos_vendas
ADD CONSTRAINT pos_vendas_atendimento_id_unique 
UNIQUE ("ATENDIMENTO_ID");
```

**Arquivo:** `docs/sql/2025-11-03_fix_pos_vendas_unique_constraint.sql`

---

### 3. Trigger usando campo inexistente
**Erro:** `record "new" has no field "CONTATO"`

**Causa:** Trigger tentava acessar `NEW."CONTATO"`, mas o campo correto é `whatscliente`.

**Solução:**
```sql
-- Corrigido
NEW.whatscliente  -- ✓ Campo correto
```

**Arquivos:**
- `docs/sql/2025-11-03_fix_trigger_contato_field.sql`
- `docs/sql/2025-11-03_auto_sync_processed_to_pos_vendas.sql` (atualizado)

---

## 📊 Ordem de Aplicação (Supabase)

### Ordem correta para aplicar os scripts SQL:

1. **`2025-11-03_fix_pos_vendas_unique_constraint.sql`**
   - Remove duplicatas
   - Cria constraint UNIQUE em pos_vendas.ATENDIMENTO_ID

2. **`2025-11-03_fix_trigger_contato_field.sql`**
   - Corrige função do trigger para usar whatscliente

3. **`2025-11-03_auto_sync_processed_to_pos_vendas.sql`** (opcional, apenas referência)
   - Documentação completa do trigger

---

## ✅ Status Final

| Componente | Status | Descrição |
|------------|--------|-----------|
| Frontend (UploadModal) | ✅ Corrigido | Envia `null` quando PROFISSIONAL vazio |
| Types (TypeScript) | ✅ Corrigido | Aceita `string \| null` |
| Serviço (upload) | ✅ Corrigido | Preserva `null` no processamento |
| Constraint (pos_vendas) | ✅ Criada | UNIQUE em ATENDIMENTO_ID |
| Trigger (sync) | ✅ Corrigido | Usa whatscliente (não CONTATO) |

---

## 🧪 Teste de Upload

Após aplicar todas as correções:

1. ✅ Upload de arquivo XLSX funciona sem erros
2. ✅ Registros inseridos em `processed_data`
3. ✅ Trigger cria automaticamente em `pos_vendas`
4. ✅ Constraint UNIQUE previne duplicatas
5. ✅ Campo PROFISSIONAL aceita `null` corretamente

---

## 📝 Notas Importantes

- **Campo chave:** `ATENDIMENTO_ID` conecta `processed_data` ↔ `pos_vendas`
- **Constraint crítica:** `pos_vendas.ATENDIMENTO_ID` deve ter UNIQUE
- **Campo de contato:** Sempre usar `whatscliente` (não CONTATO)
- **Profissional vazio:** Frontend envia `null` (não string vazia)

---

## 🔄 Sincronização Bidirecional

### processed_data → pos_vendas (INSERT)
- **Trigger:** `sync_processed_data_to_pos_vendas`
- **Quando:** AFTER INSERT em processed_data
- **Ação:** Cria registro em pos_vendas com status 'pendente'

### pos_vendas → processed_data (UPDATE)
- **Trigger:** `sync_pos_vendas_status`
- **Quando:** AFTER UPDATE OF status em pos_vendas
- **Ação:** Atualiza coluna "pos vendas" em processed_data

---

**Data:** 2025-11-03  
**Autor:** Sistema de correções automáticas  
**Versão:** 1.0
