import React, { useEffect, useState, useMemo } from 'react';
import { Icon } from './Icon';
import { 
  fetchProductionCards, 
  createProductionCard, 
  updateProductionCard, 
  fetchProductionColumns,
  toggleCheckpoint
} from '../../services/production/production.service';
import { fetchUnitsBasic, listUnitKeysColumns, updateUnitKeyValueById, insertUnitKeyValue } from '../../services/units/unitKeysAdmin.service';
import { fetchUnitKeys } from '../../services/units/unitKeys.service';
import { ProductionCard, ProductionColumn, Unit } from '../../types';

interface ProductionCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardId: string | null;
  initialColumnId: string | null;
}

const ProductionCardModal: React.FC<ProductionCardModalProps> = ({ 
  isOpen, 
  onClose, 
  cardId, 
  initialColumnId 
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'checkpoints' | 'keys'>('details');
  const [card, setCard] = useState<ProductionCard | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [columns, setColumns] = useState<ProductionColumn[]>([]);
  const [loading, setLoading] = useState(true);
  
  // States para edição/criação
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [notes, setNotes] = useState('');
  
  // Unit Keys States
  const [unitKeysCols, setUnitKeysCols] = useState<any[]>([]);
  const [unitValues, setUnitValues] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allUnits, allCols, keyCols] = await Promise.all([
        fetchUnitsBasic(),
        fetchProductionColumns(),
        listUnitKeysColumns(false)
      ]);
      setUnits(allUnits);
      setColumns(allCols);
      setUnitKeysCols(keyCols);

      if (cardId) {
        const allCards = await fetchProductionCards();
        const currentCard = allCards.find(c => c.id === cardId);
        if (currentCard) {
          setCard(currentCard);
          setSelectedUnitId(currentCard.unit_id);
          setNotes(currentCard.notes || '');
          
          // Carregar keys da unidade vinculada
          const keys = await fetchUnitKeys(currentCard.unit_id);
          setUnitValues(keys[0] || null);
        }
      }
    } catch (e) {
      console.error('Erro ao carregar modal:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen, cardId]);

  const handleSaveDetails = async () => {
    try {
      if (cardId) {
        await updateProductionCard(cardId, { notes, unit_id: selectedUnitId });
      } else {
        if (!selectedUnitId || !initialColumnId) return alert('Selecione uma unidade');
        await createProductionCard(selectedUnitId, initialColumnId, 0);
      }
      onClose();
    } catch (e) {
      alert('Erro ao salvar card');
    }
  };

  const handleToggleCheck = async (templateId: string, colId: string, currentStatus: boolean) => {
    if (!card) return;
    try {
      await toggleCheckpoint(card.id, templateId, colId, !currentStatus);
      loadData(); // Recarregar para atualizar progresso
    } catch (e) {
      alert('Erro ao atualizar checkpoint');
    }
  };

  const handleUpdateKey = async (colName: string, value: string) => {
    if (!selectedUnitId) return;
    try {
      if (unitValues?.id) {
        await updateUnitKeyValueById(unitValues.id, colName, value);
      } else {
        await insertUnitKeyValue(selectedUnitId, colName, value);
      }
      // Atualizar estado local para feedback imediato
      setUnitValues((prev: any) => ({ ...prev, [colName]: value }));
    } catch (e) {
      alert('Erro ao atualizar key');
    }
  };

  const currentColumn = useMemo(() => {
    if (!card) return null;
    return columns.find(c => c.id === card.current_column_id);
  }, [card, columns]);

  const totalCheckpoints = useMemo(() => {
    return columns
      .filter(col => col.name !== 'Inicial')
      .reduce((acc, col) => acc + (col.templates?.length || 0), 0);
  }, [columns]);

  const completedCheckpoints = useMemo(() => {
    if (!card?.progress) return 0;
    return card.progress.filter(p => p.is_completed).length;
  }, [card]);

  const progressPercent = totalCheckpoints > 0 ? Math.round((completedCheckpoints / totalCheckpoints) * 100) : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-bg-secondary w-full max-w-4xl h-[85vh] rounded-xl shadow-2xl border border-border-primary flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border-primary flex items-center justify-between bg-bg-tertiary">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-accent-primary/10 rounded-lg text-accent-primary">
                <Icon name="Activity" className="w-6 h-6" />
             </div>
             <div>
                <h2 className="text-xl font-bold text-text-primary">
                  {cardId ? `Produção: ${card?.unit?.unit_name}` : 'Nova Produção'}
                </h2>
                {card && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-text-tertiary font-mono">{card.id}</span>
                    <span className="px-2 py-0.5 rounded-full bg-accent-primary/20 text-accent-primary text-[10px] font-bold uppercase">
                      {currentColumn?.name || 'Inicial'}
                    </span>
                  </div>
                )}
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-bg-secondary rounded-full transition-colors text-text-tertiary">
            <Icon name="X" className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border-primary px-4 bg-bg-tertiary">
          <button 
            onClick={() => setActiveTab('details')}
            className={`px-4 py-3 text-sm font-medium transition-all border-b-2 ${activeTab === 'details' ? 'border-accent-primary text-accent-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
          >
            Detalhes
          </button>
          <button 
             disabled={!card}
             onClick={() => setActiveTab('checkpoints')}
             className={`px-4 py-3 text-sm font-medium transition-all border-b-2 ${!card ? 'opacity-30 cursor-not-allowed' : ''} ${activeTab === 'checkpoints' ? 'border-accent-primary text-accent-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
          >
            Checkpoints ({completedCheckpoints}/{totalCheckpoints})
          </button>
          <button 
             disabled={!card}
             onClick={() => setActiveTab('keys')}
             className={`px-4 py-3 text-sm font-medium transition-all border-b-2 ${!card ? 'opacity-30 cursor-not-allowed' : ''} ${activeTab === 'keys' ? 'border-accent-primary text-accent-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
          >
            Unit Keys
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-bg-tertiary/50 to-bg-secondary">
          {loading ? (
             <div className="flex h-full items-center justify-center">
               <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent-primary border-t-transparent"></div>
             </div>
          ) : (
            <>
              {activeTab === 'details' && (
                <div className="max-w-2xl mx-auto space-y-6">
                  <div className="bg-bg-tertiary p-5 rounded-lg border border-border-secondary shadow-sm">
                    <label className="block text-sm font-semibold text-text-secondary mb-2">Unidade</label>
                    <select
                      value={selectedUnitId}
                      onChange={(e) => setSelectedUnitId(e.target.value)}
                      disabled={!!cardId}
                      className="w-full bg-bg-secondary border border-border-secondary rounded-lg px-4 py-2 text-text-primary focus:ring-2 focus:ring-accent-primary outline-none disabled:opacity-70"
                    >
                      <option value="">Selecione uma unidade...</option>
                      {units.map(u => (
                        <option key={u.id} value={u.id}>{u.unit_name} ({u.unit_code})</option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-bg-tertiary p-5 rounded-lg border border-border-secondary shadow-sm">
                    <label className="block text-sm font-semibold text-text-secondary mb-2">Observações Internas</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={6}
                      placeholder="Adicione notas sobre o processo de produção desta unidade..."
                      className="w-full bg-bg-secondary border border-border-secondary rounded-lg px-4 py-3 text-text-primary focus:ring-2 focus:ring-accent-primary outline-none transition-all resize-none"
                    />
                  </div>
                  
                  <div className="flex justify-end pt-4">
                    <button
                      onClick={handleSaveDetails}
                      className="px-8 py-3 bg-accent-primary text-white font-bold rounded-lg hover:bg-accent-secondary transition-all shadow-lg hover:shadow-accent-primary/20 flex items-center gap-2"
                    >
                      <Icon name="Save" className="w-5 h-5" />
                      {cardId ? 'Salvar Alterações' : 'Iniciar Produção'}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'checkpoints' && (
                <div className="space-y-8">
                   {/* Overall Progress */}
                   <div className="bg-bg-tertiary p-6 rounded-xl border border-border-secondary shadow-sm">
                      <div className="flex justify-between items-end mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-text-primary">Progresso Geral</h3>
                          <p className="text-xs text-text-tertiary">Somatório de todas as plataformas configuradas</p>
                        </div>
                        <span className="text-2xl font-black text-accent-primary">{progressPercent}%</span>
                      </div>
                      <div className="w-full bg-border-primary rounded-full h-3 overflow-hidden">
                        <div className="bg-accent-primary h-full transition-all duration-700" style={{ width: `${progressPercent}%` }}></div>
                      </div>
                   </div>

                   {/* Columns / Platforms */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {columns
                        .filter(col => col.name !== 'Inicial') // Remove a coluna inicial da lista de checkpoints
                        .map(col => (
                        <div key={col.id} className="bg-bg-tertiary rounded-xl border border-border-secondary overflow-hidden flex flex-col shadow-sm">
                          <div className="p-3 bg-bg-secondary border-b border-border-primary flex justify-between items-center px-4">
                            <span className="text-xs font-black uppercase tracking-widest text-text-secondary">{col.name}</span>
                          </div>
                          <div className="p-4 space-y-3 flex-1">
                             {col.templates?.length === 0 ? (
                               <p className="text-xs text-text-tertiary text-center py-4 italic">Nenhum checkpoint configurado</p>
                             ) : (
                               col.templates?.map(item => {
                                 const prog = card?.progress?.find(p => p.template_item_id === item.id);
                                 const isChecked = prog?.is_completed || false;
                                 return (
                                   <div key={item.id} className="flex items-center justify-between group">
                                      <label className="flex items-center gap-3 cursor-pointer select-none flex-1">
                                        <div className="relative">
                                          <input 
                                            type="checkbox" 
                                            checked={isChecked}
                                            onChange={() => handleToggleCheck(item.id, col.id, isChecked)}
                                            className="sr-only"
                                          />
                                          <div className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center ${isChecked ? 'bg-accent-primary border-accent-primary' : 'bg-transparent border-border-secondary'}`}>
                                            {isChecked && <Icon name="Check" className="w-3 h-3 text-white" />}
                                          </div>
                                        </div>
                                        <span className={`text-sm transition-colors ${isChecked ? 'text-text-tertiary line-through' : 'text-text-primary'}`}>
                                          {item.title}
                                        </span>
                                      </label>
                                   </div>
                                 );
                               })
                             )}
                          </div>
                        </div>
                      ))}
                   </div>
                </div>
              )}

              {activeTab === 'keys' && (
                <div className="space-y-4">
                  <div className="bg-bg-tertiary p-4 rounded-lg border border-border-secondary mb-6">
                    <h3 className="font-bold text-text-primary mb-1">Configuração de Unit Keys</h3>
                    <p className="text-xs text-text-tertiary">Estas chaves são sincronizadas diretamente com a tabela unit_keys da unidade.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {unitKeysCols.map(col => (
                      <div key={col.column_name} className="flex flex-col gap-1.5 p-3 rounded-lg border border-border-primary bg-bg-tertiary group hover:border-accent-primary/30 transition-all">
                        <label className="text-[10px] font-black uppercase text-text-tertiary tracking-widest">{col.column_name}</label>
                        <input
                          type="text"
                          defaultValue={unitValues?.[col.column_name] || ''}
                          onBlur={(e) => handleUpdateKey(col.column_name, e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as any).blur(); }}
                          placeholder={`Valor para ${col.column_name}...`}
                          className="bg-bg-secondary border border-border-secondary rounded-md px-3 py-1.5 text-sm text-text-primary focus:ring-1 focus:ring-accent-primary outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductionCardModal;
