import React, { useState, useEffect } from 'react';
import { DataRecord } from '../../types';
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
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setIsLoading(false);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-bg-secondary rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-border-primary">
          <h2 className="text-xl font-semibold text-text-primary">
            Editar Atendimento
          </h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary focus:outline-none"
          >
            <Icon name="close" className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Data
              </label>
              <input
                type="date"
                value={formatDateForInput(formData.DATA || '')}
                onChange={(e) => handleInputChange('DATA', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md bg-bg-tertiary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary ${
                  errors.DATA ? 'border-red-500' : 'border-border-primary'
                }`}
              />
              {errors.DATA && <p className="text-red-500 text-sm mt-1">{errors.DATA}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Orçamento
              </label>
              <input
                type="text"
                value={formData.orcamento || ''}
                onChange={(e) => handleInputChange('orcamento', e.target.value)}
                className="w-full px-3 py-2 border border-border-primary rounded-md bg-bg-tertiary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary font-mono"
                placeholder="Número do orçamento"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Cliente
            </label>
            <input
              type="text"
              value={formData.CLIENTE || ''}
              onChange={(e) => handleInputChange('CLIENTE', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md bg-bg-tertiary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary ${
                errors.CLIENTE ? 'border-red-500' : 'border-border-primary'
              }`}
              placeholder="Nome do cliente"
            />
            {errors.CLIENTE && <p className="text-red-500 text-sm mt-1">{errors.CLIENTE}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Valor (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.VALOR || ''}
                onChange={(e) => handleInputChange('VALOR', parseFloat(e.target.value) || 0)}
                className={`w-full px-3 py-2 border rounded-md bg-bg-tertiary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary ${
                  errors.VALOR ? 'border-red-500' : 'border-border-primary'
                }`}
                placeholder="0.00"
              />
              {errors.VALOR && <p className="text-red-500 text-sm mt-1">{errors.VALOR}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Status
              </label>
              <select
                value={formData.status || ''}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-border-primary rounded-md bg-bg-tertiary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary"
              >
                <option value="">Selecione um status</option>
                <option value="Pendente">Pendente</option>
                <option value="Em Andamento">Em Andamento</option>
                <option value="Concluído">Concluído</option>
                <option value="Cancelado">Cancelado</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-text-secondary bg-bg-tertiary border border-border-primary rounded-md hover:bg-bg-primary focus:outline-none focus:ring-2 focus:ring-accent-primary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-accent-primary rounded-md hover:bg-accent-secondary focus:outline-none focus:ring-2 focus:ring-accent-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {isLoading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditRecordModal;