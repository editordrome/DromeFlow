import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { fetchDataTable, fetchDataTableMulti, updateDataRecord, deleteDataRecord, deleteDataRecords, fetchAvailableYearsFromProcessedData } from '../../services/data/dataTable.service';
import { useAuth } from '../../contexts/AuthContext';
import { DataRecord } from '../../types';
import { Icon } from '../ui/Icon';
import UploadModal from '../ui/UploadModal';
import DataDetailModal from '../ui/DataDetailModal';
import EditRecordModal from '../ui/EditRecordModal';
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';

const PeriodDropdown: React.FC<{
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  availableYears?: number[];
}> = ({ value, onChange, disabled, availableYears }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const currentYear = new Date().getFullYear();
  const years = availableYears && availableYears.length > 0 ? availableYears : [currentYear, currentYear - 1, currentYear - 2];
  
  const months = [
    { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' },
    { value: '03', label: 'Março' }, { value: '04', label: 'Abril' },
    { value: '05', label: 'Maio' }, { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' }, { value: '08', label: 'Agosto' },
    { value: '09', label: 'Setembro' }, { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' }
  ];

  const options: { value: string; label: string }[] = [];
  years.forEach(year => {
    months.forEach(month => {
      options.push({ value: `${year}-${month.value}`, label: `${month.label} ${year}` });
    });
  });

  const getDisplayLabel = () => {
    const [year, monthValue] = value.split('-');
    const month = months.find(m => m.value === monthValue);
    return month ? `${month.label} ${year}` : value;
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center justify-between w-48 px-3 py-2 text-left border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        <span className="text-sm text-text-primary">{getDisplayLabel()}</span>
        <Icon name={isOpen ? 'close' : 'add'} className="w-4 h-4 text-text-secondary" />
      </button>
      
      {isOpen && !disabled && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 z-20 w-48 mt-1 bg-bg-secondary border rounded-md shadow-lg border-border-secondary max-h-60 overflow-y-auto">
            <div className="py-1">
              {options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => { onChange(option.value); setIsOpen(false); }}
                  className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-bg-tertiary ${
                    value === option.value ? 'bg-accent-primary text-white' : 'text-text-primary'
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


const DataPage: React.FC = () => {
  const { selectedUnit } = useAppContext();
  const { userUnits } = useAuth();
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DataRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [searchColumn, setSearchColumn] = useState<'cliente' | 'atendimento'>('cliente');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DataRecord | null>(null);
  const [deleteConfirmRecord, setDeleteConfirmRecord] = useState<DataRecord | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const multiUnits = (selectedUnit?.unit_code === 'ALL' ? (userUnits || []).map(u => u.unit_code) : []);

  useEffect(() => {
    const handler = setTimeout(() => {
        setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    if (currentPage !== 1) setCurrentPage(1);
    setSelectedRecordIds(new Set());
  }, [debouncedSearchTerm, searchColumn, selectedPeriod]);

  useEffect(() => {
    setSelectedRecordIds(new Set());
  }, [currentPage]);

  useEffect(() => {
    if (!selectedUnit) {
      setAvailableYears([new Date().getFullYear()]);
      return;
    }
    const loadYears = async () => {
      try {
        const unitCode = selectedUnit.unit_code === 'ALL' 
          ? (userUnits || []).map(u => u.unit_code)
          : selectedUnit.unit_code;
        const years = await fetchAvailableYearsFromProcessedData(unitCode);
        setAvailableYears(years);
      } catch (error) {
        console.error('Erro ao carregar anos disponíveis:', error);
        setAvailableYears([new Date().getFullYear()]);
      }
    };
    loadYears();
  }, [selectedUnit, userUnits]);

  const loadData = useCallback(async () => {
    if (!selectedUnit) {
      setRecords([]);
      setTotalRecords(0);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const isAll = selectedUnit.unit_code === 'ALL';
      const { data: result, count } = isAll
        ? await fetchDataTableMulti(
            (userUnits || []).map(u => u.unit_code),
            currentPage,
            pageSize,
            debouncedSearchTerm,
            searchColumn,
            selectedPeriod
          )
        : await fetchDataTable(
            selectedUnit.unit_code,
            currentPage,
            pageSize,
            debouncedSearchTerm,
            searchColumn,
            selectedPeriod
          );
      setRecords(result);
      setTotalRecords(count);
    } catch (err: any) {
      setError('Falha ao carregar dados.');
      setRecords([]);
      setTotalRecords(0);
    } finally {
      setIsLoading(false);
    }
  }, [selectedUnit, userUnits, currentPage, pageSize, debouncedSearchTerm, searchColumn, selectedPeriod]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime Subscription para processed_data (DataPage)
  useRealtimeSubscription<DataRecord>({
    table: 'processed_data',
    filter: (record) => {
      // Filtrar por unidade(s)
      if (selectedUnit && selectedUnit.unit_code !== 'ALL') {
        if (record.unidade_code !== selectedUnit.unit_code) return false;
      } else if (multiUnits.length > 0) {
        if (!multiUnits.includes(record.unidade_code)) return false;
      }
      // Filtrar por período
      if (record.DATA) {
        const [year, month] = selectedPeriod.split('-');
        const recordDate = new Date(record.DATA);
        const recordMonth = recordDate.getMonth() + 1;
        const recordYear = recordDate.getFullYear();
        if (recordYear !== parseInt(year) || recordMonth !== parseInt(month)) return false;
      }
      return true;
    },
    callbacks: {
      onInsert: (newRecord) => {
        console.log('[DataPage] Novo registro, recarregando...');
        loadData();
      },
      onUpdate: (updatedRecord) => {
        console.log('[DataPage] Registro atualizado');
        setRecords(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r));
      },
      onDelete: (deletedRecord) => {
        console.log('[DataPage] Registro deletado');
        setRecords(prev => prev.filter(r => r.id !== deletedRecord.id));
      }
    },
    enabled: !isLoading
  });

  const handleUploadSuccess = () => {
    setIsUploadModalOpen(false);
    if (currentPage !== 1) setCurrentPage(1);
    else loadData();
  };

  const handleOpenDetailModal = (record: DataRecord) => {
    setSelectedRecord(record);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedRecord(null);
  };

  const handleEditRecord = (record: DataRecord) => {
    setEditingRecord(record);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingRecord(null);
  };

  const handleSaveEdit = async (updatedRecord: DataRecord) => {
    if (!updatedRecord.id) {
      setError('Não é possível salvar um registro sem ID.');
      return;
    }
    try {
      await updateDataRecord(String(updatedRecord.id), updatedRecord);
      handleCloseEditModal();
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      setError('Erro ao salvar alterações do atendimento.');
    }
  };

  const handleDeleteRecord = async (record: DataRecord) => {
    if (!record.id) {
      setError('Não é possível excluir um registro sem ID.');
      return;
    }
    try {
      await deleteDataRecord(String(record.id));
      await loadData();
      setDeleteConfirmRecord(null);
    } catch (error) {
      console.error('Erro ao excluir registro:', error);
      setError('Erro ao excluir o atendimento.');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRecordIds.size === 0) return;
    setIsDeleting(true);
    try {
      await deleteDataRecords(Array.from(selectedRecordIds));
      setSelectedRecordIds(new Set());
      await loadData();
      setShowBulkDeleteConfirm(false);
    } catch (error) {
      console.error('Erro ao excluir registros em lote:', error);
      setError('Erro ao excluir os atendimentos selecionados.');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelectRecord = (id: string) => {
    const newSet = new Set(selectedRecordIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedRecordIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedRecordIds.size === records.length && records.length > 0) {
      setSelectedRecordIds(new Set());
    } else {
      const allIds = records.map(r => String(r.id)).filter(Boolean);
      setSelectedRecordIds(new Set(allIds));
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const totalPages = Math.ceil(totalRecords / pageSize);
  const handlePrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-text-primary">
          Dados{selectedUnit && selectedUnit.unit_code !== 'ALL' ? ` - ${selectedUnit.unit_name}` : ''}
        </h1>
        
        {selectedUnit && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Campo de busca com seletor de coluna */}
            <div className="flex items-center gap-2">
              <select
                value={searchColumn}
                onChange={(e) => setSearchColumn(e.target.value as 'cliente' | 'atendimento')}
                className="px-3 py-2 text-sm border border-border-secondary rounded-md bg-bg-tertiary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary"
              >
                <option value="cliente">Cliente</option>
                <option value="atendimento">Atendimento ID</option>
              </select>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-text-secondary pointer-events-none">
                  <Icon name="search" className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64 pl-9 pr-9 py-2 text-sm border border-border-secondary rounded-md bg-bg-tertiary text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent-primary"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute inset-y-0 right-2 flex items-center text-text-secondary hover:text-text-primary"
                    aria-label="Limpar busca"
                  >
                    <Icon name="x" className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            
            {/* Filtro de período */}
            <PeriodDropdown
              value={selectedPeriod}
              onChange={setSelectedPeriod}
              disabled={isLoading}
              availableYears={availableYears}
            />
            
            {/* Botão de upload */}
            <button 
              onClick={() => setIsUploadModalOpen(true)} 
              disabled={!selectedUnit}
              className="p-2 text-white rounded-md bg-accent-primary hover:bg-accent-secondary disabled:bg-gray-400 disabled:cursor-not-allowed"
              title="Importar XLSX"
            >
              <Icon name="upload" className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Mensagem de todas as unidades */}
      {selectedUnit?.unit_code === 'ALL' && (
        <div className="text-xs text-text-secondary">Exibindo dados agregados de todas as suas unidades.</div>
      )}
      
      {/* Barra de seleção */}
      {selectedRecordIds.size > 0 && (
        <div className="p-3 bg-accent-primary/10 border border-accent-primary/30 rounded-md flex items-center justify-between">
          <span className="text-sm text-text-primary">
            {selectedRecordIds.size} {selectedRecordIds.size === 1 ? 'atendimento selecionado' : 'atendimentos selecionados'}
          </span>
          <button
            onClick={() => setShowBulkDeleteConfirm(true)}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Icon name="delete" className="w-4 h-4" />
            Excluir Selecionados
          </button>
        </div>
      )}
      
      {/* Área de Tabela */}
      <div className="bg-bg-secondary rounded-lg shadow-md overflow-hidden">
        {!selectedUnit ? (
          <div className="p-8 text-center">
            <p className="text-text-secondary">Selecione uma unidade na barra lateral para visualizar ou importar dados.</p>
          </div>
        ) : isLoading ? (
          <div className="p-8 text-center">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-accent-primary rounded-full animate-spin mx-auto"></div>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <div className="p-4 text-danger bg-danger/10 border border-danger/30 rounded-md">{error}</div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full divide-y table-fixed divide-border-primary">
                <colgroup>
                  <col style={{ width: '5%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '28%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '25%' }} />
                  <col style={{ width: '10%' }} />
                </colgroup>
                <thead className="bg-bg-tertiary">
                  <tr>
                    <th className="px-4 py-3 text-xs font-medium tracking-wider text-center uppercase text-text-secondary">
                      <input
                        type="checkbox"
                        checked={selectedRecordIds.size === records.length && records.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Data</th>
                    <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Atendimento ID</th>
                    <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Cliente</th>
                    <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Valor</th>
                    <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Profissional</th>
                    <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Repasse</th>
                  </tr>
                </thead>
                <tbody className="bg-bg-secondary divide-y divide-border-primary">
                  {records.length === 0 ? (
                      <tr>
                          <td colSpan={7} className="px-6 py-10 text-center text-text-secondary">
                            {searchTerm || selectedPeriod ? 'Nenhum resultado encontrado para os filtros aplicados.' : 'Nenhum dado encontrado para esta unidade.'}
                          </td>
                      </tr>
                  ) : records.map((row, index) => (
                    <tr 
                        key={row.id || index} 
                        className="transition-colors hover:bg-bg-tertiary"
                    >
                      <td className="px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedRecordIds.has(String(row.id))}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelectRecord(String(row.id));
                          }}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td 
                        className="px-4 py-4 text-sm whitespace-nowrap text-text-primary cursor-pointer"
                        onDoubleClick={() => handleOpenDetailModal(row)}
                      >
                        {formatDate(row.DATA)}
                      </td>
                      <td 
                        className="px-4 py-4 text-sm truncate whitespace-nowrap text-text-secondary font-mono cursor-pointer" 
                        title={row.ATENDIMENTO_ID}
                        onDoubleClick={() => handleOpenDetailModal(row)}
                      >
                        {row.ATENDIMENTO_ID}
                      </td>
                      <td 
                        className="px-4 py-4 text-sm truncate whitespace-nowrap text-text-primary cursor-pointer" 
                        title={row.CLIENTE}
                        onDoubleClick={() => handleOpenDetailModal(row)}
                      >
                        {row.CLIENTE}
                      </td>
                      <td 
                        className="px-4 py-4 text-sm whitespace-nowrap text-text-secondary cursor-pointer"
                        onDoubleClick={() => handleOpenDetailModal(row)}
                      >
                        {Number(row.VALOR ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td 
                        className="px-4 py-4 text-sm truncate whitespace-nowrap text-text-secondary cursor-pointer" 
                        title={row.PROFISSIONAL}
                        onDoubleClick={() => handleOpenDetailModal(row)}
                      >
                        {row.PROFISSIONAL}
                      </td>
                      <td 
                        className="px-4 py-4 text-sm whitespace-nowrap text-text-secondary cursor-pointer"
                        onDoubleClick={() => handleOpenDetailModal(row)}
                      >
                        {Number(row.REPASSE ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-border-secondary bg-bg-tertiary">
                <div className="text-xs text-text-secondary">
                  Mostrando {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalRecords)} de {totalRecords}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className={`px-2 py-1 text-sm rounded-md border ${currentPage === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-bg-secondary transition'}`}>«</button>
                  <button onClick={handlePrevPage} disabled={currentPage === 1} className={`px-2 py-1 text-sm rounded-md border ${currentPage === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-bg-secondary transition'}`}>‹</button>
                  {(() => {
                    const windowSize = 5;
                    let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
                    let end = start + windowSize - 1;
                    if (end > totalPages) { end = totalPages; start = Math.max(1, end - windowSize + 1); }
                    const pages = [] as number[];
                    for (let i = start; i <= end; i++) pages.push(i);
                    return pages.map(p => (
                      <button key={p} onClick={() => setCurrentPage(p)} className={`px-2 py-1 text-sm rounded-md border min-w-[32px] ${p === currentPage ? 'bg-accent-primary text-white border-accent-secondary' : 'hover:bg-bg-secondary transition'}`}>{p}</button>
                    ));
                  })()}
                  <button onClick={handleNextPage} disabled={currentPage === totalPages} className={`px-2 py-1 text-sm rounded-md border ${currentPage === totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-bg-secondary transition'}`}>›</button>
                  <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className={`px-2 py-1 text-sm rounded-md border ${currentPage === totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-bg-secondary transition'}`}>»</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {isUploadModalOpen && (
        <UploadModal 
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onUploadSuccess={handleUploadSuccess}
          unit={selectedUnit}
        />
      )}

      {isDetailModalOpen && (
        <DataDetailModal
          isOpen={isDetailModalOpen}
          onClose={handleCloseDetailModal}
          record={selectedRecord}
          onEdit={(record) => {
            handleCloseDetailModal();
            handleEditRecord(record);
          }}
          onDelete={(record) => {
            handleCloseDetailModal();
            setDeleteConfirmRecord(record);
          }}
        />
      )}

      {isEditModalOpen && (
        <EditRecordModal
          isOpen={isEditModalOpen}
          onClose={handleCloseEditModal}
          record={editingRecord}
          onSave={handleSaveEdit}
        />
      )}

      {deleteConfirmRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-bg-secondary rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0 w-10 h-10 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                  <Icon name="delete" className="w-6 h-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-text-primary">
                    Confirmar Exclusão
                  </h3>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-text-secondary">
                  Tem certeza que deseja excluir o atendimento de <strong>{deleteConfirmRecord.CLIENTE}</strong>?
                </p>
                <p className="text-sm text-red-600 mt-2">
                  Esta ação não pode ser desfeita.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirmRecord(null)}
                  className="px-4 py-2 text-sm font-medium text-text-secondary bg-bg-tertiary border border-border-primary rounded-md hover:bg-bg-primary focus:outline-none focus:ring-2 focus:ring-accent-primary"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDeleteRecord(deleteConfirmRecord)}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-bg-secondary rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0 w-10 h-10 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                  <Icon name="delete" className="w-6 h-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-text-primary">
                    Confirmar Exclusão em Lote
                  </h3>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-text-secondary">
                  Tem certeza que deseja excluir <strong>{selectedRecordIds.size}</strong> {selectedRecordIds.size === 1 ? 'atendimento' : 'atendimentos'}?
                </p>
                <p className="text-sm text-red-600 mt-2">
                  Esta ação não pode ser desfeita.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm font-medium text-text-secondary bg-bg-tertiary border border-border-primary rounded-md hover:bg-bg-primary focus:outline-none focus:ring-2 focus:ring-accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Excluindo...
                    </>
                  ) : (
                    'Excluir Todos'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataPage;