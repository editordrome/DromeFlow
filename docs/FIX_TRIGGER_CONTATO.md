# 🔧 Guia de Correção: Trigger pos_vendas

## Problema Identificado

❌ **Erro ao fazer upload de XLSX**: `record "new" has no field "CONTATO"`

O trigger estava tentando acessar um campo `CONTATO` que não existe na tabela `processed_data`.

## ✅ Solução: Aplicar Script de Correção

### Passo 1: Acesse o Supabase SQL Editor

1. Acesse seu projeto no [Supabase Dashboard](https://supabase.com/dashboard)
2. Vá em **SQL Editor** no menu lateral
3. Clique em **New Query**

### Passo 2: Cole o Script de Correção

```sql
-- ============================================================================
-- CORREÇÃO DO TRIGGER: Campo whatscliente (não CONTATO)
-- Execute este script no SQL Editor do Supabase
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_processed_data_to_pos_vendas()
RETURNS TRIGGER AS $$
DECLARE
  v_unit_id uuid;
BEGIN
  -- Busca o unit_id correspondente ao unit_code da unidade
  SELECT id INTO v_unit_id
  FROM units
  WHERE unit_code = NEW.unidade_code
  LIMIT 1;
  
  -- Se não encontrar a unidade, loga warning
  IF v_unit_id IS NULL THEN
    RAISE WARNING 'Unidade não encontrada para unit_code: %', NEW.unidade_code;
  END IF;
  
  -- Insere em pos_vendas apenas se o ATENDIMENTO_ID ainda não existir
  INSERT INTO pos_vendas (
    "ATENDIMENTO_ID",
    unit_id,
    nome,
    contato,
    data,
    status,
    nota,
    reagendou,
    feedback,
    created_at,
    updated_at
  )
  VALUES (
    NEW."ATENDIMENTO_ID",
    v_unit_id,
    NEW."CLIENTE",
    NEW.whatscliente,  -- ✅ CORRIGIDO: era NEW."CONTATO", agora é NEW.whatscliente
    NEW."DATA",
    COALESCE(NEW."pos vendas", 'pendente')::text,
    NULL,
    FALSE,
    NULL,
    NOW(),
    NOW()
  )
  ON CONFLICT ("ATENDIMENTO_ID") DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- O trigger já existe, apenas atualizamos a função
```

### Passo 3: Execute o Script

1. Clique no botão **Run** (ou pressione `Ctrl+Enter` / `Cmd+Enter`)
2. Aguarde a confirmação de sucesso: ✅ "Success. No rows returned"

### Passo 4: Verifique a Correção

Tente fazer upload de um arquivo XLSX novamente. O erro não deve mais aparecer.

## 📋 O que foi Corrigido?

| Antes (❌ Errado) | Depois (✅ Correto) |
|------------------|---------------------|
| `NEW."CONTATO"` | `NEW.whatscliente` |

### Estrutura da Tabela processed_data

A tabela possui o campo **`whatscliente`** (não `CONTATO`):
- ✅ `whatscliente` - telefone/WhatsApp do cliente
- ❌ `CONTATO` - este campo NÃO existe

## 🎯 Resultado Esperado

Após aplicar a correção:
- ✅ Upload de arquivos XLSX funciona normalmente
- ✅ Dados são inseridos em `processed_data`
- ✅ Trigger cria registros em `pos_vendas` automaticamente
- ✅ Campo `contato` em `pos_vendas` recebe o valor de `whatscliente`

## ⚠️ Nota Importante

Esta correção **não afeta dados existentes**. Ela apenas corrige o comportamento do trigger para novos uploads.

---

**Commit**: `4c4179c`  
**Data**: 2025-11-03  
**Arquivos atualizados**:
- `docs/sql/2025-11-03_auto_sync_processed_to_pos_vendas.sql`
- `docs/sql/2025-11-03_fix_trigger_contato_field.sql`
- `docs/CHANGELOG.md`
