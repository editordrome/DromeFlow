import React, { useEffect, useState } from 'react';
import type { ComercialCard } from '../../types';
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

const TYPE_OPTIONS: Array<{ value: Exclude<ComercialCard['tipo'], null>; label: string }> = [
  { value: 'Residencial', label: 'Residencial' },
  { value: 'Comercial', label: 'Comercial' },
  { value: 'Pós Obra', label: 'Pós Obra' },
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
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<ComercialCard['tipo']>(null);
  const [endereco, setEndereco] = useState('');
  const [contato, setContato] = useState('');
  const [status, setStatus] = useState(defaultStatus);
  const [observacao, setObservacao] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSaving(false);
    if (initialCard) {
      setNome(initialCard.nome || '');
  setTipo(initialCard.tipo ?? null);
      setEndereco(initialCard.endereco || '');
      setContato(initialCard.contato || '');
      setStatus(initialCard.status || defaultStatus);
      setObservacao(initialCard.observacao || '');
    } else {
      setNome('');
  setTipo(null);
      setEndereco('');
      setContato('');
      setStatus(defaultStatus);
      setObservacao('');
    }
  }, [isOpen, initialCard, defaultStatus]);

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
  tipo,
        endereco: endereco.trim() || null,
        contato: contato.trim() || null,
        status,
        observacao: observacao.trim() || null,
      } as Partial<ComercialCard>;

      if (initialCard && onUpdate) {
        await onUpdate(initialCard.id, payload);
      } else if (!initialCard && onCreate) {
        if (!unitId) {
          throw new Error('Selecione uma unidade para criar oportunidades.');
        }
        payload.unit_id = unitId;
        await onCreate(payload);
      }

      onSaved();
      onClose();
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
      <div className="w-full max-w-2xl rounded-lg bg-bg-secondary shadow-xl">
        <div className="flex items-center justify-between border-b border-border-secondary px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{initialCard ? 'Editar oportunidade' : 'Nova oportunidade'}</h2>
            <p className="text-sm text-text-secondary">Unidade: {unidadeNome}</p>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <Icon name="close" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error && <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-text-secondary">
              Nome*
              <input
                value={nome}
                onChange={e => setNome(e.target.value)}
                className="rounded-md border border-border-secondary bg-bg-tertiary px-3 py-2 text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/40"
                placeholder="Ex.: Loja XPTO"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-text-secondary">
              Tipo
              <select
                value={tipo ?? ''}
                onChange={e => {
                  const value = e.target.value as Exclude<ComercialCard['tipo'], null> | '';
                  setTipo(value === '' ? null : value);
                }}
                className="rounded-md border border-border-secondary bg-bg-tertiary px-3 py-2 text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/40"
              >
                <option value="">Selecione</option>
                {TYPE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-text-secondary">
              Endereço
              <input
                value={endereco}
                onChange={e => setEndereco(e.target.value)}
                className="rounded-md border border-border-secondary bg-bg-tertiary px-3 py-2 text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/40"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-text-secondary">
              Contato
              <input
                value={contato}
                onChange={e => setContato(e.target.value)}
                className="rounded-md border border-border-secondary bg-bg-tertiary px-3 py-2 text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/40"
                placeholder="Telefone, email..."
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-text-secondary">
              Status
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="rounded-md border border-border-secondary bg-bg-tertiary px-3 py-2 text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/40"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-text-secondary">
              Observação
              <textarea
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                className="h-24 rounded-md border border-border-secondary bg-bg-tertiary px-3 py-2 text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/40"
              />
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border-secondary bg-bg-tertiary px-5 py-3">
          <div className="text-xs text-text-secondary">* Campos obrigatórios</div>
          <div className="flex items-center gap-2">
            {initialCard && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-md border border-danger/50 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/10 focus:outline-none focus:ring-2 focus:ring-danger/60"
                disabled={saving}
              >
                Excluir
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border-secondary px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary focus:outline-none focus:ring-2 focus:ring-border-secondary"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-md bg-accent-primary px-4 py-2 text-sm font-semibold text-text-on-accent hover:bg-accent-primary/90 focus:outline-none focus:ring-2 focus:ring-accent-primary"
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComercialCardModal;
