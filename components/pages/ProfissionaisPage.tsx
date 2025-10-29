import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { fetchProfissionais, updateProfissionalStatus, Profissional } from '../../services/profissionais/profissionais.service';
import { Icon } from '../ui/Icon';
import ProfissionalDetailModal from '../ui/ProfissionalDetailModal';

type StatusTab = 'todas' | 'ativas' | 'inativas';

const ProfissionaisPage: React.FC = () => {
  const { selectedUnit } = useAppContext();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Profissional[]>([]);
  const [selected, setSelected] = useState<Profissional | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('todas');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Filtra por unit_id usando o id da unidade (não o unit_code)
  const unitFilter = selectedUnit?.unit_code === 'ALL' ? undefined : (selectedUnit as any)?.id;

  useEffect(() => {
    let active = true;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchProfissionais(unitFilter);
        if (active) setRows(data);
      } catch (e: any) {
        if (active) setError(e.message || 'Falha ao carregar profissionais');
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, [unitFilter]);

  // Resetar página ao alterar busca ou aba
  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusTab]);

  // Cálculo de métricas
  const metrics = useMemo(() => {
    const normalizeStatus = (status: string | null) => (status || '').toLowerCase().trim();
    const ativas = rows.filter(r => normalizeStatus(r.status) === 'ativa' || normalizeStatus(r.status) === 'ativo').length;
    const inativas = rows.filter(r => normalizeStatus(r.status) === 'inativa' || normalizeStatus(r.status) === 'inativo').length;
    return { ativas, inativas, total: rows.length };
  }, [rows]);

  // Filtro por status tab
  const filteredByStatus = useMemo(() => {
    const normalizeStatus = (status: string | null) => (status || '').toLowerCase().trim();
    if (statusTab === 'ativas') {
      return rows.filter(r => {
        const normalized = normalizeStatus(r.status);
        return normalized === 'ativa' || normalized === 'ativo';
      });
    }
    if (statusTab === 'inativas') {
      return rows.filter(r => {
        const normalized = normalizeStatus(r.status);
        return normalized === 'inativa' || normalized === 'inativo';
      });
    }
    return rows;
  }, [rows, statusTab]);

  // Filtro por busca
  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return filteredByStatus;
    return filteredByStatus.filter(r =>
      (r.nome || '').toLowerCase().includes(q) ||
      (r.whatsapp || '').toLowerCase().includes(q)
    );
  }, [filteredByStatus, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageIndex = Math.min(currentPage, totalPages) - 1;
  const start = pageIndex * pageSize;
  const end = start + pageSize;
  const paginatedRows = filteredRows.slice(start, end);

  const handleRowDoubleClick = (p: Profissional) => {
    setSelected(p);
    setModalOpen(true);
  };

  const handleToggleStatus = async (profissional: Profissional, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profissional.id || updatingStatusId) return;
    
    const currentStatus = (profissional.status || '').toLowerCase().trim();
    const isCurrentlyActive = currentStatus === 'ativa' || currentStatus === 'ativo';
    const newStatus: 'Ativa' | 'Inativa' = isCurrentlyActive ? 'Inativa' : 'Ativa';
    
    setUpdatingStatusId(profissional.id);
    
    // Atualização otimista
    setRows(prev => prev.map(r => 
      r.id === profissional.id ? { ...r, status: newStatus } : r
    ));
    
    try {
      await updateProfissionalStatus(profissional.id, newStatus);
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      // Reverter em caso de erro
      setRows(prev => prev.map(r => 
        r.id === profissional.id ? { ...r, status: profissional.status } : r
      ));
      setError('Erro ao atualizar status da profissional');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Componente de paginação estilo ClientsPage
  const Pagination: React.FC = () => {
    if (totalPages <= 1) return null;
    const go = (p: number) => { if (p >= 1 && p <= totalPages) setCurrentPage(p); };
    const windowSize = 5;
    let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
    let end = start + windowSize - 1;
    if (end > totalPages) { end = totalPages; start = Math.max(1, end - windowSize + 1); }
    const pages = [] as number[];
    for (let i = start; i <= end; i++) pages.push(i);
    
    return (
      <div className="flex items-center justify-between mt-4 text-xs text-text-secondary">
        <div>Mostrando {start + 1} - {Math.min(end, filteredRows.length)} de {filteredRows.length}</div>
        <div className="flex items-center gap-1">
          <button onClick={() => go(1)} disabled={currentPage === 1} className={`px-2 py-1 rounded-md border ${currentPage === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-bg-tertiary'}`}>«</button>
          <button onClick={() => go(currentPage - 1)} disabled={currentPage === 1} className={`px-2 py-1 rounded-md border ${currentPage === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-bg-tertiary'}`}>‹</button>
          {pages.map(p => (
            <button key={p} onClick={() => go(p)} className={`px-2 py-1 rounded-md border min-w-[32px] ${p === currentPage ? 'bg-accent-primary text-white border-accent-secondary' : 'hover:bg-bg-tertiary'}`}>{p}</button>
          ))}
          <button onClick={() => go(currentPage + 1)} disabled={currentPage === totalPages} className={`px-2 py-1 rounded-md border ${currentPage === totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-bg-tertiary'}`}>›</button>
          <button onClick={() => go(totalPages)} disabled={currentPage === totalPages} className={`px-2 py-1 rounded-md border ${currentPage === totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-bg-tertiary'}`}>»</button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 bg-bg-secondary rounded-lg shadow-md">
      {/* Cabeçalho com título e busca */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">
          Profissionais{selectedUnit && selectedUnit.unit_code !== 'ALL' ? ` - ${selectedUnit.unit_name}` : ''}
        </h1>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-text-secondary">
            <Icon name="search" className="h-4 w-4" />
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome ou WhatsApp"
            className="w-full max-w-72 pl-9 pr-9 py-2 text-sm border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-2 flex items-center text-text-secondary hover:text-text-primary"
              aria-label="Limpar busca"
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-16 h-16 border-4 border-t-4 border-gray-200 rounded-full animate-spin border-t-accent-primary"></div>
        </div>
      ) : error ? (
        <div className="p-4 text-danger bg-danger/10 border border-danger/30 rounded-md">{error}</div>
      ) : (
        <>
          {/* Abas de filtro */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <button
              onClick={() => setStatusTab('todas')}
              className={`px-6 py-3 text-sm font-medium rounded-lg transition-all ${
                statusTab === 'todas'
                  ? 'bg-accent-primary text-white shadow-md'
                  : 'bg-bg-tertiary text-text-secondary hover:bg-bg-primary border border-border-secondary'
              }`}
            >
              Todas ({metrics.total})
            </button>
            <button
              onClick={() => setStatusTab('ativas')}
              className={`px-6 py-3 text-sm font-medium rounded-lg transition-all ${
                statusTab === 'ativas'
                  ? 'bg-accent-primary text-white shadow-md'
                  : 'bg-bg-tertiary text-text-secondary hover:bg-bg-primary border border-border-secondary'
              }`}
            >
              Ativas ({metrics.ativas})
            </button>
            <button
              onClick={() => setStatusTab('inativas')}
              className={`px-6 py-3 text-sm font-medium rounded-lg transition-all ${
                statusTab === 'inativas'
                  ? 'bg-accent-primary text-white shadow-md'
                  : 'bg-bg-tertiary text-text-secondary hover:bg-bg-primary border border-border-secondary'
              }`}
            >
              Inativas ({metrics.inativas})
            </button>
          </div>

          {/* Tabela */}
          <div className="overflow-x-auto">
            <table className="w-full divide-y table-fixed divide-border-primary">
              <colgroup>
                <col style={{ width: '40%' }} />
                <col style={{ width: '35%' }} />
                <col style={{ width: '25%' }} />
              </colgroup>
              <thead className="bg-bg-tertiary">
                <tr>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Nome</th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">WhatsApp</th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-center uppercase text-text-secondary">Status</th>
                </tr>
              </thead>
              <tbody className="bg-bg-secondary divide-y divide-border-primary">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-text-secondary" colSpan={3}>
                      {searchTerm ? 'Nenhuma profissional encontrada para a busca.' : 'Nenhuma profissional encontrada.'}
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((r) => {
                    const normalizedStatus = (r.status || '').toLowerCase().trim();
                    const isAtiva = normalizedStatus === 'ativa' || normalizedStatus === 'ativo';
                    const isUpdating = updatingStatusId === r.id;
                    
                    return (
                      <tr 
                        key={r.id} 
                        className="hover:bg-bg-tertiary transition-colors"
                        onDoubleClick={() => handleRowDoubleClick(r)}
                      >
                        <td className="px-6 py-3 text-sm text-text-primary cursor-pointer">
                          {r.nome || '-'}
                        </td>
                        <td className="px-6 py-3 text-sm text-text-primary cursor-pointer">
                          {r.whatsapp || '-'}
                        </td>
                        <td className="px-6 py-3 text-center">
                          <button
                            onClick={(e) => handleToggleStatus(r, e)}
                            disabled={isUpdating}
                            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                              isAtiva
                                ? 'bg-green-500/10 text-green-600 border border-green-500/30 hover:bg-green-500/20'
                                : 'bg-red-500/10 text-red-600 border border-red-500/30 hover:bg-red-500/20'
                            } ${isUpdating ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                            title={isAtiva ? 'Clique para inativar' : 'Clique para ativar'}
                          >
                            {isUpdating ? (
                              <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <Icon name={isAtiva ? 'user-check' : 'user-x'} className="w-3 h-3" />
                            )}
                            {isAtiva ? 'Ativa' : 'Inativa'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <Pagination />
        </>
      )}

      <ProfissionalDetailModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        profissional={selected}
        onEdit={(updated) => {
          // Atualiza a lista local com os dados atualizados
          setRows(prev => prev.map(r => r.id === updated.id ? updated : r));
          // Atualiza o profissional selecionado
          if (selected && selected.id === updated.id) {
            setSelected(updated);
          }
        }}
      />
    </div>
  );
};

export default ProfissionaisPage;
