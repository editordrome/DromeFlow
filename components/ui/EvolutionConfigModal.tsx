import { useState, useEffect } from 'react';
import { Icon } from './Icon';
import type { EvolutionConfig } from '../../services/evolution/config.service';
import {
  fetchEvolutionConfig,
  saveEvolutionConfig,
  testEvolutionConnection,
} from '../../services/evolution/config.service';

interface EvolutionConfigModalProps {
  unitId: string;
  unitName: string;
  onClose: () => void;
  onSave: () => void;
}

export function EvolutionConfigModal({
  unitId,
  unitName,
  onClose,
  onSave,
}: EvolutionConfigModalProps) {
  const [config, setConfig] = useState<EvolutionConfig>({
    api_url: 'https://api.evolution-api.com',
    api_key: '',
    global_webhook_url: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    loadConfig();
  }, [unitId]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const existingConfig = await fetchEvolutionConfig(unitId);
      if (existingConfig) {
        setConfig(existingConfig);
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    if (!config.api_url || !config.api_key) {
      setTestResult({
        type: 'error',
        message: 'Preencha URL da API e API Key antes de testar',
      });
      return;
    }

    try {
      setTesting(true);
      setTestResult(null);

      const result = await testEvolutionConnection(config.api_url, config.api_key);

      setTestResult({
        type: result.success ? 'success' : 'error',
        message: result.message,
      });
    } catch (error: any) {
      setTestResult({
        type: 'error',
        message: error.message || 'Erro ao testar conexão',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!config.api_url || !config.api_key) {
      alert('Preencha URL da API e API Key');
      return;
    }

    try {
      setSaving(true);
      await saveEvolutionConfig(unitId, config);
      onSave();
      onClose();
    } catch (error: any) {
      alert(`Erro ao salvar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-2xl w-full p-6">
          <div className="text-center text-gray-500">Carregando configuração...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Configuração Evolution API
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Unidade: {unitName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <Icon name="X" className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="space-y-6">
            {/* Info Alert */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-3">
                <Icon name="Info" className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Sobre esta configuração</p>
                  <p>
                    Configure as credenciais do seu servidor Evolution API para gerenciar
                    instâncias de WhatsApp desta unidade. Você pode usar o servidor oficial
                    ou seu servidor self-hosted.
                  </p>
                </div>
              </div>
            </div>

            {/* URL da API */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                URL da Evolution API *
              </label>
              <input
                type="url"
                value={config.api_url}
                onChange={(e) => setConfig({ ...config, api_url: e.target.value })}
                placeholder="https://api.evolution-api.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                URL base do servidor Evolution API (sem barra no final)
              </p>
            </div>

            {/* API Key */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key (Global Key) *
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={config.api_key}
                  onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                  placeholder="Digite a API Key global do servidor"
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <Icon name={showApiKey ? 'EyeOff' : 'Eye'} className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Chave de autenticação global do servidor Evolution (definida na variável AUTHENTICATION_API_KEY)
              </p>
            </div>

            {/* Webhook Global (Opcional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Webhook URL Global (Opcional)
              </label>
              <input
                type="url"
                value={config.global_webhook_url || ''}
                onChange={(e) =>
                  setConfig({ ...config, global_webhook_url: e.target.value })
                }
                placeholder="https://seu-dominio.com/webhook/evolution"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                URL que receberá eventos das instâncias (pode ser configurada individualmente)
              </p>
            </div>

            {/* Botão de Teste */}
            <div>
              <button
                onClick={handleTest}
                disabled={testing || !config.api_url || !config.api_key}
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Icon
                  name={testing ? 'Loader2' : 'Zap'}
                  className={testing ? 'animate-spin' : ''}
                />
                {testing ? 'Testando conexão...' : 'Testar Conexão'}
              </button>
            </div>

            {/* Resultado do Teste */}
            {testResult && (
              <div
                className={`rounded-lg p-4 ${
                  testResult.type === 'success'
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <div className="flex gap-3">
                  <Icon
                    name={testResult.type === 'success' ? 'CheckCircle' : 'AlertCircle'}
                    className={`w-5 h-5 flex-shrink-0 ${
                      testResult.type === 'success' ? 'text-green-600' : 'text-red-600'
                    }`}
                  />
                  <p
                    className={`text-sm ${
                      testResult.type === 'success' ? 'text-green-800' : 'text-red-800'
                    }`}
                  >
                    {testResult.message}
                  </p>
                </div>
              </div>
            )}

            {/* Documentação */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                <Icon name="BookOpen" className="w-4 h-4" />
                Como obter as credenciais?
              </h3>
              <ul className="text-xs text-gray-600 space-y-1 ml-6 list-disc">
                <li>
                  <strong>Servidor Cloud:</strong> Acesse o painel da Evolution API e copie a API Key global
                </li>
                <li>
                  <strong>Self-hosted:</strong> A API Key está definida na variável de ambiente{' '}
                  <code className="bg-gray-200 px-1 rounded">AUTHENTICATION_API_KEY</code> do seu servidor
                </li>
                <li>
                  Documentação oficial:{' '}
                  <a
                    href="https://doc.evolution-api.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    doc.evolution-api.com
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !config.api_url || !config.api_key}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Icon name={saving ? 'Loader2' : 'Save'} className={saving ? 'animate-spin' : ''} />
              {saving ? 'Salvando...' : 'Salvar Configuração'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
