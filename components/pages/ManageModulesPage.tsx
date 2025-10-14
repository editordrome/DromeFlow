import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchAllModules, createModule, updateModule, deleteModule, toggleModuleStatus, updateModulesOrder } from '../../services/modules/modules.service';
import { Module, UserRole } from '../../types';
import { Icon, ICON_NAMES } from '../ui/Icon';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

const ITEMS_PER_PAGE = 10;

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
  allModules: Module[];
}> = ({ isOpen, onClose, onSave, module, allModules }) => {
  const [formData, setFormData] = useState({
    name: '',
    icon: ICON_NAMES[0] || '',
    webhook_url: '',
    view_id: '',
    allowed_profiles: [UserRole.SUPER_ADMIN] as UserRole[],
    parent_id: null as string | null,
  });
  const [error, setError] = useState('');
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [iconSearch, setIconSearch] = useState('');

  useEffect(() => {
    if (module) {
      setFormData({
        name: module.name,
        icon: module.icon,
        webhook_url: module.webhook_url || '',
        view_id: module.view_id || '',
        allowed_profiles: (module.allowed_profiles as UserRole[]) || [UserRole.SUPER_ADMIN],
        parent_id: module.parent_id ?? null,
      });
    } else {
      setFormData({
        name: '',
        icon: ICON_NAMES[0] || '',
        webhook_url: '',
        view_id: '',
        allowed_profiles: [UserRole.SUPER_ADMIN],
        parent_id: null,
      });
    }
    setError('');
  }, [module, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'parent_id') {
      setFormData(prev => ({ ...prev, parent_id: value === '' ? null : value }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
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
    if (module && formData.parent_id === module.id) {
      setError('Um módulo não pode ser pai de si mesmo.');
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
            <label className="block text-sm font-medium text-text-secondary">Ícone</label>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-2 px-2 py-1 border rounded-md bg-bg-tertiary border-border-secondary">
                <Icon name={formData.icon} className="w-7 h-7" />
                <span className="text-sm text-text-secondary truncate max-w-[200px]" title={formData.icon}>{formData.icon}</span>
              </div>
              <button type="button" onClick={() => setIsIconPickerOpen(true)} className="px-3 py-2 text-sm font-medium rounded-md bg-accent-primary text-white hover:bg-accent-secondary">
                Escolher Ícone
              </button>
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
            <label htmlFor="parent_id" className="block text-sm font-medium text-text-secondary">Módulo pai (opcional)</label>
            <select
              id="parent_id"
              name="parent_id"
              value={formData.parent_id || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary"
            >
              <option value="">Nenhum (topo)</option>
              {allModules
                .filter(m => !module || m.id !== module.id)
                .filter(m => !m.parent_id) /* apenas top-level como possíveis pais */
                .map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
            </select>
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

      {isIconPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-4xl max-h-[80vh] overflow-hidden rounded-lg shadow-lg bg-bg-secondary border border-border-primary">
            <div className="flex items-center justify-between p-4 border-b border-border-primary">
              <h3 className="text-lg font-semibold text-text-primary">Escolher Ícone</h3>
              <button onClick={() => setIsIconPickerOpen(false)} className="p-1 rounded-md hover:bg-bg-tertiary text-text-secondary">
                <Icon name="close" />
              </button>
            </div>
            <div className="p-4">
              <div className="mb-3">
                <input
                  type="text"
                  value={iconSearch}
                  onChange={(e) => setIconSearch(e.target.value)}
                  placeholder="Buscar ícone pelo nome..."
                  className="w-full px-3 py-2 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 overflow-y-auto max-h-[55vh] p-1">
                {ICON_NAMES
                  .filter(n => n.toLowerCase().includes(iconSearch.toLowerCase()))
                  .map((iconName) => (
                    <button
                      type="button"
                      key={iconName}
                      onClick={() => { setFormData(prev => ({ ...prev, icon: iconName })); setIsIconPickerOpen(false); }}
                      className={`flex flex-col items-center justify-center gap-2 p-3 rounded-md border transition-colors hover:bg-bg-tertiary ${formData.icon === iconName ? 'border-accent-primary ring-1 ring-accent-primary' : 'border-border-secondary'}`}
                      title={iconName}
                    >
                      <Icon name={iconName} className="w-8 h-8" />
                      <span className="text-xs text-text-secondary truncate w-full text-center">{iconName}</span>
                    </button>
                  ))}
              </div>
            </div>
            <div className="flex justify-end p-4 border-t border-border-primary">
              <button onClick={() => setIsIconPickerOpen(false)} className="px-4 py-2 text-sm font-medium border rounded-md text-text-secondary border-border-secondary hover:bg-bg-tertiary">Fechar</button>
            </div>
          </div>
        </div>
      )}
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
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

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

  const filteredModules = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return modules;
    return modules.filter((module) => {
      const name = (module.name || '').toLowerCase();
      const viewId = (module.view_id || '').toLowerCase();
      const parent = module.parent_id ? modules.find((m) => m.id === module.parent_id)?.name?.toLowerCase() : '';
      return name.includes(term) || viewId.includes(term) || (parent ? parent.includes(term) : false);
    });
  }, [modules, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredModules.length / ITEMS_PER_PAGE));

  useEffect(() => {
    setCurrentPage((prev) => {
      if (prev > totalPages) return totalPages;
      if (prev < 1) return 1;
      return prev;
    });
  }, [totalPages]);

  const paginatedModules = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredModules.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredModules, currentPage]);

  const pageStart = filteredModules.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const pageEnd = filteredModules.length === 0 ? 0 : Math.min(filteredModules.length, (currentPage - 1) * ITEMS_PER_PAGE + paginatedModules.length);

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
    const filteredIds = filteredModules.map((m) => m.id);
    const pageOffset = (currentPage - 1) * ITEMS_PER_PAGE;
    const fromFilteredIndex = pageOffset + result.source.index;
    const toFilteredIndex = pageOffset + result.destination.index;
    if (fromFilteredIndex === toFilteredIndex) return;

    const fromModuleId = filteredIds[fromFilteredIndex];
    const toModuleId = filteredIds[toFilteredIndex];
    if (!fromModuleId || !toModuleId) return;

    const fromIndex = modules.findIndex((m) => m.id === fromModuleId);
    const toIndex = modules.findIndex((m) => m.id === toModuleId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

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
      const payload = newOrder.map((m, idx) => ({ id: m.id, position: idx + 1, parent_id: m.parent_id ?? null }));
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

  const mParentName = (all: Module[], parentId?: string | null) => {
    if (!parentId) return '-';
    const p = all.find(m => m.id === parentId);
    return p ? p.name : '-';
  };


  return (
    <div className="p-6 bg-bg-secondary rounded-lg shadow-md">
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Módulos {isSavingOrder && <span className="ml-2 text-sm text-text-secondary">(salvando...)</span>}</h1>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative max-w-xs w-full sm:w-[260px]">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar módulo"
              className="w-full pl-9 pr-8 py-2 text-sm border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary"
            />
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary">
              <Icon name="search" className="w-4 h-4" />
            </span>
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-bg-tertiary text-text-secondary"
                aria-label="Limpar busca"
              >
                <Icon name="close" className="w-4 h-4" />
              </button>
            )}
          </div>
          <button onClick={() => handleOpenModal()} className="flex items-center px-4 py-2 text-sm font-medium text-white rounded-md bg-accent-primary hover:bg-accent-secondary">
            <Icon name="add" className="w-5 h-5 mr-2" />
            Adicionar Módulo
          </button>
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
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="modules-table">
              {(provided) => (
                <table className="min-w-full divide-y divide-border-primary" ref={provided.innerRef} {...provided.droppableProps}>
                  <thead className="bg-bg-tertiary">
                    <tr>
                      <th className="w-8 px-2 py-2 text-xs font-medium tracking-wider text-left uppercase text-text-secondary"></th>
                      <th scope="col" className="px-6 py-2 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Nome</th>
                      <th scope="col" className="px-6 py-2 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Ícone</th>
                      <th scope="col" className="px-6 py-2 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Pai</th>
                      <th scope="col" className="px-6 py-2 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Perfis</th>
                      <th scope="col" className="px-6 py-2 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Status</th>
                      <th scope="col" className="px-6 py-2 text-xs font-medium tracking-wider text-right uppercase text-text-secondary">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-bg-secondary divide-y divide-border-primary">
                    {filteredModules.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-6 text-center text-sm text-text-secondary">Nenhum módulo encontrado.</td>
                      </tr>
                    )}
                    {paginatedModules.map((module, index) => (
                      <Draggable key={module.id} draggableId={module.id} index={index}>
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
                            <td className="px-6 py-2 whitespace-nowrap text-sm font-medium text-text-primary">{module.name}</td>
                            <td className="px-6 py-2 whitespace-nowrap text-sm text-text-secondary">
                              <Icon name={module.icon} className="w-6 h-6" />
                            </td>
                            <td className="px-6 py-2 whitespace-nowrap text-sm text-text-secondary">
                              {mParentName(modules, module.parent_id)}
                            </td>
                            <td className="px-6 py-2 whitespace-nowrap text-sm text-text-secondary">
                              <div className="flex flex-wrap gap-1">
                                {module.allowed_profiles?.map(profile => (
                                  <span key={profile} className="px-2 py-1 text-xs font-semibold text-white bg-gray-600 rounded-full">
                                    {profile}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-2 whitespace-nowrap text-sm text-text-secondary">
                               <div className="flex items-center space-x-2">
                                  <ToggleSwitch
                                    checked={module.is_active}
                                    onChange={() => handleToggleStatus(module)}
                                  />
                                  <span>{module.is_active ? 'Ativo' : 'Inativo'}</span>
                                </div>
                            </td>
                            <td className="px-6 py-2 text-sm font-medium text-right whitespace-nowrap">
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

      {filteredModules.length > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 mt-4 text-sm text-text-secondary sm:flex-row">
          <span>Mostrando {pageStart}–{pageEnd} de {filteredModules.length}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm font-medium border rounded-md text-text-secondary border-border-secondary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-bg-tertiary"
            >
              Anterior
            </button>
            <span>Página {currentPage} de {totalPages}</span>
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages || filteredModules.length === 0}
              className="px-3 py-1.5 text-sm font-medium border rounded-md text-text-secondary border-border-secondary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-bg-tertiary"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      <ModuleFormModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveModule}
        module={editingModule}
        allModules={modules}
      />
    </div>
  );
};

export default ManageModulesPage;