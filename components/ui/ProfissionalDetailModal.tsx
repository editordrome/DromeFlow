import React from 'react';
import { Icon } from './Icon';
import type { Profissional } from '../../services/profissionais/profissionais.service';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profissional: Profissional | null;
}

const ProfissionalDetailModal: React.FC<Props> = ({ isOpen, onClose, profissional }) => {
  if (!isOpen || !profissional) return null;

  const Item: React.FC<{ label: string; value: any }> = ({ label, value }) => (
    <div>
      <div className="text-xs text-text-secondary">{label}</div>
      <div className="text-sm text-text-primary break-words">{value ?? '-'}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" aria-modal="true" role="dialog" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] bg-bg-secondary rounded-lg shadow-lg flex flex-col" onClick={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
          <h2 className="text-lg font-semibold text-text-primary">Detalhes do Profissional</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-bg-tertiary text-text-secondary"><Icon name="close"/></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Item label="Nome" value={profissional.nome} />
            <Item label="WhatsApp" value={profissional.whatsapp} />
            <Item label="Status" value={profissional.status} />
            <Item label="Unidade" value={profissional.unidade || profissional.unit_id} />
            <Item label="CPF" value={profissional.cpf} />
            <Item label="RG" value={profissional.rg} />
            <Item label="Data de Nascimento" value={profissional.data_nasc} />
            <Item label="Estado Civil" value={profissional.estado_civil} />
            <Item label="Fumante" value={profissional.fumante} />
            <Item label="Filhos" value={profissional.filhos} />
            <Item label="Qtde. Filhos" value={profissional.qto_filhos} />
            <Item label="Rotina Filhos" value={profissional.rotina_filhos} />
            <Item label="Endereço" value={profissional.endereco} />
            <Item label="Dias Livres" value={profissional.dias_livres} />
            <Item label="Dias Semana" value={profissional.dias_semana} />
            <Item label="Observação" value={profissional.observacao} />
            <Item label="Data Cadastro" value={profissional.data_cadastro} />
            <Item label="Data Ativo" value={profissional.data_ativo} />
          </div>
        </div>
        <div className="px-4 py-3 border-t border-border-primary flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-border-secondary text-text-secondary hover:bg-bg-tertiary">Fechar</button>
        </div>
      </div>
    </div>
  );
};

export default ProfissionalDetailModal;
