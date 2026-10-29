import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { WhatsAppConnection, WhatsAppConnectionType, Unit } from '../../types';
import { WhatsAppCloudService } from '../../services/integration/whatsappCloud.service';

interface WhatsAppConnectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUnit: Unit | any | null;
}

const WhatsAppConnectionsModal: React.FC<WhatsAppConnectionsModalProps> = ({ isOpen, onClose, selectedUnit }) => {
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectingType, setConnectingType] = useState<WhatsAppConnectionType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && selectedUnit && selectedUnit.id !== 'ALL') {
      loadConnections();
    }
  }, [isOpen, selectedUnit]);

  const loadConnections = async () => {
    if (!selectedUnit || selectedUnit.id === 'ALL') return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await WhatsAppCloudService.getConnections(selectedUnit.id);
      setConnections(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar conexões.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async (type: WhatsAppConnectionType) => {
    if (!selectedUnit || selectedUnit.id === 'ALL') {
      alert("Selecione uma unidade específica para configurar o WhatsApp.");
      return;
    }
    
    try {
      setError(null);
      setConnectingType(type);
      
      const authResponse = await WhatsAppCloudService.login();
      await WhatsAppCloudService.saveConnection(selectedUnit.id, type, authResponse);
      await loadConnections();
      
    } catch (e: any) {
      console.error('[WhatsApp Connections] handleConnect:', e);
      setError(e.message || 'Erro ao conectar-se à Meta.');
    } finally {
      setConnectingType(null);
    }
  };

  const handleDisconnect = async (connId: string) => {
    if (!window.confirm('Tem certeza que deseja desconectar este WhatsApp da Unidade? A operação deixará de funcionar imediatamente.')) return;
    
    try {
      await WhatsAppCloudService.disconnect(connId);
      // Recarrega a lista
      await loadConnections();
    } catch (err: any) {
      alert(`Falha ao desconectar: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  // Render Card para um tipo específico
  const renderCard = (type: WhatsAppConnectionType, title: string, description: string) => {
    const conn = connections.find(c => c.connection_type === type);
    
    return (
      <div className="bg-bg-tertiary border border-border-secondary rounded-lg p-5 flex flex-col h-full">
        <h3 className="text-lg font-bold text-text-primary flex items-center gap-2 mb-2">
          <Icon name="Smartphone" className="w-5 h-5 text-accent-primary" />
          {title}
        </h3>
        <p className="text-xs text-text-secondary leading-relaxed mb-6 flex-1">
          {description}
        </p>

        <div className="mt-auto">
          {(isLoading || connectingType === type) ? (
            <div className="animate-pulse flex items-center gap-2 text-text-muted">
              <div className="w-4 h-4 border-2 border-t-2 border-border-secondary rounded-full animate-spin border-t-text-secondary"></div>
              <span className="text-xs">Verificando...</span>
            </div>
          ) : conn ? (
             <div className="bg-success/10 border border-success/30 rounded-md p-3 flex flex-col">
               <div className="flex items-center gap-2 mb-2">
                 <div className="w-2.5 h-2.5 bg-success rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                 <span className="text-sm font-semibold text-success">Conectado</span>
               </div>
               
               <div className="space-y-1 mb-4 text-xs font-medium text-text-secondary break-all">
                 <p><strong className="text-text-primary">WABA ID:</strong> {conn.waba_id}</p>
                 {conn.phone_number && <p><strong className="text-text-primary">Telefone:</strong> {conn.phone_number}</p>}
               </div>
               
               <button 
                 onClick={() => handleDisconnect(conn.id)}
                 className="w-full flex items-center justify-center gap-2 bg-transparent hover:bg-danger/10 border border-danger/50 hover:border-danger text-danger font-medium rounded-md py-2 px-4 transition-all duration-200 text-sm"
               >
                 <Icon name="Unplug" className="w-4 h-4" /> Desconectar
               </button>
             </div>
          ) : (
            <div className="flex flex-col">
               <div className="flex items-center gap-2 mb-4">
                 <div className="w-2.5 h-2.5 bg-gray-500 rounded-full"></div>
                 <span className="text-sm font-semibold text-gray-400">Não Configurado</span>
               </div>
               
               <button 
                 onClick={() => handleConnect(type)}
                 className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] border-none text-white font-medium rounded-md py-2 px-4 transition-all duration-200 text-sm"
               >
                 <Icon name="MessageCircle" className="w-4 h-4 fill-current" /> Conectar WhatsApp
               </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 overflow-y-auto" aria-modal="true" role="dialog" onClick={onClose}>
      <div 
        className="w-full max-w-2xl p-6 mx-4 bg-bg-secondary rounded-lg shadow-lg my-8" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-border-primary">
            <div className="flex items-center gap-2">
                <Icon name="MessageCircle" className="w-6 h-6 text-accent-primary" />
                <h2 className="text-xl font-bold text-text-primary">Conexão WhatsApp Cloud</h2>
            </div>
            <button onClick={onClose} className="p-1 rounded-full text-text-secondary hover:bg-bg-tertiary">
                <Icon name="close" />
            </button>
        </div>

        <div className="mt-6">
          {(!selectedUnit || selectedUnit.id === 'ALL') ? (
             <div className="text-center py-10 bg-bg-tertiary rounded-lg border border-border-secondary">
               <Icon name="Building" className="w-12 h-12 text-text-muted mx-auto mb-4" />
               <p className="text-text-secondary">Você está na visão agregada.<br/> Selecione uma unidade específica no topo da tela para configurar sua conexão do WhatsApp.</p>
             </div>
          ) : (
            <>
              <p className="text-sm text-text-secondary mb-6">
                 Configuração da Meta API para a unidade: <strong className="text-text-primary">{selectedUnit.unit_name}</strong>
              </p>

              {error && (
                <div className="mb-6 bg-danger/10 border border-danger/30 text-danger px-4 py-3 rounded-md flex items-start gap-3 text-sm">
                   <Icon name="alert-circle" className="w-5 h-5 flex-shrink-0 mt-0.5" />
                   <div>{error}</div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {/* Card COMERCIAL */}
                 {renderCard(
                   'comercial', 
                   'Linha Comercial', 
                   'Foco em Vendas e Captação de Clientes.'
                 )}
                 
                 {/* Card PROFISSIONAIS */}
                 {renderCard(
                   'profissionais', 
                   'Linha Profissionais', 
                   'Foco em Recrutamento e Relacionamento.'
                 )}
              </div>
            </>
          )}

          <div className="flex justify-end pt-6 mt-6 border-t border-border-primary">
              <button 
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium border rounded-md text-text-secondary border-border-secondary hover:bg-bg-tertiary"
              >
                Fechar
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppConnectionsModal;
