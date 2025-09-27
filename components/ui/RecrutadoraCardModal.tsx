import React, { useEffect, useState } from 'react';
import { RecrutadoraCard } from '../../types';
import { Icon } from './Icon';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  unidade: string;
  defaultStatus?: string; // usado na criação
  initialCard?: RecrutadoraCard | null; // se presente, edição
  onDelete?: (id: number) => Promise<void>;
  onCreate?: (payload: Partial<RecrutadoraCard>) => Promise<void>;
  onUpdate?: (id: number, payload: Partial<RecrutadoraCard>) => Promise<void>;
}

const RecrutadoraCardModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSaved,
  unidade,
  defaultStatus,
  initialCard,
  onDelete,
  onCreate,
  onUpdate,
}) => {
  const isEditing = !!initialCard;
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [color, setColor] = useState<string | null>('#4ade80');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErr(null);
    setSaving(false);
    if (initialCard) {
      setNome(initialCard.nome || '');
      setWhatsapp(initialCard.whatsapp || '');
      setColor(initialCard.color_card || '#4ade80');
    } else {
      setNome('');
      setWhatsapp('');
      setColor('#4ade80');
    }
  }, [isOpen, initialCard]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setErr(null);
    try {
      if (isEditing && initialCard && onUpdate) {
        await onUpdate(initialCard.id, { nome, whatsapp, color_card: color });
      } else if (!isEditing && onCreate && defaultStatus) {
        await onCreate({ nome, whatsapp, color_card: color, status: defaultStatus, unidade });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message || 'Falha ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditing || !initialCard || !onDelete || saving) return;
    if (!confirm('Excluir este card?')) return;
    setSaving(true);
    setErr(null);
    try {
      await onDelete(initialCard.id);
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message || 'Falha ao excluir');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true" role="dialog">
      <div className="w-full max-w-md p-6 mx-4 bg-bg-secondary rounded-lg shadow-lg">
        <div className="flex items-center justify-between pb-3 border-b border-border-primary">
          <h2 className="text-xl font-bold text-text-primary">{isEditing ? 'Editar Card' : 'Novo Card'}</h2>
          <button onClick={onClose} className="p-1 rounded-full text-text-secondary hover:bg-bg-tertiary" disabled={saving}>
            <Icon name="close" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {defaultStatus && !isEditing && (
            <div className="text-sm text-text-secondary">Coluna: <span className="font-semibold text-text-primary">{defaultStatus}</span></div>
          )}
          <div>
            <label className="block text-sm mb-1 text-text-secondary">Nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full px-3 py-2 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none"
              placeholder="Nome da candidata(o)"
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-text-secondary">WhatsApp</label>
            <input
              type="text"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="w-full px-3 py-2 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none"
              placeholder="55999990000"
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-text-secondary">Cor do Card</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color || '#4ade80'}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-12 p-0 bg-transparent border border-border-secondary rounded cursor-pointer"
              />
              <input
                type="text"
                value={color || ''}
                onChange={(e) => setColor(e.target.value || null)}
                className="flex-1 px-3 py-2 rounded bg-bg-tertiary text-text-primary border border-border-secondary focus:outline-none"
                placeholder="#4ade80"
              />
            </div>
          </div>
          {err && <div className="text-sm text-danger bg-danger/10 p-2 rounded">{err}</div>}
        </div>

        <div className="flex justify-between items-center pt-6 mt-6 border-t border-border-primary">
          {isEditing ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="px-3 py-2 text-sm font-medium text-danger border border-danger/50 rounded hover:bg-danger/10 disabled:opacity-50"
            >
              Excluir
            </button>
          ) : <span />}
          <div className="space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium border rounded-md text-text-secondary border-border-secondary hover:bg-bg-tertiary disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md bg-accent-primary hover:bg-accent-secondary disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecrutadoraCardModal;
