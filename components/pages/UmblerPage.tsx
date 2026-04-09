import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bot, Building2, Tag as TagIcon, Variable, Settings,
  Plus, Pencil, Trash2, RefreshCw, CheckCircle2,
  AlertCircle, Save, X, Circle, Loader2, ChevronDown,
  Bookmark, BookmarkPlus, Download, Eye, EyeOff, RotateCcw,
  Search, ChevronRight, ExternalLink, Copy, Layout, Zap, FolderPlus
} from 'lucide-react';
import * as umblerService from '../../services/integration/umbler.service';
import { MB_DROME_ORG_ID as DROME_ORG_ID } from '../../services/integration/umbler.service';
import type {
  UmblerTag, UmblerCustomField, UmblerBot,
  UmblerOrganization, UmblerUnitKey, UmblerPreset, UmblerQuickAnswer
} from '../../services/integration/umbler.service';

// ─── Helpers de Formatação ───────────────────────────────────────────────────
function formatToTitleCase(text: string): string {
  if (!text) return '';
  const exceptions = ['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'com'];
  return text.trim().toLowerCase().split(/\s+/).map((word, i) => {
    if (i > 0 && exceptions.includes(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}

// ─── Umbler tag icons e cores disponíveis ───────────────────────────────────
const UMBLER_COLORS = [
  '#ef4444','#f97316','#eab308','#22c55e','#14b8a6',
  '#3b82f6','#8b5cf6','#ec4899','#6b7280','#1e293b',
];

const STATUS_OPTIONS = [
  { label: 'Todos', value: 'all' },
  { label: 'Ativos', value: 'active' },
  { label: 'Inativos', value: 'inactive' },
];

const SYSTEM_VARIABLES = [
  { label: 'Nome do Contato', value: 'contact.name' },
  { label: 'Primeiro Nome', value: 'contact.firstName' },
  { label: 'Nome do Usuário', value: 'user.name' },
  { label: 'Nome da Unidade', value: 'organization.name' },
];

const UMBLER_ICONS = [
  'star','heart','flag','bookmark','bell','zap','shield',
  'user','users','briefcase','home','shopping-cart','truck',
  'phone','mail','message-square','check-circle','alert-circle',
  'clock','calendar','globe','map-pin','target','award',
];

// ─── Types ──────────────────────────────────────────────────────────────────
type Tab = 'organization' | 'shortcuts' | 'tags' | 'variables' | 'config';
interface Toast { type: 'success' | 'error'; text: string }

// ─── Tab config ──────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'organization', label: 'Organização',      icon: <Building2 className="w-4 h-4" /> },
  { id: 'shortcuts',    label: 'Respostas Rápidas', icon: <Zap className="w-4 h-4" /> },
  { id: 'tags',         label: 'Tags',             icon: <TagIcon className="w-4 h-4" /> },
  { id: 'variables',    label: 'Campos',           icon: <Variable className="w-4 h-4" /> },
  { id: 'config',       label: 'Configuração',     icon: <Settings className="w-4 h-4" /> },
];

// ─── StatusBadge ─────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ connected: boolean }> = ({ connected }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${
    connected ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
              : 'bg-gray-500/10 text-gray-500 border border-gray-500/20'
  }`}>
    <Circle className={`w-2 h-2 fill-current ${connected ? 'animate-pulse' : ''}`} />
    {connected ? 'Conectado' : 'Offline'}
  </span>
);

// ─── FormModal ───────────────────────────────────────────────────────────────
interface FormField {
  key: string;
  label: string;
  placeholder?: string;
  type?: string;
}

interface FormModalProps {
  title: string;
  fields: FormField[];
  initial?: Record<string, string>;
  onSave: (values: Record<string, string>) => Promise<void>;
  onClose: () => void;
}

const FormModal: React.FC<FormModalProps> = ({ title, fields, initial, onSave, onClose }) => {
  const [values, setValues] = useState<Record<string, string>>(
    initial || Object.fromEntries(fields.map(f => [f.key, '']))
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await onSave(values); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md mx-4 bg-bg-secondary border border-border-primary rounded-2xl shadow-xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-text-primary">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-secondary"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map(f => (
            <div key={f.key}>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">{f.label}</label>
              <input type={f.type || 'text'} value={values[f.key] || ''}
                onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full px-4 py-2.5 bg-bg-tertiary border border-border-primary rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary outline-none transition-all" />
            </div>
          ))}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-secondary border border-border-primary rounded-xl hover:bg-bg-tertiary transition-all">Cancelar</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-accent-primary rounded-xl hover:bg-accent-secondary disabled:opacity-50 transition-all shadow-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


// ─── UnitDropdown ────────────────────────────────────────────────────────────
const UnitDropdown: React.FC<{
  units: UmblerUnitKey[];
  selected: UmblerUnitKey | null;
  onSelect: (u: UmblerUnitKey) => void;
  loadingUnits: boolean;
}> = ({ units, selected, onSelect, loadingUnits }) => (
  <div className="flex items-center gap-3 px-3 py-1.5 bg-bg-tertiary border border-border-primary rounded-xl max-w-fit shadow-sm">
    <div className="w-7 h-7 rounded-lg bg-accent-primary/10 flex items-center justify-center flex-shrink-0">
      <Building2 className="w-3.5 h-3.5 text-accent-primary" />
    </div>
    <div className="flex-1 min-w-[120px]">
      {loadingUnits ? (
        <div className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin text-text-secondary" /><span className="text-[10px] text-text-secondary">Carregando...</span></div>
      ) : units.length === 0 ? (
        <span className="text-[10px] text-amber-600 font-medium text-center block">Nenhuma unidade com OrgID</span>
      ) : (
        <div className="relative">
          <select
            value={selected?.unit_id || ''}
            onChange={e => { const u = units.find(x => x.unit_id === e.target.value); if (u) onSelect(u); }}
            className="w-full bg-transparent text-xs font-bold text-text-primary outline-none appearance-none pr-5 cursor-pointer"
          >
            <option value="" disabled>— Selecionar Unidade —</option>
            {units.map(u => <option key={u.unit_id} value={u.unit_id}>{u.unit_name}</option>)}
          </select>
          <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-text-secondary pointer-events-none" />
        </div>
      )}
    </div>
    {selected?.organizationID && (
      <span className="text-[8px] font-mono text-text-secondary bg-bg-secondary px-2 py-0.5 rounded-lg border border-border-primary hidden sm:block opacity-60">
        ID: {selected.organizationID}
      </span>
    )}
  </div>
);

// ─── CRUDRow ─────────────────────────────────────────────────────────────────
const CRUDRow: React.FC<{
  label: string; sublabel?: string; badge?: React.ReactNode;
  colorDot?: string | null; iconName?: string | null;
  onEdit: () => void; onDelete: () => void;
  selected?: boolean; onSelect?: (val: boolean) => void;
  code?: string;
}> = ({ label, sublabel, badge, colorDot, onEdit, onDelete, selected, onSelect, code }) => (
  <div className={`flex items-center justify-between p-4 rounded-xl border transition-all group ${
    selected ? 'border-accent-primary bg-accent-primary/5 shadow-sm' : 'border-border-primary bg-bg-secondary hover:border-accent-primary/30'
  }`}>
    <div className="flex items-center gap-3 min-w-0 flex-1">
      {onSelect && (
        <input 
          type="checkbox" checked={selected} onChange={e => onSelect(e.target.checked)}
          className="w-4 h-4 rounded border-border-primary text-accent-primary focus:ring-accent-primary/30 cursor-pointer"
        />
      )}
      {colorDot && (
        <span className="w-4 h-4 rounded-full border border-black/10 flex-shrink-0" style={{ backgroundColor: colorDot }} />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-text-primary truncate">{label}</p>
          {code && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-bg-tertiary text-text-secondary border border-border-primary/50" title="ID/Código do Template">
              {code}
            </span>
          )}
        </div>
        {sublabel && <p className="text-xs text-text-secondary truncate">{sublabel}</p>}
      </div>
      {badge}
    </div>
    <div className="flex items-center gap-1 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
      <button onClick={onEdit} className="p-2 rounded-lg text-text-secondary hover:bg-accent-primary/10 hover:text-accent-primary transition-all" title="Editar">
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button onClick={onDelete} className="p-2 rounded-lg text-text-secondary hover:bg-danger/10 hover:text-danger transition-all" title="Excluir">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);

// ─── Section wrapper ─────────────────────────────────────────────────────────
const Section: React.FC<{
  title: string; subtitle?: string; action?: React.ReactNode;
  loading?: boolean; empty?: string; children: React.ReactNode;
}> = ({ title, subtitle, action, loading, empty, children }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-lg font-bold text-text-primary">{title}</h2>
        {subtitle && <p className="text-sm text-text-secondary mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
    {loading ? (
      <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-accent-primary" /></div>
    ) : (
      <div className="space-y-2">
        {children}
        {empty && <div className="text-center py-12 text-text-secondary text-sm italic">{empty}</div>}
      </div>
    )}
  </div>
);

// ─── TagFormModal (rico: cor + ícone) ────────────────────────────────────────
interface TagFormModalProps {
  initial?: { name: string; color?: string; icon?: string };
  onSave: (values: { name: string; color: string; icon: string }) => Promise<void>;
  onClose: () => void;
  title: string;
  presets?: UmblerPreset[];
  onSaveAsPreset?: (values: { name: string; color: string; icon: string }, presetName: string) => Promise<void>;
}

const TagFormModal: React.FC<TagFormModalProps> = ({ initial, onSave, onClose, title, presets, onSaveAsPreset }) => {
  const [name, setName] = useState(initial?.name || '');
  const [color, setColor] = useState(initial?.color || UMBLER_COLORS[4]);
  const [icon, setIcon] = useState(initial?.icon || '');
  const [saving, setSaving] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [savingPreset, setSavingPreset] = useState(false);
  const [showPresetInput, setShowPresetInput] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await onSave({ name, color, icon }); } finally { setSaving(false); }
  };

  const handleSavePreset = async () => {
    if (!presetName.trim() || !onSaveAsPreset) return;
    setSavingPreset(true);
    try { await onSaveAsPreset({ name, color, icon }, presetName.trim()); setShowPresetInput(false); setPresetName(''); }
    finally { setSavingPreset(false); }
  };

  const applyPreset = (p: UmblerPreset) => {
    if (p.config.name) setName(p.config.name);
    if (p.config.color) setColor(p.config.color);
    if (p.config.icon) setIcon(p.config.icon);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg mx-4 bg-bg-secondary border border-border-primary rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-text-primary">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-secondary"><X className="w-4 h-4" /></button>
        </div>

        {/* Presets disponíveis */}
        {presets && presets.length > 0 && (
          <div className="mb-5">
            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-2">Usar Template Salvo</p>
            <div className="flex flex-wrap gap-2">
              {presets.map(p => (
                <button key={p.id} onClick={() => applyPreset(p)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-accent-primary/10 text-accent-primary border border-accent-primary/20 rounded-lg hover:bg-accent-primary/20 transition-all">
                  <Bookmark className="w-3 h-3" /> {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Nome */}
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">Nome da Tag</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)} required
              placeholder="Ex: VIP, Lead Quente, Urgente"
              className="w-full px-4 py-2.5 bg-bg-tertiary border border-border-primary rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary outline-none transition-all"
            />
          </div>

          {/* Cores */}
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Cor</label>
            <div className="flex flex-wrap gap-2">
              {UMBLER_COLORS.map(c => (
                <button type="button" key={c} onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-70 hover:opacity-100 hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <div className="flex items-center gap-2 ml-2">
                <input type="color" value={color} onChange={e => setColor(e.target.value)}
                  className="w-8 h-8 rounded-full cursor-pointer border border-border-primary bg-transparent p-0"
                  title="Cor personalizada" />
                <span className="text-xs text-text-secondary font-mono">{color}</span>
              </div>
            </div>
          </div>

          {/* Ícones */}
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Ícone <span className="text-text-secondary/50 normal-case font-normal">(opcional)</span></label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setIcon('')}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${!icon ? 'bg-accent-primary text-white border-accent-primary' : 'border-border-primary text-text-secondary hover:bg-bg-tertiary'}`}>
                Nenhum
              </button>
              {UMBLER_ICONS.map(i => (
                <button type="button" key={i} onClick={() => setIcon(i)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${icon === i ? 'bg-accent-primary text-white border-accent-primary' : 'border-border-primary text-text-secondary hover:bg-bg-tertiary'}`}>
                  {i}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 p-3 bg-bg-tertiary rounded-xl border border-border-primary">
            <span className="w-6 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-sm font-semibold text-text-primary">{name || 'Preview da Tag'}</span>
            {icon && <span className="text-xs text-text-secondary ml-auto">ícone: {icon}</span>}
          </div>

          {/* Ações */}
          <div className="flex items-center justify-between pt-1">
            {onSaveAsPreset && (
              <div className="flex items-center gap-2">
                {showPresetInput ? (
                  <>
                    <input type="text" value={presetName} onChange={e => setPresetName(e.target.value)}
                      placeholder="Nome do template" autoFocus
                      className="px-3 py-2 text-xs bg-bg-tertiary border border-border-primary rounded-xl text-text-primary outline-none focus:ring-1 focus:ring-accent-primary w-36" />
                    <button type="button" onClick={handleSavePreset} disabled={savingPreset || !presetName.trim()}
                      className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-accent-primary border border-accent-primary/30 rounded-xl hover:bg-accent-primary/10 disabled:opacity-50 transition-all">
                      {savingPreset ? <Loader2 className="w-3 h-3 animate-spin" /> : <BookmarkPlus className="w-3 h-3" />} Salvar
                    </button>
                    <button type="button" onClick={() => setShowPresetInput(false)} className="p-2 text-text-secondary hover:text-text-primary"><X className="w-3 h-3" /></button>
                  </>
                ) : (
                  <button type="button" onClick={() => setShowPresetInput(true)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-text-secondary border border-border-primary rounded-xl hover:bg-bg-tertiary transition-all">
                    <Bookmark className="w-3 h-3" /> Salvar como template
                  </button>
                )}
              </div>
            )}
            <div className="flex gap-2 ml-auto">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-secondary border border-border-primary rounded-xl hover:bg-bg-tertiary transition-all">Cancelar</button>
              <button type="submit" disabled={saving || !name.trim()} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-accent-primary rounded-xl hover:bg-accent-secondary disabled:opacity-50 transition-all shadow-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── PresetPickerModal (Seleção múltipla de templates) ─────────────────────
interface PresetPickerModalProps {
  title: string;
  presets: UmblerPreset[];
  loading: boolean;
  onApply: (selected: UmblerPreset[]) => Promise<void>;
  onClose: () => void;
}

const PresetPickerModal: React.FC<PresetPickerModalProps> = ({ title, presets, loading, onApply, onClose }) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);

  const folders = Array.from(new Set(presets.map(p => p.config.folder || 'Sem Pasta')));

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };


  const toggleFolder = (folderName: string) => {
    const folderPresets = presets.filter(p => (p.config.folder || 'Sem Pasta') === folderName);
    const folderIds = folderPresets.map(p => p.id!);
    const next = new Set(selectedIds);
    const allSelected = folderIds.every(id => next.has(id));
    
    if (allSelected) {
      folderIds.forEach(id => next.delete(id));
    } else {
      folderIds.forEach(id => next.add(id));
    }
    setSelectedIds(next);
  };

  const handleApply = async () => {
    const selected = presets.filter(p => selectedIds.has(p.id!));
    if (selected.length === 0) return;
    setApplying(true);
    try { await onApply(selected); onClose(); }
    finally { setApplying(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg mx-4 bg-bg-secondary border border-border-primary rounded-2xl shadow-xl p-6 flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center text-accent-primary">
               <Download className="w-5 h-5" />
             </div>
             <h3 className="text-lg font-bold text-text-primary">{title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-secondary"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2 mb-6">
          {presets.length === 0 ? (
            <div className="text-center py-12 text-text-secondary text-sm italic">Nenhum template salvo deste tipo.</div>
          ) : (
            folders.map(folder => {
              const folderPresets = presets.filter(p => (p.config.folder || 'Sem Pasta') === folder);
              const allSelected = folderPresets.every(p => selectedIds.has(p.id!));
              
              return (
                <div key={folder} className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-[10px] font-extrabold text-text-secondary uppercase tracking-[0.2em] flex items-center gap-2">
                      <Layout className="w-3 h-3" /> {folder}
                    </h4>
                    <button 
                      onClick={() => toggleFolder(folder)}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-all ${
                        allSelected ? 'text-accent-primary bg-accent-primary/10' : 'text-text-secondary hover:bg-bg-tertiary'
                      }`}
                    >
                      {allSelected ? 'Desmarcar Tudo' : 'Selecionar Tudo'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {folderPresets.map(p => (
                      <div key={p.id} onClick={() => toggleOne(p.id!)}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer group ${
                          selectedIds.has(p.id!) ? 'border-accent-primary bg-accent-primary/5 shadow-sm' : 'border-border-primary hover:border-accent-primary/30'
                        }`}>
                        <input type="checkbox" checked={selectedIds.has(p.id!)} readOnly className="w-4 h-4 rounded border-border-primary text-accent-primary pointer-events-none" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-text-primary truncate">{p.name}</p>
                          {p.description && <p className="text-[10px] text-text-secondary truncate">{p.description}</p>}
                        </div>
                        {p.preset_type === 'tag_template' && p.config.color && (
                          <span className="w-4 h-4 rounded-full border border-black/10 shadow-inner" style={{ backgroundColor: p.config.color }} />
                        )}
                        {p.preset_type === 'bot' && (
                          <Bot className="w-4 h-4 text-accent-primary/40 group-hover:text-accent-primary transition-colors" />
                        )}
                        {p.preset_type === 'variable' && (
                          <Variable className="w-4 h-4 text-text-secondary/40 group-hover:text-accent-primary transition-colors" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border-primary">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-secondary border border-border-primary rounded-xl hover:bg-bg-tertiary transition-all">Cancelar</button>
          <button onClick={handleApply} disabled={selectedIds.size === 0 || applying}
            className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-accent-primary rounded-xl hover:bg-accent-secondary disabled:opacity-50 transition-all shadow-lg shadow-accent-primary/20">
            {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Importar Selecionados ({selectedIds.size})
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════
const UmblerPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('organization');
  const [toast, setToast] = useState<Toast | null>(null);

  // Token
  const [apiToken, setApiToken] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [savingToken, setSavingToken] = useState(false);

  // Unidades
  const [units, setUnits] = useState<UmblerUnitKey[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<UmblerUnitKey | null>(null);

  // Data states

  const [org, setOrg] = useState<UmblerOrganization | null>(null);
  const [orgForm, setOrgForm] = useState<Partial<UmblerOrganization>>({});
  const [savingOrg, setSavingOrg] = useState(false);
  const [tags, setTags] = useState<UmblerTag[]>([]);
  const [variables, setVariables] = useState<UmblerCustomField[]>([]);
  const [quickAnswers, setQuickAnswers] = useState<UmblerQuickAnswer[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Templates (presets)
  const [tagPresets, setTagPresets] = useState<UmblerPreset[]>([]);
  const [variablePresets, setVariablePresets] = useState<UmblerPreset[]>([]);
  const [quickAnswerPresets, setQuickAnswerPresets] = useState<UmblerPreset[]>([]);
  
  const [dromeTagsSource, setDromeTagsSource] = useState<UmblerTag[]>([]);
  const [dromeFieldsSource, setDromeFieldsSource] = useState<UmblerCustomField[]>([]);
  const [dromeQuickAnswersSource, setDromeQuickAnswersSource] = useState<UmblerQuickAnswer[]>([]);

  const [isLoadingDrome, setIsLoadingDrome] = useState(false);
  const [editingDromeTag, setEditingDromeTag] = useState<any>(null);
  const [editingFieldPreset, setEditingFieldPreset] = useState<UmblerPreset | null>(null);
  const [editingQAPreset, setEditingQAPreset] = useState<UmblerPreset | null>(null);
  const [activePresetTab, setActivePresetTab] = useState<'tags' | 'fields' | 'quick_answer'>('tags');
  const [isPresetPickerOpen, setIsPresetPickerOpen] = useState(false);
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [selectedPresetIds, setSelectedPresetIds] = useState<Set<string>>(new Set());
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedQuickAnswer, setSelectedQuickAnswer] = useState<UmblerQuickAnswer | null>(null);
  const [qaEditForm, setQaEditForm] = useState<{ name: string; content: string }>({ name: '', content: '' });
  const [isSavingQA, setIsSavingQA] = useState(false);
  const qaTextareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Helpers de Estado (Derivados) ──
  const token = apiToken;
  const orgId = selectedUnit?.organizationID;

  // Modals
  const [tagModal, setTagModal] = useState<{ open: boolean; tag?: UmblerTag } | null>(null);
  const [genericModal, setGenericModal] = useState<FormModalProps & { open: boolean } | null>(null);

  const insertVariable = (varName: string) => {
    if (!qaTextareaRef.current) {
      setQaEditForm(p => ({ ...p, content: p.content + `{{${varName}}}` }));
      return;
    }
    const { selectionStart, selectionEnd } = qaTextareaRef.current;
    const currentText = qaEditForm.content;
    const newText = 
      currentText.substring(0, selectionStart) + 
      `{{${varName}}}` + 
      currentText.substring(selectionEnd);
    
    setQaEditForm(p => ({ ...p, content: newText }));
    
    // Devolve o foco e ajusta o cursor
    setTimeout(() => {
      if (qaTextareaRef.current) {
        qaTextareaRef.current.focus();
        const newPos = selectionStart + varName.length + 4; // 4 = {{ }}
        qaTextareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; onConfirm: () => void; label: string } | null>(null);

  // ── Notify ──
  const notify = (type: Toast['type'], text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Bootstrap ──
  useEffect(() => {
    umblerService.getApiToken().then(t => {
      if (t) { setApiToken(t); setTokenInput(t); setIsConfigured(true); }
    }).catch(err => notify('error', `Erro ao carregar token: ${err.message}`));

    setLoadingUnits(true);
    umblerService.listUnitsWithOrgId().then(data => {
      setUnits(data);
      if (data.length > 0) setSelectedUnit(data[0]);
    }).catch(err => console.error('[Umbler] units error:', err))
      .finally(() => setLoadingUnits(false));

    const loadPresets = async () => {
      try {
        const [tags, vars, shots] = await Promise.all([
          umblerService.listPresets('tag_template'),
          umblerService.listPresets('variable'),
          umblerService.listPresets('quick_answer')
        ]);
        setTagPresets(tags);
        setVariablePresets(vars);
        setQuickAnswerPresets(shots);
      } catch (err: any) {
        console.error('Erro ao carregar presets:', err);
      }
    };
    loadPresets();
  }, []);

  // ── Fetch por aba ──
  const fetchTabData = useCallback(async (tab: Tab, unit: UmblerUnitKey | null, token: string | null) => {
    if (!token || !unit?.organizationID || tab === 'config') return;
    const { organizationID: orgId } = unit;
    setLoading(true);
    try {
      if (tab === 'organization') {
        const data = await umblerService.getOrganization(orgId, token);
        const formatted = {
          ...data,
          socialReason: formatToTitleCase(data.socialReason),
          name: formatToTitleCase(data.name),
          road: formatToTitleCase(data.road),
          neighbourhood: formatToTitleCase(data.neighbourhood),
          city: formatToTitleCase(data.city),
        };
        setOrg(data); setOrgForm(formatted);
      }
      else if (tab === 'tags') setTags(await umblerService.listTags(orgId, token));
      else if (tab === 'variables') setVariables(await umblerService.listCustomFields(orgId, token));
      else if (tab === 'shortcuts') {
        const [qas, vars] = await Promise.all([
          umblerService.listQuickAnswers(orgId, token),
          umblerService.listCustomFields(orgId, token)
        ]);
        setQuickAnswers(qas);
        setVariables(vars);
      }
    } catch (err: any) {
      notify('error', err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isConfigured && selectedUnit && activeTab !== 'config') {
      fetchTabData(activeTab, selectedUnit, apiToken);
    }
  }, [activeTab, selectedUnit, isConfigured, apiToken, fetchTabData]);

  // Limpar seleção ao trocar de aba
  useEffect(() => {
    setSelectedIds(new Set());
    setSearchTerm('');
  }, [activeTab]);

  const toggleAll = (ids: string[]) => {
    if (selectedIds.size === ids.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(ids));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const loadDromeTags = async () => {
    if (!token) return notify('error', 'Token não configurado');
    setIsLoadingDrome(true);
    try {
      const tags = await umblerService.listTags(DROME_ORG_ID, token);
      setDromeTagsSource(tags);
      notify('success', `${tags.length} tags carregadas da MB Dromedário`);
    } catch (err: any) {
      notify('error', `Erro ao carregar da MB Dromedário: ${err.message}`);
    } finally {
      setIsLoadingDrome(false);
    }
  };

  const loadDromeQuickAnswers = async () => {
    if (!token) return notify('error', 'Token não configurado');
    setIsLoadingDrome(true);
    try {
      const qas = await umblerService.listQuickAnswers(DROME_ORG_ID, token);
      setDromeQuickAnswersSource(qas);
      notify('success', `${qas.length} respostas rápidas carregadas da MB Dromedário`);
    } catch (err: any) {
      notify('error', `Erro ao carregar da MB Dromedário: ${err.message}`);
    } finally {
      setIsLoadingDrome(false);
    }
  };



  const handleSaveVariableAsPreset = async (values: any, presetName: string) => {
    try {
      setIsLoadingDrome(true);
      await umblerService.savePreset({
        preset_type: 'variable',
        name: presetName,
        config: values
      });
      setVariablePresets(await umblerService.listPresets('variable'));
      notify('success', 'Campo salvo nos templates');
    } catch (err: any) {
      notify('error', 'Erro ao salvar campo nos templates: ' + err.message);
    } finally {
      setIsLoadingDrome(false);
    }
  };

  const handleMoveToFolder = async (folderName: string) => {
    if (selectedPresetIds.size === 0) return;
    try {
      setIsLoadingDrome(true);
      const allPresets = [...tagPresets, ...variablePresets, ...quickAnswerPresets];
      const selected = allPresets.filter(p => p.id && selectedPresetIds.has(p.id));

      for (const p of selected) {
        await umblerService.savePreset({
          ...p,
          config: { ...p.config, folder: folderName }
        });
      }

      setTagPresets(await umblerService.listPresets('tag_template'));
      setVariablePresets(await umblerService.listPresets('variable'));
      setQuickAnswerPresets(await umblerService.listPresets('quick_answer'));
      
      setSelectedPresetIds(new Set());
      setIsFolderModalOpen(false);
      notify('success', `Selecionados movidos para a pasta "${folderName}"`);
    } catch (err: any) {
      notify('error', 'Erro ao mover para pasta: ' + err.message);
    } finally {
      setIsLoadingDrome(false);
    }
  };

  const togglePresetSelection = (id: string) => {
    const next = new Set(selectedPresetIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedPresetIds(next);
  };

  const loadDromeFields = async () => {
    if (!token) return notify('error', 'Token não configurado');
    setIsLoadingDrome(true);
    try {
      const fieldSource = await umblerService.listCustomFields(DROME_ORG_ID, token);
      setDromeFieldsSource(fieldSource);
      notify('success', `${fieldSource.length} campos carregados da MB Dromedário`);
    } catch (err: any) {
      notify('error', `Erro ao carregar da MB Dromedário: ${err.message}`);
    } finally {
      setIsLoadingDrome(false);
    }
  };

  const handleSaveDromeTagAsPreset = async (values: any, presetName: string) => {
    try {
      await umblerService.savePreset({
        // Não passa values.id — era o ID externo da Umbler e causava UPDATE sem efeito.
        name: presetName,
        preset_type: 'tag_template',
        config: { name: values.name, color: values.color, icon: values.icon }
      });
      setTagPresets(await umblerService.listPresets('tag_template'));
      notify('success', 'Template de Tag salvo');
    } catch (err: any) { notify('error', err.message); }
  };



  const handleSaveDromeFieldAsPreset = async (field: UmblerCustomField) => {
    try {
      await umblerService.savePreset({
        name: field.name,
        preset_type: 'variable',
        config: field
      });
      setVariablePresets(await umblerService.listPresets('variable'));
      notify('success', `Template do Campo "${field.name}" salvo`);
    } catch (err: any) { notify('error', err.message); }
  };

  const handleApplyPresets = async (selected: UmblerPreset[]) => {
    if (!selectedUnit?.organizationID || !apiToken) return;
    setLoading(true);
    let success = 0;
    try {
      for (const p of selected) {
        try {
          if (p.preset_type === 'tag_template') {
            await umblerService.createTag(orgId, token, p.config as any);
          } else if (p.preset_type === 'variable') {
            await umblerService.createCustomField(orgId, token, { name: p.config.name, description: p.config.description });
          } else if (p.preset_type === 'quick_answer') {
            await umblerService.createQuickAnswer(orgId, token, p.config as any);
          }
          success++;
        } catch (e) {
          console.error(`Erro ao aplicar preset ${p.name}:`, e);
        }
      }
      notify('success', `${success} templates aplicados com sucesso!`);
      fetchTabData(activeTab, selectedUnit, apiToken);
    } catch (err: any) {
      notify('error', 'Erro ao aplicar templates: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const label = activeTab === 'tags' ? 'tags' : activeTab === 'variables' ? 'campos' : 'respostas';
    askDelete(`${selectedIds.size} ${label} selecionados`, async () => {
      setLoading(true);
      try {
        const ids = Array.from(selectedIds);
        for (const id of ids) {
          if (activeTab === 'tags') await umblerService.deleteTag(orgId, apiToken!, id);
          else if (activeTab === 'variables') await umblerService.deleteCustomField(orgId, apiToken!, id);
          else if (activeTab === 'shortcuts') await umblerService.deleteQuickAnswer(orgId, apiToken!, id);
        }
        notify('success', `${selectedIds.size} itens excluídos`);
        setSelectedIds(new Set());
        fetchTabData(activeTab, selectedUnit, apiToken);
      } catch (err: any) {
        notify('error', 'Erro na exclusão em massa: ' + err.message);
      } finally {
        setLoading(false);
        setConfirmDelete(null);
      }
    });
  };

  // ── Save token ──
  const handleSaveToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    setSavingToken(true);
    try {
      await umblerService.saveApiToken(tokenInput.trim());
      setApiToken(tokenInput.trim());
      setIsConfigured(true);
      notify('success', 'Token salvo com sucesso!');
      setIsTokenModalOpen(false);
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setSavingToken(false);
    }
  };

  // ── Delete confirm ──
  const askDelete = (label: string, onConfirm: () => void) =>
    setConfirmDelete({ open: true, label, onConfirm });

  // ── TAGS CRUD ──
  const handleSaveTag = async (values: { name: string; color: string; icon: string }, existingTag?: UmblerTag) => {
    try {
      const payload = { name: values.name, color: values.color, icon: values.icon || undefined };
      if (existingTag) {
        await umblerService.updateTag(orgId, token, existingTag.id, payload);
        notify('success', 'Tag atualizada!');
      } else {
        await umblerService.createTag(orgId, token, payload);
        notify('success', 'Tag criada!');
      }
      setTagModal(null);
      fetchTabData('tags', selectedUnit, apiToken);
    } catch (err: any) {
      notify('error', err.message);
      throw err;
    }
  };

  const handleSaveTagAsPreset = async (values: { name: string; color: string; icon: string }, presetName: string) => {
    try {
      await umblerService.savePreset({ preset_type: 'tag_template', name: presetName, config: values });
      const updated = await umblerService.listPresets('tag_template');
      setTagPresets(updated);
      notify('success', `Template "${presetName}" salvo!`);
    } catch (err: any) {
      notify('error', err.message);
      throw err;
    }
  };


  const deleteTagHandler = (tag: UmblerTag) => askDelete(`a tag "${tag.name}"`, async () => {
    try { await umblerService.deleteTag(orgId, token, tag.id); notify('success', 'Tag excluída'); fetchTabData('tags', selectedUnit, apiToken); }
    catch (err: any) { notify('error', err.message); }
    setConfirmDelete(null);
  });

  // ── CUSTOM FIELDS CRUD ──
  const openVariableForm = (v?: UmblerCustomField) => {
    setGenericModal({
      open: true,
      title: v ? 'Editar Campo' : 'Novo Campo',
      fields: [
        { key: 'name', label: 'Nome do Campo', placeholder: 'Ex: CPF, Data Nasc' },
        { key: 'description', label: 'Descrição', placeholder: 'Opcional' },
      ],
      initial: v ? { name: v.name, description: v.description || '' } : undefined,
      onClose: () => setGenericModal(null),
      onSave: async values => {
        const payload = { name: values.name, description: values.description };
        if (v) { await umblerService.updateCustomField(orgId, token, v.id, payload); notify('success', 'Campo atualizado!'); }
        else { await umblerService.createCustomField(orgId, token, payload); notify('success', 'Campo criado!'); }
        setGenericModal(null);
        fetchTabData('variables', selectedUnit, apiToken);
      },
    });
  };

  const deleteVariableHandler = (v: UmblerCustomField) => askDelete(`o campo "${v.name}"`, async () => {
    try { await umblerService.deleteCustomField(orgId, token, v.id); notify('success', 'Campo excluído'); fetchTabData('variables', selectedUnit, apiToken); }
    catch (err: any) { notify('error', err.message); }
    setConfirmDelete(null);
  });



  // ── QUICK ANSWERS CRUD ──
  const openQuickAnswerForm = (qa?: UmblerQuickAnswer) => {
    if (qa) {
      setSelectedQuickAnswer(qa);
      setQaEditForm({ name: qa.name, content: qa.content });
    } else {
      setSelectedQuickAnswer({ id: '_new' } as any);
      setQaEditForm({ name: '', content: '' });
    }
  };

  const handleSaveQuickAnswer = async () => {
    if (!selectedQuickAnswer || !token || !orgId) return;
    setIsSavingQA(true);
    try {
      const payload = {
        name: qaEditForm.name,
        content: qaEditForm.content,
        visibility: 'All' as const
      };
      
      if (selectedQuickAnswer.id === '_new') {
        const res = await umblerService.createQuickAnswer(orgId, token, payload);
        notify('success', 'Resposta criada com sucesso!');
        setSelectedQuickAnswer(null);
      } else {
        await umblerService.updateQuickAnswer(orgId, token, selectedQuickAnswer.id, payload);
        notify('success', 'Resposta atualizada com sucesso!');
      }
      fetchTabData('shortcuts', selectedUnit, apiToken);
    } catch (err: any) {
      notify('error', 'Erro ao salvar: ' + err.message);
    } finally {
      setIsSavingQA(false);
    }
  };

  const handleSaveQuickAnswerAsPreset = async (values: any, presetName: string) => {
    try {
      await umblerService.savePreset({ preset_type: 'quick_answer', name: presetName, config: values });
      const updated = await umblerService.listPresets('quick_answer');
      setQuickAnswerPresets(updated);
      notify('success', `Template de resposta "${presetName}" salvo!`);
    } catch (err: any) {
      notify('error', err.message);
      throw err;
    }
  };

  const deleteQuickAnswerHandler = (qa: UmblerQuickAnswer) => askDelete(`a resposta "${qa.name}"`, async () => {
    try { await umblerService.deleteQuickAnswer(orgId, token, qa.id); notify('success', 'Resposta rápida excluída'); fetchTabData('shortcuts', selectedUnit, apiToken); }
    catch (err: any) { notify('error', err.message); }
    setConfirmDelete(null);
  });

  // ── ORG save ──
  const handleSaveOrg = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingOrg(true);
    try { await umblerService.updateOrganization(orgId, token, orgForm); notify('success', 'Organização atualizada!'); }
    catch (err: any) { notify('error', err.message); }
    finally { setSavingOrg(false); }
  };

  const handleImportUnitData = async () => {
    if (!selectedUnit?.unit_id || !orgForm) return;
    
    setLoading(true);
    try {
      const unit = await umblerService.getUnitDetails(selectedUnit.unit_id);
      if (!unit) throw new Error('Unidade não encontrada no sistema.');

      const newForm = { ...orgForm };

      // Dados diretos (com formatação)
      if (unit.razao_social) newForm.socialReason = formatToTitleCase(unit.razao_social);
      if (unit.cnpj) newForm.cnpj = unit.cnpj; // CNPJ não altera case
      if (unit.email) newForm.financeEmail = unit.email.toLowerCase();
      if (unit.contato) newForm.phone = unit.contato;

      // Parser de Endereço (Melhor esforço)
      if (unit.endereco) {
        const addr = unit.endereco;
        const parts = addr.split(/,|\s-\s/).map((p: string) => p.trim()).filter(Boolean);
        
        if (parts.length >= 1) {
          newForm.road = formatToTitleCase(parts[0]);

          if (parts[1] && (/^\d+/.test(parts[1]) || /S\/N/i.test(parts[1]))) {
            newForm.number = parts[1].toUpperCase(); // S/N em maiúsculo
            
            if (parts.length >= 5) {
              newForm.neighbourhood = formatToTitleCase(parts[2]);
              newForm.city = formatToTitleCase(parts[3]);
              newForm.state = parts[4].split('/')[0].trim().toUpperCase();
            } else if (parts.length >= 3) {
              newForm.city = formatToTitleCase(parts[parts.length - 1].split('/')[0].trim());
              if (parts.length === 4) newForm.neighbourhood = formatToTitleCase(parts[2]);
            }
          }
        }

        // Tenta extrair CEP (8 dígitos no final ou com hífen)
        const cepMatch = addr.match(/(\d{5}-?\d{3})/);
        if (cepMatch) newForm.cep = cepMatch[0].replace(/-/, '');

        // Tenta extrair UF (Sigla de 2 letras)
        const ufMatch = addr.match(/\s([A-Z]{2})($|[\s,])/);
        if (ufMatch) newForm.state = ufMatch[1];
      }

      setOrgForm(newForm);
      notify('success', 'Dados da unidade carregados no formulário!');
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Render helpers ──
  const AddButton: React.FC<{ onClick: () => void; label: string }> = ({ onClick, label }) => (
    <button onClick={onClick} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-accent-primary rounded-xl hover:bg-accent-secondary shadow-sm transition-all active:scale-95">
      <Plus className="w-4 h-4" /> {label}
    </button>
  );

  const RefreshBtn: React.FC<{ tab: Tab }> = ({ tab }) => (
    <button onClick={() => fetchTabData(tab, selectedUnit, apiToken)} className="p-2 rounded-xl border border-border-primary text-text-secondary hover:bg-bg-tertiary transition-all">
      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
    </button>
  );

  const noOrgId = isConfigured && activeTab !== 'config' && !selectedUnit?.organizationID;
  const noToken = !isConfigured && activeTab !== 'config';

  return (
    <div className="flex flex-col h-full bg-bg-primary">

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[300] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border animate-in slide-in-from-top-2 duration-300 ${
          toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700' : 'bg-danger/10 border-danger/20 text-danger'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
          <p className="text-sm font-semibold">{toast.text}</p>
        </div>
      )}

      {/* ── Tag Modal ── */}
      {tagModal?.open && (
        <TagFormModal
          title={tagModal.tag ? 'Editar Tag' : 'Nova Tag'}
          initial={tagModal.tag ? { name: tagModal.tag.name, color: tagModal.tag.color || UMBLER_COLORS[4], icon: tagModal.tag.icon || '' } : undefined}
          presets={tagPresets}
          onSave={values => handleSaveTag(values, tagModal.tag)}
          onSaveAsPreset={handleSaveTagAsPreset}
          onClose={() => setTagModal(null)}
        />
      )}

      {/* ── Generic Modal ── */}
      {genericModal?.open && <FormModal {...genericModal} />}

      {/* ── Confirm Delete ── */}
      {confirmDelete?.open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm mx-4 bg-bg-secondary border border-border-primary rounded-2xl shadow-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-text-primary">Confirmar exclusão</h3>
            <p className="text-sm text-text-secondary">Excluir {confirmDelete.label}? Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm font-medium text-text-secondary border border-border-primary rounded-xl hover:bg-bg-tertiary transition-all">Cancelar</button>
              <button onClick={confirmDelete.onConfirm} className="px-4 py-2 text-sm font-bold text-white bg-danger rounded-xl hover:bg-danger/90 transition-all shadow-sm">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center">
            <Bot className="w-5 h-5 text-accent-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Umbler Talk</h1>
            <p className="text-sm text-text-secondary">Gerenciamento via API UTalk</p>
          </div>
        </div>
        <button 
          onClick={() => setIsTokenModalOpen(true)}
          className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border transition-all hover:brightness-95 active:scale-95 ${
            isConfigured ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 cursor-pointer' : 'bg-gray-500/10 text-gray-500 border-gray-500/20 cursor-pointer'
          }`}
        >
          {isConfigured ? '● Token ativo' : '○ Não configurado'}
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 bg-bg-tertiary rounded-xl border border-border-primary mb-5">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all flex-1 justify-center ${
              activeTab === tab.id ? 'bg-bg-secondary text-text-primary shadow-sm border border-border-primary' : 'text-text-secondary hover:text-text-primary'
            }`}>
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Gate: sem token */}
      {noToken && (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent-primary/10 flex items-center justify-center"><Settings className="w-8 h-8 text-accent-primary" /></div>
          <h2 className="text-xl font-bold text-text-primary">Bearer Token necessário</h2>
          <p className="text-text-secondary text-sm max-w-sm">Configure na aba <strong>Configuração</strong> para começar.</p>
          <button onClick={() => setActiveTab('config')} className="flex items-center gap-2 px-5 py-2.5 bg-accent-primary text-white font-bold rounded-xl hover:bg-accent-secondary transition-all shadow-md">
            <Settings className="w-4 h-4" /> Ir para Configuração
          </button>
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto space-y-1">



        {/* ── ORGANIZATION ── */}
        {activeTab === 'organization' && isConfigured && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 p-2 bg-bg-tertiary/20 border border-border-primary/50 rounded-2xl mb-2">
              <div className="flex flex-wrap items-center gap-3">
                <UnitDropdown units={units} selected={selectedUnit} onSelect={setSelectedUnit} loadingUnits={loadingUnits} />
                {!noOrgId && (
                  <button
                    onClick={handleImportUnitData}
                    disabled={loading || !org}
                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 rounded-lg text-[10px] font-bold transition-all group border border-emerald-500/10 active:scale-95 shadow-sm"
                    title="Sincronizar dados cadastrais da unidade com o perfil Umbler"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : 'group-hover:rotate-180'} transition-transform duration-500`} />
                    Sincronizar com Unidade
                  </button>
                )}
              </div>
              {!noOrgId && org && (
                <button
                  onClick={() => handleSaveOrg()}
                  disabled={savingOrg}
                  className="flex items-center gap-2 px-5 py-2 bg-accent-primary text-white text-xs font-bold rounded-xl hover:bg-accent-secondary disabled:opacity-50 transition-all shadow-md active:scale-95"
                >
                  {savingOrg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Salvar Alterações
                </button>
              )}
            </div>

            {noOrgId ? (
              <p className="text-center py-10 text-amber-600 text-sm">Esta unidade não possui Organization ID configurado.</p>
            ) : (
              <div className={loading && !org ? 'opacity-50 pointer-events-none' : ''}>
                {loading && !org && <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-accent-primary" /></div>}
                {org && (
                  <form onSubmit={handleSaveOrg} className="space-y-6 max-w-4xl px-1">
                    
                    {/* Grupo: Dados da Empresa */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-1 border-b border-border-primary">
                        <Building2 className="w-4 h-4 text-accent-primary" />
                        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Dados da Empresa</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Nome Fantasia (Exibição)</label>
                          <input type="text" value={orgForm.name || ''} onChange={e => setOrgForm(p => ({ ...p, name: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-bg-tertiary border border-border-primary rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary outline-none transition-all" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Razão Social</label>
                          <input type="text" value={orgForm.socialReason || ''} onChange={e => setOrgForm(p => ({ ...p, socialReason: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-bg-tertiary border border-border-primary rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary outline-none transition-all" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">CNPJ</label>
                          <input type="text" value={orgForm.cnpj || ''} onChange={e => setOrgForm(p => ({ ...p, cnpj: e.target.value }))}
                            placeholder="00.000.000/0000-00"
                            className="w-full px-4 py-2.5 bg-bg-tertiary border border-border-primary rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary outline-none transition-all" />
                        </div>
                      </div>
                    </div>

                    {/* Grupo: Contato e Financeiro */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-1 border-b border-border-primary">
                        <Save className="w-4 h-4 text-accent-primary" />
                        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Contato e Financeiro</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">E-mail Financeiro</label>
                          <input type="email" value={orgForm.financeEmail || ''} onChange={e => setOrgForm(p => ({ ...p, financeEmail: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-bg-tertiary border border-border-primary rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary outline-none transition-all" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Tel. Financeiro (WhatsApp)</label>
                          <input type="text" value={orgForm.financeWhatsapp || ''} onChange={e => setOrgForm(p => ({ ...p, financeWhatsapp: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-bg-tertiary border border-border-primary rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary outline-none transition-all" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Telefone Geral</label>
                          <input type="text" value={orgForm.phone || ''} onChange={e => setOrgForm(p => ({ ...p, phone: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-bg-tertiary border border-border-primary rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary outline-none transition-all" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Timezone</label>
                          <input type="text" value={orgForm.timezone || ''} onChange={e => setOrgForm(p => ({ ...p, timezone: e.target.value }))}
                            placeholder="America/Sao_Paulo"
                            className="w-full px-4 py-2.5 bg-bg-tertiary border border-border-primary rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary outline-none transition-all" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Idioma</label>
                          <input type="text" value={orgForm.language || ''} onChange={e => setOrgForm(p => ({ ...p, language: e.target.value }))}
                            placeholder="pt-BR"
                            className="w-full px-4 py-2.5 bg-bg-tertiary border border-border-primary rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary outline-none transition-all" />
                        </div>
                      </div>
                    </div>

                    {/* Grupo: Endereço */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-1 border-b border-border-primary">
                        <Building2 className="w-4 h-4 text-accent-primary" />
                        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Endereço</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">CEP</label>
                          <input type="text" value={orgForm.cep || ''} onChange={e => setOrgForm(p => ({ ...p, cep: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-bg-tertiary border border-border-primary rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary outline-none transition-all" />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Logradouro / Rua</label>
                          <input type="text" value={orgForm.road || ''} onChange={e => setOrgForm(p => ({ ...p, road: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-bg-tertiary border border-border-primary rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary outline-none transition-all" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Número</label>
                          <input type="text" value={orgForm.number || ''} onChange={e => setOrgForm(p => ({ ...p, number: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-bg-tertiary border border-border-primary rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary outline-none transition-all" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Bairro</label>
                          <input type="text" value={orgForm.neighbourhood || ''} onChange={e => setOrgForm(p => ({ ...p, neighbourhood: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-bg-tertiary border border-border-primary rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary outline-none transition-all" />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Cidade</label>
                          <input type="text" value={orgForm.city || ''} onChange={e => setOrgForm(p => ({ ...p, city: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-bg-tertiary border border-border-primary rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary outline-none transition-all" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Estado (UF)</label>
                          <input type="text" value={orgForm.state || ''} onChange={e => setOrgForm(p => ({ ...p, state: e.target.value }))}
                            placeholder="Ex: SP"
                            className="w-full px-4 py-2.5 bg-bg-tertiary border border-border-primary rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary outline-none transition-all" />
                        </div>
                        <div className="md:col-span-4">
                          <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Complemento</label>
                          <input type="text" value={orgForm.complement || ''} onChange={e => setOrgForm(p => ({ ...p, complement: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-bg-tertiary border border-border-primary rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary outline-none transition-all" />
                        </div>
                      </div>
                    </div>

                    {/* Grupo: Identidade Visual */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-1 border-b border-border-primary">
                        <TagIcon className="w-4 h-4 text-accent-primary" />
                        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Identidade Visual</h3>
                      </div>
                      <div className="flex items-center gap-6 p-4 bg-bg-tertiary border border-border-primary rounded-xl">
                        <div className="w-20 h-20 rounded-2xl bg-bg-secondary border border-border-primary flex items-center justify-center overflow-hidden">
                          {orgForm.iconUrl ? (
                            <img src={orgForm.iconUrl} alt="Logo" className="w-full h-full object-cover" />
                          ) : (
                            <Building2 className="w-8 h-8 text-text-secondary opacity-30" />
                          )}
                        </div>
                        <div className="flex-1">
                          <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">URL do Ícone / Logo</label>
                          <input type="text" value={orgForm.iconUrl || ''} onChange={e => setOrgForm(p => ({ ...p, iconUrl: e.target.value }))}
                            placeholder="https://..."
                            className="w-full px-4 py-2.5 bg-bg-primary border border-border-primary rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary outline-none transition-all" />
                        </div>
                      </div>
                    </div>

                  </form>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAGS ── */}
        {activeTab === 'tags' && isConfigured && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 p-2 bg-bg-tertiary/20 border border-border-primary/50 rounded-2xl mb-2">
              <div className="flex items-center gap-3 flex-1">
                <UnitDropdown units={units} selected={selectedUnit} onSelect={setSelectedUnit} loadingUnits={loadingUnits} />
                <div className="relative flex-1 max-w-xs">
                  <input
                    type="text" placeholder="Buscar tags..."
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-bg-secondary border border-border-primary rounded-lg text-[10px] text-text-primary focus:border-accent-primary outline-none transition-all"
                  />
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-secondary" />
                </div>
                <button onClick={() => setIsPresetPickerOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary/10 hover:bg-accent-primary text-accent-primary hover:text-white rounded-lg text-[10px] font-bold transition-all border border-accent-primary/20">
                  <Bookmark className="w-3 h-3" /> Adicionar do Template
                </button>
                {selectedIds.size > 0 && (
                  <button onClick={handleBulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 bg-danger/10 hover:bg-danger text-danger hover:text-white rounded-lg text-[10px] font-bold transition-all border border-danger/20">
                    <Trash2 className="w-3 h-3" /> Excluir ({selectedIds.size})
                  </button>
                )}
              </div>
              {!noOrgId && (
                <button onClick={() => setTagModal({ open: true })} className="flex items-center gap-2 px-4 py-2 bg-accent-primary text-white text-xs font-bold rounded-xl hover:bg-accent-secondary transition-all shadow-md">
                  <Plus className="w-4 h-4" /> Nova Tag
                </button>
              )}
            </div>

            {noOrgId ? (
              <p className="text-center py-10 text-amber-600 text-sm">Esta unidade não possui Organization ID configurado.</p>
            ) : (
              <div className={loading ? 'opacity-50 pointer-events-none' : ''}>
                {loading && <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-accent-primary" /></div>}
                {!loading && tags.length === 0 && <div className="text-center py-12 text-text-secondary text-sm italic">Nenhuma tag encontrada.</div>}
                {!loading && tags.length > 0 && (
                  <div className="flex items-center gap-2 mb-2 px-4 py-1">
                    <input
                      type="checkbox" 
                      checked={selectedIds.size > 0 && selectedIds.size === tags.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase())).length}
                      onChange={() => toggleAll(tags.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase())).map(t => t.id))}
                      className="w-4 h-4 rounded border-border-primary text-accent-primary focus:ring-accent-primary/30 cursor-pointer"
                    />
                    <span className="text-[10px] font-bold text-text-secondary uppercase">Selecionar Todos</span>
                  </div>
                )}
                <div className="space-y-2">
                  {tags
                    .filter(tag => tag.name.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(tag => (
                    <CRUDRow key={tag.id} label={tag.name} sublabel={tag.icon ? `ícone: ${tag.icon}` : tag.id}
                      colorDot={tag.color}
                      selected={selectedIds.has(tag.id)}
                      onSelect={() => toggleOne(tag.id)}
                      onEdit={() => setTagModal({ open: true, tag })}
                      onDelete={() => deleteTagHandler(tag)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SHORTCUTS ── */}
        {activeTab === 'shortcuts' && isConfigured && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 p-2 bg-bg-tertiary/20 border border-border-primary/50 rounded-2xl mb-2">
              <div className="flex items-center gap-3 flex-1">
                <UnitDropdown units={units} selected={selectedUnit} onSelect={setSelectedUnit} loadingUnits={loadingUnits} />
                <div className="relative flex-1 max-w-xs">
                  <input
                    type="text" placeholder="Buscar respostas..."
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-bg-secondary border border-border-primary rounded-lg text-[10px] text-text-primary focus:border-accent-primary outline-none transition-all"
                  />
                  <Zap className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-secondary" />
                </div>
                <button onClick={() => setIsPresetPickerOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary/10 hover:bg-accent-primary text-accent-primary hover:text-white rounded-lg text-[10px] font-bold transition-all border border-accent-primary/20">
                  <Bookmark className="w-3 h-3" /> Adicionar do Template
                </button>
                {selectedIds.size > 0 && (
                  <button onClick={handleBulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 bg-danger/10 hover:bg-danger text-danger hover:text-white rounded-lg text-[10px] font-bold transition-all border border-danger/20">
                    <Trash2 className="w-3 h-3" /> Excluir ({selectedIds.size})
                  </button>
                )}
              </div>
              {!noOrgId && (
                <button onClick={() => openQuickAnswerForm()} className="flex items-center gap-2 px-4 py-2 bg-accent-primary text-white text-xs font-bold rounded-xl hover:bg-accent-secondary transition-all shadow-md">
                  <Plus className="w-4 h-4" /> Nova Resposta
                </button>
              )}
            </div>

            {noOrgId ? (
              <p className="text-center py-10 text-amber-600 text-sm">Esta unidade não possui Organization ID configurado.</p>
            ) : (
              <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                
                {/* LADO ESQUERDO: LISTA */}
                <div className="lg:col-span-4 space-y-4">
                  {loading && <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-accent-primary" /></div>}
                  {!loading && quickAnswers.length === 0 && <div className="text-center py-12 text-text-secondary text-sm italic">Nenhuma resposta rápida encontrada.</div>}
                  
                  {!loading && quickAnswers.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 mb-2 px-4 py-1">
                        <input
                          type="checkbox" 
                          checked={selectedIds.size > 0 && selectedIds.size === quickAnswers.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())).length}
                          onChange={() => toggleAll(quickAnswers.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())).map(s => s.id))}
                          className="w-4 h-4 rounded border-border-primary text-accent-primary focus:ring-accent-primary/30 cursor-pointer"
                        />
                        <span className="text-[10px] font-bold text-text-secondary uppercase">Selecionar Todos</span>
                      </div>
                      
                      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                        {quickAnswers
                          .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
                          .map(s => (
                          <div 
                            key={s.id}
                            onClick={() => openQuickAnswerForm(s)}
                            className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
                              selectedQuickAnswer?.id === s.id 
                                ? 'border-accent-primary bg-accent-primary/5 shadow-sm' 
                                : 'border-border-primary bg-bg-secondary hover:border-accent-primary/30'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <input 
                                  type="checkbox" 
                                  checked={selectedIds.has(s.id)} 
                                  onChange={(e) => { e.stopPropagation(); toggleOne(s.id); }}
                                  className="w-3.5 h-3.5 rounded border-border-primary text-accent-primary cursor-pointer"
                                />
                                <p className="text-sm font-bold text-text-primary truncate">{s.name}</p>
                              </div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); deleteQuickAnswerHandler(s); }}
                                className="p-1.5 rounded-lg text-text-secondary hover:text-danger hover:bg-danger/10 transition-all opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                            <p className="text-[10px] text-text-secondary line-clamp-2 leading-relaxed">
                              {s.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* LADO DIREITO: EDITOR */}
                <div className="lg:col-span-8 bg-bg-secondary border border-border-primary rounded-2xl p-6 shadow-sm min-h-[400px]">
                  {selectedQuickAnswer ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                      <div className="flex items-center justify-between border-b border-border-primary pb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center text-accent-primary">
                            <Zap className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-text-primary">
                              {selectedQuickAnswer.id === '_new' ? 'Nova Resposta Rápida' : 'Editar Resposta'}
                            </h3>
                            <p className="text-xs text-text-secondary">Defina o atalho e a mensagem de resposta.</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setSelectedQuickAnswer(null)}
                          className="p-2 rounded-lg hover:bg-bg-tertiary text-text-secondary transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1.5 ml-1">Nome do Atalho</label>
                          <input 
                            type="text"
                            value={qaEditForm.name}
                            onChange={(e) => setQaEditForm({ ...qaEditForm, name: e.target.value })}
                            placeholder="Ex: Saudação, Link de Pagamento..."
                            className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary outline-none transition-all"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1.5 ml-1">
                            <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest">Mensagem da Resposta</label>
                            
                            {/* Toolbar de Variáveis */}
                            <div className="flex items-center gap-1.5 overflow-x-auto max-w-[400px] scrollbar-hide pb-1">
                              <span className="text-[9px] text-text-secondary whitespace-nowrap">Variáveis:</span>
                              {SYSTEM_VARIABLES.map(v => (
                                <button key={v.value} onClick={() => insertVariable(v.value)} title={v.label}
                                  className="px-2 py-1 bg-bg-tertiary border border-border-primary rounded-md text-[9px] text-text-primary hover:border-accent-primary transition-all whitespace-nowrap">
                                  {v.label}
                                </button>
                              ))}
                              {variables.length > 0 && <div className="w-[1px] h-3 bg-border-primary mx-1" />}
                              {variables.map(v => (
                                <button key={v.id} onClick={() => insertVariable(v.name)} title={`Campo Personalizado: ${v.name}`}
                                  className="px-2 py-1 bg-accent-primary/5 border border-accent-primary/20 rounded-md text-[9px] text-accent-primary hover:bg-accent-primary hover:text-white transition-all whitespace-nowrap">
                                  {v.name}
                                </button>
                              ))}
                            </div>
                          </div>
                          <textarea 
                            ref={qaTextareaRef}
                            rows={8}
                            value={qaEditForm.content}
                            onChange={(e) => setQaEditForm({ ...qaEditForm, content: e.target.value })}
                            placeholder="Digite a mensagem que o sistema deve enviar automaticamente..."
                            className="w-full px-4 py-4 bg-bg-tertiary border border-border-primary rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary outline-none transition-all resize-none"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-primary">
                        <button 
                          disabled={isSavingQA}
                          onClick={() => setSelectedQuickAnswer(null)}
                          className="px-5 py-2.5 text-xs font-bold text-text-secondary hover:text-text-primary transition-all"
                        >
                          Cancelar
                        </button>
                        <button 
                          onClick={handleSaveQuickAnswer}
                          disabled={isSavingQA || !qaEditForm.name || !qaEditForm.content}
                          className="flex items-center gap-2 px-6 py-2.5 bg-accent-primary text-white text-xs font-extrabold rounded-xl hover:bg-accent-secondary disabled:opacity-50 transition-all shadow-lg shadow-accent-primary/20"
                        >
                          {isSavingQA ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          {selectedQuickAnswer.id === '_new' ? 'Criar Resposta' : 'Salvar Alterações'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-12">
                      <div className="w-16 h-16 rounded-full bg-bg-tertiary flex items-center justify-center text-text-secondary/20">
                        <Zap className="w-8 h-8" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-text-primary">Nenhuma resposta selecionada</p>
                        <p className="text-xs text-text-secondary max-w-[240px] mx-auto">Selecione uma resposta ao lado para editar ou clique em "Nova Resposta".</p>
                      </div>
                      <button 
                        onClick={() => openQuickAnswerForm()}
                        className="px-4 py-2 text-[10px] font-bold text-accent-primary hover:bg-accent-primary/5 rounded-lg border border-accent-primary/20 transition-all"
                      >
                        Nova Resposta Rápida
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── VARIABLES ── */}
        {activeTab === 'variables' && isConfigured && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 p-2 bg-bg-tertiary/20 border border-border-primary/50 rounded-2xl mb-2">
              <div className="flex items-center gap-3 flex-1">
                <UnitDropdown units={units} selected={selectedUnit} onSelect={setSelectedUnit} loadingUnits={loadingUnits} />
                <div className="relative flex-1 max-w-xs">
                  <input
                    type="text" placeholder="Buscar campos..."
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-bg-secondary border border-border-primary rounded-lg text-[10px] text-text-primary focus:border-accent-primary outline-none transition-all"
                  />
                  <Variable className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-secondary" />
                </div>
                <button onClick={() => setIsPresetPickerOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary/10 hover:bg-accent-primary text-accent-primary hover:text-white rounded-lg text-[10px] font-bold transition-all border border-accent-primary/20">
                  <Bookmark className="w-3 h-3" /> Adicionar do Template
                </button>
                {selectedIds.size > 0 && (
                  <button onClick={handleBulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 bg-danger/10 hover:bg-danger text-danger hover:text-white rounded-lg text-[10px] font-bold transition-all border border-danger/20">
                    <Trash2 className="w-3 h-3" /> Excluir ({selectedIds.size})
                  </button>
                )}
              </div>
              {!noOrgId && (
                <button onClick={() => openVariableForm()} className="flex items-center gap-2 px-4 py-2 bg-accent-primary text-white text-xs font-bold rounded-xl hover:bg-accent-secondary transition-all shadow-md">
                  <Plus className="w-4 h-4" /> Novo Campo
                </button>
              )}
            </div>

            {noOrgId ? (
              <p className="text-center py-10 text-amber-600 text-sm">Esta unidade não possui Organization ID configurado.</p>
            ) : (
              <div className={loading ? 'opacity-50 pointer-events-none' : ''}>
                {loading && <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-accent-primary" /></div>}
                {!loading && variables.length === 0 && <div className="text-center py-12 text-text-secondary text-sm italic">Nenhum campo personalizado encontrado.</div>}
                {!loading && variables.length > 0 && (
                  <div className="flex items-center gap-2 mb-2 px-4 py-1">
                    <input
                      type="checkbox" 
                      checked={selectedIds.size > 0 && selectedIds.size === variables.filter(v => v.name.toLowerCase().includes(searchTerm.toLowerCase())).length}
                      onChange={() => toggleAll(variables.filter(v => v.name.toLowerCase().includes(searchTerm.toLowerCase())).map(v => v.id))}
                      className="w-4 h-4 rounded border-border-primary text-accent-primary focus:ring-accent-primary/30 cursor-pointer"
                    />
                    <span className="text-[10px] font-bold text-text-secondary uppercase">Selecionar Todos</span>
                  </div>
                )}
                <div className="space-y-2">
                  {variables
                    .filter(v => v.name.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(v => (
                    <CRUDRow key={v.id} label={v.name} sublabel={v.description || v.id}
                      selected={selectedIds.has(v.id)}
                      onSelect={() => toggleOne(v.id)}
                      onEdit={() => openVariableForm(v)} onDelete={() => deleteVariableHandler(v)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CONFIGURATION ── */}
        {activeTab === 'config' && (
          <div className="space-y-6 max-w-3xl">

            {/* ── CENTRAL DE TEMPLATES ── */}
            <div className="bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden shadow-sm">
              <div className="p-5 border-b border-border-primary bg-bg-tertiary/20">
                <h3 className="text-lg font-bold text-text-primary flex items-center gap-2"><Bookmark className="w-5 h-5 text-accent-primary" /> Central de Templates (Presets)</h3>
                <p className="text-sm text-text-secondary mt-1">Configure padrões ideais baseados na MB Dromedário.</p>
                
                {/* Sub-abas de Templates */}
                <div className="flex items-center gap-2 mt-4 p-1 bg-bg-tertiary/50 border border-border-primary/50 rounded-xl w-fit">
                  {[
                    { id: 'tags', label: 'Tags', icon: <TagIcon className="w-3.5 h-3.5" /> },
                    { id: 'fields', label: 'Campos', icon: <Variable className="w-3.5 h-3.5" /> },
                    { id: 'quick_answer', label: 'Respostas', icon: <Zap className="w-3.5 h-3.5" /> },
                  ].map(st => (
                    <button key={st.id} onClick={() => setActivePresetTab(st.id as any)}
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        activePresetTab === st.id ? 'bg-bg-secondary text-accent-primary shadow-sm ring-1 ring-border-primary' : 'text-text-secondary hover:bg-bg-tertiary'
                      }`}>
                      {st.icon} {st.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6">
                {/* BARRA DE AÇÕES EM LOTE */}
                {selectedPresetIds.size > 0 && (
                  <div className="sticky top-0 z-20 flex items-center justify-between p-4 mb-4 bg-accent-primary/5 border border-accent-primary/20 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent-primary text-white text-xs font-bold shadow-lg shadow-accent-primary/20">
                        {selectedPresetIds.size}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-text-primary">Itens selecionados</p>
                        <p className="text-[10px] text-text-secondary">Escolha uma ação para aplicar nos templates</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <button onClick={() => setSelectedPresetIds(new Set())} className="px-4 py-2 text-xs font-bold text-text-secondary hover:text-text-primary transition-all">
                        Cancelar
                      </button>
                      <button onClick={() => setIsFolderModalOpen(true)} className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-accent-primary rounded-xl hover:bg-accent-secondary transition-all shadow-md">
                        <FolderPlus className="w-3.5 h-3.5" /> Mover para Pasta
                      </button>
                      <button onClick={() => askDelete(`${selectedPresetIds.size} templates`, async () => {
                         for (const id of Array.from(selectedPresetIds)) {
                          await umblerService.deletePreset(id);
                        }
                        setTagPresets(await umblerService.listPresets('tag_template'));
                        setVariablePresets(await umblerService.listPresets('variable'));
                        setQuickAnswerPresets(await umblerService.listPresets('quick_answer'));
                        setSelectedPresetIds(new Set());
                        setConfirmDelete(null);
                        notify('success', 'Templates excluídos com sucesso');
                      })} className="p-2.5 rounded-xl text-danger border border-danger/20 hover:bg-danger/10 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* TAGS */}
                {activePresetTab === 'tags' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-text-secondary max-w-sm">Biblioteca de Tags configuradas.</p>
                      <button onClick={loadDromeTags} disabled={isLoadingDrome} className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-accent-primary border border-accent-primary/30 rounded-xl hover:bg-accent-primary/10 transition-all">
                        {isLoadingDrome ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sincronizar MB Dromedário
                      </button>
                    </div>

                    {dromeTagsSource.length > 0 && (
                      <div className="space-y-3 p-4 bg-bg-tertiary rounded-xl border border-border-primary border-dashed">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Disponíveis na MB Dromedário</p>
                          <button onClick={() => setDromeTagsSource([])} className="text-[10px] text-text-secondary hover:text-danger font-bold">Ocultar</button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                          {dromeTagsSource.map(tag => (
                            <div key={tag.id} className="flex items-center justify-between p-3 bg-bg-secondary border border-border-primary rounded-xl group hover:border-accent-primary/30 transition-all">
                              <div className="flex items-center gap-3">
                                <span className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: tag.color || UMBLER_COLORS[4] }} />
                                <p className="text-sm font-semibold text-text-primary">{tag.name}</p>
                              </div>
                              <button onClick={() => handleSaveDromeTagAsPreset(tag, tag.name)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-accent-primary border border-accent-primary/20 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-accent-primary/10 transition-all">
                                <BookmarkPlus className="w-3.5 h-3.5" /> Salvar Template
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Agrupamento por Pasta */}
                      {Array.from(new Set(tagPresets.map(p => p.config.folder || 'Sem Pasta'))).map(folder => (
                        <div key={folder} className="space-y-3">
                          <h4 className="text-[10px] font-extrabold text-text-secondary uppercase tracking-widest flex items-center gap-2 px-1">
                            <Layout className="w-3 h-3" /> {folder}
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {tagPresets.filter(p => (p.config.folder || 'Sem Pasta') === folder).map(p => (
                              <div key={p.id} className="flex items-center justify-between p-3 bg-bg-secondary border border-border-primary rounded-xl group hover:border-accent-primary/30 transition-all">
                                <div className="flex items-center gap-3 min-w-0">
                                  <input 
                                    type="checkbox" 
                                    checked={selectedPresetIds.has(p.id!)}
                                    onChange={() => togglePresetSelection(p.id!)}
                                    className="w-4 h-4 rounded border-border-primary text-accent-primary focus:ring-accent-primary/30 cursor-pointer"
                                  />
                                  <span className="w-4 h-4 rounded-full border border-black/10 flex-shrink-0" style={{ backgroundColor: p.config.color || UMBLER_COLORS[4] }} />
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-text-primary truncate">{p.name}</p>
                                    <p className="text-[10px] text-text-secondary">Cor: {p.config.color}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => setEditingDromeTag({ id: p.id, name: p.config.name || p.name, color: p.config.color || UMBLER_COLORS[4], icon: p.config.icon || '' })} className="p-1.5 rounded-lg text-text-secondary hover:text-accent-primary transition-all">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => askDelete(`o template "${p.name}"`, async () => {
                                    await umblerService.deletePreset(p.id!);
                                    setTagPresets(await umblerService.listPresets('tag_template'));
                                    setConfirmDelete(null);
                                    notify('success', 'Template excluído');
                                  })} className="p-1.5 rounded-lg text-text-secondary hover:text-danger transition-all">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* FIELDS */}
                {activePresetTab === 'fields' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-text-secondary max-w-sm">Biblioteca de Campos configurados.</p>
                      <button onClick={loadDromeFields} disabled={isLoadingDrome} className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-accent-primary border border-accent-primary/30 rounded-xl hover:bg-accent-primary/10 transition-all">
                        {isLoadingDrome ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sincronizar MB Dromedário
                      </button>
                    </div>

                    {dromeFieldsSource.length > 0 && (
                      <div className="space-y-3 p-4 bg-bg-tertiary rounded-xl border border-border-primary border-dashed">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Disponíveis na MB Dromedário</p>
                          <button onClick={() => setDromeFieldsSource([])} className="text-[10px] text-text-secondary hover:text-danger font-bold">Ocultar</button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                          {dromeFieldsSource.map(field => (
                            <div key={field.id} className="flex items-center justify-between p-3 bg-bg-secondary border border-border-primary rounded-xl group hover:border-accent-primary/30 transition-all">
                              <div className="flex items-center gap-3">
                                <Variable className="w-4 h-4 text-text-secondary" />
                                <p className="text-sm font-semibold text-text-primary">{field.name}</p>
                              </div>
                              <button onClick={() => handleSaveDromeFieldAsPreset(field)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-accent-primary border border-accent-primary/20 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-accent-primary/10 transition-all">
                                <BookmarkPlus className="w-3.5 h-3.5" /> Salvar Template
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Agrupamento por Pasta */}
                      {Array.from(new Set(variablePresets.map(p => p.config.folder || 'Sem Pasta'))).map(folder => (
                        <div key={folder} className="space-y-3">
                          <h4 className="text-[10px] font-extrabold text-text-secondary uppercase tracking-widest flex items-center gap-2 px-1">
                            <Layout className="w-3 h-3" /> {folder}
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {variablePresets.filter(p => (p.config.folder || 'Sem Pasta') === folder).map(p => (
                              <div key={p.id} className="flex items-center justify-between p-3 bg-bg-secondary border border-border-primary rounded-xl group hover:border-accent-primary/30 transition-all shadow-sm">
                                <div className="flex items-center gap-3 min-w-0">
                                  <input 
                                    type="checkbox" 
                                    checked={selectedPresetIds.has(p.id!)}
                                    onChange={() => togglePresetSelection(p.id!)}
                                    className="w-4 h-4 rounded border-border-primary text-accent-primary focus:ring-accent-primary/30 cursor-pointer"
                                  />
                                  <Variable className="w-4 h-4 text-text-secondary" />
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-text-primary truncate">{p.name}</p>
                                    <p className="text-[10px] text-text-secondary truncate">{p.description || "Tipo: Texto"}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => setEditingFieldPreset(p)} className="p-1.5 rounded-lg text-text-secondary hover:text-accent-primary transition-all">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => askDelete(`o template do campo "${p.name}"`, async () => {
                                    await umblerService.deletePreset(p.id!);
                                    setVariablePresets(await umblerService.listPresets('variable'));
                                    setConfirmDelete(null);
                                    notify('success', 'Template de Campo excluído');
                                  })} className="p-1.5 rounded-lg text-text-secondary hover:text-danger hover:bg-danger/10 transition-all">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* QUICK ANSWERS */}
                {activePresetTab === 'quick_answer' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-text-secondary max-w-sm">Biblioteca de Respostas Rápidas.</p>
                      <button onClick={loadDromeQuickAnswers} disabled={isLoadingDrome} className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-accent-primary border border-accent-primary/30 rounded-xl hover:bg-accent-primary/10 transition-all">
                        {isLoadingDrome ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sincronizar MB Dromedário
                      </button>
                    </div>
                    {dromeQuickAnswersSource.length > 0 && (
                      <div className="space-y-3 p-4 bg-bg-tertiary rounded-xl border border-border-primary border-dashed">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Disponíveis na MB Dromedário</p>
                          <button onClick={() => setDromeQuickAnswersSource([])} className="text-[10px] text-text-secondary hover:text-danger font-bold">Ocultar</button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                          {dromeQuickAnswersSource.map(qa => (
                            <div key={qa.id} className="flex items-center justify-between p-3 bg-bg-secondary border border-border-primary rounded-xl group hover:border-accent-primary/30 transition-all">
                              <div className="flex items-center gap-3">
                                <Zap className="w-4 h-4 text-accent-primary" />
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-text-primary truncate">{qa.name}</p>
                                  <p className="text-[10px] text-text-secondary truncate">{qa.content.slice(0, 40)}...</p>
                                </div>
                              </div>
                              <button onClick={() => handleSaveQuickAnswerAsPreset(qa, qa.name)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-accent-primary border border-accent-primary/20 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-accent-primary/10 transition-all">
                                <BookmarkPlus className="w-3.5 h-3.5" /> Salvar Template
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Agrupamento por Pasta */}
                      {Array.from(new Set(quickAnswerPresets.map(p => p.config.folder || 'Sem Pasta'))).map(folder => (
                        <div key={folder} className="space-y-3">
                          <h4 className="text-[10px] font-extrabold text-text-secondary uppercase tracking-widest flex items-center gap-2 px-1">
                            <Layout className="w-3 h-3" /> {folder}
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {quickAnswerPresets.filter(p => (p.config.folder || 'Sem Pasta') === folder).map(p => (
                              <div key={p.id} className="flex items-center justify-between p-3 bg-bg-secondary border border-border-primary rounded-xl group hover:border-accent-primary/30 transition-all shadow-sm">
                                <div className="flex items-center gap-3 min-w-0">
                                  <input 
                                    type="checkbox" 
                                    checked={selectedPresetIds.has(p.id!)}
                                    onChange={() => togglePresetSelection(p.id!)}
                                    className="w-4 h-4 rounded border-border-primary text-accent-primary focus:ring-accent-primary/30 cursor-pointer"
                                  />
                                  <Zap className="w-4 h-4 text-accent-primary" />
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-text-primary truncate">{p.name}</p>
                                    <p className="text-[10px] text-text-secondary truncate">{p.config.content?.slice(0, 40)}...</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => setEditingQAPreset(p)} className="p-1.5 rounded-lg text-text-secondary hover:text-accent-primary transition-all">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => askDelete(`o template da resposta "${p.name}"`, async () => {
                                    await umblerService.deletePreset(p.id!);
                                    setQuickAnswerPresets(await umblerService.listPresets('quick_answer'));
                                    setConfirmDelete(null);
                                    notify('success', 'Template de Resposta excluído');
                                  })} className="p-1.5 rounded-lg text-text-secondary hover:text-danger hover:bg-danger/10 transition-all">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* MODAIS GLOBAIS */}

        {/* Modal para Seleção de Template */}
        {isPresetPickerOpen && (
          <PresetPickerModal
            title={`Importar Templates de ${
              activeTab === 'tags' ? 'Tags' : 
              activeTab === 'variables' ? 'Campos' : 
              'Respostas Rápidas'
            }`}
            presets={
              activeTab === 'tags' ? tagPresets : 
              activeTab === 'variables' ? variablePresets : 
              quickAnswerPresets
            }
            loading={loading}
            onApply={handleApplyPresets}
            onClose={() => setIsPresetPickerOpen(false)}
          />
        )}

        {/* Modal para editar tag da Dromedário e salvar como template */}
        {editingDromeTag && (
          <TagFormModal
            title={editingDromeTag.id === '_new' ? 'Novo Template de Tag' : `Template: "${editingDromeTag.name}"`}
            initial={{ name: editingDromeTag.name, color: editingDromeTag.color || UMBLER_COLORS[4], icon: editingDromeTag.icon || '' }}
            presets={[]}
            onSave={async (values) => { 
              await handleSaveDromeTagAsPreset({ ...values, id: editingDromeTag.id }, values.name); 
              setEditingDromeTag(null); 
            }}
            onSaveAsPreset={async (values, presetName) => {
              await handleSaveDromeTagAsPreset(values, presetName);
              setEditingDromeTag(null);
            }}
            onClose={() => setEditingDromeTag(null)}
          />
        )}

        {editingFieldPreset && (
          <FormModal
            title={`Editar Template do Campo: "${editingFieldPreset.name}"`}
            fields={[
              { key: 'name', label: 'Nome do Template', type: 'text' },
              { key: 'description', label: 'Descrição/Pasta', type: 'text' }
            ]}
            initial={{ 
              name: editingFieldPreset.name, 
              description: editingFieldPreset.config.folder || '' 
            }}
            onSave={async (values) => {
              const updated = { ...editingFieldPreset, name: values.name, config: { ...editingFieldPreset.config, folder: values.description } };
              await umblerService.savePreset(updated);
              setVariablePresets(await umblerService.listPresets('variable'));
              setEditingFieldPreset(null);
              notify('success', 'Template de Campo atualizado');
            }}
            onClose={() => setEditingFieldPreset(null)}
          />
        )}

        {editingQAPreset && (
          <FormModal
            title={`Editar Template de Resposta: "${editingQAPreset.name}"`}
            fields={[
              { key: 'name', label: 'Nome do Template', type: 'text' },
              { key: 'content', label: 'Mensagem', type: 'textarea' }
            ]}
            initial={{ 
              name: editingQAPreset.name, 
              content: editingQAPreset.config.content || ''
            }}
            onSave={async (values) => {
              const updated = { ...editingQAPreset, name: values.name, config: { ...editingQAPreset.config, content: values.content } };
              await umblerService.savePreset(updated);
              setQuickAnswerPresets(await umblerService.listPresets('quick_answer'));
              setEditingQAPreset(null);
              notify('success', 'Template de Resposta atualizado');
            }}
            onClose={() => setEditingQAPreset(null)}
          />
        )}

        {/* Modal de Confirmação de Exclusão */}
        {confirmDelete && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
            <div className="w-full max-w-sm mx-4 bg-bg-secondary border border-border-primary rounded-2xl shadow-xl p-6 text-center" onClick={e => e.stopPropagation()}>
              <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4 text-danger"><Trash2 className="w-7 h-7" /></div>
              <h3 className="text-lg font-bold text-text-primary mb-2">Confirmar Exclusão</h3>
              <p className="text-sm text-text-secondary mb-6 leading-relaxed">Tem certeza que deseja excluir <strong>{confirmDelete.label}</strong>? Esta ação não pode ser desfeita.</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setConfirmDelete(null)} className="px-4 py-2.5 text-sm font-semibold text-text-secondary bg-bg-tertiary rounded-xl hover:bg-border-primary/50 transition-all border border-border-primary">Cancelar</button>
                <button onClick={confirmDelete.onConfirm} className="px-4 py-2.5 text-sm font-bold text-white bg-danger rounded-xl hover:bg-danger/90 transition-all shadow-md">Confirmar Exclusão</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Pasta */}
        {isFolderModalOpen && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setIsFolderModalOpen(false)}>
            <div className="w-full max-w-sm mx-4 bg-bg-secondary border border-border-primary rounded-2xl shadow-2xl p-6 overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center text-accent-primary border border-accent-primary/10">
                    <FolderPlus className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-text-primary tracking-tight">Mover para Pasta</h3>
                </div>
                <button onClick={() => setIsFolderModalOpen(false)} className="p-2 rounded-lg hover:bg-bg-tertiary text-text-secondary transition-all"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-extrabold text-text-secondary uppercase tracking-widest mb-1.5 block px-1">Nova Pasta ou Existente</label>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    placeholder="Ex: Setup Inicial, Comercial..."
                    className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent-primary/20 outline-none transition-all placeholder:text-text-secondary/50"
                  />
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  <p className="text-[9px] font-bold text-text-secondary uppercase px-1">Pastas Recentes</p>
                  {Array.from(new Set([...tagPresets, ...variablePresets, ...quickAnswerPresets].map(p => p.config.folder).filter(Boolean))).map(folder => (
                    <button
                      key={folder}
                      onClick={() => handleMoveToFolder(folder)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent-primary/5 border border-transparent hover:border-accent-primary/20 transition-all text-left group"
                    >
                      <Layout className="w-4 h-4 text-text-secondary group-hover:text-accent-primary transition-colors" />
                      <span className="text-sm font-semibold text-text-primary group-hover:text-accent-primary transition-colors">{folder}</span>
                    </button>
                  ))}
                  {Array.from(new Set([...tagPresets, ...variablePresets, ...quickAnswerPresets].map(p => p.config.folder).filter(Boolean))).length === 0 && (
                    <p className="text-xs text-text-secondary italic px-1 py-1">Nenhuma pasta criada ainda.</p>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => handleMoveToFolder(newFolderName)}
                    disabled={!newFolderName.trim()}
                    className="w-full py-3.5 bg-accent-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-accent-primary/20 hover:bg-accent-secondary disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                  >
                    Confirmar Destino
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {toast && (
          <div className="fixed bottom-6 right-6 z-[500] animate-in slide-in-from-right duration-300">
            <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border text-sm font-bold ${
              toast.type === 'success' ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-danger text-white border-red-400'
            }`}>
              {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              {toast.text}
            </div>
          </div>
        )}

        {/* Modais de Formulário */}
        {tagModal && tagModal.open && (
           <TagFormModal
             title={tagModal.tag ? 'Editar Tag' : 'Nova Tag'}
             initial={tagModal.tag}
             presets={tagPresets}
             onSave={values => handleSaveTag(values, tagModal.tag)}
             onSaveAsPreset={handleSaveTagAsPreset}
             onClose={() => setTagModal(null)}
           />
        )}

        {genericModal && genericModal.open && (
          <FormModal
            title={genericModal.title}
            fields={genericModal.fields}
            initial={genericModal.initial}
            onSave={genericModal.onSave}
            onClose={() => setGenericModal(null)}
          />
        )}

      </div>
      {isTokenModalOpen && (
        <TokenModal
          initialValue={tokenInput}
          onSave={handleSaveToken}
          onClose={() => setIsTokenModalOpen(false)}
          saving={savingToken}
          showToken={showToken}
          setShowToken={setShowToken}
          tokenInput={tokenInput}
          setTokenInput={setTokenInput}
        />
      )}
    </div>
  );
};

// ── SUB-COMPONENTES ──

const TokenModal = ({ onClose, onSave, saving, showToken, setShowToken, tokenInput, setTokenInput }: any) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-bg-primary border border-border-primary rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-border-primary bg-bg-tertiary/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent-primary/10 flex items-center justify-center text-accent-primary border border-accent-primary/10 shadow-inner">
              <Zap className="w-5 h-5 fill-accent-primary/20" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-text-primary tracking-tight">Gerenciar Token</h3>
              <p className="text-xs text-text-secondary">Chave de acesso global à Umbler Talk</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-bg-secondary rounded-xl text-text-secondary transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={onSave} className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-text-secondary uppercase px-1">Bearer Token API</label>
            <div className="relative">
              <input
                autoFocus
                type={showToken ? 'text' : 'password'}
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                placeholder="dromeflow-chat-..."
                className="w-full px-4 py-3 pr-10 bg-bg-tertiary border border-border-primary rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary outline-none transition-all font-mono shadow-inner"
              />
              <button type="button" onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors">
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[9px] text-text-secondary italic px-1">Este token é necessário para todas as integrações de Tags, Bots e Respostas.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-3 bg-bg-secondary text-text-primary font-bold rounded-xl hover:bg-bg-tertiary transition-all border border-border-primary">
              Cancelar
            </button>
            <button type="submit" disabled={saving || !tokenInput.trim()}
              className="flex-[2] flex items-center justify-center gap-2 px-4 py-3 bg-accent-primary text-white font-extrabold rounded-xl hover:bg-accent-secondary disabled:opacity-50 transition-all shadow-lg">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Configuração
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UmblerPage;
