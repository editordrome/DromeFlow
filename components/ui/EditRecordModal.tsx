import React, { useState, useEffect } from 'react';
import { DataRecord } from '../../types';
import { activityLogger } from '../../services/utils/activityLogger.service';
import { useAuth } from '../../contexts/AuthContext';
import { useAppContext } from '../../contexts/AppContext';
import { Icon } from './Icon';

interface EditRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: DataRecord | null;
  onSave: (updatedRecord: DataRecord) => void;
}

const EditRecordModal: React.FC<EditRecordModalProps> = ({
  isOpen,
  onClose,
  record,
  onSave,
}) => {
  const { profile } = useAuth();
  const { selectedUnit } = useAppContext();
  const [formData, setFormData] = useState<Partial<DataRecord>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (record) {
      setFormData({
        ...record,
        DATA: record.DATA || '',
        CLIENTE: record.CLIENTE || '',
        VALOR: record.VALOR || 0,
        status: record.status || '',
        orcamento: record.orcamento || '',
      });
    }
  }, [record]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.CLIENTE?.trim()) {
      newErrors.CLIENTE = 'Cliente é obrigatório';
    }

    if (!formData.VALOR || formData.VALOR <= 0) {
      newErrors.VALOR = 'Valor deve ser maior que zero';
    }

    if (!formData.DATA) {
      newErrors.DATA = 'Data é obrigatória';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !record) return;

    setIsLoading(true);
    try {
      const updatedRecord: DataRecord = {
        ...record,
        DATA: formData.DATA!,
        CLIENTE: formData.CLIENTE!,
        VALOR: formData.VALOR!,
        status: formData.status || '',
        orcamento: formData.orcamento || '',
      };

      await onSave(updatedRecord);
    } catch (err) {
      console.error('Erro ao salvar:', err);
      setError(err instanceof Error ? err.message : 'Erro ao salvar registro');
      
      // Registrar erro ao salvar
      if (profile && selectedUnit && formData.ATENDIMENTO_ID) {
        const actionCode = record ? 'update_atend' : 'create_atend';
        activityLogger.logActivity({
          unitCode: selectedUnit,
          actionCode,
          userIdentifier: profile.email || profile.name,
          status: 'error',
          atendId: formData.ATENDIMENTO_ID,
          metadata: { error_message: err instanceof Error ? err.message : 'Erro desconhecido' }
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof DataRecord, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const formatDateForInput = (dateString: string) => {
    if (!dateString) return '';
    // Se já está no formato YYYY-MM-DD, mantenha
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateString;
    }
    // Se está no formato DD/MM/YYYY, converta
    const parts = dateString.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateString;
  };

  if (!isOpen || !record) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-2xl rounded-xl bg-bg-secondary shadow-2xl overflow-hidden">
        {/* Header compacto com status */}
        <div className="relative bg-gradient-to-r from-accent-primary/5 to-brand-cyan/5 border-b border-border-secondary px-5 py-3.5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-text-primary">
              Editar Atendimento
            </h2>
            
            <div className="flex items-center gap-3">
              {/* Status ao lado do botão fechar */}
              <label className="flex flex-col gap-1.5 min-w-[160px]">
                <span className="text-xs font-medium text-text-secondary">Status</span>
                <select
                  value={formData.status || ''}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                >
                  <option value="">Selecione</option>
                  <option value="Confirmado">Confirmado</option>
                  <option value="Pendente">Pendente</option>
                  <option value="Recusado">Recusado</option>
                  <option value="Aguardando">Aguardando</option>
                  <option value="Esperar">Esperar</option>
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
          {Object.keys(errors).length > 0 && (
            <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 flex items-start gap-2">
              <Icon name="alert" className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
              <div className="text-xs text-danger">
                {Object.values(errors).map((err, i) => (
                  <div key={i}>{err}</div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {/* Data e Orçamento na mesma linha */}
            <div className="flex gap-3">
              <label className="flex-1 flex flex-col gap-1.5">
                <span className="text-xs font-medium text-text-secondary flex items-center gap-1">
                  Data <span className="text-danger">*</span>
                </span>
                <input
                  type="date"
                  value={formatDateForInput(formData.DATA || '')}
                  onChange={(e) => handleInputChange('DATA', e.target.value)}
                  className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                />
              </label>
              <label className="flex-1 flex flex-col gap-1.5">
                <span className="text-xs font-medium text-text-secondary">Orçamento</span>
                <input
                  type="text"
                  value={formData.orcamento || ''}
                  onChange={(e) => handleInputChange('orcamento', e.target.value)}
                  className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all font-mono"
                  placeholder="Número do orçamento"
                />
              </label>
            </div>

            {/* Cliente */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-secondary flex items-center gap-1">
                Cliente <span className="text-danger">*</span>
              </span>
              <input
                type="text"
                value={formData.CLIENTE || ''}
                onChange={(e) => handleInputChange('CLIENTE', e.target.value)}
                className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                placeholder="Nome do cliente"
              />
            </label>

            {/* Valor */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-secondary flex items-center gap-1">
                Valor (R$) <span className="text-danger">*</span>
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.VALOR || ''}
                onChange={(e) => handleInputChange('VALOR', parseFloat(e.target.value) || 0)}
                className="rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                placeholder="0.00"
              />
            </label>
          </div>
        </div>

        {/* Footer compacto - apenas ícones */}
        <div className="flex items-center justify-between border-t border-border-secondary bg-bg-tertiary px-5 py-3">
          <div className="flex items-center gap-1 text-xs text-text-secondary">
            <Icon name="info" className="w-3 h-3" />
            <span>* Obrigatório</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading}
              className="rounded-lg bg-accent-primary p-2.5 text-white hover:bg-accent-primary/90 focus:outline-none focus:ring-2 focus:ring-accent-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent-primary/20"
              title={isLoading ? "Salvando..." : "Salvar"}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <Icon name="Check" className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditRecordModal;