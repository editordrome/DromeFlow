import React, { useState, useEffect, useCallback } from 'react';
import { fetchAllUnits, createUnit, updateUnit, deleteUnit } from '../../services/units/units.service';
import { fetchUsersForUnit } from '../../services/auth/users.service';
import { Unit } from '../../types';
import { Icon } from '../ui/Icon';

type UnitDataPayload = Partial<Unit>;

const UnitFormModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (unit: UnitDataPayload) => void;
  unit: Unit | null;
  onDelete: (unitId: string) => void;
}> = ({ isOpen, onClose, onSave, unit, onDelete }) => {
  const [formData, setFormData] = useState({
    unit_name: '',
    unit_code: '',
  });
  const [error, setError] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [unitUsers, setUnitUsers] = useState<{ id: string; full_name: string; email: string; role: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Reset form
    if (unit) {
      setFormData({ unit_name: unit.unit_name, unit_code: unit.unit_code });
    } else {
      setFormData({ unit_name: '', unit_code: '' });
    }
    setError('');
    setUsersError(null);
    setUnitUsers([]);
    // Carrega usuários vinculados (somente em edição)
    if (unit && isOpen) {
      (async () => {
        try {
          setUsersLoading(true);
          const users = await fetchUsersForUnit(unit.id);
          setUnitUsers(users);
        } catch (err: any) {
          setUsersError('Falha ao carregar usuários vinculados.');
        } finally {
          setUsersLoading(false);
        }
      })();
    }
  }, [unit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.unit_name || !formData.unit_code) {
      setError('Por favor, preencha todos os campos.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const dataToSave: UnitDataPayload = { ...formData };
      if (unit) dataToSave.id = unit.id;
      await onSave(dataToSave);
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true" role="dialog">
      <div className="w-full max-w-lg p-6 mx-4 bg-bg-secondary rounded-lg shadow-lg">
        <div className="flex items-center justify-between pb-3 border-b border-border-primary">
          <h2 className="text-xl font-bold text-text-primary">{unit ? 'Editar Unidade' : 'Adicionar Nova Unidade'}</h2>
          <button onClick={onClose} className="p-1 rounded-full text-text-secondary hover:bg-bg-tertiary">
            <Icon name="close" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {error && <p className="text-sm text-center text-danger bg-danger/10 p-2 rounded-md">{error}</p>}
          <div>
            <label htmlFor="unit_name" className="block text-sm font-medium text-text-secondary">Nome da Unidade</label>
            <input type="text" name="unit_name" id="unit_name" value={formData.unit_name} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
          </div>
          <div>
            <label htmlFor="unit_code" className="block text-sm font-medium text-text-secondary">Código da Unidade</label>
            <input type="text" name="unit_code" id="unit_code" value={formData.unit_code} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
          </div>
          {unit && (
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-2 flex items-center">Usuários Vinculados</h3>
              {usersLoading && (
                <div className="flex items-center space-x-2 text-text-secondary text-sm"><span className="w-4 h-4 border-2 border-t-accent-primary border-border-secondary rounded-full animate-spin" /> <span>Carregando...</span></div>
              )}
              {usersError && <div className="text-sm text-danger bg-danger/10 p-2 rounded-md">{usersError}</div>}
              {!usersLoading && !usersError && unitUsers.length === 0 && (
                <div className="text-xs italic text-text-secondary">Nenhum usuário vinculado.</div>
              )}
              {!usersLoading && unitUsers.length > 0 && (
                <ul className="divide-y divide-border-secondary border border-border-secondary rounded-md overflow-hidden">
                  {unitUsers.map(u => (
                    <li key={u.id} className="px-3 py-2 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between bg-bg-tertiary/30 hover:bg-bg-tertiary transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-text-primary truncate">{u.full_name || '(Sem nome)'}</p>
                        <p className="text-xs text-text-secondary truncate font-mono">{u.email}</p>
                      </div>
                      <span className="mt-1 sm:mt-0 inline-flex items-center px-2 py-0.5 rounded text-xs bg-accent-primary/10 text-accent-primary font-medium uppercase tracking-wide">{u.role}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="flex items-center justify-between pt-4">
            <div>
              {unit && (
                <button
                  type="button"
                  onClick={() => onDelete(unit.id)}
                  className="flex items-center px-4 py-2 text-sm font-medium text-white transition-colors bg-danger rounded-md hover:bg-red-700"
                >
                  <Icon name="delete" className="w-5 h-5 mr-2" />
                  Excluir
                </button>
              )}
            </div>
            <div className="flex space-x-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium border rounded-md text-text-secondary border-border-secondary hover:bg-bg-tertiary">Cancelar</button>
              <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md bg-accent-primary hover:bg-accent-secondary disabled:opacity-50 disabled:cursor-not-allowed">
                {isSubmitting ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

const DeleteConfirmationModal: React.FC<{
  unit: Unit | null;
  onClose: () => void;
  onConfirm: (unitId: string) => void;
}> = ({ unit, onClose, onConfirm }) => {
  if (!unit) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true" role="dialog">
      <div className="w-full max-w-md p-6 mx-4 bg-bg-secondary rounded-lg shadow-lg">
        <h2 className="text-xl font-bold text-text-primary">Confirmar Exclusão</h2>
        <p className="mt-4 text-text-secondary">
          Tem certeza que deseja excluir a unidade <strong className="text-text-primary">{unit.unit_name}</strong>?
        </p>
        <p className="mt-2 text-sm text-danger">Esta ação é irreversível e removerá as permissões de todos os usuários associados a esta unidade.</p>
        <div className="flex justify-end pt-6 mt-4 space-x-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium border rounded-md text-text-secondary border-border-secondary hover:bg-bg-tertiary">
            Cancelar
          </button>
          <button onClick={() => onConfirm(unit.id)} className="px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md bg-danger hover:bg-red-700">
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
};


const ManageUnitsPage: React.FC = () => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitToDelete, setUnitToDelete] = useState<Unit | null>(null);

  const loadUnits = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedUnits = await fetchAllUnits();
      setUnits(fetchedUnits);
    } catch (err: any) {
      setError('Falha ao carregar as unidades.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  const handleOpenModal = (unit: Unit | null = null) => {
    setEditingUnit(unit);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUnit(null);
  };
  
  const handleOpenDeleteConfirm = (unit: Unit) => {
    setUnitToDelete(unit);
  };

  const handleCloseDeleteConfirm = () => {
    setUnitToDelete(null);
  };

  const handleSaveUnit = async (data: UnitDataPayload) => {
    if (editingUnit) {
      await updateUnit(editingUnit.id, data);
      handleCloseModal();
      await loadUnits();
      return;
    }
    await createUnit(data);
    handleCloseModal();
    await loadUnits();
    // Foca/realça a nova unidade (caso queira implementar no futuro: scroll / highlight)
  };

  const handleDeleteUnit = async (unitId: string) => {
    try {
      await deleteUnit(unitId);
      handleCloseDeleteConfirm();
      await loadUnits();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };
  
  const handleDeleteFromModal = (unitId: string) => {
    const unit = units.find(u => u.id === unitId);
    if(unit) {
      handleCloseModal();
      handleOpenDeleteConfirm(unit);
    }
  };

  return (
    <div className="p-6 bg-bg-secondary rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Unidades</h1>
        <button onClick={() => handleOpenModal()} className="flex items-center px-4 py-2 text-sm font-medium text-white rounded-md bg-accent-primary hover:bg-accent-secondary">
          <Icon name="add" className="w-5 h-5 mr-2" />
          Adicionar Unidade
        </button>
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
                <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Nome da Unidade</th>
                <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Código</th>
                <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-right uppercase text-text-secondary">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-bg-secondary divide-y divide-border-primary">
              {units.map((unit) => (
                <tr 
                  key={unit.id}
                  onDoubleClick={() => handleOpenModal(unit)}
                  className="transition-colors cursor-pointer hover:bg-bg-tertiary"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">{unit.unit_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary font-mono">{unit.unit_code}</td>
                  <td className="px-6 py-4 text-sm font-medium text-right whitespace-nowrap">
                    <div className="flex items-center justify-end space-x-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleOpenModal(unit); }} 
                        className="p-2 rounded-md text-accent-primary hover:bg-accent-primary/10 transition-colors"
                        title="Editar Unidade"
                      >
                        <Icon name="edit" className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleOpenDeleteConfirm(unit); }} 
                        className="p-2 rounded-md text-danger hover:bg-danger/10 transition-colors"
                        title="Excluir Unidade"
                      >
                        <Icon name="delete" className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UnitFormModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveUnit}
        unit={editingUnit}
        onDelete={handleDeleteFromModal}
      />

      <DeleteConfirmationModal
        unit={unitToDelete}
        onClose={handleCloseDeleteConfirm}
        onConfirm={handleDeleteUnit}
      />
    </div>
  );
};

export default ManageUnitsPage;