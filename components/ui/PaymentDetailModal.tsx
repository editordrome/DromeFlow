
import React, { useState, useEffect } from 'react';
import { Icon } from './Icon'; // Adjust import based on your project structure
import { PaymentRecord, DataRecord } from '../../types';
import { fetchClientAppointments, updatePaymentAppointment } from '../../services/financial/financial.service';
import { fetchDataRecordById } from '../../services/data/dataTable.service';
import DataDetailModal from './DataDetailModal';

interface PaymentDetailModalProps {
    payment: PaymentRecord;
    unitCode: string;
    onClose: () => void;
    onUpdate: () => void;
}

export const PaymentDetailModal: React.FC<PaymentDetailModalProps> = ({ payment, unitCode, onClose, onUpdate }) => {
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [options, setOptions] = useState<any[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Initial date range: Current Month
    const now = new Date();
    const initialStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const initialEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const [rangeStart, setRangeStart] = useState(initialStart);
    const [rangeEnd, setRangeEnd] = useState(initialEnd);

    // Appointment Detail Modal State
    const [selectedAppointment, setSelectedAppointment] = useState<DataRecord | null>(null);
    const [linkedDate, setLinkedDate] = useState<string | null>(null);

    useEffect(() => {
        const loadLinkedDate = async () => {
            if (payment.atendimento_id) {
                const firstId = String(payment.atendimento_id).split(',')[0].trim();
                // Avoid fetching if it looks like we already have the date for this ID? No, safer to fetch.
                // But wait, if we have options loaded? No, options depend on search.
                if (firstId) {
                    try {
                        const rec = await fetchDataRecordById(firstId);
                        if (rec && rec.DATA) setLinkedDate(rec.DATA);
                    } catch (e) {
                        console.error("Failed to load linked date", e);
                    }
                }
            } else {
                setLinkedDate(null);
            }
        };
        loadLinkedDate();
    }, [payment.atendimento_id]);

    const handleOpenAppointment = async (id: string) => {
        setLoading(true);
        try {
            const record = await fetchDataRecordById(id);
            if (record) {
                setSelectedAppointment(record);
            } else {
                alert("Detalhes do atendimento não encontrados.");
            }
        } catch (error) {
            console.error("Failed to fetch appointment details:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Initialize selected IDs from payment record (CSV)
        if (payment.atendimento_id) {
            const ids = String(payment.atendimento_id).split(',').map(s => s.trim()).filter(Boolean);
            setSelectedIds(ids);
        }
    }, [payment]);

    const clientName = payment.nome || (payment.unit_clients as any)?.nome;

    useEffect(() => {
        if (clientName) {
            handleSearch(clientName);
        }
    }, [rangeStart, rangeEnd]); // Trigger search when dates change

    const handleSearch = async (term: string) => {
        if (!term) return;
        setLoading(true);
        try {
            const results = await fetchClientAppointments(unitCode, term, rangeStart, rangeEnd);
            setOptions(results);
        } catch (err) {
            console.error("Search failed", err);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (atendimentoId: string) => {
        setSelectedIds(prev => {
            if (prev.includes(atendimentoId)) {
                return prev.filter(id => id !== atendimentoId);
            } else {
                return [...prev, atendimentoId];
            }
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const csv = selectedIds.join(',');
            await updatePaymentAppointment(payment.id, csv);
            onUpdate();
            onClose();
        } catch (err) {
            console.error("Save failed", err);
            alert("Erro ao salvar vínculos.");
        } finally {
            setIsSaving(false);
        }
    };



    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-bg-secondary w-full max-w-xl rounded-lg shadow-xl border border-border-secondary flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border-secondary">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold text-text-primary">Detalhes do Pagamento</h2>
                        {payment.numero_fatura && (
                            <span className="text-sm font-mono text-text-secondary bg-bg-tertiary px-2 py-1 rounded border border-border-secondary">
                                #{payment.numero_fatura}
                            </span>
                        )}
                        {payment.link_fatura && (
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(payment.link_fatura || '');
                                    alert('Link da fatura copiado!');
                                }}
                                className="p-1.5 text-text-secondary hover:text-accent-primary hover:bg-accent-primary/10 rounded transition-colors"
                                title="Copiar link da fatura"
                            >
                                <Icon name="Copy" className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition">
                        <Icon name="x" className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">

                    {/* Payment Info Card */}
                    <div className="grid grid-cols-4 gap-4 p-4 bg-bg-tertiary rounded-md border border-border-secondary">
                        <div>
                            <label className="block text-xs uppercase text-text-secondary mb-1">Cliente</label>
                            <div className="font-semibold text-text-primary text-sm truncate" title={clientName || 'Cliente Desconhecido'}>
                                {clientName || 'Cliente Desconhecido'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs uppercase text-text-secondary mb-1">Valor</label>
                            <div className="font-semibold text-text-primary text-sm">
                                {payment.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs uppercase text-text-secondary mb-1">
                                {linkedDate ? 'Data do Atendimento' : 'Vencimento'}
                            </label>
                            <div className="text-text-primary text-sm">
                                {linkedDate
                                    ? new Date(linkedDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                                    : new Date(payment.data_vencimento).toLocaleDateString('pt-BR')}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs uppercase text-text-secondary mb-1">Status</label>
                            <div className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase
                        ${payment.status_pagamento === 'RECEIVED' || payment.status_pagamento === 'CONFIRMED' ? 'bg-emerald-500/10 text-emerald-500' :
                                    payment.status_pagamento === 'PENDING' ? 'bg-amber-500/10 text-amber-500' :
                                        'bg-rose-500/10 text-rose-500'
                                }`}>
                                {payment.status_pagamento}
                            </div>
                        </div>
                    </div>

                    {/* Linkage Section */}
                    <div>

                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                                <Icon name="Link" className="w-4 h-4" />
                                Vincular Atendimentos
                            </h3>

                            {/* Date Filter Inline */}
                            <div className="flex items-center gap-2 text-sm text-text-secondary bg-bg-primary px-2 py-1 rounded border border-border-secondary">
                                <input
                                    type="date"
                                    value={rangeStart}
                                    onChange={(e) => setRangeStart(e.target.value)}
                                    className="bg-transparent text-text-primary focus:outline-none w-28 text-xs"
                                />
                                <span className="text-xs">até</span>
                                <input
                                    type="date"
                                    value={rangeEnd}
                                    onChange={(e) => setRangeEnd(e.target.value)}
                                    className="bg-transparent text-text-primary focus:outline-none w-28 text-xs"
                                />
                                {/* Button to refresh? Or just rely on search button below? 
                                    Ideally changing date updates if search term exists. 
                                    Let's add a refresh button or make inputs trigger search?
                                    User said "always show ... automatic". 
                                    Let's add a small refresh icon button just in case, or leave it to the search button below.
                                    For now, just the inputs.
                                */}
                            </div>
                        </div>



                        {/* Results List */}
                        <div className="border border-border-secondary rounded-md max-h-60 overflow-y-auto bg-bg-tertiary">
                            {options.length === 0 ? (
                                <div className="p-4 text-center text-text-secondary text-sm">
                                    {loading ? 'Carregando...' : 'Nenhum agendamento encontrado para este mês/termo.'}
                                </div>
                            ) : (
                                <div className="divide-y divide-border-secondary">
                                    {options.map(opt => {
                                        const isSelected = selectedIds.includes(opt.atendimento_id);
                                        return (
                                            <div
                                                key={opt.id}
                                                onClick={() => toggleSelection(opt.atendimento_id)}
                                                onDoubleClick={(e) => {
                                                    e.stopPropagation(); // prevent toggle on double click if desired, but tricky.
                                                    // actually double click sends 2 clicks usually.
                                                    // Let's just open modal. User can re-toggle if needed.
                                                    handleOpenAppointment(opt.atendimento_id);
                                                }}
                                                className={`flex items-center justify-between p-3 cursor-pointer transition hover:bg-bg-secondary ${isSelected ? 'bg-accent-primary/10 border-l-4 border-l-accent-primary' : ''}`}
                                            >
                                                <div className="grid grid-cols-[70px_80px_60px_100px_1fr_40px] items-center gap-2 text-sm text-text-primary flex-1 mr-4">
                                                    <span className="text-sm font-medium text-text-secondary">
                                                        #{opt.atendimento_id}
                                                    </span>
                                                    <span className="font-medium">
                                                        {new Date(opt.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                                    </span>
                                                    <span>{opt.time?.slice(0, 5)}</span>
                                                    <span className="capitalize truncate" title={opt.day}>{opt.day?.toLowerCase()}</span>
                                                    <span className="capitalize truncate" title={opt.period}>
                                                        {opt.period && !isNaN(Number(opt.period.replace(/[^0-9]/g, '')))
                                                            ? `${opt.period.replace(/[^0-9]/g, '')} horas`
                                                            : opt.period?.toLowerCase()}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenAppointment(opt.atendimento_id);
                                                        }}
                                                        className="w-8 h-8 rounded hover:bg-bg-primary flex items-center justify-center text-text-secondary hover:text-accent-primary transition z-10"
                                                        title="Ver detalhes"
                                                    >
                                                        <Icon name="Eye" className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-accent-primary border-accent-primary text-white' : 'border-text-tertiary'}`}>
                                                    {isSelected && <Icon name="check" className="w-3 h-3" />}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Appointment Detail Modal */}
                        {selectedAppointment && (
                            <DataDetailModal
                                isOpen={true}
                                record={selectedAppointment}
                                onClose={() => setSelectedAppointment(null)}
                                onEdit={() => {
                                    // Refresh list if meaningful data changed
                                    if (clientName) handleSearch(clientName);
                                    // Keep modal open or close? User usually expects it to stay open on save, 
                                    // but if we want to reflect changes in the list, we might just update the list.
                                    // The original code closed it: setSelectedAppointment(null);
                                    // Let's keep it closing or just update list?
                                    // If onEdit is called, it means record updated.
                                    // Let's just update the list. The modal has its own internal state for fields.
                                    // But wait, onEdit in DataDetailModal is called after save.
                                    if (clientName) handleSearch(clientName);
                                }}
                            />
                        )}
                    </div>

                    {/* Selected Summary */}

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border-secondary bg-bg-tertiary rounded-b-lg flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 bg-accent-primary text-text-on-accent rounded-md text-sm font-bold hover:bg-accent-primary/90 shadow-sm transition disabled:opacity-50"
                    >
                        {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>
            </div>
        </div>
    );
};
