import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  fetchAllAccessCredentials, 
  createAccessCredential, 
  updateAccessCredential, 
  deleteAccessCredential 
} from '../../services/access/accessCredentials.service';
import { AccessCredential, AccessCredentialType } from '../../types';
import { Icon } from '../ui/Icon';

type CredentialDataPayload = Partial<AccessCredential>;

const CredentialFormModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (credential: CredentialDataPayload) => void;
  credential: AccessCredential | null;
}> = ({ isOpen, onClose, onSave, credential }) => {
  const [formData, setFormData] = useState({
    name: '',
    type: 'LINK' as AccessCredentialType,
    value: '',
    description: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (credential) {
      setFormData({
        name: credential.name,
        type: credential.type,
        value: credential.value,
        description: credential.description || '',
      });
    } else {
      setFormData({
        name: '',
        type: 'LINK' as AccessCredentialType,
        value: '',
        description: '',
      });
    }
    setError('');
  }, [credential, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value as AccessCredentialType }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.type || !formData.value) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    const dataToSave: CredentialDataPayload = { ...formData };
    if (credential) {
      dataToSave.id = credential.id;
    }
    onSave(dataToSave);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true" role="dialog">
      <div className="w-full max-w-lg p-6 mx-4 bg-bg-secondary rounded-lg shadow-lg">
        <div className="flex items-center justify-between pb-3 border-b border-border-primary">
          <h2 className="text-xl font-bold text-text-primary">{credential ? 'Editar Acesso' : 'Adicionar Novo Acesso'}</h2>
          <button onClick={onClose} className="p-1 rounded-full text-text-secondary hover:bg-bg-tertiary">
            <Icon name="close" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && <p className="text-sm text-center text-danger bg-danger/10 p-2 rounded-md">{error}</p>}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-text-secondary">Nome</label>
            <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
          </div>
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-text-secondary">Tipo</label>
            <select name="type" id="type" value={formData.type} onChange={handleChange} className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary">
              <option value="LINK">Link</option>
              <option value="API_KEY">Chave de API</option>
              <option value="TOKEN">Token</option>
            </select>
          </div>
          <div>
            <label htmlFor="value" className="block text-sm font-medium text-text-secondary">Valor</label>
            <textarea name="value" id="value" value={formData.value} onChange={handleChange} rows={3} required className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary font-mono" />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-text-secondary">Descrição</label>
            <textarea name="description" id="description" value={formData.description} onChange={handleChange} rows={2} className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary" />
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

const ValueCell: React.FC<{ value: string }> = ({ value }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [copySuccess, setCopySuccess] = useState('');

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopySuccess('Copiado!');
            setTimeout(() => setCopySuccess(''), 2000);
        } catch (err) {
            setCopySuccess('Falha ao copiar');
            setTimeout(() => setCopySuccess(''), 2000);
        }
    };
    
    const maskedValue = value.length > 8 ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}` : '••••••••';

    return (
        <div className="flex items-center gap-2 font-mono text-sm">
            <span className="truncate">{isVisible ? value : maskedValue}</span>
            <button onClick={() => setIsVisible(!isVisible)} className="text-text-secondary hover:text-text-primary" title={isVisible ? 'Ocultar' : 'Mostrar'}>
                <Icon name={isVisible ? 'eye-off' : 'eye'} className="w-4 h-4" />
            </button>
            <button onClick={copyToClipboard} className="text-text-secondary hover:text-text-primary" title="Copiar">
                {copySuccess ? <span className="text-xs text-success">{copySuccess}</span> : <Icon name="copy" className="w-4 h-4" />}
            </button>
        </div>
    );
};

const ManageAccessPage: React.FC = () => {
  const [credentials, setCredentials] = useState<AccessCredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCredential, setEditingCredential] = useState<AccessCredential | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const loadCredentials = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedCredentials = await fetchAllAccessCredentials();
      setCredentials(fetchedCredentials);
    } catch (err: any) {
      setError('Falha ao carregar credenciais de acesso.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);

  // Resetar página ao alterar busca
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const filteredCredentials = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return credentials;
    return credentials.filter((c) => {
      const t = [
        c.name,
        c.type,
        c.description ?? '',
        c.value ?? '',
      ].join(' ').toLowerCase();
      return t.includes(q);
    });
  }, [credentials, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredCredentials.length / ITEMS_PER_PAGE));
  const pageIndex = Math.min(currentPage, totalPages) - 1;
  const start = pageIndex * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const paginatedCredentials = filteredCredentials.slice(start, end);

  const handleOpenModal = (credential: AccessCredential | null = null) => {
    setEditingCredential(credential);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCredential(null);
  };

  const handleSaveCredential = async (data: CredentialDataPayload) => {
    try {
      if (editingCredential) {
        await updateAccessCredential(editingCredential.id, data);
      } else {
        await createAccessCredential(data);
      }
      handleCloseModal();
      await loadCredentials();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  const handleDeleteCredential = async (credentialId: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta credencial?')) {
      try {
        await deleteAccessCredential(credentialId);
        await loadCredentials();
      } catch (err: any) {
        alert(`Erro: ${err.message}`);
      }
    }
  };

  return (
    <div className="p-6 bg-bg-secondary rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-6 gap-3">
        <h1 className="text-2xl font-bold text-text-primary">Gerenciar Acessos</h1>
        <div className="flex items-center gap-2 ml-auto">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-text-secondary">
              <Icon name="search" className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e)=>setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, tipo, descrição ou valor"
              className="w-80 pl-8 pr-8 py-2 text-sm border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={()=>setSearchTerm('')}
                className="absolute inset-y-0 right-2 flex items-center text-text-secondary hover:text-text-primary"
                aria-label="Limpar busca"
                title="Limpar"
              >
                <Icon name="close" className="w-4 h-4" />
              </button>
            )}
          </div>
          <button onClick={() => handleOpenModal()} className="flex items-center px-4 py-2 text-sm font-medium text-white rounded-md bg-accent-primary hover:bg-accent-secondary">
            <Icon name="add" className="w-5 h-5 mr-2" />
            Adicionar Acesso
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
          <table className="min-w-full divide-y divide-border-primary">
            <thead className="bg-bg-tertiary">
              <tr>
                <th scope="col" className="px-6 py-2 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Nome</th>
                <th scope="col" className="px-6 py-2 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Tipo</th>
                <th scope="col" className="px-6 py-2 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Valor</th>
                <th scope="col" className="px-6 py-2 text-xs font-medium tracking-wider text-left uppercase text-text-secondary">Descrição</th>
                <th scope="col" className="px-6 py-2 text-xs font-medium tracking-wider text-right uppercase text-text-secondary">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-bg-secondary divide-y divide-border-primary">
              {paginatedCredentials.length === 0 && (
                <tr>
                  <td className="px-6 py-4 text-sm text-text-secondary" colSpan={5}>Nenhum acesso encontrado.</td>
                </tr>
              )}
              {paginatedCredentials.map((cred) => (
                <tr 
                  key={cred.id}
                  onDoubleClick={() => handleOpenModal(cred)}
                  className="transition-colors cursor-pointer hover:bg-bg-tertiary"
                >
                  <td className="px-6 py-2 whitespace-nowrap text-sm font-medium text-text-primary">{cred.name}</td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-text-secondary">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        cred.type === 'API_KEY' ? 'bg-blue-100 text-blue-800' :
                        cred.type === 'TOKEN' ? 'bg-purple-100 text-purple-800' :
                        'bg-green-100 text-green-800'
                    }`}>
                        {cred.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-text-secondary">
                    <ValueCell value={cred.value} />
                  </td>
                   <td className="px-6 py-2 text-sm text-text-secondary max-w-xs truncate">{cred.description}</td>
                  <td className="px-6 py-2 text-sm font-medium text-right whitespace-nowrap">
                    <div className="flex items-center justify-end space-x-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleOpenModal(cred); }} 
                        className="p-2 rounded-md text-accent-primary hover:bg-accent-primary/10 transition-colors"
                        title="Editar Acesso"
                      >
                        <Icon name="edit" className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteCredential(cred.id); }} 
                        className="p-2 rounded-md text-danger hover:bg-danger/10 transition-colors"
                        title="Excluir Acesso"
                      >
                        <Icon name="delete" className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Paginação */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-text-secondary">
              Mostrando {filteredCredentials.length === 0 ? 0 : start + 1}–{Math.min(end, filteredCredentials.length)} de {filteredCredentials.length}
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

      <CredentialFormModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveCredential}
        credential={editingCredential}
      />
    </div>
  );
};

export default ManageAccessPage;