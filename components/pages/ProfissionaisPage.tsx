import React, { useEffect, useState } from 'react';
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

  const handleRowDoubleClick = (p: Profissional) => {
    setSelected(p);
    setModalOpen(true);
  };

  return (
    <div className="p-6 bg-bg-secondary rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-text-primary">Profissionais</h1>
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
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Nome</th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">WhatsApp</th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Status</th>
              </tr>
            </thead>
            <tbody className="bg-bg-secondary divide-y divide-border-primary">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-bg-tertiary cursor-pointer" onDoubleClick={() => handleRowDoubleClick(r)}>
                  <td className="px-6 py-3 text-sm text-text-primary">{r.nome || '-'}</td>
                  <td className="px-6 py-3 text-sm text-text-primary">{r.whatsapp || '-'}</td>
                  <td className="px-6 py-3 text-sm text-text-primary">{r.status || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProfissionalDetailModal isOpen={modalOpen} onClose={() => setModalOpen(false)} profissional={selected} />
    </div>
  );
};

export default ProfissionaisPage;
