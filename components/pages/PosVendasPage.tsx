import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useAppContext } from '../../contexts/AppContext';
import { Icon } from '../ui/Icon';
import type { PosVenda } from '../../types';
import {
  fetchPosVendas,
  fetchPendenteWithProfissional,
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
  const { profile, userModules } = useAuth();
  const { selectedUnit } = useAppContext();

  const [allRecords, setAllRecords] = useState<PosVenda[]>([]);
  const [pendentesProfissional, setPendentesProfissional] = useState<Array<PosVenda & { PROFISSIONAL: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PosVenda | null>(null);
  const [activeCard, setActiveCard] = useState<ActiveCard>('geral');
  const [sendingWebhook, setSendingWebhook] = useState<Set<string>>(new Set());
  const [webhookFeedback, setWebhookFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Localiza webhook do módulo pós-vendas
  const posVendasWebhook = useMemo(() => {
    const module = userModules.find(m =>
      m.code === 'pos_vendas' || m.name.toLowerCase().includes('pós-vendas')
    );
    return module?.webhook_url || null;
  }, [userModules]);

  // Limpa feedback de webhook após alguns segundos
  useEffect(() => {
    if (webhookFeedback) {
      const t = setTimeout(() => setWebhookFeedback(null), 5000);
      return () => clearTimeout(t);
    }
  }, [webhookFeedback]);

  // Período selecionado (formato: YYYY-MM)
  const currentDate = new Date();
  const [selectedPeriod, setSelectedPeriod] = useState(
    `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
  );

  // Métricas
  const [metrics, setMetrics] = useState<{
    totalContatos: number;
    totalContatados: number;
    totalFinalizados: number;
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
      if (selectedUnit && selectedUnit.id !== 'ALL') {
        filters.unit_id = selectedUnit.id;
      } else if (profile?.role !== 'super_admin') {
        // Se não houver unidade selecionada e não for super_admin, não carrega nada
        setAllRecords([]);
        setMetrics({
          totalContatos: 0,
          totalContatados: 0,
          totalFinalizados: 0,
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

      const [data, metricsData, pendenteData] = await Promise.all([
        fetchPosVendas(filters),
        getMetrics(filters),
        fetchPendenteWithProfissional(filters)
      ]);

      setAllRecords(data);
      setMetrics(metricsData);
      setPendentesProfissional(pendenteData);
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

  const handleSendWebhook = async (record: PosVenda & { PROFISSIONAL: string | null }) => {
    if (!posVendasWebhook) {
      setWebhookFeedback({ type: 'error', message: 'Webhook não configurado para este módulo' });
      return;
    }

    if (!record.ATENDIMENTO_ID) {
      setWebhookFeedback({ type: 'error', message: 'ATENDIMENTO_ID não disponível' });
      return;
    }

    setSendingWebhook(prev => new Set(prev).add(record.id));

    try {
      const payload = {
        action: 'pos_vendas',
        ATENDIMENTO_ID: record.ATENDIMENTO_ID,
        unit_id: record.unit_id
      };

      let usedFallback = false;
      try {
        const resp = await fetch(posVendasWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          throw new Error(`Falha HTTP ${resp.status}${text ? ' - ' + text.slice(0, 140) : ''}`);
        }
        setWebhookFeedback({ type: 'success', message: 'Webhook enviado com sucesso!' });
      } catch (primaryErr: any) {
        const msg = primaryErr?.message || '';
        if (msg.includes('Failed to fetch') || msg.includes('CORS') || msg.includes('NetworkError') || msg.includes('TypeError')) {
          usedFallback = true;
        } else {
          throw primaryErr;
        }
      }

      if (usedFallback) {
        const url = new URL(posVendasWebhook);
        url.searchParams.set('action', 'pos_vendas');
        url.searchParams.set('aid', record.ATENDIMENTO_ID);
        url.searchParams.set('uid', record.unit_id || '');
        const r = await fetch(url.toString(), { method: 'GET' });
        if (!r.ok) throw new Error(`Fallback GET falhou HTTP ${r.status}`);
        setWebhookFeedback({ type: 'success', message: 'Webhook enviado via fallback GET!' });
      }
    } catch (err: any) {
      let msg = 'Erro ao enviar webhook.';
      if (err?.message) {
        if (err.message.includes('Failed to fetch')) msg = 'Falha de rede/DNS ao contatar webhook.';
        else msg = err.message;
      }
      console.error('Erro ao enviar webhook pós-vendas:', err);
      setWebhookFeedback({ type: 'error', message: msg });
    } finally {
      setSendingWebhook(prev => {
        const next = new Set(prev);
        next.delete(record.id);
        return next;
      });
    }
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
              ? 'bg-pink-500 text-white border-pink-500 shadow-lg'
              : 'bg-bg-secondary border-border-primary hover:border-pink-500'
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
            {/* Métricas Principais - Funil de Respostas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="TrendingUp" className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm font-medium text-purple-800 dark:text-purple-300">Taxa de Conversão</span>
                </div>
                <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">
                  {metrics.totalContatados > 0 
                    ? `${((metrics.totalFinalizados / metrics.totalContatados) * 100).toFixed(1)}%`
                    : '0%'}
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                  {metrics.totalFinalizados} de {metrics.totalContatados} contatados
                </p>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="Send" className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-300">Total Contatados</span>
                </div>
                <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{metrics.totalContatados}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Avaliação enviada</p>
              </div>

              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="CheckCircle2" className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-800 dark:text-green-300">Finalizados</span>
                </div>
                <p className="text-3xl font-bold text-green-900 dark:text-green-100">{metrics.totalFinalizados}</p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">Responderam avaliação</p>
              </div>
            </div>

            {/* Métricas Principais - Linha 2: Indicadores de Qualidade */}
            <div>
              <h3 className="text-lg font-semibold text-text-primary mb-3">Indicadores de Qualidade</h3>
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

        {activeCard === 'pendente' && (
          <div className="overflow-x-auto">
            {webhookFeedback && (
              <div className={`mb-4 p-3 rounded-lg ${webhookFeedback.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {webhookFeedback.message}
              </div>
            )}
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
                    Profissional
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary">
                {pendentesProfissional.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-text-secondary">
                      Nenhum registro pendente
                    </td>
                  </tr>
                ) : (
                  pendentesProfissional.map((record) => (
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
                        {record.PROFISSIONAL || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleSendWebhook(record)}
                          disabled={sendingWebhook.has(record.id) || !posVendasWebhook}
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
                        >
                          {sendingWebhook.has(record.id) ? (
                            <>
                              <Icon name="Loader2" className="w-4 h-4 animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <Icon name="Send" className="w-4 h-4" />
                              Enviar
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {pendentesProfissional.length > 0 && (
              <div className="px-4 py-3 bg-bg-tertiary text-center text-sm text-text-secondary">
                {pendentesProfissional.length} registro(s) pendente(s)
              </div>
            )}
          </div>
        )}
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
