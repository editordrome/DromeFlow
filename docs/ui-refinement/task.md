# Projeto DromeFlow - Tarefas

## ✅ COMPLETO - Correção do Valor de Uniforme em Documentos Contratuais
- [x] Diagnóstico do problema (RPC get_user_units)
- [x] Criação e aplicação da migration SQL
- [x] Ajustes de tipos no frontend e backend
- [x] Substituição de placeholders em Contrato e Aditamento
- [x] Verificação final do fluxo de dados

## ✅ COMPLETO - Coluna de Data de Assinatura
- [x] Criar migration para adicionar coluna `assinatura` em `recrutadora` e `profissionais`
- [x] Aplicar migration no banco
- [x] Atualizar interface TypeScript `RecrutadoraCard`
- [x] Adicionar campo `assinatura` na aba Documentos do módulo Recrutadora

## ✅ COMPLETO - Implementar aba Documentos no módulo Profissionais
- [x] Atualizar `ProfissionalDetailModal.tsx`
  - [x] Adicionar estado `editAssinatura` e lógica de atualização
  - [x] Adicionar aba "Documentos" na navegação
  - [x] Implementar layout da aba Documentos (campo data + botões)
  - [x] Adicionar lógica de geração de documentos (Ficha, Aditamento, Contrato, etc.)
- [x] Atualizar `ProfissionalFormModal.tsx` para consistência
  - [x] Sincronizar campo `assinatura`
  - [x] Implementar aba Documentos e botões de geração de documentos
- [x] Atualizar `profissionais.service.ts`
  - [x] Adicionar campo `assinatura` ao tipo `Profissional`
  - [x] Expandir campos permitidos no `updateProfissional` e `createProfissional`
- [x] Refinamentos na aba Documentos
  - [x] Ajustar botões para ficarem na mesma linha (layout horizontal)
  - [x] Adicionar documento "Distrato" em `ProfissionalDetailModal.tsx`
  - [x] Adicionar documento "Distrato" em `ProfissionalFormModal.tsx`
  - [x] Verificar layout e geração de todos os 6 documentos
## ✅ COMPLETO - Padronização e Remoção de botões (Módulos Profissionais e Recrutadora)
- [x] Remover botão "Ficha" na aba Documentos do módulo Profissionais (`Detail` e `Form`)
- [x] Remover botões "Distrato" e "Notificação" na aba Documentos do módulo Recrutadora
- [x] Ajustar layout do módulo Recrutadora para exibição horizontal (uma linha)
- [x] Padronizar o layout do modal Profissionais seguindo o design do modal Recrutadora
- [x] Resolver inconsistências de JSX e lint em `ProfissionalDetailModal.tsx`

## ✅ COMPRETO - Unificação Total da Identidade Visual (UI Premium)
- [x] Padronizar containers (bordas, sombras, overflow) em ambos os modais Profissionais
- [x] Reorganizar cabeçalho do `ProfissionalDetailModal` (Ícone de cor, Unidade, ID, Status)
- [x] Migrar botões de ação (Salvar/Editar) para o rodapé no `ProfissionalDetailModal`
- [x] Sincronizar estilos de abas e paddings com o `RecrutadoraCardModal`
- [x] Verificar e padronizar rodapé do `ProfissionalFormModal`
- [x] Refatorar layout de TODAS as abas do `ProfissionalDetailModal` (Grid Premium, Estilos de Input)
  - [x] 'Início' Tab
  - [x] 'Dados' Tab
  - [x] 'Histórico' Tab
- [x] Refatorar layout de TODAS as abas do `ProfissionalFormModal` (Grid Premium, Estilos de Input)
  - [x] 'Dados' Tab
  - [x] 'Atendimentos/Pós-venda' Tab
  - [x] 'Observação' Tab
- [x] **BUGFIX**: Corrigir erro de atualização "invalid input syntax for type date" (sanitizar datas vazias) e `unit_id` nulo (prevenir desaparecimento da lista)
