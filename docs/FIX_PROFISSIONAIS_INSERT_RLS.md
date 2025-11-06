# Correção: Erro ao Criar Profissional (RLS Policy Violation)

**Data:** 06 de novembro de 2025  
**Problema:** `new row violates row-level security policy for table "profissionais" (Código: 42501)`

## Diagnóstico

### Causa Raiz
O sistema usa **autenticação customizada** que valida credenciais na tabela `profiles`, mas executa queries com a role `anon` (chave pública do Supabase). 

A tabela `profissionais` tinha políticas RLS que:
- ✅ Permitiam SELECT para `anon`
- ✅ Permitiam UPDATE para `anon` (corrigido em 2025-10-29)
- ❌ **NÃO permitiam INSERT para `anon`** ← Causa do erro

### Política Existente (Incompleta)
```sql
-- Só permite INSERT para 'authenticated' (não funciona com auth customizada)
CREATE POLICY profissionais_write 
ON profissionais 
FOR INSERT 
TO authenticated 
WITH CHECK (true);
```

## Solução

### Script SQL
Execute o script: `docs/sql/2025-11-06_profissionais_insert_anon_fix.sql`

```sql
DROP POLICY IF EXISTS profissionais_insert_anon ON profissionais;

CREATE POLICY profissionais_insert_anon
ON profissionais
FOR INSERT
TO anon
WITH CHECK (true);
```

### Aplicação
1. Acesse o **SQL Editor** do Supabase
2. Execute o script acima
3. Verifique se a política foi criada:
   ```sql
   SELECT policyname, roles, cmd 
   FROM pg_policies 
   WHERE tablename = 'profissionais' 
   ORDER BY cmd, policyname;
   ```

### Resultado Esperado
```
policyname                  | roles          | cmd
----------------------------|----------------|--------
profissionais_insert_anon   | {anon}         | INSERT
profissionais_write         | {authenticated}| INSERT
profissionais_update        | {authenticated}| UPDATE
profissionais_update_anon   | {anon}         | UPDATE
profissionais_read          | {authenticated}| SELECT
```

## Validação

### Teste 1: Criar Nova Profissional
1. Acesse o módulo **Recrutadora**
2. Clique em "Nova profissional"
3. Preencha os campos obrigatórios
4. Salve

**Resultado esperado:** Profissional criada com sucesso, sem erro RLS

### Teste 2: Atualizar Status
1. Na tabela de profissionais
2. Altere o toggle de status (Ativa/Inativa)

**Resultado esperado:** Status atualizado sem erros

## Contexto Técnico

### Fluxo de Autenticação Customizada
```
1. Login → valida em 'profiles' (SELECT)
2. Operações → usa anon key (chave pública)
3. RLS → precisa permitir anon para INSERT/UPDATE/DELETE
```

### Políticas RLS Necessárias para Auth Customizada
```sql
-- SELECT
CREATE POLICY profissionais_read 
ON profissionais FOR SELECT 
TO authenticated USING (true);

-- INSERT (precisa de anon!)
CREATE POLICY profissionais_insert_anon 
ON profissionais FOR INSERT 
TO anon WITH CHECK (true);

-- UPDATE (já corrigido em 2025-10-29)
CREATE POLICY profissionais_update_anon 
ON profissionais FOR UPDATE 
TO anon USING (true) WITH CHECK (true);

-- DELETE (se necessário no futuro)
CREATE POLICY profissionais_delete_anon 
ON profissionais FOR DELETE 
TO anon USING (true);
```

## Histórico de Correções RLS

| Data | Problema | Solução |
|------|----------|---------|
| 2025-10-29 | UPDATE bloqueado | `profissionais_update_anon` |
| 2025-11-06 | INSERT bloqueado | `profissionais_insert_anon` |

## Prevenção

Para novas tabelas com auth customizada, sempre criar políticas para `anon`:
```sql
-- Template para auth customizada
ALTER TABLE nome_tabela ENABLE ROW LEVEL SECURITY;

CREATE POLICY nome_tabela_select_anon ON nome_tabela 
FOR SELECT TO anon USING (true);

CREATE POLICY nome_tabela_insert_anon ON nome_tabela 
FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY nome_tabela_update_anon ON nome_tabela 
FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY nome_tabela_delete_anon ON nome_tabela 
FOR DELETE TO anon USING (true);
```

## Notas
- ⚠️ Em produção, considere políticas RLS mais restritivas baseadas em `user_id` ou perfis
- ⚠️ Este fix é necessário enquanto usar autenticação customizada
- 💡 Futuramente, migrar para `auth.users` eliminaria a necessidade de políticas `anon`
