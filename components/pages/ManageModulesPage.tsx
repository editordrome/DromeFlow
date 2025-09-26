import React, { useState, useEffect, useCallback } from 'react';
import { fetchAllModules, createModule, updateModule, deleteModule, toggleModuleStatus, updateModulesOrder } from '../../services/mockApi';
import { Module, UserRole } from '../../types';
import { Icon, ICON_NAMES } from '../ui/Icon';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

type ModuleDataPayload = Partial<Module>;

const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}> = ({ checked, onChange, disabled }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`${
        checked ? 'bg-accent-primary' : 'bg-gray-300'
      } relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-primary disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <span
        className={`${
          checked ? 'translate-x-6' : 'translate-x-1'
        } inline-block w-4 h-4 transform bg-white rounded-full transition-transform`}
      />
    </button>
  );
};

const ModuleFormModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (module: ModuleDataPayload) => void;
  module: Module | null;
}> = ({ isOpen, onClose, onSave, module }) => {
  const [formData, setFormData] = useState({
    name: '',
    icon: ICON_NAMES[0] || '',
    webhook_url: '',
    view_id: '',
    allowed_profiles: [UserRole.SUPER_ADMIN] as UserRole[],
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (module) {
      setFormData({
        name: module.name,
        icon: module.icon,
        webhook_url: module.webhook_url || '',
        view_id: module.view_id || '',
        allowed_profiles: (module.allowed_profiles as UserRole[]) || [UserRole.SUPER_ADMIN],
      });
    } else {
      setFormData({
        name: '',
        icon: ICON_NAMES[0] || '',
        webhook_url: '',
        view_id: '',
        allowed_profiles: [UserRole.SUPER_ADMIN],
      });
    }
    setError('');
  }, [module, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProfileChange = (role: UserRole) => {
    setFormData(prev => {
      const newProfiles = prev.allowed_profiles.includes(role)
        ? prev.allowed_profiles.filter(p => p !== role)
        : [...prev.allowed_profiles, role];
      return { ...prev, allowed_profiles: newProfiles };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.icon) {
      setError('Por favor, preencha o nome e selecione um ícone.');
      return;
    }
    if (formData.allowed_profiles.length === 0) {
        setError('Selecione pelo menos um perfil de usuário.');
        return;
    }
    const dataToSave: ModuleDataPayload = { ...formData };
    if (module) {
      dataToSave.id = module.id;
    }
    onSave(dataToSave);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true" role="dialog">
      <div className="w-full max-w-lg p-6 mx-4 bg-bg-secondary rounded-lg shadow-lg">
        <div className="flex items-center justify-between pb-3 border-b border-border-primary">
          <h2 className="text-xl font-bold text-text-primary">{module ? 'Editar Módulo' : 'Adicionar Novo Módulo'}</h2>
          <button onClick={onClose} className="p-1 rounded-full text-text-secondary hover:bg-bg-tertiary">
            <Icon name="close" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && <p className="text-sm text-center text-danger bg-danger/10 p-2 rounded-md">{error}</p>}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-text-secondary">Nome do Módulo</label>
            <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
          </div>
          <div>
            <label htmlFor="icon" className="block text-sm font-medium text-text-secondary">Ícone</label>
            <div className="flex items-center space-x-3">
              <Icon name={formData.icon} className="w-8 h-8 p-1 border rounded-md bg-bg-tertiary border-border-secondary" />
              <select name="icon" id="icon" value={formData.icon} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary">
                {ICON_NAMES.map(iconName => (
                  <option key={iconName} value={iconName}>{iconName}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="webhook_url" className="block text-sm font-medium text-text-secondary">URL do Webhook (Opcional)</label>
            <input type="url" name="webhook_url" id="webhook_url" value={formData.webhook_url} onChange={handleChange} className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
          </div>
          <div>
            <label htmlFor="view_id" className="block text-sm font-medium text-text-secondary">View ID (Opcional)</label>
            <input type="text" name="view_id" id="view_id" value={formData.view_id} onChange={handleChange} className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">Perfis Permitidos</label>
            <div className="flex items-center mt-2 space-x-4">
              {Object.values(UserRole).map(role => (
                <label key={role} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allowed_profiles.includes(role)}
                    onChange={() => handleProfileChange(role)}
                    className="w-4 h-4 rounded text-accent-primary bg-bg-tertiary border-border-secondary focus:ring-accent-primary"
                  />
                  <span className="text-sm text-text-primary">{role}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end pt-4 space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium border rounded-md text-text-secondary border-border-secondary hover:bg-bg-tertiary">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md bg-accent-primary hover:bg-accent-secondary">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ManageModulesPage: React.FC = () => {
  const [modules, setModules] = useState<Module[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  const loadModules = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedModules = await fetchAllModules();
      setModules(fetchedModules);
    } catch (err: any) {
      setError('Falha ao carregar os módulos.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModules();
  }, [loadModules]);

  const handleOpenModal = (module: Module | null = null) => {
    setEditingModule(module);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingModule(null);
  };

  const handleSaveModule = async (data: ModuleDataPayload) => {
    try {
      if (editingModule) {
        await updateModule(editingModule.id, data);
      } else {
        await createModule(data);
      }
      handleCloseModal();
      await loadModules();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este módulo? As permissões de usuário para este módulo também serão removidas.')) {
      try {
        await deleteModule(moduleId);
        await loadModules();
      } catch (err: any) {
        alert(`Erro: ${err.message}`);
      }
    }
  };

  const handleToggleStatus = async (module: Module) => {
    try {
      await toggleModuleStatus(module.id, !module.is_active);
      setModules(prevModules => 
        prevModules.map(m => 
          m.id === module.id ? { ...m, is_active: !m.is_active } : m
        )
      );
    } catch (err: any) {
      alert(`Erro ao alterar o status: ${err.message}`);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const fromIndex = result.source.index;
    const toIndex = result.destination.index;
    if (fromIndex === toIndex) return;

    // Calcula nova ordem local imediatamente (estado otimista)
    const newOrder = (() => {
      const clone = [...modules];
      const [moved] = clone.splice(fromIndex, 1);
      clone.splice(toIndex, 0, moved);
      return clone;
    })();

    setModules(newOrder);

    try {
      setIsSavingOrder(true);
      const payload = newOrder.map((m, idx) => ({ id: m.id, position: idx + 1 }));
      await updateModulesOrder(payload);
      // Opcional: recarregar para garantir consistência caso haja triggers
      // await loadModules();
    } catch (e: any) {
      alert('Falha ao salvar nova ordem: ' + e.message);
      // Reverte em caso de falha
      await loadModules();
    } finally {
      setIsSavingOrder(false);
    }
  };


  return (
    <div className="p-6 bg-bg-secondary rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Módulos {isSavingOrder && <span className="ml-2 text-sm text-text-secondary">(salvando...)</span>}</h1>
        <button onClick={() => handleOpenModal()} className="flex items-center px-4 py-2 text-sm font-medium text-white rounded-md bg-accent-primary hover:bg-accent-secondary">
          <Icon name="add" className="w-5 h-5 mr-2" />
          Adicionar Módulo
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
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="modules-table">
              {(provided) => (
                <table className="min-w-full divide-y divide-border-primary" ref={provided.innerRef} {...provided.droppableProps}>
                  <thead className="bg-bg-tertiary">
                    <tr>
                      <th className="w-8 px-2 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary"></th>
                      <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Nome</th>
                      <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Ícone</th>
                      <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Perfis</th>
                      <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Status</th>
                      <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-right uppercase text-text-secondary">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-bg-secondary divide-y divide-border-primary">
                    {modules.map((module, index) => (
                      <Draggable draggableId={module.id} index={index} key={module.id}>
                        {(dragProvided, snapshot) => (
                          <tr
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            className={`transition-colors cursor-pointer hover:bg-bg-tertiary ${!module.is_active ? 'opacity-50' : ''} ${snapshot.isDragging ? 'bg-accent-primary/10' : ''}`}
                            onDoubleClick={() => handleOpenModal(module)}
                          >
                            <td className="px-2 py-2 align-middle" {...dragProvided.dragHandleProps}>
                              <div className="flex items-center justify-center w-4 h-4 text-text-secondary cursor-grab active:cursor-grabbing">⋮⋮</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">{module.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                              <Icon name={module.icon} className="w-6 h-6" />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                              <div className="flex flex-wrap gap-1">
                                {module.allowed_profiles?.map(profile => (
                                  <span key={profile} className="px-2 py-1 text-xs font-semibold text-white bg-gray-600 rounded-full">
                                    {profile}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                               <div className="flex items-center space-x-2">
                                  <ToggleSwitch
                                    checked={module.is_active}
                                    onChange={() => handleToggleStatus(module)}
                                  />
                                  <span>{module.is_active ? 'Ativo' : 'Inativo'}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-right whitespace-nowrap">
                              <div className="flex items-center justify-end space-x-1">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleOpenModal(module); }} 
                                  className="p-2 rounded-md text-accent-primary hover:bg-accent-primary/10 transition-colors"
                                  title="Editar Módulo"
                                >
                                  <Icon name="edit" className="w-5 h-5" />
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDeleteModule(module.id); }} 
                                  className="p-2 rounded-md text-danger hover:bg-danger/10 transition-colors"
                                  title="Excluir Módulo"
                                >
                                  <Icon name="delete" className="w-5 h-5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </tbody>
                </table>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      )}

      <ModuleFormModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveModule}
        module={editingModule}
      />
    </div>
  );
};

export default ManageModulesPage;