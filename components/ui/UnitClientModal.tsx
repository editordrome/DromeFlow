import React, { useEffect, useState } from 'react';
import { UnitClient } from '../../types';
import { Icon } from './Icon';
import { updateUnitClient, deleteUnitClient } from '../../services/data/clientsDirectory.service';

interface UnitClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: UnitClient | null;
  onSaved?: (updated: UnitClient) => void;
  onDeleted?: (id: string) => void;
}

const UnitClientModal: React.FC<UnitClientModalProps> = ({ isOpen, onClose, item, onSaved, onDeleted }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Partial<UnitClient>>({});
  const [busy, setBusy] = useState<'idle' | 'saving' | 'deleting'>('idle');

  useEffect(() => {
    if (item) {
      setForm({ nome: item.nome, tipo: item.tipo, endereco: item.endereco, contato: item.contato });
      setIsEditing(false);
      setBusy('idle');
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!item) return;
    setBusy('saving');
    try {
      const updated = await updateUnitClient(item.id, {
        nome: (form.nome || '').trim() || item.nome,
        tipo: (form.tipo ?? null) as any,
        endereco: (form.endereco ?? null) as any,
        contato: (form.contato ?? null) as any,
      });
      onSaved && onSaved(updated);
      setIsEditing(false);
    } catch (e: any) {
      alert(e?.message || 'Falha ao salvar');
    } finally {
      setBusy('idle');
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    if (!confirm('Excluir este cliente do cadastro da unidade?')) return;
    setBusy('deleting');
    try {
      await deleteUnitClient(item.id);
      onDeleted && onDeleted(item.id);
      onClose();
    } catch (e: any) {
      alert(e?.message || 'Falha ao excluir');
    } finally {
      setBusy('idle');
    }
  };

  const Row: React.FC<{ label: string; value: React.ReactNode }>= ({ label, value }) => (
    <div>
      <p className="text-xs font-semibold uppercase text-text-secondary tracking-wider">{label}</p>
      <p className="text-sm text-text-primary break-words">{value || <span className="text-text-tertiary">-</span>}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-lg mx-4 bg-bg-secondary rounded-lg shadow-lg" onClick={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-secondary">
          <h2 className="text-lg font-bold text-text-primary truncate" title={item.nome}>{item.nome}</h2>
          <button onClick={onClose} className="p-1 rounded text-text-secondary hover:bg-bg-tertiary"><Icon name="close" /></button>
        </div>

        <div className="p-4 space-y-4">
          {!isEditing ? (
            <div className="grid grid-cols-1 gap-3">
              <Row label="Nome" value={item.nome} />
              <Row label="Tipo" value={item.tipo} />
              <Row label="Endereço" value={item.endereco} />
              <Row label="Contato" value={item.contato} />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary">Nome</label>
                <input name="nome" value={form.nome || ''} onChange={handleChange} className="mt-1 w-full px-3 py-2 rounded-md border bg-bg-secondary border-border-secondary focus:outline-none focus:ring-2 focus:ring-accent-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary">Tipo</label>
                <input name="tipo" value={form.tipo || ''} onChange={handleChange} className="mt-1 w-full px-3 py-2 rounded-md border bg-bg-secondary border-border-secondary focus:outline-none focus:ring-2 focus:ring-accent-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary">Endereço</label>
                <input name="endereco" value={form.endereco || ''} onChange={handleChange} className="mt-1 w-full px-3 py-2 rounded-md border bg-bg-secondary border-border-secondary focus:outline-none focus:ring-2 focus:ring-accent-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary">Contato</label>
                <input name="contato" value={form.contato || ''} onChange={handleChange} className="mt-1 w-full px-3 py-2 rounded-md border bg-bg-secondary border-border-secondary focus:outline-none focus:ring-2 focus:ring-accent-primary" />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-border-secondary">
          <button
            type="button"
            onClick={() => setIsEditing(e => !e)}
            className="px-3 py-2 text-sm rounded-md border border-border-secondary text-text-secondary hover:bg-bg-tertiary"
            disabled={busy !== 'idle'}
          >
            {isEditing ? 'Cancelar' : 'Editar'}
          </button>
          <div className="flex items-center gap-2">
            {isEditing && (
              <button
                type="button"
                onClick={handleSave}
                disabled={busy !== 'idle'}
                className="px-3 py-2 text-sm font-medium text-white rounded-md bg-accent-primary hover:bg-accent-secondary disabled:opacity-60"
              >
                {busy === 'saving' ? 'Salvando…' : 'Salvar'}
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy !== 'idle'}
              className="px-3 py-2 text-sm rounded-md bg-danger/80 text-white hover:bg-danger disabled:opacity-60"
            >
              {busy === 'deleting' ? 'Excluindo…' : 'Excluir'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnitClientModal;
