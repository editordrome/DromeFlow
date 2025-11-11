# Unit-Based Access Control - Sistema de Controle de Acesso por Unidade

**Data de Implementação**: 11 de novembro de 2025  
**Versão**: 1.0.0  
**Status**: ✅ Completo e em Produção

## Visão Geral

Este documento descreve o sistema de controle de acesso baseado em unidades implementado no DromeFlow, permitindo gerenciamento granular de permissões de módulos por unidade e usuário.

## Motivação

Antes desta implementação, o sistema tinha apenas controle de acesso baseado em perfis (`super_admin`, `admin`, `user`) com atribuições globais em `user_modules`. Isso não permitia:

- Restringir módulos específicos para unidades específicas
- Administradores de unidade gerenciarem seus próprios módulos
- Controle granular sobre o que cada unidade pode acessar
- Isolamento de funcionalidades entre unidades

## Arquitetura

### Componentes Principais

```
┌─────────────────────────────────────────────────────────────┐
│                    SISTEMA DE ACESSO                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Database Layer                                           │
│     ├── unit_modules (Nova tabela)                          │
│     ├── user_modules (Existente)                            │
│     └── modules (Existente)                                 │
│                                                              │
│  2. Service Layer                                            │
│     ├── unitModules.service.ts (9 funções CRUD)            │
│     └── users.service.ts (updateUserAssignments)           │
│                                                              │
│  3. Context Layer                                            │
│     ├── AuthContext.getModulesForUnit()                     │
│     └── AppContext (navegação + inicialização)             │
│                                                              │
│  4. UI Layer                                                 │
│     ├── ManageUnitsPage (Aba Módulos)                      │
│     └── UserFormModal (Aba Módulos + Multi-unit)           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Hierarquia de Permissões

```
                    ┌─────────────────┐
                    │  SUPER ADMIN    │
                    │  (módulos SA)   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │     ADMIN       │
                    │ (todos módulos  │
                    │   da unidade)   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │      USER       │
                    │  (user_modules  │
                    │       ∩         │
                    │  unit_modules)  │
                    └─────────────────┘
```

## Implementação

### Fase 1: Estrutura de Banco de Dados ✅

**Arquivo**: `docs/sql/2025-11-11_unit_modules.sql`

#### Tabela `unit_modules`
```sql
CREATE TABLE public.unit_modules (
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (unit_id, module_id)
);
```

#### Índices
```sql
CREATE INDEX idx_unit_modules_unit ON unit_modules(unit_id);
CREATE INDEX idx_unit_modules_module ON unit_modules(module_id);
CREATE INDEX idx_unit_modules_lookup ON unit_modules(unit_id, module_id);
```

#### RPCs
1. **get_unit_modules**: Lista módulos de uma unidade
2. **assign_modules_to_unit**: Atribui múltiplos módulos (batch)
3. **check_unit_module_access**: Verifica se unidade tem acesso a módulo

#### View Agregada
```sql
CREATE VIEW unit_modules_summary AS
SELECT 
    unit_id,
    COUNT(module_id) as module_count,
    ARRAY_AGG(m.name ORDER BY m.name) as module_names
FROM unit_modules um
JOIN modules m ON um.module_id = m.id
GROUP BY unit_id;
```

### Fase 2: Camada de Serviços ✅

**Arquivo**: `services/units/unitModules.service.ts`

#### Funções Implementadas (9 total)

```typescript
// CRUD Básico
export async function fetchUnitModules(unitId: string)
export async function assignModuleToUnit(unitId: string, moduleId: string)
export async function removeModuleFromUnit(unitId: string, moduleId: string)

// Batch Operations
export async function assignModulesToUnit(unitId: string, moduleIds: string[])
export async function updateUnitModules(unitId: string, moduleIds: string[])

// Queries
export async function fetchUnitModuleIds(unitId: string): Promise<string[]>
export async function fetchUnitModuleAssignments()
export async function fetchUnitModulesSummary()

