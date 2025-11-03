# Changelog

Registro de todas as mudanças notáveis no projeto DromeFlow.

## [2025-11-02] - Correção de Bug Crítico em Pós-Vendas

### 🐛 Bug Corrigido
**Métrica de "Contatados" sempre exibia zero**

#### Descrição do Problema
O card de métricas "Contatados" na página de Pós-Vendas sempre exibia 0, mesmo quando existiam registros com status `contatado` no banco de dados para o período selecionado.

#### Causa Raiz
A função `getMetrics()` em `services/posVendas/posVendas.service.ts` estava fazendo uma query Supabase que:
1. Aplicava filtros de data usando `.gte()` e `.lte()` no campo `data`
2. **MAS não incluía o campo `data` no `.select()`**

```typescript
// ❌ ANTES (incorreto)
.select('nota, reagendou, status')
```

O cliente Supabase JS não aplica corretamente filtros de intervalo em campos que não estão incluídos na seleção, resultando em 0 registros retornados.

#### Solução Implementada
Adicionado o campo `data` ao `.select()` da query:

```typescript
// ✅ DEPOIS (correto)
.select('data, nota, reagendou, status')
```

#### Testes Realizados
1. **Query SQL direta no banco**: Confirmado que existia 1 registro com status `contatado` para outubro/2025
2. **Verificação de filtros**: 
   - `unit_id`: `6b9769ab-9088-469b-b31a-d174ed766682` ✓
   - `startDate`: `2025-10-01` ✓
   - `endDate`: `2025-10-31` ✓
3. **Query PostgreSQL**: Retornou corretamente 320 registros (1 contatado + 319 pendentes)

#### Impacto
- **Antes**: Métricas incorretas, impossível monitorar contatos realizados
- **Depois**: Métricas precisas, contagem correta de status 'contatado'

#### Arquivos Modificados
- `services/posVendas/posVendas.service.ts` (linha ~282)

#### Lições Aprendidas
⚠️ **Importante**: Ao usar o cliente Supabase JS com filtros de intervalo (`.gte()`, `.lte()`, `.gt()`, `.lt()`), sempre incluir o campo filtrado no `.select()`. O PostgREST pode otimizar a query e ignorar filtros em campos não selecionados.

---

## Boas Práticas para Queries Supabase

### ✅ Correto
```typescript
const query = supabase
  .from('tabela')
  .select('campo_filtrado, campo1, campo2')  // Incluir campo_filtrado
  .gte('campo_filtrado', valor_min)
  .lte('campo_filtrado', valor_max);
```

### ❌ Incorreto
```typescript
const query = supabase
  .from('tabela')
  .select('campo1, campo2')  // Faltando campo_filtrado
  .gte('campo_filtrado', valor_min)
  .lte('campo_filtrado', valor_max);
```

---

## Próximos Passos
- [ ] Revisar outras queries em `services/*/*.service.ts` para garantir consistência
- [ ] Adicionar testes automatizados para métricas de pós-vendas
- [ ] Documentar padrões de query no guia de contribuição
