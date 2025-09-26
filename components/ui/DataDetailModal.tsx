import React from 'react';
import { DataRecord } from '../../types';
import { Icon } from './Icon';

interface DataDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    record: DataRecord | null;
    onEdit: (record: DataRecord) => void;
    onDelete: (record: DataRecord) => void;
}

const DataDetailModal: React.FC<DataDetailModalProps> = ({ isOpen, onClose, record, onEdit, onDelete }) => {
    if (!isOpen || !record) return null;

    const renderDetail = (label: string, value: any) => {
        let displayValue = value;
        if (value === null || value === undefined || value === '') {
            displayValue = <span className="text-gray-400">N/A</span>;
        } else if (typeof value === 'boolean') {
            displayValue = value ? 'Sim' : 'Não';
        } else if (label.toLowerCase().includes('valor') || label.toLowerCase().includes('repasse')) {
             displayValue = Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        } else if ((label === 'Data' || label === 'Data de Cadastro') && typeof value === 'string' && value.includes('-')) {
            const parts = value.split('-');
            if (parts.length === 3) {
                displayValue = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
        }

        return (
            <div key={label} className="py-2">
                <p className="text-xs font-semibold uppercase text-text-secondary tracking-wider">{label}</p>
                <p className="text-md text-text-primary">{displayValue}</p>
            </div>
        );
    };
    
    const fieldMap: { key: keyof DataRecord; label: string }[] = [
        { key: 'ATENDIMENTO_ID', label: 'ID do Atendimento' },
        { key: 'DATA', label: 'Data' },
        { key: 'HORARIO', label: 'Horário' },
    { key: 'MOMENTO', label: 'Momento' },
        { key: 'DIA', label: 'Dia da Semana' },
        { key: 'TIPO', label: 'Tipo' },
        { key: 'VALOR', label: 'Valor (R$)' },
        { key: 'REPASSE', label: 'Repasse (R$)' },
        { key: 'CLIENTE', label: 'Cliente' },
        { key: 'whatscliente', label: 'WhatsApp Cliente' },
        { key: 'PROFISSIONAL', label: 'Profissional' },
        { key: 'IS_DIVISAO', label: 'É Divisão?' },
        { key: 'ENDEREÇO', label: 'Endereço' },
        { key: 'ORIGEM', label: 'Origem' },
        { key: 'CUPOM', label: 'Cupom' },
        { key: 'CADASTRO', label: 'Data de Cadastro' },
        { key: 'unidade', label: 'Unidade' },
        { key: 'status', label: 'Status' },
        { key: 'confirmacao', label: 'Confirmação' },
        { key: 'observacao', label: 'Observação' },
        { key: 'pos vendas', label: 'Pós Vendas' },
        { key: 'comentario', label: 'Comentário' },
    ];


    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true" role="dialog">
            <div className="w-full max-w-2xl p-6 mx-4 bg-bg-secondary rounded-lg shadow-lg max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-border-primary flex-shrink-0">
                    <h2 className="text-xl font-bold text-text-primary">Detalhes do Atendimento</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-text-secondary hover:bg-bg-tertiary">
                        <Icon name="close" />
                    </button>
                </div>
                <div className="mt-6 space-y-4 pr-2 overflow-y-auto">
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6">
                        {fieldMap.map(({ key, label }) => renderDetail(label, record[key]))}
                   </div>
                </div>
                 <div className="flex items-center justify-between pt-4 mt-auto flex-shrink-0">
                    <button
                        type="button"
                        onClick={() => onDelete(record)}
                        className="flex items-center px-4 py-2 text-sm font-medium text-white transition-colors bg-danger rounded-md hover:bg-red-700"
                    >
                        <Icon name="delete" className="w-5 h-5 mr-2" />
                        Excluir
                    </button>
                    <div className="flex space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium border rounded-md text-text-secondary border-border-secondary hover:bg-bg-tertiary"
                        >
                            Fechar
                        </button>
                         <button
                            type="button"
                            onClick={() => onEdit(record)}
                            className="flex items-center px-4 py-2 text-sm font-medium text-white transition-colors border border-transparent rounded-md bg-accent-primary hover:bg-accent-secondary"
                        >
                            <Icon name="edit" className="w-5 h-5 mr-2" />
                            Editar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DataDetailModal;