// Validação
export async function checkUnitModuleAccess(unitId: string, moduleId: string)
```

**Arquivo**: `services/auth/users.service.ts`

#### updateUserAssignments (Enhanced)
```typescript
export async function updateUserAssignments(
  userId: string,
  unitIds: string[],
  moduleIds: string[]
): Promise<void> {
  // 1. Delete existing user_units
  // 2. Insert new user_units
  // 3. Delete existing user_modules
  // 4. Insert new user_modules
  // Com logging abrangente para debug
}
```

### Fase 3: Interface de Usuário ✅

#### ManageUnitsPage - Aba "Módulos"

**Localização**: `components/pages/ManageUnitsPage.tsx`

**Features**:
- Grid de checkboxes (2 colunas, responsivo)
- Lista módulos ativos (`is_active = true`)
- Pré-seleção baseada em `unit_modules`
- Feedback visual: Salvando... → Salvo! → Salvar Módulos
- Estados gerenciados:
  ```typescript
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [selectedModuleIds, setSelectedModuleIds] = useState<Set<string>>(new Set());
  const [modulesLoading, setModulesLoading] = useState(false);
  const [savingModules, setSavingModules] = useState(false);
  const [modulesSaved, setModulesSaved] = useState(false);
  ```

#### UserFormModal - Aba "Módulos"

**Localização**: `components/ui/UserFormModal.tsx`

**Features**:
- **Multi-unit**: Dropdown para selecionar unidade
- Checkboxes filtrados dinamicamente por unidade
- Módulos disponíveis = `unit_modules` da unidade selecionada
- Comportamento específico por perfil:
  - Super Admin: Desabilitado (acesso automático)
  - Admin: Visualização (não salva, herda tudo)
  - User: Edição (salva em `user_modules`)

**Estados gerenciados**:
```typescript
const [selectedUnitForModules, setSelectedUnitForModules] = useState<string>('');
const [modulesByUnit, setModulesByUnit] = useState<Map<string, Set<string>>>(new Map());
const [allModulesCache, setAllModulesCache] = useState<Module[]>([]);
```

### Fase 4: Lógica de Autenticação ✅

**Arquivo**: `contexts/AuthContext.tsx`

#### getModulesForUnit(unitId: string)

```typescript
const getModulesForUnit = useCallback((unitId: string): Module[] => {
  if (!profile || !unitId) return [];

  // Super Admin: apenas módulos super_admin
  if (profile.role === 'super_admin') {
    return userModules.filter(m => 
      Array.isArray(m.allowed_profiles) && 
      m.allowed_profiles.includes('super_admin')
    );
  }

  // Admin: todos os módulos da unidade
  if (profile.role === 'admin') {
    const unitModuleIds = new Set(
      await fetchUnitModuleIds(unitId)
    );
    return userModules.filter(m => unitModuleIds.has(m.id));
  }

  // User: interseção user_modules ∩ unit_modules
  const unitModuleIds = new Set(
    await fetchUnitModuleIds(unitId)
  );
  return userModules.filter(m => 
    selectedModules.has(m.id) && unitModuleIds.has(m.id)
  );
}, [profile, userModules, selectedModules]);
```

**Arquivo**: `contexts/AppContext.tsx`

#### Inicialização e Navegação

```typescript
// Inicialização: carrega primeiro módulo ativo da unidade
useEffect(() => {
  if (profile && selectedUnit && !hasInitialized) {
    const modules = getModulesForUnit(selectedUnit);
    const firstModule = modules.find(m => m.is_active);
    
    if (firstModule) {
      // Detecta view_id e navega corretamente
      const viewIdNorm = firstModule.view_id?.trim();
      const internalView = firstModule.internal_url?.startsWith('internal://')
        ? firstModule.internal_url.replace('internal://', '')
        : null;
      
      setView(viewIdNorm || internalView || firstModule.code);
    }
    setHasInitialized(true);
  }
}, [profile, selectedUnit, hasInitialized]);

// Mudança de unidade: recarrega primeiro módulo
useEffect(() => {
  if (selectedUnit && hasInitialized) {
    const modules = getModulesForUnit(selectedUnit);
    const firstModule = modules.find(m => m.is_active);
    // ... navegação
  }
}, [selectedUnit]);
```

### Fase 5: Testes e Correções ✅

#### Bugs Corrigidos

1. **SQL "position" keyword error**: Wrapped em quotes
2. **Module interface mismatch**: Adicionados campos opcionais
3. **Save button white screen**: React state vs DOM manipulation
4. **Admin scope bug**: Filtro por unidade em vez de global
5. **Fallback logic**: Retorna `[]` em vez de `userModules`
6. **Dynamic filtering**: Unit selector com filtro real-time
7. **Checkbox reactivity**: Immutable Set updates
8. **Content reload**: `selectedUnit` dependency
9. **Modal white screen**: Reload antes de fechar
10. **Navigation bug**: view_id detection correta
11. **Select tag duplicate**: Syntax error corrigido

#### Validações

✅ Módulos salvam corretamente no banco  
✅ Console logs confirmam: `user_modules inseridos com sucesso`  
✅ Build completa sem erros (740kb → 163kb brotli)  
✅ Unit selector funciona em multi-unit  
✅ Filtro dinâmico responde corretamente  
✅ Auto-reload ao mudar unidade  
✅ Navegação para views corretas  

## Fluxos de Uso

### 1. Configurar Módulos da Unidade

```
┌─────────────────────────────────────────────────────────┐
│ ADMIN/SUPER ADMIN                                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Acessar "Gerenciar Unidades"                        │
│  2. Clicar no botão "Editar" da unidade                 │
│  3. Navegar para aba "Módulos"                          │
│  4. Marcar checkboxes dos módulos desejados             │
│  5. Clicar "Salvar Módulos"                             │
│                                                          │
│  Backend:                                                │
│  ├─ DELETE FROM unit_modules WHERE unit_id = ?         │
│  └─ INSERT INTO unit_modules (unit_id, module_id) ...  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 2. Atribuir Módulos a Usuário (Role: User)

```
┌─────────────────────────────────────────────────────────┐
│ ADMIN                                                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Acessar "Gerenciar Usuários"                        │
│  2. Clicar no botão "Editar" do usuário                 │
│  3. Navegar para aba "Módulos"                          │
│  4. Selecionar unidade no dropdown (se multi-unit)      │
│  5. Marcar checkboxes dos módulos específicos           │
│  6. Clicar "Salvar"                                     │
│                                                          │
│  Backend:                                                │
│  ├─ DELETE FROM user_modules WHERE user_id = ?         │
│  └─ INSERT INTO user_modules (user_id, module_id) ...  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 3. Login e Navegação

```
┌─────────────────────────────────────────────────────────┐
│ QUALQUER USUÁRIO                                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Login → AuthContext carrega profile                 │
│  2. AppContext.initialize()                             │
│     └─ getModulesForUnit(selectedUnit)                 │
│         ├─ super_admin: módulos com SA em allowed      │
│         ├─ admin: todos da unidade                      │
│         └─ user: interseção user ∩ unit                │
│  3. Sidebar renderiza módulos filtrados                 │
│  4. Navega para primeiro módulo ativo                   │
│     └─ Detecta view_id ou internal_url                 │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Console Logs (Debug)

Para facilitar troubleshooting, os seguintes logs estão disponíveis:

```typescript
// Carregamento de módulos
[UserFormModal] Módulos carregados do usuário: [moduleId1, moduleId2, ...]
[UserFormModal] modulesByUnit inicializado: Map(2) { ... }

// Interação com checkboxes
[handleModuleToggle] Toggling module: 0ed70987-... for unit: abc123...
[handleModuleToggle] Adicionando módulo: 0ed70987-...
[Render checkbox Dashboard] isChecked: true currentUnitModules: [...]

// Salvamento
[updateUserAssignments] Inserindo user_modules: [{user_id: ..., module_id: ...}]
[updateUserAssignments] user_modules inseridos com sucesso
```

