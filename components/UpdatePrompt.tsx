import { useEffect, useState } from 'react';
import { RefreshCw, X, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getActiveVersion,
  checkUserUpdate,
  recordUserUpdate,
  type AppVersion,
} from '@/services/versions/versions.service';

/**
 * Componente que exibe notificação quando há uma nova versão disponível
 * Integrado com sistema de gerenciamento de versões do banco de dados
 */
export const UpdatePrompt = () => {
  const { profile } = useAuth();
  const [version, setVersion] = useState<AppVersion | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }

    console.log('[UpdatePrompt] Componente montado para usuário:', profile.id);
    checkForUpdates();

    // Verifica atualizações a cada 5 minutos
    const interval = setInterval(() => {
      console.log('[UpdatePrompt] Verificação periódica de atualizações');
      checkForUpdates();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [profile]);

  const checkForUpdates = async () => {
    if (!profile) return;

    try {
      console.log('[UpdatePrompt] Verificando versão ativa...');

      // Busca versão ativa mais recente
      const activeVersion = await getActiveVersion();

      if (!activeVersion) {
        console.log('[UpdatePrompt] Nenhuma versão ativa encontrada');
        setLoading(false);
        return;
      }

      console.log('[UpdatePrompt] Versão ativa encontrada:', activeVersion.version);

      // Verifica se usuário já atualizou
      const userUpdate = await checkUserUpdate(profile.id, activeVersion.id!);

      if (!userUpdate) {
        // Usuário nunca viu esta versão
        console.log('[UpdatePrompt] ✅ Nova versão disponível para o usuário!');
        setVersion(activeVersion);
      } else if (userUpdate.dismissed && activeVersion.is_mandatory) {
        // Versão obrigatória que foi dispensada - mostra novamente
        console.log('[UpdatePrompt] ⚠️ Versão obrigatória foi dispensada, mostrando novamente');
        setVersion(activeVersion);
      } else if (!userUpdate.dismissed) {
        // Usuário já atualizou
        console.log('[UpdatePrompt] Usuário já atualizou para esta versão');
      } else {
        // Usuário dispensou versão não-obrigatória
        console.log('[UpdatePrompt] Usuário dispensou esta versão');
      }
    } catch (error) {
      console.error('[UpdatePrompt] Erro ao verificar atualizações:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!version || !profile) return;

    try {
      console.log('[UpdatePrompt] Registrando atualização...');

      // Registra que usuário atualizou
      await recordUserUpdate(profile.id, version.id!, false);

      console.log('[UpdatePrompt] Atualização registrada, recarregando página...');

      // Recarrega página para aplicar nova versão
      window.location.reload();
    } catch (error) {
      console.error('[UpdatePrompt] Erro ao registrar atualização:', error);
    }
  };

  const handleDismiss = async () => {
    if (!version || !profile) return;

    // Não permite dispensar versões obrigatórias
    if (version.is_mandatory) {
      console.log('[UpdatePrompt] Tentativa de dispensar versão obrigatória bloqueada');
      return;
    }

    try {
      console.log('[UpdatePrompt] Dispensando notificação...');

      // Registra que usuário dispensou
      await recordUserUpdate(profile.id, version.id!, true);

      setDismissed(true);
      console.log('[UpdatePrompt] Notificação dispensada');
    } catch (error) {
      console.error('[UpdatePrompt] Erro ao dispensar:', error);
    }
  };

  // Não mostra enquanto carrega
  if (loading) return null;

  // Não mostra se não há versão ou foi dispensado
  if (!version || dismissed) return null;

  console.log('[UpdatePrompt] 🎨 Renderizando toast para versão:', version.version);

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md animate-slide-up">
      <div className="bg-gradient-to-r from-accent-primary to-brand-cyan rounded-lg shadow-2xl p-4 border border-white/20 backdrop-blur-sm">
        <div className="flex items-start gap-3">
          {/* Ícone */}
          <div className="p-2 bg-white/10 rounded-lg flex-shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>

          {/* Conteúdo */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-white font-bold text-sm">{version.title}</h3>
              <span className="px-2 py-0.5 bg-white/20 text-white text-xs rounded-full font-medium">
                v{version.version}
              </span>
              {version.is_mandatory && (
                <span className="px-2 py-0.5 bg-red-500/80 text-white text-xs rounded-full font-medium">
                  Obrigatória
                </span>
              )}
            </div>
            <p className="text-white/90 text-xs mb-3 leading-relaxed">
              {version.message}
            </p>

            {/* Botões */}
            <div className="flex gap-2">
              <button
                onClick={handleUpdate}
                className="px-3 py-1.5 bg-white text-accent-primary rounded-lg text-xs font-medium hover:bg-white/90 transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Atualizar Agora
              </button>
              {!version.is_mandatory && (
                <button
                  onClick={handleDismiss}
                  className="px-3 py-1.5 bg-white/10 text-white rounded-lg text-xs font-medium hover:bg-white/20 transition-colors"
                >
                  Depois
                </button>
              )}
            </div>
          </div>

          {/* Botão Fechar (apenas se não for obrigatório) */}
          {!version.is_mandatory && (
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0"
              aria-label="Fechar notificação"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
