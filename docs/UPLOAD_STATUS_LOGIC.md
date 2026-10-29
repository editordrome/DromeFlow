# Lógica de STATUS no Upload de Atendimentos

## Regra Atualizada (2025-11-17)

### 🎯 Quando STATUS = "esperar" é Aplicado Automaticamente

A regra de STATUS "esperar" é aplicada **apenas** quando:

1. ✅ A profissional tem **2 ou mais atendimentos** no mesmo dia
2. ✅ **TODOS** os atendimentos desse dia são no turno **"Tarde"**
3. ✅ **NENHUM** atendimento do dia é no turno **"Manhã"**

### ❌ Quando STATUS NÃO é Alterado (Preservado)

O STATUS original da planilha é **preservado** quando:

- ❌ A profissional tem apenas 1 atendimento no dia
- ❌ Os atendimentos do dia incluem turnos mistos (Manhã + Tarde)
- ❌ Todos os atendimentos do dia são apenas pela Manhã

---

## 📋 Exemplos Práticos

### ✅ Exemplo 1: STATUS "esperar" Aplicado

**Planilha:**
| PROFISSIONAL | DATA | MOMENTO | STATUS (original) |
|--------------|------------|--------------|-------------------|
| Maria | 2025-11-20 | Tarde 14:00 | confirmado |
| Maria | 2025-11-20 | Tarde 15:30 | confirmado |

**Resultado:**
| PROFISSIONAL | DATA | MOMENTO | STATUS (final) |
|--------------|------------|--------------|----------------|
| Maria | 2025-11-20 | Tarde 14:00 | **esperar** ✅ |
| Maria | 2025-11-20 | Tarde 15:30 | **esperar** ✅ |

**Motivo:** 2 atendimentos no dia, ambos à Tarde

---

### ❌ Exemplo 2: STATUS Preservado (Turnos Mistos)

**Planilha:**
| PROFISSIONAL | DATA | MOMENTO | STATUS (original) |
|--------------|------------|---------------|-------------------|
| João | 2025-11-21 | Manhã 09:00 | confirmado |
| João | 2025-11-21 | Tarde 14:00 | confirmado |

**Resultado:**
| PROFISSIONAL | DATA | MOMENTO | STATUS (final) |
|--------------|------------|---------------|-------------------|
| João | 2025-11-21 | Manhã 09:00 | **confirmado** ❌ |
| João | 2025-11-21 | Tarde 14:00 | **confirmado** ❌ |

**Motivo:** Mix de turnos (Manhã + Tarde) → STATUS preservado

---

### ❌ Exemplo 3: STATUS Preservado (Apenas Manhã)

**Planilha:**
| PROFISSIONAL | DATA | MOMENTO | STATUS (original) |
|--------------|------------|---------------|-------------------|
| Ana | 2025-11-22 | Manhã 08:00 | confirmado |
| Ana | 2025-11-22 | Manhã 10:30 | confirmado |

**Resultado:**
| PROFISSIONAL | DATA | MOMENTO | STATUS (final) |
|--------------|------------|---------------|-------------------|
| Ana | 2025-11-22 | Manhã 08:00 | **confirmado** ❌ |
| Ana | 2025-11-22 | Manhã 10:30 | **confirmado** ❌ |

**Motivo:** Apenas atendimentos pela Manhã → STATUS preservado

---

### ❌ Exemplo 4: STATUS Preservado (Único Atendimento)

**Planilha:**
| PROFISSIONAL | DATA | MOMENTO | STATUS (original) |
|--------------|------------|--------------|-------------------|
| Pedro | 2025-11-23 | Tarde 16:00 | confirmado |

**Resultado:**
| PROFISSIONAL | DATA | MOMENTO | STATUS (final) |
|--------------|------------|--------------|-------------------|
| Pedro | 2025-11-23 | Tarde 16:00 | **confirmado** ❌ |

**Motivo:** Apenas 1 atendimento no dia → STATUS preservado

---

### ✅ Exemplo 5: Múltiplos Dias com Comportamentos Diferentes

