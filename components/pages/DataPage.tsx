import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { fetchDataTable, updateDataRecord, deleteDataRecord } from '../../services/mockApi';
import { DataRecord } from '../../types';
import { Icon } from '../ui/Icon';
import UploadModal from '../ui/UploadModal';
import DataDetailModal from '../ui/DataDetailModal';
import EditRecordModal from '../ui/EditRecordModal';

const PeriodDropdown: React.FC<{
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];
  
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
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DataRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [searchColumn, setSearchColumn] = useState<'cliente' | 'orcamento'>('cliente');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DataRecord | null>(null);
  const [deleteConfirmRecord, setDeleteConfirmRecord] = useState<DataRecord | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalRecords, setTotalRecords] = useState(0);

  useEffect(() => {
    const handler = setTimeout(() => {
        setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    if (currentPage !== 1) setCurrentPage(1);
  }, [debouncedSearchTerm, searchColumn, selectedPeriod]);


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
      const { data: result, count } = await fetchDataTable(
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
  }, [selectedUnit, currentPage, pageSize, debouncedSearchTerm, searchColumn, selectedPeriod]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      await loadData();
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
    <div className="p-6 bg-bg-secondary rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Dados: {selectedUnit?.unit_name || 'Nenhuma'}</h1>
        
        {selectedUnit && (
          <div className="flex items-center gap-4">
             <PeriodDropdown
                value={selectedPeriod}
                onChange={setSelectedPeriod}
                disabled={isLoading}
            />
            <div className="flex items-center gap-2">
              <select
                value={searchColumn}
                onChange={(e) => setSearchColumn(e.target.value as 'cliente' | 'orcamento')}
                className="px-3 py-2 text-sm border border-border-primary rounded-md bg-bg-secondary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
              >
                <option value="cliente">Cliente</option>
                <option value="orcamento">Orçamento</option>
              </select>
              <input
                type="text"
                placeholder={`Buscar...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-48 px-3 py-2 text-sm border border-border-primary rounded-md bg-bg-secondary text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
              />
            </div>
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
      
      {!selectedUnit ? (
        <div className="p-4 text-center text-text-secondary bg-bg-tertiary rounded-md">
            Selecione uma unidade na barra lateral para visualizar ou importar dados.
        </div>
      ) : isLoading ? (
         <div className="flex items-center justify-center h-64">
             <div className="w-16 h-16 border-4 border-t-4 border-gray-200 rounded-full animate-spin border-t-accent-primary"></div>
         </div>
      ) : error ? (
        <div className="p-4 text-danger bg-danger/10 border border-danger/30 rounded-md">{error}</div>
      ) : (
        <>
            <div className="overflow-x-auto">
              <table className="w-full divide-y table-fixed divide-border-primary">
                <thead className="bg-bg-tertiary">
                  <tr>
                    <th className="w-[10%] px-4 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Data</th>
                    <th className="w-[12%] px-4 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Orçamento</th>
                    <th className="w-[30%] px-4 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Cliente</th>
                    <th className="w-[10%] px-4 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Valor</th>
                    <th className="w-[28%] px-4 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Profissional</th>
                    <th className="w-[10%] px-4 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Repasse</th>
                  </tr>
                </thead>
                <tbody className="bg-bg-secondary divide-y divide-border-primary">
                  {records.length === 0 ? (
                      <tr>
                          <td colSpan={6} className="px-6 py-10 text-center text-text-secondary">
                            {searchTerm || selectedPeriod ? 'Nenhum resultado encontrado para os filtros aplicados.' : 'Nenhum dado encontrado para esta unidade.'}
                          </td>
                      </tr>
                  ) : records.map((row, index) => (
                    <tr 
                        key={row.id || index} 
                        className="transition-colors cursor-pointer hover:bg-bg-tertiary"
                        onDoubleClick={() => handleOpenDetailModal(row)}
                    >
                      <td className="px-4 py-4 text-sm whitespace-nowrap text-text-primary">{formatDate(row.DATA)}</td>
                      <td className="px-4 py-4 text-sm truncate whitespace-nowrap text-text-secondary font-mono" title={row.orcamento}>{row.orcamento}</td>
                      <td className="px-4 py-4 text-sm truncate whitespace-nowrap text-text-primary" title={row.CLIENTE}>{row.CLIENTE}</td>
                      <td className="px-4 py-4 text-sm whitespace-nowrap text-text-secondary">{row.VALOR.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td className="px-4 py-4 text-sm truncate whitespace-nowrap text-text-secondary" title={row.PROFISSIONAL}>{row.PROFISSIONAL}</td>
                      <td className="px-4 py-4 text-sm whitespace-nowrap text-text-secondary">{row.REPASSE.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-4 mt-2 border-t border-border-primary">
                <span className="text-sm text-text-secondary">
                    Mostrando {Math.min((currentPage - 1) * pageSize + 1, totalRecords).toLocaleString()} a {Math.min(currentPage * pageSize, totalRecords).toLocaleString()} de {totalRecords.toLocaleString()} registros
                </span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handlePrevPage}
                        disabled={currentPage === 1 || totalPages === 0}
                        className="px-3 py-1 text-sm font-medium bg-bg-secondary border rounded-md border-border-secondary hover:bg-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Anterior
                    </button>
                    <span className="text-sm text-text-primary">
                        Página {totalPages > 0 ? currentPage : 0} de {totalPages}
                    </span>
                    <button
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="px-3 py-1 text-sm font-medium bg-bg-secondary border rounded-md border-border-secondary hover:bg-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Próximo
                    </button>
                </div>
            </div>
        </>
      )}

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
    </div>
  );
};

export default DataPage;