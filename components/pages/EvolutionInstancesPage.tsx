import { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { Icon } from '../ui/Icon';
import { EvolutionConfigModal } from '../ui/EvolutionConfigModal';
import type { EvolutionInstance, EvolutionStats } from '../../types';
import {
  fetchInstances,
  getInstanceStats,
  deleteInstance,
  syncInstanceStatus,
  syncAllInstances,
} from '../../services/evolution/instances.service';

export function EvolutionInstancesPage() {
  const { selectedUnit } = useAppContext();
  
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [stats, setStats] = useState<EvolutionStats>({
    total: 0,
    connected: 0,
    disconnected: 0,
    connecting: 0,
    error: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<EvolutionInstance | null>(null);

  // Carregar dados
  const loadData = async () => {
    try {
      setLoading(true);
      const unitId = selectedUnit && selectedUnit.unit_code !== 'ALL' ? selectedUnit.id : undefined;
      
      const [instancesData, statsData] = await Promise.all([
        fetchInstances(unitId),
        getInstanceStats(unitId),
      ]);

      setInstances(instancesData);
      setStats(statsData);
    } catch (error) {
      console.error('Erro ao carregar instâncias:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedUnit]);

  // Filtrar instâncias
  const filteredInstances = useMemo(() => {
    return instances.filter(instance => {
      const matchesSearch = 
        instance.instance_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        instance.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        instance.phone_number?.includes(searchTerm);

      const matchesStatus = statusFilter === 'all' || instance.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [instances, searchTerm, statusFilter]);

  // Handlers
  const handleNew = () => {
    setSelectedInstance(null);
    setShowFormModal(true);
  };

  const handleEdit = (instance: EvolutionInstance) => {
    setSelectedInstance(instance);
    setShowFormModal(true);
  };

  const handleConnect = (instance: EvolutionInstance) => {
    setSelectedInstance(instance);
    setShowQRModal(true);
  };

  const handleDelete = async (instance: EvolutionInstance) => {
    if (!confirm(`Deseja realmente excluir a instância "${instance.display_name || instance.instance_name}"?`)) {
      return;
    }

    try {
      await deleteInstance(instance.id);
      await loadData();
    } catch (error: any) {
      alert(`Erro ao excluir: ${error.message}`);
    }
  };

  const handleSync = async (instanceId: string) => {
    try {
      setSyncingId(instanceId);
      await syncInstanceStatus(instanceId);
      await loadData();
    } catch (error: any) {
      alert(`Erro ao sincronizar: ${error.message}`);
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAll = async () => {
    try {
      setSyncingAll(true);
      await syncAllInstances();
      await loadData();
    } catch (error: any) {
      alert(`Erro ao sincronizar: ${error.message}`);
    } finally {
      setSyncingAll(false);
    }
  };

  // Status badge
  const getStatusBadge = (status: string) => {
    const styles = {
      connected: 'bg-green-100 text-green-800',
      disconnected: 'bg-gray-100 text-gray-800',
      connecting: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
    };

    const labels = {
      connected: 'Conectado',
      disconnected: 'Desconectado',
      connecting: 'Conectando...',
      error: 'Erro',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || styles.disconnected}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Carregando instâncias...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Instâncias WhatsApp</h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowConfigModal(true)}
            disabled={!selectedUnit || selectedUnit.unit_code === 'ALL'}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            title={!selectedUnit || selectedUnit.unit_code === 'ALL' ? 'Selecione uma unidade específica' : 'Configurar servidor Evolution'}
          >
            <Icon name="Settings" />
            Configurar API
          </button>
          <button
            onClick={handleSyncAll}
            disabled={syncingAll}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Icon name={syncingAll ? "Loader2" : "RefreshCw"} className={syncingAll ? "animate-spin" : ""} />
            {syncingAll ? 'Sincronizando...' : 'Sincronizar'}
          </button>
          <button
            onClick={handleNew}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Icon name="Plus" />
            Nova Instância
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Icon name="MessageSquare" className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Conectadas</p>
              <p className="text-2xl font-bold text-green-600">{stats.connected}</p>
            </div>
            <Icon name="CheckCircle" className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Desconectadas</p>
              <p className="text-2xl font-bold text-gray-600">{stats.disconnected}</p>
            </div>
            <Icon name="XCircle" className="w-8 h-8 text-gray-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Conectando</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.connecting}</p>
            </div>
            <Icon name="Loader2" className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Com Erro</p>
              <p className="text-2xl font-bold text-red-600">{stats.error}</p>
            </div>
            <Icon name="AlertCircle" className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Buscar por nome ou número..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Todos os Status</option>
            <option value="connected">Conectado</option>
            <option value="disconnected">Desconectado</option>
            <option value="connecting">Conectando</option>
            <option value="error">Com Erro</option>
          </select>
        </div>
      </div>

      {/* Tabela Desktop */}
      <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Instância
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Número
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Última Sinc.
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredInstances.map((instance) => (
              <tr key={instance.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {instance.display_name || instance.instance_name}
                    </div>
                    <div className="text-sm text-gray-500">{instance.instance_name}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(instance.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {instance.phone_number || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {instance.last_sync ? new Date(instance.last_sync).toLocaleString('pt-BR') : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end gap-2">
                    {instance.status === 'disconnected' && (
                      <button
                        onClick={() => handleConnect(instance)}
                        className="text-green-600 hover:text-green-900"
                        title="Conectar"
                      >
                        <Icon name="Plug" className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleSync(instance.id)}
                      disabled={syncingId === instance.id}
                      className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                      title="Sincronizar"
                    >
                      <Icon name={syncingId === instance.id ? "Loader2" : "RefreshCw"} className={`w-5 h-5 ${syncingId === instance.id ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleEdit(instance)}
                      className="text-gray-600 hover:text-gray-900"
                      title="Editar"
                    >
                      <Icon name="Settings" className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(instance)}
                      className="text-red-600 hover:text-red-900"
                      title="Excluir"
                    >
                      <Icon name="Trash2" className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredInstances.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Nenhuma instância encontrada
          </div>
        )}
      </div>

      {/* Cards Mobile */}
      <div className="lg:hidden space-y-4">
        {filteredInstances.map((instance) => (
          <div key={instance.id} className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">
                  {instance.display_name || instance.instance_name}
                </h3>
                <p className="text-sm text-gray-500">{instance.instance_name}</p>
              </div>
              {getStatusBadge(instance.status)}
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Número:</span>
                <span className="text-gray-900">{instance.phone_number || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Última Sinc.:</span>
                <span className="text-gray-900">
                  {instance.last_sync ? new Date(instance.last_sync).toLocaleString('pt-BR') : '-'}
                </span>
              </div>
            </div>

            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
              {instance.status === 'disconnected' && (
                <button
                  onClick={() => handleConnect(instance)}
                  className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <Icon name="Plug" className="w-4 h-4" />
                  Conectar
                </button>
              )}
              <button
                onClick={() => handleSync(instance.id)}
                disabled={syncingId === instance.id}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Icon name={syncingId === instance.id ? "Loader2" : "RefreshCw"} className={syncingId === instance.id ? "animate-spin" : ""} />
                Sincronizar
              </button>
              <button
                onClick={() => handleEdit(instance)}
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                <Icon name="Settings" className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleDelete(instance)}
                className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
              >
                <Icon name="Trash2" className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}

        {filteredInstances.length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow">
            Nenhuma instância encontrada
          </div>
        )}
      </div>

      {/* Modals */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full">
            <p className="p-6 text-center text-gray-600">
              Modal de formulário será implementado (InstanceFormModal)
            </p>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => setShowFormModal(false)}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {showQRModal && selectedInstance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <p className="p-6 text-center text-gray-600">
              Modal de QR Code será implementado (QRCodeModal)
            </p>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => setShowQRModal(false)}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Configuração Evolution API */}
      {showConfigModal && selectedUnit && selectedUnit.unit_code !== 'ALL' && (
        <EvolutionConfigModal
          unitId={selectedUnit.id}
          unitName={selectedUnit.unit_name}
          onClose={() => setShowConfigModal(false)}
          onSave={() => {
            loadData();
          }}
        />
      )}
    </div>
  );
}
