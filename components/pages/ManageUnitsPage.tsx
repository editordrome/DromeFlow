import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAllUnits, createUnit, updateUnit, deleteUnit } from '../../services/units/units.service';
import { fetchUsersForUnit, updateUser, createUser } from '../../services/auth/users.service';
import { Unit, UnitKey } from '../../types';
import { Icon } from '../ui/Icon';
import { useAuth } from '../../contexts/AuthContext';
import { fetchUnitKeys, createUnitKey, updateUnitKey, deleteUnitKey } from '../../services/units/unitKeys.service';
import { User as UserType, Profile as ProfileType } from '../../types';
import { UserFormModal } from '../ui/UserFormModal';

type UnitDataPayload = Partial<Unit>;

const UnitFormModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (unit: UnitDataPayload) => void;
  unit: Unit | null;
  onDelete: (unitId: string) => void;
}> = ({ isOpen, onClose, onSave, unit, onDelete }) => {
  const { profile } = useAuth();
  const [formData, setFormData] = useState({
    unit_name: '',
    unit_code: '',
  });
  const [error, setError] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [unitUsers, setUnitUsers] = useState<{ id: string; full_name: string; email: string; role: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'dados' | 'usuarios' | 'keys'>('dados');
  const [keys, setKeys] = useState<UnitKey[]>([]);
  // Estado para abrir modal Editar Usuário reaproveitando o componente compartilhado
  const [editingUser, setEditingUser] = useState<(UserType & ProfileType) | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);

  const handleOpenUserModal = (u?: { id: string; full_name: string; email: string; role: string }) => {
    setEditingUser((u as any) || null);
    setIsUserModalOpen(true);
  };
  const handleCloseUserModal = () => {
    setIsUserModalOpen(false);
    setEditingUser(null);
  };

  const handleSaveUserFromUnit = async (payload: Partial<UserType & ProfileType>) => {
    try {
      if (editingUser) {
        await updateUser(editingUser.id, payload as any);
      } else {
        // criação: vincula à unidade atual
        await createUser({ ...(payload as any), auto_unit_id: unit?.id });
      }
      if (unit) {
        const users = await fetchUsersForUnit(unit.id);
        setUnitUsers(users);
      }
      handleCloseUserModal();
    } catch (e: any) {
      alert(e?.message || 'Falha ao salvar usuário');
    }
  };
  const [keysLoading, setKeysLoading] = useState(false);
  const [keysError, setKeysError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [expandedKeyId, setExpandedKeyId] = useState<string | null>(null);
  const [expandedFocusField, setExpandedFocusField] = useState<string | null>(null);
  const [createdKeyHints, setCreatedKeyHints] = useState<Record<string, string>>({});
  const [isTypePickerOpen, setIsTypePickerOpen] = useState(false);
  const [selectedKeyType, setSelectedKeyType] = useState<string>('umbler');
  // Modal antigo removido; agora salvamento é automático na própria aba
  const [keyEdits, setKeyEdits] = useState<Record<string, string>>({});
  const [savingKeyIds, setSavingKeyIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Reset form
    if (unit) {
      setFormData({ unit_name: unit.unit_name, unit_code: unit.unit_code });
    } else {
      setFormData({ unit_name: '', unit_code: '' });
    }
    setError('');
    setUsersError(null);
    setUnitUsers([]);
    setActiveTab('dados');
    setKeys([]);
    setKeysError(null);
    // Carrega usuários vinculados (somente em edição)
    if (unit && isOpen) {
      (async () => {
        try {
          setUsersLoading(true);
          const users = await fetchUsersForUnit(unit.id);
          setUnitUsers(users);
        } catch (err: any) {
          setUsersError('Falha ao carregar usuários vinculados.');
        } finally {
          setUsersLoading(false);
        }
      })();
      // Carrega keys (somente em edição)
      (async () => {
        try {
          setKeysLoading(true);
          const list = await fetchUnitKeys(unit.id);
          setKeys(list);
        } catch (err: any) {
          setKeysError('Falha ao carregar keys da unidade.');
        } finally {
          setKeysLoading(false);
        }
      })();
    }
  }, [unit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.unit_name || !formData.unit_code) {
      setError('Por favor, preencha todos os campos.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const dataToSave: UnitDataPayload = { ...formData };
      if (unit) dataToSave.id = unit.id;
      await onSave(dataToSave);
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true" role="dialog" onMouseDown={onClose}>
      <div className="w-full max-w-3xl p-6 mx-4 bg-bg-secondary rounded-lg shadow-lg" onMouseDown={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between pb-3 border-b border-border-primary">
          <h2 className="text-xl font-bold text-text-primary">{unit ? (unit.unit_name || 'Editar Unidade') : 'Adicionar Nova Unidade'}</h2>
          <button onClick={onClose} className="p-1 rounded-full text-text-secondary hover:bg-bg-tertiary">
            <Icon name="close" />
          </button>
        </div>
        {/* Abas (somente em edição e para super_admin exibe Keys) */}
        {unit && (
          <div className="mt-4 border-b border-border-secondary flex items-center justify-between">
            <div className="flex gap-2">
              <button type="button" className={`px-3 py-2 text-sm rounded-t-md ${activeTab==='dados'?'bg-bg-tertiary text-text-primary':'text-text-secondary hover:text-text-primary'}`} onClick={()=>setActiveTab('dados')}>Dados</button>
              <button type="button" className={`px-3 py-2 text-sm rounded-t-md ${activeTab==='usuarios'?'bg-bg-tertiary text-text-primary':'text-text-secondary hover:text-text-primary'}`} onClick={()=>setActiveTab('usuarios')}>Usuários</button>
              {profile?.role === 'super_admin' && (
                <button type="button" className={`px-3 py-2 text-sm rounded-t-md ${activeTab==='keys'?'bg-bg-tertiary text-text-primary':'text-text-secondary hover:text-text-primary'}`} onClick={()=>setActiveTab('keys')}>Keys</button>
              )}
            </div>
            {profile?.role === 'super_admin' && activeTab === 'keys' && (
              <button
                type="button"
                disabled={isCreatingKey}
                className={`ml-auto px-3 py-1.5 text-sm font-medium text-white rounded-md ${isCreatingKey ? 'opacity-60 cursor-not-allowed bg-accent-primary' : 'bg-accent-primary hover:bg-accent-secondary'}`}
                onClick={() => setIsTypePickerOpen(true)}
              >
                <Icon name="add" className="w-5 h-5 mr-1 inline" />
                {isCreatingKey ? 'Criando…' : 'Adicionar Key'}
              </button>
            )}
          </div>
        )}

        {activeTab === 'dados' && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-6">
            {error && <p className="text-sm text-center text-danger bg-danger/10 p-2 rounded-md">{error}</p>}
            <div>
              <label htmlFor="unit_name" className="block text-sm font-medium text-text-secondary">Nome da Unidade</label>
              <input type="text" name="unit_name" id="unit_name" value={formData.unit_name} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
            </div>
            <div>
              <label htmlFor="unit_code" className="block text-sm font-medium text-text-secondary">Código da Unidade</label>
              <input type="text" name="unit_code" id="unit_code" value={formData.unit_code} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
            </div>
            <div className="flex items-center justify-between pt-4">
              <div>
                {unit && (
                  <button
                    type="button"
                    onClick={() => onDelete(unit.id)}
                    className="flex items-center px-4 py-2 text-sm font-medium text-white transition-colors bg-danger rounded-md hover:bg-red-700"
                  >
                    <Icon name="delete" className="w-5 h-5 mr-2" />
                    Excluir
                  </button>
                )}
              </div>
              <div className="flex space-x-3">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium border rounded-md text-text-secondary border-border-secondary hover:bg-bg-tertiary">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md bg-accent-primary hover:bg-accent-secondary disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </form>
        )}

        {unit && activeTab === 'usuarios' && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-text-primary flex items-center">Usuários Vinculados</h3>
              <button onClick={() => handleOpenUserModal()} className="flex items-center px-4 py-2 text-sm font-medium text-white rounded-md bg-accent-primary hover:bg-accent-secondary">
                <Icon name="add" className="w-5 h-5 mr-2" />
                Adicionar Usuário
              </button>
            </div>
            {usersLoading && (
              <div className="flex items-center space-x-2 text-text-secondary text-sm"><span className="w-4 h-4 border-2 border-t-accent-primary border-border-secondary rounded-full animate-spin" /> <span>Carregando...</span></div>
            )}
            {usersError && <div className="text-sm text-danger bg-danger/10 p-2 rounded-md">{usersError}</div>}
            {!usersLoading && !usersError && unitUsers.length === 0 && (
              <div className="text-xs italic text-text-secondary">Nenhum usuário vinculado.</div>
            )}
            {!usersLoading && unitUsers.length > 0 && (
              <ul className="divide-y divide-border-secondary border border-border-secondary rounded-md overflow-hidden">
                {unitUsers.map(u => (
                  <li key={u.id} className="px-3 py-2 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between bg-bg-tertiary/30 hover:bg-bg-tertiary transition-colors" onDoubleClick={()=>handleOpenUserModal(u)}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-text-primary truncate">{u.full_name || '(Sem nome)'}</p>
                      <p className="text-xs text-text-secondary truncate font-mono">{u.email}</p>
                    </div>
                    <span className="mt-1 sm:mt-0 inline-flex items-center px-2 py-0.5 rounded text-xs bg-accent-primary/10 text-accent-primary font-medium uppercase tracking-wide">{u.role}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {unit && profile?.role === 'super_admin' && activeTab === 'keys' && (
          <div className="mt-4 space-y-4">
            {keysLoading ? (
              <div className="flex items-center space-x-2 text-text-secondary text-sm"><span className="w-4 h-4 border-2 border-t-accent-primary border-border-secondary rounded-full animate-spin" /> <span>Carregando...</span></div>
            ) : keysError ? (
              <div className="text-sm text-danger bg-danger/10 p-2 rounded-md">{keysError}</div>
            ) : (
              <div className="bg-bg-tertiary/20 border border-border-secondary rounded-md p-4 space-y-4">
                {keys.length === 0 && (
                  <div className="text-xs italic text-text-secondary">Nenhuma key cadastrada para esta unidade.</div>
                )}

                {keys.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full table-fixed divide-y divide-border-secondary">
                      <thead className="bg-bg-tertiary/60">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-text-secondary w-[28%]">Nome</th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-text-secondary">Key</th>
                          <th className="px-4 py-2 text-right text-xs font-medium uppercase text-text-secondary w-[10%]">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-secondary bg-bg-secondary/60">
                        {keys.map((item) => {
                          const labelMap: Record<string, string> = {
                            umbler: 'Umbler',
                            whats_profi: 'WhatsApp Profissional',
                            whats_client: 'WhatsApp Cliente',
                            botID: 'Bot ID',
                            organizationID: 'Organization ID',
                            trigger: 'Trigger',
                            description: 'Descrição',
                          };
                          const fields: Array<keyof typeof item> = ['umbler','whats_profi','whats_client','botID','organizationID','trigger','description'] as any;
                          let chosenField: string | null = null;
                          let chosenLabel = '';
                          let chosenValue = '';
                          for (const f of fields) {
                            const val = (item as any)[f];
                            if (val && String(val).length > 0) { chosenField = String(f); chosenValue = String(val); chosenLabel = labelMap[String(f)] || String(f); break; }
                          }
                          if (!chosenField) { chosenField = 'umbler'; chosenLabel = labelMap['umbler']; chosenValue = ''; }
                          const id = String(item.id);
                          const value = keyEdits[id] !== undefined ? keyEdits[id] : chosenValue;
                          const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                            const v = e.target.value;
                            setKeyEdits(prev => ({ ...prev, [id]: v }));
                          };
                          const persist = async () => {
                            if (!chosenField) return;
                            try {
                              setSavingKeyIds(prev => ({ ...prev, [id]: true }));
                              await updateUnitKey(String(item.id), { [chosenField]: value } as any);
                              const list = await fetchUnitKeys(unit!.id);
                              setKeys(list);
                            } finally {
                              setSavingKeyIds(prev => { const n = { ...prev }; delete n[id]; return n; });
                            }
                          };
                          const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
                            if (e.key === 'Enter') { e.preventDefault(); persist(); }
                          };
                          const onBlur = () => { persist(); };
                          const handleDelete = async () => {
                            if (!confirm('Remover esta key?')) return;
                            await deleteUnitKey(String(item.id));
                            const list = await fetchUnitKeys(unit!.id);
                            setKeys(list);
                          };
                          return (
                            <tr key={id}>
                              <td className="px-4 py-2 text-sm text-text-primary truncate">{chosenLabel}</td>
                              <td className="px-4 py-2">
                                <input
                                  value={value}
                                  onChange={onChange}
                                  onKeyDown={onKeyDown}
                                  onBlur={onBlur}
                                  placeholder="Digite a key..."
                                  className="w-full px-3 py-1.5 text-sm border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary"
                                />
                              </td>
                              <td className="px-4 py-2 text-right">
                                <button
                                  onClick={handleDelete}
                                  className="p-2 rounded-md text-danger hover:bg-danger/10"
                                  title="Excluir"
                                >
                                  <Icon name="delete" className="w-5 h-5" />
                                </button>
                                {savingKeyIds[id] && (
                                  <span className="ml-2 align-middle text-xs text-text-secondary">Salvando…</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Modal antigo removido: auto-save direto no formulário */}
          </div>
        )}

        {isTypePickerOpen && unit && (
          <KeyTypePickerModal
            isOpen={isTypePickerOpen}
            selected={selectedKeyType}
            onSelect={setSelectedKeyType}
            onCancel={() => setIsTypePickerOpen(false)}
            onConfirm={async () => {
              if (!unit || isCreatingKey) return;
              try {
                setKeysError(null);
                setIsCreatingKey(true);
                const created = await createUnitKey(unit.id, { is_active: true });
                const list = await fetchUnitKeys(unit.id);
                setKeys(list);
                setExpandedKeyId(String(created.id));
                setExpandedFocusField(selectedKeyType);
                const labelMap: Record<string, string> = {
                  umbler: 'Umbler',
                  whats_profi: 'WhatsApp Profissional',
                  whats_client: 'WhatsApp Cliente',
                  botID: 'Bot ID',
                  organizationID: 'Organization ID',
                  trigger: 'Trigger',
                };
                setCreatedKeyHints(prev => ({ ...prev, [String(created.id)]: labelMap[selectedKeyType] || selectedKeyType }));
              } catch (e: any) {
                const msg = e?.message || 'Falha ao criar key.';
                setKeysError(msg);
              } finally {
                setIsCreatingKey(false);
                setIsTypePickerOpen(false);
              }
            }}
          />
        )}
        {/* Modal reutilizado para editar usuário */}
        <UserFormModal
          isOpen={isUserModalOpen}
          onClose={handleCloseUserModal}
          onSave={handleSaveUserFromUnit}
          user={editingUser}
          currentAdminProfile={profile}
        />
      </div>
    </div>
  );
};
const FieldRow: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => {
  if (!value) return null;
  return (
    <div className="text-xs">
      <span className="text-text-secondary mr-1">{label}:</span>
      <span className="text-text-primary break-all font-mono">{value}</span>
    </div>
  );
};

const KeyListItem: React.FC<{
  unitId: string;
  item: UnitKey;
  expanded?: boolean;
  autoFocusField?: string;
  hintLabel?: string;
  onUpdated: () => void | Promise<void>;
  onDeleted: () => void | Promise<void>;
}> = ({ unitId, item, expanded: expandedProp = false, autoFocusField, hintLabel, onUpdated, onDeleted }) => {
  const [expanded, setExpanded] = useState(expandedProp);
  useEffect(() => { setExpanded(expandedProp); }, [expandedProp]);
  const anyValue = !!(item.umbler || item.whats_profi || item.whats_client || item.botID || item.organizationID || item.trigger || item.description);
  return (
    <div className="border border-border-secondary rounded-md bg-bg-secondary/60">
      <div className="p-3 flex items-start justify-between gap-3">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
          {!anyValue && hintLabel && (
            <div className="col-span-1 md:col-span-2 text-xs italic text-text-secondary">Nova key: {hintLabel}</div>
          )}
          <FieldRow label="umbler" value={item.umbler || undefined} />
          <FieldRow label="whats_profi" value={item.whats_profi || undefined} />
          <FieldRow label="whats_client" value={item.whats_client || undefined} />
          <FieldRow label="botID" value={item.botID || undefined} />
          <FieldRow label="organizationID" value={item.organizationID || undefined} />
          <FieldRow label="trigger" value={item.trigger || undefined} />
          <FieldRow label="Descrição" value={item.description || undefined} />
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded ${item.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400'}`}>{item.is_active ? 'ATIVA' : 'INATIVA'}</span>
          <button
            type="button"
            className="px-2 py-1 text-xs rounded-md border border-border-secondary hover:bg-bg-tertiary"
            onClick={() => setExpanded(v => !v)}
          >{expanded ? 'Fechar' : 'Editar'}</button>
          <button
            type="button"
            className="px-2 py-1 text-xs rounded-md text-white bg-danger hover:bg-red-700"
            onClick={async ()=>{
              if (confirm('Remover esta key?')) {
                await deleteUnitKey(String(item.id));
                await onDeleted();
              }
            }}
          >Remover</button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border-secondary p-4">
          <KeyItemForm
            initial={item}
            autoFocusField={autoFocusField}
            onSubmit={async (payload)=>{ await updateUnitKey(String(item.id), payload as any); await onUpdated(); }}
            onDelete={async ()=>{ if (confirm('Remover esta key?')) { await deleteUnitKey(String(item.id)); await onDeleted(); } }}
          />
        </div>
      )}
    </div>
  );
};

const keyTypeOptions: Array<{ value: string; label: string; hint?: string }> = [
  { value: 'umbler', label: 'Umbler', hint: 'Bearer/Token' },
  { value: 'whats_profi', label: 'WhatsApp Profissional' },
  { value: 'whats_client', label: 'WhatsApp Cliente' },
  { value: 'botID', label: 'Bot ID' },
  { value: 'organizationID', label: 'Organization ID' },
  { value: 'trigger', label: 'Trigger' },
];

const KeyTypePickerModal: React.FC<{
  isOpen: boolean;
  selected: string;
  onSelect: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}> = ({ isOpen, selected, onSelect, onCancel, onConfirm }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true">
      <div className="w-full max-w-md mx-4 bg-bg-secondary rounded-lg shadow-lg p-5">
        <div className="flex items-center justify-between pb-3 border-b border-border-primary">
          <h3 className="text-sm font-semibold text-text-primary">Selecionar tipo de Key</h3>
          <button onClick={onCancel} className="p-1 rounded-md text-text-secondary hover:bg-bg-tertiary" aria-label="Fechar">
            <Icon name="close" />
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {keyTypeOptions.map(opt => (
            <label key={opt.value} className="flex items-start gap-3 p-2 rounded-md border border-border-secondary hover:bg-bg-tertiary cursor-pointer">
              <input type="radio" name="keytype" value={opt.value} checked={selected===opt.value} onChange={() => onSelect(opt.value)} />
              <div className="flex-1">
                <div className="text-sm text-text-primary">{opt.label}</div>
                {opt.hint && <div className="text-xs text-text-secondary">{opt.hint}</div>}
              </div>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm border rounded-md text-text-secondary border-border-secondary hover:bg-bg-tertiary">Cancelar</button>
          <button onClick={onConfirm} className="px-3 py-1.5 text-sm rounded-md text-white bg-accent-primary hover:bg-accent-secondary">Confirmar</button>
        </div>
      </div>
    </div>
  );
};

const KeyItemForm: React.FC<{
  initial: UnitKey | null;
  autoFocusField?: string;
  onSubmit: (payload: Partial<UnitKey>) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}> = ({ initial, autoFocusField, onSubmit, onDelete }) => {
  const formEl = useRef<HTMLFormElement | null>(null);
  const [form, setForm] = useState<Partial<UnitKey>>({
    umbler: initial?.umbler ?? '',
    whats_profi: initial?.whats_profi ?? '',
    whats_client: initial?.whats_client ?? '',
    botID: initial?.botID ?? '',
    organizationID: initial?.organizationID ?? '',
    trigger: initial?.trigger ?? '',
    description: initial?.description ?? '',
    is_active: initial?.is_active ?? true,
  });
  const [error, setError] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<string>(JSON.stringify(form));
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type, checked } = e.target as any;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };
  useEffect(() => {
    const next = {
      umbler: initial?.umbler ?? '',
      whats_profi: initial?.whats_profi ?? '',
      whats_client: initial?.whats_client ?? '',
      botID: initial?.botID ?? '',
      organizationID: initial?.organizationID ?? '',
      trigger: initial?.trigger ?? '',
      description: initial?.description ?? '',
      is_active: initial?.is_active ?? true,
    };
    setForm(next);
    setSnapshot(JSON.stringify(next));
  }, [initial?.umbler, initial?.whats_profi, initial?.whats_client, initial?.botID, initial?.organizationID, initial?.trigger, initial?.description, initial?.is_active]);

  useEffect(() => {
    const current = JSON.stringify(form);
    if (current === snapshot) return;
    setIsSaving(true);
    setError('');
    const t = setTimeout(async () => {
      try {
        await onSubmit(form);
        setSnapshot(JSON.stringify(form));
        setLastSavedAt(Date.now());
      } catch (e: any) {
        setError(e?.message || 'Falha ao salvar');
      } finally {
        setIsSaving(false);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [form, snapshot, onSubmit]);

  useEffect(() => {
    if (autoFocusField && formEl.current) {
      const el = formEl.current.querySelector(`input[name="${autoFocusField}"]`) as HTMLInputElement | null;
      if (el) el.focus();
    }
  }, [autoFocusField]);
  return (
    <form ref={formEl} className="space-y-4" onSubmit={async (e)=>{ e.preventDefault(); setError(''); await onSubmit(form); }}>
      {error && <div className="text-sm text-danger bg-danger/10 p-2 rounded-md">{error}</div>}
      <div className="text-xs text-text-secondary">
        {isSaving ? 'Salvando...' : lastSavedAt ? `Auto-salvo às ${new Date(lastSavedAt).toLocaleTimeString()}` : 'Edições serão salvas automaticamente'}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary">umbler</label>
          <input name="umbler" value={form.umbler as string} onChange={handleChange} className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">whats_profi</label>
          <input name="whats_profi" value={form.whats_profi as string} onChange={handleChange} className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">whats_client</label>
          <input name="whats_client" value={form.whats_client as string} onChange={handleChange} className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">botID</label>
          <input name="botID" value={form.botID as string} onChange={handleChange} className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">organizationID</label>
          <input name="organizationID" value={form.organizationID as string} onChange={handleChange} className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">trigger</label>
          <input name="trigger" value={form.trigger as string} onChange={handleChange} className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-text-secondary">Descrição</label>
        <textarea name="description" value={(form.description as string) || ''} onChange={handleChange} rows={2} className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
        <input type="checkbox" name="is_active" checked={!!form.is_active} onChange={handleChange} />
        Ativo
      </label>
      <div className="flex justify-end gap-2 pt-2">
        {initial && (
          <button type="button" onClick={() => onDelete()} className="px-4 py-2 text-sm font-medium text-white rounded-md bg-danger hover:bg-red-700">Remover</button>
        )}
      </div>
    </form>
  );
};

const DeleteConfirmationModal: React.FC<{
  unit: Unit | null;
  onClose: () => void;
  onConfirm: (unitId: string) => void;
}> = ({ unit, onClose, onConfirm }) => {
  if (!unit) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true" role="dialog">
      <div className="w-full max-w-md p-6 mx-4 bg-bg-secondary rounded-lg shadow-lg">
        <h2 className="text-xl font-bold text-text-primary">Confirmar Exclusão</h2>
        <p className="mt-4 text-text-secondary">
          Tem certeza que deseja excluir a unidade <strong className="text-text-primary">{unit.unit_name}</strong>?
        </p>
        <p className="mt-2 text-sm text-danger">Esta ação é irreversível e removerá as permissões de todos os usuários associados a esta unidade.</p>
        <div className="flex justify-end pt-6 mt-4 space-x-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium border rounded-md text-text-secondary border-border-secondary hover:bg-bg-tertiary">
            Cancelar
          </button>
          <button onClick={() => onConfirm(unit.id)} className="px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md bg-danger hover:bg-red-700">
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
};


const ManageUnitsPage: React.FC = () => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitToDelete, setUnitToDelete] = useState<Unit | null>(null);
  const [unitUserCounts, setUnitUserCounts] = useState<Record<string, number>>({});

  const loadUnits = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedUnits = await fetchAllUnits();
      setUnits(fetchedUnits);
    } catch (err: any) {
      setError('Falha ao carregar as unidades.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  // Após carregar unidades, buscar contagem de usuários por unidade em uma única consulta
  useEffect(() => {
    const run = async () => {
      try {
        const ids = units.map(u => u.id);
        if (!ids.length) { setUnitUserCounts({}); return; }
        const supabase = (await import('../../services/supabaseClient')).supabase;
        const { data, error } = await supabase
          .from('user_units')
          .select('unit_id')
          .in('unit_id', ids);
        if (error) { setUnitUserCounts({}); return; }
        const map: Record<string, number> = {};
        (data || []).forEach((row: any) => {
          const id = row?.unit_id as string | undefined;
          if (!id) return;
          map[id] = (map[id] || 0) + 1;
        });
        setUnitUserCounts(map);
      } catch {
        setUnitUserCounts({});
      }
    };
    run();
  }, [units]);

  const handleOpenModal = (unit: Unit | null = null) => {
    setEditingUnit(unit);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUnit(null);
  };
  
  const handleOpenDeleteConfirm = (unit: Unit) => {
    setUnitToDelete(unit);
  };

  const handleCloseDeleteConfirm = () => {
    setUnitToDelete(null);
  };

  const handleSaveUnit = async (data: UnitDataPayload) => {
    if (editingUnit) {
      await updateUnit(editingUnit.id, data);
      handleCloseModal();
      await loadUnits();
      return;
    }
    await createUnit(data);
    handleCloseModal();
    await loadUnits();
  };

  const handleDeleteUnit = async (unitId: string) => {
    try {
      await deleteUnit(unitId);
      handleCloseDeleteConfirm();
      await loadUnits();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };
  
  const handleDeleteFromModal = (unitId: string) => {
    const unit = units.find(u => u.id === unitId);
    if(unit) {
      handleCloseModal();
      handleOpenDeleteConfirm(unit);
    }
  };

  return (
    <div className="p-6 bg-bg-secondary rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Unidades</h1>
        <button onClick={() => handleOpenModal()} className="flex items-center px-4 py-2 text-sm font-medium text-white rounded-md bg-accent-primary hover:bg-accent-secondary">
          <Icon name="add" className="w-5 h-5 mr-2" />
          Adicionar Unidade
        </button>
      </div>
      
      {isLoading ? (
         <div className="flex items-center justify-center h-64">
             <div className="w-16 h-16 border-4 border-t-4 border-gray-200 rounded-full animate-spin border-t-accent-primary"></div>
         </div>
      ) : error ? (
        <div className="p-4 text-danger bg-danger/10 border border-danger/30 rounded-md">{error}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border-primary">
            <thead className="bg-bg-tertiary">
              <tr>
                <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Nome da Unidade</th>
                <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Código</th>
                <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Usuários</th>
                <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-right uppercase text-text-secondary">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-bg-secondary divide-y divide-border-primary">
              {units.map((unit) => (
                <tr 
                  key={unit.id}
                  onDoubleClick={() => handleOpenModal(unit)}
                  className="transition-colors cursor-pointer hover:bg-bg-tertiary"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">{unit.unit_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary font-mono">{unit.unit_code}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{unitUserCounts[unit.id] ?? 0}</td>
                  <td className="px-6 py-4 text-sm font-medium text-right whitespace-nowrap">
                    <div className="flex items-center justify-end space-x-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleOpenModal(unit); }} 
                        className="p-2 rounded-md text-accent-primary hover:bg-accent-primary/10 transition-colors"
                        title="Editar Unidade"
                      >
                        <Icon name="edit" className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleOpenDeleteConfirm(unit); }} 
                        className="p-2 rounded-md text-danger hover:bg-danger/10 transition-colors"
                        title="Excluir Unidade"
                      >
                        <Icon name="delete" className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UnitFormModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveUnit}
        unit={editingUnit}
        onDelete={handleDeleteFromModal}
      />

      <DeleteConfirmationModal
        unit={unitToDelete}
        onClose={handleCloseDeleteConfirm}
        onConfirm={handleDeleteUnit}
      />
    </div>
  );
};

export default ManageUnitsPage;