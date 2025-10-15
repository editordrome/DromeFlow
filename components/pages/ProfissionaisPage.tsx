import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { fetchProfissionais, Profissional } from '../../services/profissionais/profissionais.service';
import ProfissionalDetailModal from '../ui/ProfissionalDetailModal';

const ProfissionaisPage: React.FC = () => {
  const { selectedUnit } = useAppContext();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Profissional[]>([]);
  const [selected, setSelected] = useState<Profissional | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

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

  // Resetar página ao alterar busca
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      (r.nome || '').toLowerCase().includes(q) ||
      (r.whatsapp || '').toLowerCase().includes(q) ||
      (r.status || '').toLowerCase().includes(q)
    );
  }, [rows, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE));
  const pageIndex = Math.min(currentPage, totalPages) - 1;
  const start = pageIndex * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const paginatedRows = filteredRows.slice(start, end);

  const handleRowDoubleClick = (p: Profissional) => {
    setSelected(p);
    setModalOpen(true);
  };

  return (
    <div className="p-6 bg-bg-secondary rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h1 className="text-2xl font-bold text-text-primary">Profissionais</h1>
        <div className="ml-auto relative">
          <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-text-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 103.5 3.5a7.5 7.5 0 0013.15 13.15z" /></svg>
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e)=>setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, WhatsApp ou status"
            className="w-72 pl-8 pr-8 py-2 text-sm border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={()=>setSearchTerm('')}
              className="absolute inset-y-0 right-2 flex items-center text-text-secondary hover:text-text-primary"
              aria-label="Limpar busca"
              title="Limpar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm2.707-11.293a1 1 0 00-1.414-1.414L10 6.586 8.707 5.293a1 1 0 00-1.414 1.414L8.586 8l-1.293 1.293a1 1 0 101.414 1.414L10 9.414l1.293 1.293a1 1 0 001.414-1.414L11.414 8l1.293-1.293z" clipRule="evenodd" /></svg>
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
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border-primary">
            <thead className="bg-bg-tertiary">
              <tr>
                <th className="px-6 py-2 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Nome</th>
                <th className="px-6 py-2 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">WhatsApp</th>
                <th className="px-6 py-2 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Status</th>
              </tr>
            </thead>
            <tbody className="bg-bg-secondary divide-y divide-border-primary">
              {paginatedRows.length === 0 && (
                <tr>
                  <td className="px-6 py-4 text-sm text-text-secondary" colSpan={3}>Nenhum profissional encontrado.</td>
                </tr>
              )}
              {paginatedRows.map((r) => (
                <tr key={r.id} className="hover:bg-bg-tertiary cursor-pointer" onDoubleClick={() => handleRowDoubleClick(r)}>
                  <td className="px-6 py-2 text-sm text-text-primary">{r.nome || '-'}</td>
                  <td className="px-6 py-2 text-sm text-text-primary">{r.whatsapp || '-'}</td>
                  <td className="px-6 py-2 text-sm text-text-primary">{r.status || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Paginação */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-text-secondary">
              Mostrando {filteredRows.length === 0 ? 0 : start + 1}–{Math.min(end, filteredRows.length)} de {filteredRows.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1 text-sm border rounded-md disabled:opacity-50"
                onClick={()=>setCurrentPage(p=>Math.max(1, p-1))}
                disabled={currentPage <= 1}
              >Anterior</button>
              <span className="text-sm text-text-secondary">Página {currentPage} de {totalPages}</span>
              <button
                className="px-3 py-1 text-sm border rounded-md disabled:opacity-50"
                onClick={()=>setCurrentPage(p=>Math.min(totalPages, p+1))}
                disabled={currentPage >= totalPages}
              >Próxima</button>
            </div>
          </div>
        </div>
      )}

      <ProfissionalDetailModal isOpen={modalOpen} onClose={() => setModalOpen(false)} profissional={selected} />
    </div>
  );
};

export default ProfissionaisPage;
