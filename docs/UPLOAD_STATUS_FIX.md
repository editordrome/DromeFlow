# Fix: Upload Preserva STATUS Condicionalmente

**Data**: 2025-11-06  
**Status**: ✅ Migração aplicada  
**Arquivo SQL**: `docs/sql/2025-11-06_fix_upload_preserve_status.sql`

## Problema

Ao fazer upload de arquivo XLSX, a função `process_xlsx_upload` estava **sobrepondo o STATUS** de todos os atendimentos existentes:

- ❌ Atendimentos com STATUS "CONFIRMADO" eram alterados para "PENDENTE"
- ❌ Upload idêntico múltiplas vezes alterava STATUS repetidamente
- ❌ Perda de informação de confirmação de atendimentos

### Causa Raiz

```sql
ON CONFLICT (unidade_code, ATENDIMENTO_ID) DO UPDATE SET
    ...
    "STATUS" = EXCLUDED."STATUS"  -- ❌ Sempre sobrescreve
```

## Solução Implementada

### Lógica Condicional

O STATUS agora é preservado **exceto quando o PROFISSIONAL é alterado**:

```sql
"STATUS" = CASE 
    WHEN processed_data."PROFISSIONAL" IS DISTINCT FROM EXCLUDED."PROFISSIONAL" 
    THEN EXCLUDED."STATUS"  -- Profissional mudou: atualiza STATUS
    ELSE processed_data."STATUS"  -- Profissional igual: preserva STATUS
END
```

### Comportamento

#### INSERT (registro novo)
- STATUS vem do arquivo XLSX
- Pode ser NULL, "PENDENTE", ou qualquer outro valor

#### UPDATE (registro existente)

**Cenário 1: PROFISSIONAL não mudou**
```
Banco:   STATUS = "CONFIRMADO", PROFISSIONAL = "Maria"
Arquivo: STATUS = "PENDENTE",   PROFISSIONAL = "Maria"
Resultado: STATUS = "CONFIRMADO" ✅ (preservado)
```

**Cenário 2: PROFISSIONAL mudou**
```
Banco:   STATUS = "CONFIRMADO", PROFISSIONAL = "Maria"
Arquivo: STATUS = "PENDENTE",   PROFISSIONAL = "João"
Resultado: STATUS = "PENDENTE" ✅ (atualizado - permite reatribuição)
```

## Impacto

### Vantagens
✅ STATUS "CONFIRMADO" não é perdido em uploads subsequentes  
✅ Idempotência: mesmo arquivo pode ser enviado múltiplas vezes  
✅ Permite reatribuir atendimentos mudando PROFISSIONAL  
✅ Histórico de confirmações preservado  

### Casos de Uso
1. **Upload mensal recorrente**: STATUS confirmados permanecem
2. **Correção de dados**: Atualiza campos sem afetar confirmações
3. **Reatribuição**: Mudar profissional + resetar STATUS funciona corretamente

## Campos no UPDATE

### Sempre Atualizados
- DATA, HORARIO, VALOR
- SERVIÇO, TIPO, PERÍODO, MOMENTO
- CLIENTE, PROFISSIONAL, ENDEREÇO, DIA
- REPASSE, whatscliente, CUPOM
- ORIGEM, IS_DIVISAO, CADASTRO, unidade

### Condicional
- **STATUS**: preservado se PROFISSIONAL igual, atualizado se diferente

### Sempre Preservados
- `id` (PK)
- `created_at` (timestamp original)

## Testes Recomendados

### Teste 1: Upload Idêntico
```
1. Confirmar alguns atendimentos (STATUS = "CONFIRMADO")
2. Fazer upload do mesmo arquivo XLSX
3. ✅ Verificar: STATUS permanece "CONFIRMADO"
```

### Teste 2: Atualização de Dados
```
1. Atendimento com STATUS = "CONFIRMADO", PROFISSIONAL = "Maria"
2. Upload: muda DATA, mas mantém PROFISSIONAL = "Maria"
3. ✅ Verificar: STATUS permanece "CONFIRMADO"
```

### Teste 3: Reatribuição
```
1. Atendimento com STATUS = "CONFIRMADO", PROFISSIONAL = "Maria"
2. Upload: muda PROFISSIONAL para "João", STATUS = "PENDENTE"
3. ✅ Verificar: STATUS atualiza para "PENDENTE"
```

## Arquivos Relacionados

- **Migração SQL**: `docs/sql/2025-11-06_fix_upload_preserve_status.sql`
- **Documentação**: `.github/copilot-instructions.md` (linha 95)
- **Changelog**: `docs/CHANGELOG.md`
- **Serviço Upload**: `services/ingestion/upload.service.ts`

## Histórico

- **2025-11-04**: Sistema migrado de `orcamento` para `ATENDIMENTO_ID` como chave única
- **2025-11-06**: Corrigido: STATUS agora é condicional baseado em mudança de PROFISSIONAL

## Referências

- Constraint único: `processed_data_unidade_code_atendimento_id_key`
- RPC: `process_xlsx_upload(unit_code_arg text, records_arg jsonb)`
- Expansão multi-profissional: sufixos `_1`, `_2` em `ATENDIMENTO_ID`
