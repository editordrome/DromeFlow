import React from 'react';
import { Icon } from './Icon';
import type { ProfessionalAppointment } from '../../services/analytics/prestadoras.service';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profissional: string | null;
  periodLabel?: string;
  appointments: ProfessionalAppointment[];
  loading?: boolean;
}

const ProfessionalAppointmentsModal: React.FC<Props> = ({ isOpen, onClose, profissional, periodLabel, appointments, loading }) => {
  if (!isOpen || !profissional) return null;

  const formatDate = (iso: string) => {
    if (!iso) return '-';
    const [y,m,d] = iso.split('-');
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[90vh] bg-bg-secondary rounded-lg shadow-lg flex flex-col" onClick={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Atendimentos de {profissional}</h2>
            {periodLabel && <div className="text-xs text-text-secondary mt-0.5">Período: {periodLabel}</div>}
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-bg-tertiary text-text-secondary"><Icon name="close"/></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-10 h-10 border-4 border-gray-200 rounded-full animate-spin border-t-accent-primary"></div>
            </div>
          ) : (!appointments || appointments.length === 0) ? (
            <div className="text-sm text-text-secondary">Nenhum atendimento encontrado para este mês.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border-primary">
                <thead className="bg-bg-tertiary">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary uppercase">Data</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary uppercase">Cliente</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary uppercase">Período</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary uppercase">Repasse</th>
                  </tr>
                </thead>
                <tbody className="bg-bg-secondary divide-y divide-border-primary">
                  {appointments.map((a, idx) => (
                    <tr key={`${a.DATA}-${idx}`}>
                      <td className="px-4 py-2 text-sm text-text-primary whitespace-nowrap">{formatDate(a.DATA)}</td>
                      <td className="px-4 py-2 text-sm text-text-primary">{a.CLIENTE || '-'}</td>
                      <td className="px-4 py-2 text-sm text-text-primary">{a.MOMENTO || a.HORARIO || '-'}</td>
                      <td className="px-4 py-2 text-sm text-text-primary">{Number(a.REPASSE||0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="px-4 py-3 border-t border-border-primary flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-border-secondary text-text-secondary hover:bg-bg-tertiary">Fechar</button>
        </div>
      </div>
    </div>
  );
};

export default ProfessionalAppointmentsModal;