## Boas Práticas

### Para Desenvolvedores

1. **Imutabilidade de Sets**:
   ```typescript
   // ✅ Correto
   setModulesByUnit(prev => {
     const newMap = new Map(prev);
     const updated = new Set(currentSet);
     updated.add(moduleId);
     newMap.set(unitId, updated);
     return newMap;
   });
   
   // ❌ Incorreto
   currentSet.add(moduleId); // Não dispara re-render
   ```

2. **Filtrar null em listas**:
   ```typescript
   // ✅ Correto
   {array
     .map(item => transform(item))
     .filter((item): item is NonNullable<typeof item> => item !== undefined)
     .map(item => <Component key={item.id} />)
   }
   ```

3. **Reload antes de fechar modal**:
   ```typescript
   // ✅ Correto
   await loadUsers();
   handleCloseModal();
   
   // ❌ Incorreto
   handleCloseModal(); // Tela branca
   loadUsers(); // Tarde demais
   ```

### Para Administradores

1. **Ordem de configuração**:
   - Primeiro: Configure módulos da unidade
   - Depois: Atribua usuários à unidade
   - Por último: Configure módulos específicos do usuário

2. **Perfis**:
   - Use `user` para controle granular
   - Use `admin` quando precisar de acesso total à unidade
   - Use `super_admin` apenas para administração global

3. **Multi-unit**:
   - Usuários com múltiplas unidades precisam ter módulos configurados por unidade
   - Use o dropdown na aba "Módulos" para alternar entre unidades

## Troubleshooting

### Módulos não aparecem na Sidebar

**Sintomas**: Usuário logado não vê módulos esperados

**Verificações**:
1. `unit_modules`: Verifique se módulo está atribuído à unidade
2. `user_modules`: Para role `user`, verifique se está atribuído ao usuário
3. `modules.is_active`: Verifique se módulo está ativo
4. Console: Procure logs de `getModulesForUnit`

### Checkboxes não marcam

**Sintomas**: Clicar em checkbox não muda estado visual

**Verificações**:
1. Imutabilidade: Verifique se está usando `new Set(oldSet)`
2. Dependencies: Verifique `useEffect` dependencies
3. Console: Procure logs de `handleModuleToggle`

### Tela branca ao salvar

**Sintomas**: Modal fecha mas página fica branca

**Verificações**:
1. Ordem: Verifique se `await loadData()` vem antes de `handleCloseModal()`
2. Errors: Verifique console para erros assíncronos
3. State: Verifique se estados estão sendo resetados corretamente

## Métricas de Sucesso

- ✅ 0 erros de compilação
- ✅ Build otimizado (740kb → 163kb brotli)
- ✅ 11 bugs identificados e corrigidos
- ✅ Console logs confirmam salvamento correto
- ✅ Navegação funciona em todas as combinações de perfil/unidade
- ✅ Multi-unit suportado com filtro dinâmico

## Próximos Passos (Futuro)

1. **RLS Restritivo**: Migrar de políticas permissivas para baseadas em JWT
2. **Cache**: Implementar cache de `unit_modules` no frontend
3. **Batch RPC**: Criar RPC única para múltiplas operações (performance)
4. **Auditoria**: Log de mudanças em `unit_modules` (quem/quando)
5. **UI Visual**: Coluna mostrando módulos atribuídos em ManageUsersPage

## Referências

- Migração SQL: `docs/sql/2025-11-11_unit_modules.sql`
- Serviço: `services/units/unitModules.service.ts`
- Contexto: `contexts/AuthContext.tsx`
- UI Unidades: `components/pages/ManageUnitsPage.tsx`
- UI Usuários: `components/ui/UserFormModal.tsx`

---

**Documentação mantida por**: Equipe DromeFlow  
**Última atualização**: 11 de novembro de 2025
