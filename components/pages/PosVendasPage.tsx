import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useAppContext } from '../../contexts/AppContext';
import { Icon } from '../ui/Icon';
import type { PosVenda } from '../../types';
import {
  fetchPosVendas,
  deletePosVenda,
  getMetrics
} from '../../services/posVendas/posVendas.service';
import PosVendaFormModal from '../ui/PosVendaFormModal';

type ActiveCard = 'geral' | 'finalizados' | 'pendente' | 'contatado';

// Componente de seletor de período
const PeriodSelector: React.FC<{
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);

  const months = [
    { value: '01', label: 'Janeiro' },
    { value: '02', label: 'Fevereiro' },
    { value: '03', label: 'Março' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Maio' },
    { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' },
  ];

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  const options = years.flatMap(year =>
    months.map(month => ({
      value: `${year}-${month.value}`,
      label: `${month.label} ${year}`
    }))
  );

  const getDisplayLabel = () => {
    const [year, monthNum] = value.split('-');
    const month = months.find(m => m.value === monthNum);
    return month ? `${month.label} ${year}` : value;
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center justify-between w-64 px-3 py-2 text-left border rounded-md bg-bg-secondary border-border-primary focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        <span className="text-sm text-text-primary">{getDisplayLabel()}</span>
        <Icon name={isOpen ? 'ChevronUp' : 'ChevronDown'} className="w-4 h-4 text-text-secondary" />
      </button>

      {isOpen && !disabled && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 z-20 w-64 mt-1 bg-bg-secondary border rounded-md shadow-lg border-border-primary max-h-80 overflow-y-auto">
            <div className="py-1">
              {options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-bg-tertiary ${
                    value === option.value ? 'bg-primary text-white' : 'text-text-primary'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const PosVendasPage: React.FC = () => {
  const { profile } = useAuth();
  const { selectedUnit } = useAppContext();

  const [allRecords, setAllRecords] = useState<PosVenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PosVenda | null>(null);
  const [activeCard, setActiveCard] = useState<ActiveCard>('geral');

  // Período selecionado (formato: YYYY-MM)
  const currentDate = new Date();
  const [selectedPeriod, setSelectedPeriod] = useState(
    `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
  );

  // Métricas
  const [metrics, setMetrics] = useState<{
    totalContatos: number;
    nps: number | null;
    taxaReagendamento: number;
    distribuicaoNotas: { nota: number; count: number }[];
  } | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedUnit, selectedPeriod]);

  const loadData = async () => {
    setLoading(true);
    try {
      const filters: any = {};
      
      // Sempre filtrar pela unidade selecionada (exceto super_admin sem unidade)
      if (selectedUnit) {
        filters.unit_id = selectedUnit;
      } else if (profile?.role !== 'super_admin') {
        // Se não houver unidade selecionada e não for super_admin, não carrega nada
        setAllRecords([]);
        setMetrics({
          totalContatos: 0,
          nps: null,
          taxaReagendamento: 0,
          distribuicaoNotas: []
        });
        setLoading(false);
        return;
      }

      // Filtrar pelo mês/ano selecionado
      const [year, month] = selectedPeriod.split('-');
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endDate = `${year}-${month}-${lastDay}`;

      filters.startDate = startDate;
      filters.endDate = endDate;

      const [data, metricsData] = await Promise.all([
        fetchPosVendas(filters),
        getMetrics(filters)
      ]);

      setAllRecords(data);
      setMetrics(metricsData);
    } catch (error) {
      console.error('Erro ao carregar pós-vendas:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar registros por status
  const getRecordsByStatus = (status: string): PosVenda[] => {
    return allRecords.filter(record => record.status === status);
  };

  const pendentes = getRecordsByStatus('pendente');
  const contatados = getRecordsByStatus('contatado');
  const finalizados = getRecordsByStatus('finalizado');

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este registro?')) return;

    try {
      await deletePosVenda(id);
      loadData();
    } catch (error) {
      console.error('Erro ao deletar:', error);
      alert('Erro ao deletar registro');
    }
  };

  const handleEdit = (record: PosVenda) => {
    setEditingRecord(record);
    setIsModalOpen(true);
  };

  const handleNew = () => {
    setEditingRecord(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRecord(null);
    loadData();
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (status: string | null) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
      contatado: { label: 'Contatado', color: 'bg-blue-100 text-blue-800' },
      finalizado: { label: 'Finalizado', color: 'bg-green-100 text-green-800' }
    };

    const statusInfo = status ? statusMap[status] : { label: '-', color: 'bg-gray-100 text-gray-800' };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    );
  };

  const renderStars = (nota: number | null) => {
    if (!nota) return '-';
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <Icon
            key={star}
            name={star <= nota ? 'Star' : 'Star'}
            className={`w-4 h-4 ${star <= nota ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  };

  const renderTable = (records: PosVenda[], emptyMessage: string) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-bg-tertiary">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
              Data
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
              Cliente
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
              Contato
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
              Avaliação
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
              Reagendou
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
              Ações
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-primary">
          {records.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            records.slice(0, 10).map((record) => (
              <tr key={record.id} className="hover:bg-bg-tertiary transition-colors">
                <td className="px-4 py-3 whitespace-nowrap text-sm text-text-primary">
                  {formatDate(record.data)}
                </td>
                <td className="px-4 py-3 text-sm text-text-primary">
                  <div>
                    <p className="font-medium">{record.nome || '-'}</p>
                    {record.ATENDIMENTO_ID && (
                      <p className="text-xs text-text-secondary">ID: {record.ATENDIMENTO_ID}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-text-primary">
                  {record.contato || '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {renderStars(record.nota)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-text-primary">
                  {record.reagendou ? (
                    <Icon name="Check" className="w-5 h-5 text-green-500" />
                  ) : (
                    <Icon name="X" className="w-5 h-5 text-gray-400" />
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleEdit(record)}
                      className="p-1 text-primary hover:bg-bg-tertiary rounded transition-colors"
                      title="Editar"
                    >
                      <Icon name="Edit" className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(record.id)}
                      className="p-1 text-red-500 hover:bg-bg-tertiary rounded transition-colors"
                      title="Excluir"
                    >
                      <Icon name="Trash2" className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {records.length > 10 && (
        <div className="px-4 py-3 bg-bg-tertiary text-center text-sm text-text-secondary">
          Mostrando 10 de {records.length} registros
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Icon name="Loader2" className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-text-secondary">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Pós-Vendas</h1>
          <p className="text-sm text-text-secondary mt-1">
            Gestão de feedback e satisfação dos clientes
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodSelector
            value={selectedPeriod}
            onChange={setSelectedPeriod}
            disabled={loading}
          />
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Icon name="Plus" className="w-4 h-4" />
            Novo Registro
          </button>
        </div>
      </div>

      {/* Cards de Navegação */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card Geral */}
        <button
          onClick={() => setActiveCard('geral')}
          className={`p-4 rounded-lg border transition-all ${
            activeCard === 'geral'
              ? 'bg-primary text-white border-primary shadow-lg'
              : 'bg-bg-secondary border-border-primary hover:border-primary'
          }`}
        >
          <div className="flex items-center gap-3">
            <Icon name="BarChart3" className="w-6 h-6" />
            <div className="text-left">
              <p className="text-sm font-medium">Geral</p>
              <p className={`text-xs ${activeCard === 'geral' ? 'text-white/80' : 'text-text-secondary'}`}>
                Métricas
              </p>
            </div>
          </div>
        </button>

        {/* Card Pendente */}
        <button
          onClick={() => setActiveCard('pendente')}
          className={`p-4 rounded-lg border transition-all ${
            activeCard === 'pendente'
              ? 'bg-yellow-500 text-white border-yellow-500 shadow-lg'
              : 'bg-bg-secondary border-border-primary hover:border-yellow-500'
          }`}
        >
          <div className="flex items-center gap-3">
            <Icon name="Clock" className="w-6 h-6" />
            <div className="text-left">
              <p className="text-sm font-medium">Pendente</p>
              <p className={`text-xs ${activeCard === 'pendente' ? 'text-white/80' : 'text-text-secondary'}`}>
                {pendentes.length} registros
              </p>
            </div>
          </div>
        </button>

        {/* Card Contatado */}
        <button
          onClick={() => setActiveCard('contatado')}
          className={`p-4 rounded-lg border transition-all ${
            activeCard === 'contatado'
              ? 'bg-blue-500 text-white border-blue-500 shadow-lg'
              : 'bg-bg-secondary border-border-primary hover:border-blue-500'
          }`}
        >
          <div className="flex items-center gap-3">
            <Icon name="Phone" className="w-6 h-6" />
            <div className="text-left">
              <p className="text-sm font-medium">Contatado</p>
              <p className={`text-xs ${activeCard === 'contatado' ? 'text-white/80' : 'text-text-secondary'}`}>
                {contatados.length} registros
              </p>
            </div>
          </div>
        </button>

        {/* Card Finalizado */}
        <button
          onClick={() => setActiveCard('finalizados')}
          className={`p-4 rounded-lg border transition-all ${
            activeCard === 'finalizados'
              ? 'bg-green-500 text-white border-green-500 shadow-lg'
              : 'bg-bg-secondary border-border-primary hover:border-green-500'
          }`}
        >
          <div className="flex items-center gap-3">
            <Icon name="CheckCircle" className="w-6 h-6" />
            <div className="text-left">
              <p className="text-sm font-medium">Finalizado</p>
              <p className={`text-xs ${activeCard === 'finalizados' ? 'text-white/80' : 'text-text-secondary'}`}>
                {finalizados.length} registros
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Conteúdo do Card Ativo */}
      <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
        {activeCard === 'geral' && metrics && (
          <div className="p-6 space-y-6">
            {/* Métricas Principais */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-bg-tertiary rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="Users" className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium text-text-secondary">Total de Contatos</span>
                </div>
                <p className="text-3xl font-bold text-text-primary">{metrics.totalContatos}</p>
              </div>

              <div className="p-4 bg-bg-tertiary rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="TrendingUp" className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium text-text-secondary">NPS</span>
                </div>
                <p className="text-3xl font-bold text-text-primary">
                  {metrics.nps !== null ? `${metrics.nps}%` : '-'}
                </p>
              </div>

              <div className="p-4 bg-bg-tertiary rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="RefreshCw" className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium text-text-secondary">Taxa de Reagendamento</span>
                </div>
                <p className="text-3xl font-bold text-text-primary">{metrics.taxaReagendamento}%</p>
              </div>
            </div>

            {/* Distribuição de Notas */}
            <div>
              <h3 className="text-lg font-semibold text-text-primary mb-4">Distribuição de Avaliações</h3>
              <div className="space-y-3">
                {metrics.distribuicaoNotas.map(({ nota, count }) => {
                  const total = metrics.totalContatos;
                  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={nota} className="flex items-center gap-4">
                      <div className="flex gap-0.5 w-24">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Icon
                            key={star}
                            name="Star"
                            className={`w-4 h-4 ${star <= nota ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                          />
                        ))}
                      </div>
                      <div className="flex-1">
                        <div className="h-6 bg-bg-primary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-medium text-text-primary w-20 text-right">
                        {count} ({percentage}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeCard === 'pendente' && renderTable(pendentes, 'Nenhum registro pendente')}
        {activeCard === 'contatado' && renderTable(contatados, 'Nenhum registro contatado')}
        {activeCard === 'finalizados' && renderTable(finalizados, 'Nenhum registro finalizado')}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <PosVendaFormModal
          record={editingRecord}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default PosVendasPage;