**Planilha:**
| PROFISSIONAL | DATA | MOMENTO | STATUS (original) |
|--------------|------------|---------------|-------------------|
| Carla | 2025-11-24 | Tarde 14:00 | confirmado |
| Carla | 2025-11-24 | Tarde 16:00 | confirmado |
| Carla | 2025-11-25 | Manhã 09:00 | confirmado |
| Carla | 2025-11-25 | Tarde 14:00 | confirmado |

**Resultado:**
| PROFISSIONAL | DATA | MOMENTO | STATUS (final) |
|--------------|------------|---------------|-------------------|
| Carla | 2025-11-24 | Tarde 14:00 | **esperar** ✅ |
| Carla | 2025-11-24 | Tarde 16:00 | **esperar** ✅ |
| Carla | 2025-11-25 | Manhã 09:00 | **confirmado** ❌ |
| Carla | 2025-11-25 | Tarde 14:00 | **confirmado** ❌ |

**Motivo:** 
- **24/11:** 2 atendimentos, ambos Tarde → STATUS = "esperar"
- **25/11:** Mix de turnos (Manhã + Tarde) → STATUS preservado

---

## 🔍 Implementação Técnica

### Função: `applyWaitStatusForAfternoonShifts()`

**Arquivo:** `services/ingestion/upload.service.ts`

**Lógica:**
```typescript
// 1. Agrupar atendimentos por (PROFISSIONAL + DATA)
const groupedByProfessionalDate = Map<string, DataRecord[]>;

// 2. Para cada grupo com 2+ atendimentos:
if (recordsGroup.length > 1) {
  // 3. Verificar se existe algum atendimento de Manhã
  const hasManha = recordsGroup.some(r => 
    r.MOMENTO.includes('manhã') || r.MOMENTO.includes('manha')
  );
  
  // 4. Verificar se TODOS são à Tarde
  const allTarde = recordsGroup.every(r => 
    r.MOMENTO.includes('tarde')
  );
  
  // 5. Aplicar "esperar" apenas se: sem Manhã + todos Tarde
  if (!hasManha && allTarde) {
    recordsGroup.forEach(r => r.STATUS = 'esperar');
  }
}
```

---

## 📊 Fluxo Completo do STATUS

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Leitura da Planilha XLSX                                 │
│    STATUS = valor da coluna "STATUS" ou null                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Aplicar Regra de "esperar" (applyWaitStatusForAfternoon)│
│    • Agrupar por (PROFISSIONAL + DATA)                     │
│    • Se 2+ atendimentos E todos Tarde → STATUS = "esperar" │
│    • Caso contrário → STATUS preservado                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Upsert no Banco (process_xlsx_upload RPC)               │
│    • Registro NOVO → usa STATUS após regra                 │
│    • Registro EXISTENTE:                                    │
│      - PROFISSIONAL igual → STATUS do banco preservado     │
│      - PROFISSIONAL mudou → STATUS da planilha usado       │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚠️ Observações Importantes

1. **Registros Derivados (IS_DIVISAO = 'SIM'):**
   - Não são afetados pela regra de "esperar"
   - Herdam STATUS do registro original

2. **Case-insensitive:**
   - Aceita "Manhã", "manhã", "MANHÃ"
   - Aceita "Tarde", "tarde", "TARDE"

3. **Prioridade:**
   - Regra automática > Valor da planilha (para novos registros)
   - STATUS do banco > Valor da planilha (para updates sem mudança de PROFISSIONAL)

4. **Sincronização com pós-vendas:**
   - `pos_vendas.status` sempre inicia como "pendente"
   - Não é afetado pelo STATUS de `processed_data`

---

## 🎯 Casos de Uso de Negócio

**Objetivo da Regra:**
Identificar automaticamente atendimentos que podem exigir reagendamento quando uma profissional tem múltiplos atendimentos concentrados apenas no período da tarde, sinalizando possível sobrecarga de horários.

**Por que preservar STATUS em turnos mistos:**
Se a profissional tem atendimentos distribuídos entre Manhã e Tarde, isso indica uma agenda já balanceada, não necessitando da marcação automática de "esperar".
