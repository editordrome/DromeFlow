import React, { useEffect, useState } from 'react';
import type { ComercialCard } from '../../types';
import { activityLogger } from '../../services/utils/activityLogger.service';
import { useAuth } from '../../contexts/AuthContext';
import { useAppContext } from '../../contexts/AppContext';
import { Icon } from './Icon';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  unidadeNome: string;
  defaultStatus: string;
  unitId?: string;
  initialCard?: ComercialCard | null;
  onDelete?: (id: string) => Promise<void>;
  onCreate?: (payload: Partial<ComercialCard>) => Promise<void>;
  onUpdate?: (id: string, payload: Partial<ComercialCard>) => Promise<void>;
}

const STATUS_OPTIONS = [
  { value: 'leads', label: 'Leads' },
  { value: 'andamento', label: 'Em andamento' },
  { value: 'ganhos', label: 'Ganhos' },
  { value: 'perdidos', label: 'Perdidos' },
];

const ComercialCardModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSaved,
  unidadeNome,
  defaultStatus,
  unitId,
  initialCard,
  onDelete,
  onCreate,
  onUpdate,
}) => {
  const { profile } = useAuth();
  const { selectedUnit } = useAppContext();
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('');
  const [endereco, setEndereco] = useState('');
  const [contato, setContato] = useState('');
  const [origem, setOrigem] = useState('');
  const [status, setStatus] = useState(defaultStatus);
  const [observacao, setObservacao] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSaving(false);
    setIsEditing(!initialCard); // Modo edição ativo apenas para novos registros
    if (initialCard) {
      setNome(initialCard.nome || '');
      setTipo(initialCard.tipo || '');
      setEndereco(initialCard.endereco || '');
      setContato(initialCard.contato || '');
      setOrigem(initialCard.origem || '');
      setStatus(initialCard.status || defaultStatus);
      setObservacao(initialCard.observacao || '');
    } else {
      setNome('');
      setTipo('');
      setEndereco('');
      setContato('');
      setOrigem('');
      setStatus(defaultStatus);
      setObservacao('');
    }
  }, [isOpen, initialCard, defaultStatus]);

  // Auto-save status changes for existing cards
  const handleStatusChange = async (newStatus: string) => {
    setStatus(newStatus);
    
    if (initialCard && onUpdate) {
      try {
        // Save silently without triggering full reload
        await onUpdate(initialCard.id, { status: newStatus });
        // Don't call onSaved() to avoid screen refresh
      } catch (e: any) {
        setError(e.message || 'Falha ao atualizar o status.');
        // Revert status on error
        setStatus(initialCard.status || defaultStatus);
      }
    }
  };

  // Auto-save observações for existing cards
  const handleObservacaoChange = async (newObservacao: string) => {
    setObservacao(newObservacao);
    
    if (initialCard && onUpdate) {
      try {
        // Save silently without triggering full reload
        await onUpdate(initialCard.id, { observacao: newObservacao.trim() || null });
        // Don't call onSaved() to avoid screen refresh
      } catch (e: any) {
        setError(e.message || 'Falha ao atualizar observações.');
      }
    }
  };

  // Auto-save tipo for existing cards
  const handleTipoChange = async (newTipo: string) => {
    setTipo(newTipo);
    
    if (initialCard && onUpdate) {
      try {
        await onUpdate(initialCard.id, { tipo: newTipo.trim() || null });
      } catch (e: any) {
        setError(e.message || 'Falha ao atualizar tipo.');
      }
    }
  };

  // Auto-save origem for existing cards
  const handleOrigemChange = async (newOrigem: string) => {
    setOrigem(newOrigem);
    
    if (initialCard && onUpdate) {
      try {
        await onUpdate(initialCard.id, { origem: newOrigem.trim() || null });
      } catch (e: any) {
        setError(e.message || 'Falha ao atualizar origem.');
      }
    }
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      setError('Informe o nome do contato.');
      return;
    }
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Partial<ComercialCard> = {
        nome: nome.trim(),
        tipo: tipo.trim() || null,
        endereco: endereco.trim() || null,
        contato: contato.trim() || null,
        origem: origem.trim() || null,
        status,
        observacao: observacao.trim() || null,
      } as Partial<ComercialCard>;

      if (initialCard && onUpdate) {
        await onUpdate(initialCard.id, payload);
        setIsEditing(false); // Sai do modo edição após salvar
      } else if (!initialCard && onCreate) {
        if (!unitId) {
          throw new Error('Selecione uma unidade para criar oportunidades.');
        }
        payload.unit_id = unitId;
        await onCreate(payload);
      }
      
      // Registrar atividade comercial
      if (profile && selectedUnit) {
        const actionCode = initialCard ? 'update_comercial' : 'create_comercial';
        const logMethod = initialCard ? activityLogger.logComercialUpdate : activityLogger.logComercialCreate;
        logMethod(
          profile.email || profile.name,
          selectedUnit,
          'success'
        );
      }

      onSaved();
      if (!initialCard) {
        onClose(); // Fecha apenas para novos registros
      }
    } catch (e: any) {
      setError(e.message || 'Falha ao salvar o registro.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initialCard || !onDelete || saving) return;
    if (!confirm('Excluir este registro comercial?')) return;
    setSaving(true);
    setError(null);
    try {
      await onDelete(initialCard.id);
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Falha ao excluir.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-2xl rounded-xl bg-bg-secondary shadow-2xl overflow-hidden">
        {/* Header compacto com status */}
        <div className="relative bg-gradient-to-r from-accent-primary/5 to-brand-cyan/5 border-b border-border-secondary px-5 py-3.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-text-primary">
                {initialCard ? 'Oportunidade' : 'Nova Oportunidade'}
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                <Icon name="building" className="w-3.5 h-3.5" />
                <span>{unidadeNome}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Status ao lado do botão fechar */}
              <label className="flex flex-col gap-1.5 min-w-[140px]">
                <span className="text-xs font-medium text-text-secondary">Status</span>
                <select
                  value={status}
                  onChange={e => handleStatusChange(e.target.value)}
                  className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              
              <button 
                onClick={onClose} 
                className="text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg p-1.5 transition-colors mt-5"
                aria-label="Fechar"
              >
                <Icon name="close" className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Body com scroll */}
        <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
          {error && (
            <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 flex items-start gap-2">
              <Icon name="alert" className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
              <span className="text-xs text-danger">{error}</span>
            </div>
          )}

          <div className="space-y-3">
            {/* Nome, Tipo e Origem na mesma linha */}
            <div className="flex gap-3">
              {/* Nome - Modo Visualização/Edição */}
              {isEditing ? (
                <label className="flex-1 flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-text-secondary flex items-center gap-1">
                    Nome <span className="text-danger">*</span>
                  </span>
                  <input
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                    placeholder="Ex.: Loja XPTO"
                    autoFocus={!initialCard}
                  />
                </label>
              ) : (
                <div className="flex-1">
                  <p className="text-xs font-medium text-text-secondary mb-1.5">Nome</p>
                  <p className="text-sm text-text-primary">{nome || '-'}</p>
                </div>
              )}

              {/* Tipo - Sempre editável com auto-save */}
              <label className="w-32 flex flex-col gap-1.5">
                <span className="text-xs font-medium text-text-secondary">Tipo</span>
                <select
                  value={tipo}
                  onChange={e => handleTipoChange(e.target.value)}
                  className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                >
                  <option value="">Selecione...</option>
                  <option value="Residencial">Residencial</option>
                  <option value="Comercial">Comercial</option>
                  <option value="Pós-Obra">Pós-Obra</option>
                </select>
              </label>

              {/* Origem - Sempre editável com auto-save */}
              <label className="w-28 flex flex-col gap-1.5">
                <span className="text-xs font-medium text-text-secondary">Origem</span>
                <select
                  value={origem}
                  onChange={e => handleOrigemChange(e.target.value)}
                  className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                >
                  <option value="">Selecione...</option>
                  <option value="Whatsapp">Whatsapp</option>
                  <option value="Ligação">Ligação</option>
                  <option value="E-mail">E-mail</option>
                </select>
              </label>
            </div>

            {/* Endereço e Contato - Modo Visualização/Edição */}
            {isEditing ? (
              <div className="grid grid-cols-12 gap-3">
                <label className="col-span-12 md:col-span-9 flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-text-secondary">
                    Endereço
                  </span>
                  <input
                    value={endereco}
                    onChange={e => setEndereco(e.target.value)}
                    className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                    placeholder="Rua, número, bairro..."
                  />
                </label>
                <label className="col-span-12 md:col-span-3 flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-text-secondary">
                    Contato
                  </span>
                  <input
                    value={contato}
                    onChange={e => setContato(e.target.value)}
                    className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                    placeholder="Telefone..."
                  />
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12 md:col-span-9">
                  <p className="text-xs font-medium text-text-secondary mb-1.5">Endereço</p>
                  <p className="text-sm text-text-primary">{endereco || '-'}</p>
                </div>
                <div className="col-span-12 md:col-span-3">
                  <p className="text-xs font-medium text-text-secondary mb-1.5">Contato</p>
                  <p className="text-sm text-text-primary">{contato || '-'}</p>
                </div>
              </div>
            )}

            {/* Observações - Sempre editável com auto-save */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-secondary">Observações</span>
              <textarea
                value={observacao}
                onChange={e => handleObservacaoChange(e.target.value)}
                rows={3}
                className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all resize-none"
                placeholder="Notas adicionais..."
              />
            </label>
          </div>
        </div>

        {/* Footer compacto */}
        <div className="flex items-center justify-between border-t border-border-secondary bg-bg-tertiary px-5 py-3">
          <div className="flex items-center gap-1 text-xs text-text-secondary">
            <Icon name="info" className="w-3 h-3" />
            <span>* Obrigatório</span>
          </div>
          <div className="flex items-center gap-2">
            {initialCard && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-lg p-2 text-danger hover:bg-danger/10 border border-danger/30 focus:outline-none focus:ring-2 focus:ring-danger/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={saving}
                title="Excluir"
              >
                <Icon name="delete" className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (!isEditing) {
                  setIsEditing(true);
                } else {
                  handleSave();
                }
              }}
              className="rounded-lg bg-accent-primary p-2.5 text-white hover:bg-accent-primary/90 focus:outline-none focus:ring-2 focus:ring-accent-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent-primary/20"
              disabled={saving}
              title={saving ? "Salvando..." : isEditing ? "Salvar" : "Editar"}
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <Icon name={isEditing ? "Check" : "edit"} className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComercialCardModal;
