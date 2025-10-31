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

const PosVendasPage: React.FC = () => {
  const { profile } = useAuth();
  const { selectedUnit } = useAppContext();

  const [records, setRecords] = useState<PosVenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PosVenda | null>(null);

  // Filtros
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Métricas
  const [metrics, setMetrics] = useState<{
    totalContatos: number;
    nps: number | null;
    taxaReagendamento: number;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedUnit, statusFilter, startDate, endDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const filters: any = {};
      
      if (selectedUnit && profile?.role !== 'super_admin') {
        filters.unit_id = selectedUnit;
      }

      if (statusFilter) {
        filters.status = statusFilter;
      }

      if (startDate) {
        filters.startDate = startDate;
      }

      if (endDate) {
        filters.endDate = endDate;
      }

      const [data, metricsData] = await Promise.all([
        fetchPosVendas(filters),
        getMetrics(filters)
      ]);

      setRecords(data);
      setMetrics(metricsData);
    } catch (error) {
      console.error('Erro ao carregar pós-vendas:', error);
    } finally {
      setLoading(false);
    }
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Pós-Vendas</h1>
          <p className="text-sm text-text-secondary mt-1">
            Gestão de feedback e satisfação dos clientes
          </p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Icon name="Plus" className="w-4 h-4" />
          Novo Registro
        </button>
      </div>

      {/* Métricas */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-bg-secondary p-4 rounded-lg border border-border-primary">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="Users" className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-text-secondary">Total de Contatos</span>
            </div>
            <p className="text-2xl font-bold text-text-primary">{metrics.totalContatos}</p>
          </div>

          <div className="bg-bg-secondary p-4 rounded-lg border border-border-primary">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="TrendingUp" className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-text-secondary">NPS</span>
            </div>
            <p className="text-2xl font-bold text-text-primary">
              {metrics.nps !== null ? `${metrics.nps}%` : '-'}
            </p>
          </div>

          <div className="bg-bg-secondary p-4 rounded-lg border border-border-primary">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="RefreshCw" className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-text-secondary">Taxa de Reagendamento</span>
            </div>
            <p className="text-2xl font-bold text-text-primary">{metrics.taxaReagendamento}%</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-bg-secondary p-4 rounded-lg border border-border-primary">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-bg-primary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Todos</option>
              <option value="pendente">Pendente</option>
              <option value="contatado">Contatado</option>
              <option value="finalizado">Finalizado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Data Início
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-bg-primary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Data Fim
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-bg-primary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setStatusFilter('');
                setStartDate('');
                setEndDate('');
              }}
              className="w-full px-3 py-2 bg-bg-primary border border-border-primary rounded-lg text-text-secondary hover:bg-bg-tertiary transition-colors"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
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
                  Status
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
                  <td colSpan={7} className="px-4 py-8 text-center text-text-secondary">
                    Nenhum registro encontrado
                  </td>
                </tr>
              ) : (
                records.map((record) => (
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
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {getStatusBadge(record.status)}
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
        </div>
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
