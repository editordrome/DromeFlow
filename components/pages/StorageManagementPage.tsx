import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { Icon } from '../ui/Icon';
import { storageAnalytics } from '../../services/analytics/storage.service';
import { r2Service } from '../../services/storage/r2.service';
import { d1ImagesService } from '../../services/storage/d1Images.service';
import type { StorageMetrics, StorageAlert, RecentFile, DatabaseMetrics } from '../../services/analytics/storage.service';
import type { ImageMetadata } from '../../services/storage/d1Images.service';

type FilterProvider = 'all' | 'supabase' | 'r2';
type FilterType = 'all' | 'xlsx' | 'pdf' | 'csv' | 'image' | 'backup';

const StorageManagementPage: React.FC = () => {
  const { selectedUnit } = useAppContext();
  const { profile } = useAuth();
  
  const [metrics, setMetrics] = useState<StorageMetrics | null>(null);
  const [alerts, setAlerts] = useState<StorageAlert[]>([]);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [dbMetrics, setDbMetrics] = useState<DatabaseMetrics | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDbDetails, setShowDbDetails] = useState(false);
  const [loadingDbMetrics, setLoadingDbMetrics] = useState(false);
  const [showR2Details, setShowR2Details] = useState(false);
  
  // Gerenciamento de imagens
  const [images, setImages] = useState<ImageMetadata[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFilter, setImageFilter] = useState<string>('all');
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  
  // Filtros
  const [filterProvider, setFilterProvider] = useState<FilterProvider>('all');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Seleção múltipla
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Verifica se é super_admin
  const isSuperAdmin = profile?.role === 'super_admin';

  // Carregar dados
  useEffect(() => {
    loadData();
  }, [selectedUnit]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [metricsData, alertsData, filesData] = await Promise.all([
        storageAnalytics.fetchMetrics(),
        storageAnalytics.generateAlerts(),
        storageAnalytics.fetchRecentFiles(100, isSuperAdmin ? undefined : selectedUnit?.id)
      ]);
      
      setMetrics(metricsData);
      setAlerts(alertsData);
      setRecentFiles(filesData);
    } catch (err) {
      console.error('[Storage Management] Erro ao carregar dados:', err);
      setError('Erro ao carregar dados de storage');
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle detalhes do banco
  const handleToggleDbDetails = async () => {
    // Fechar R2 se estiver aberto
    if (!showDbDetails) {
      setShowR2Details(false);
    }
    
    if (!showDbDetails && !dbMetrics) {
      setLoadingDbMetrics(true);
      try {
        const metrics = await storageAnalytics.fetchDatabaseMetrics();
        setDbMetrics(metrics);
      } catch (err) {
        console.error('[Storage Management] Erro ao carregar métricas do banco:', err);
      } finally {
        setLoadingDbMetrics(false);
      }
    }
    setShowDbDetails(!showDbDetails);
  };

  // Toggle detalhes do R2
  const handleToggleR2Details = async () => {
    // Fechar DB se estiver aberto
    if (!showR2Details) {
      setShowDbDetails(false);
      // Carregar imagens ao abrir R2 details
      await loadImages();
    }
    setShowR2Details(!showR2Details);
  };

  // Carregar imagens do D1
  const loadImages = async () => {
    setLoadingImages(true);
    try {
      const filters = imageFilter === 'all' ? {} : { imageType: imageFilter };
      const imagesList = await d1ImagesService.listImages(filters);
      setImages(imagesList);
    } catch (err) {
      console.error('[Storage Management] Erro ao carregar imagens:', err);
    } finally {
      setLoadingImages(false);
    }
  };

  // Upload de imagem
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione apenas arquivos de imagem');
      return;
    }

    // Validar tamanho (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Imagem muito grande. Tamanho máximo: 5MB');
      return;
    }

    setUploadingImage(true);
    try {
      await d1ImagesService.uploadImage({
        file,
        imageType: imageFilter === 'all' ? 'other' : imageFilter as any,
        unitId: selectedUnit?.id,
        uploadedBy: profile?.id
      });

      // Recarregar lista
      await loadImages();
      alert('Imagem enviada com sucesso!');
      
      // Limpar input
      event.target.value = '';
    } catch (err) {
      console.error('[Storage Management] Erro ao fazer upload:', err);
      alert('Erro ao enviar imagem. Verifique o console para detalhes.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Deletar imagem
  const handleDeleteImage = async (id: string, filename: string) => {
    if (!confirm(`Deseja realmente excluir a imagem "${filename}"?`)) return;

    try {
      await d1ImagesService.deleteImage(id);
      await loadImages();
      alert('Imagem excluída com sucesso!');
    } catch (err) {
      console.error('[Storage Management] Erro ao deletar imagem:', err);
      alert('Erro ao excluir imagem.');
    }
  };

  // Copiar URL da imagem
  const handleCopyImageUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    alert('URL copiada para a área de transferência!');
  };

  // Filtrar arquivos
  const filteredFiles = recentFiles.filter(file => {
    if (filterProvider !== 'all' && file.storage_provider !== filterProvider) return false;
    if (filterType !== 'all' && file.file_type !== filterType) return false;
    if (searchQuery && !file.filename.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Toggle seleção de arquivo
  const toggleFileSelection = (fileId: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
  };

  // Selecionar todos
  const toggleSelectAll = () => {
    if (selectedFiles.size === filteredFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(filteredFiles.map(f => f.id)));
    }
  };

  // Deletar arquivos selecionados
  const handleBulkDelete = async () => {
    if (selectedFiles.size === 0) return;
    
    if (!confirm(`Deseja realmente deletar ${selectedFiles.size} arquivo(s)?`)) return;
    
    setIsDeleting(true);
    try {
      const result = await storageAnalytics.bulkDeleteFiles(Array.from(selectedFiles));
      
      alert(`${result.success} arquivo(s) deletado(s) com sucesso. ${result.failed > 0 ? `${result.failed} falha(s).` : ''}`);
      
      setSelectedFiles(new Set());
      await loadData();
    } catch (err) {
      console.error('[Storage Management] Erro ao deletar arquivos:', err);
      alert('Erro ao deletar arquivos');
    } finally {
      setIsDeleting(false);
    }
  };

  // Download de arquivo
  const handleDownload = async (file: RecentFile) => {
    try {
      if (file.storage_provider === 'r2') {
        const url = await r2Service.getDownloadUrl(file.storage_key, 300);
        window.open(url, '_blank');
      } else {
        // Supabase storage (implementar se necessário)
        alert('Download de arquivos Supabase em desenvolvimento');
      }
    } catch (err) {
      console.error('[Storage Management] Erro ao baixar arquivo:', err);
      alert('Erro ao gerar link de download');
    }
  };

  // Formatar tamanho
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Formatar porcentagem
  const formatPercentage = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  // Cor da barra de progresso
  const getProgressColor = (percentage: number): string => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-brand-cyan';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin">
            <Icon name="Loader2" size={32} className="text-accent-primary" />
          </div>
          <p className="text-text-secondary text-sm">Carregando dados de storage...</p>
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Icon name="AlertCircle" size={48} className="text-red-500 mx-auto mb-3" />
          <p className="text-text-primary font-medium">{error || 'Erro ao carregar dados'}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90 transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-bg-primary">
      <div className="p-6 space-y-6">
        {/* Alertas */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((alert, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border flex items-start gap-3 ${
                  alert.type === 'critical'
                    ? 'bg-red-500/10 border-red-500/30'
                    : alert.type === 'warning'
                    ? 'bg-yellow-500/10 border-yellow-500/30'
                    : 'bg-blue-500/10 border-blue-500/30'
                }`}
              >
                <Icon
                  name={alert.type === 'critical' ? 'AlertTriangle' : alert.type === 'warning' ? 'AlertCircle' : 'Info'}
                  size={20}
                  className={
                    alert.type === 'critical'
                      ? 'text-red-500'
                      : alert.type === 'warning'
                      ? 'text-yellow-500'
                      : 'text-blue-500'
                  }
                />
                <div className="flex-1">
                  <h3 className="font-semibold text-text-primary text-sm">{alert.title}</h3>
                  <p className="text-text-secondary text-xs mt-0.5">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cards de Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card Supabase Database */}
          <button
            onClick={handleToggleDbDetails}
            className="bg-bg-secondary rounded-lg border border-border-primary p-5 hover:bg-bg-tertiary transition-all cursor-pointer text-left w-full"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icon name="Database" size={20} className="text-green-500" />
                <h3 className="font-semibold text-text-primary">Supabase Database</h3>
                <Icon 
                  name={showDbDetails ? "ChevronUp" : "ChevronDown"} 
                  size={16} 
                  className="text-text-secondary ml-1"
                />
              </div>
                            <span className="text-xs text-text-secondary">
                {metrics.supabase_size_mb.toFixed(1)} MB / {metrics.supabase_limit_mb} MB
              </span>
            </div>
            
            {/* Barra de progresso */}
            <div className="mb-3">
              <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                <div
                  className={`h-full ${getProgressColor(metrics.supabase_percentage_used)} transition-all`}
                  style={{ width: `${Math.min(metrics.supabase_percentage_used, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-text-secondary">{formatPercentage(metrics.supabase_percentage_used)} usado</span>
                <span className="text-xs font-medium text-text-primary">Dados estruturados</span>
              </div>
            </div>
          </button>

          {/* Card R2 */}
          <button
            onClick={handleToggleR2Details}
            className="bg-bg-secondary rounded-lg border border-border-primary p-5 hover:bg-bg-tertiary transition-all cursor-pointer text-left w-full"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icon name="Cloud" size={20} className="text-orange-500" />
                <h3 className="font-semibold text-text-primary">Cloudflare R2</h3>
                <Icon 
                  name={showR2Details ? "ChevronUp" : "ChevronDown"} 
                  size={16} 
                  className="text-text-secondary ml-1"
                />
              </div>
              <span className="text-xs text-text-secondary">
                {metrics.r2_size_mb.toFixed(2)} MB / {(metrics.r2_limit_mb / 1024).toFixed(0)} GB
              </span>
            </div>
            
            {/* Barra de progresso */}
            <div className="mb-3">
              <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                <div
                  className={`h-full ${getProgressColor(metrics.r2_percentage_used)} transition-all`}
                  style={{ width: `${Math.min(metrics.r2_percentage_used, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-text-secondary">
                  {metrics.r2_percentage_used.toFixed(2)}% usado
                </span>
                <span className="text-xs font-medium text-text-primary">
                  {metrics.r2_files.toLocaleString('pt-BR')} {metrics.r2_files === 1 ? 'arquivo' : 'arquivos'}
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Métricas Detalhadas do R2 */}
        {showR2Details && metrics && (
          <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
            <div className="p-5 space-y-5">
              {/* Informações Gerais */}
              <div>
                <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                  <Icon name="Cloud" size={18} className="text-orange-500" />
                  Informações Gerais
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="bg-bg-tertiary rounded-lg p-3">
                    <div className="text-xs text-text-secondary mb-1">Total de Arquivos</div>
                    <div className="text-xl font-bold text-text-primary">
                      {metrics.r2_files.toLocaleString('pt-BR')}
                    </div>
                    <div className="text-xs text-text-secondary mt-1">
                      {metrics.r2_files === 0 ? 'Nenhum arquivo' : 'armazenados'}
                    </div>
                  </div>
                  <div className="bg-bg-tertiary rounded-lg p-3">
                    <div className="text-xs text-text-secondary mb-1">Espaço Usado</div>
                    <div className="text-xl font-bold text-text-primary">
                      {metrics.r2_size_mb.toFixed(2)} MB
                    </div>
                    <div className="text-xs text-text-secondary mt-1">
                      de {(metrics.r2_limit_mb / 1024).toFixed(0)} GB disponíveis
                    </div>
                  </div>
                  <div className="bg-bg-tertiary rounded-lg p-3">
                    <div className="text-xs text-text-secondary mb-1">Espaço Livre</div>
                    <div className="text-xl font-bold text-text-primary">
                      {((metrics.r2_limit_mb - metrics.r2_size_mb) / 1024).toFixed(2)} GB
                    </div>
                    <div className="text-xs text-green-500 mt-1">
                      {(100 - metrics.r2_percentage_used).toFixed(1)}% disponível
                    </div>
                  </div>
                  <div className="bg-bg-tertiary rounded-lg p-3">
                    <div className="text-xs text-text-secondary mb-1">Uso Percentual</div>
                    <div className="text-xl font-bold text-text-primary">
                      {metrics.r2_percentage_used.toFixed(2)}%
                    </div>
                    <div className={`text-xs mt-1 ${
                      metrics.r2_percentage_used < 50 ? 'text-green-500' : 
                      metrics.r2_percentage_used < 80 ? 'text-yellow-500' : 'text-red-500'
                    }`}>
                      {metrics.r2_percentage_used < 50 ? 'Baixo uso' : 
                       metrics.r2_percentage_used < 80 ? 'Uso moderado' : 'Uso alto'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Distribuição por Tipo */}
              {metrics.by_type.length > 0 && (
                <div>
                  <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                    <Icon name="FileType" size={18} className="text-orange-500" />
                    Distribuição por Tipo de Arquivo
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {metrics.by_type.map((type, idx) => (
                      <div key={idx} className="bg-bg-tertiary rounded-lg p-3">
                        <div className="text-xs text-text-secondary mb-1">{type.file_type.toUpperCase()}</div>
                        <div className="text-lg font-bold text-text-primary">
                          {type.count} {type.count === 1 ? 'arquivo' : 'arquivos'}
                        </div>
                        <div className="text-xs text-text-secondary mt-1">
                          {type.size_mb.toFixed(2)} MB
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Distribuição por Unidade */}
              {metrics.by_unit.length > 0 && (
                <div>
                  <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                    <Icon name="Building2" size={18} className="text-orange-500" />
                    Distribuição por Unidade
                  </h3>
                  <div className="bg-bg-tertiary rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-bg-primary">
                        <tr>
                          <th className="text-left text-xs font-medium text-text-secondary px-4 py-2">Unidade</th>
                          <th className="text-right text-xs font-medium text-text-secondary px-4 py-2">Arquivos</th>
                          <th className="text-right text-xs font-medium text-text-secondary px-4 py-2">Tamanho</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.by_unit.map((unit, idx) => (
                          <tr key={idx} className="border-t border-border-secondary">
                            <td className="px-4 py-2 text-sm text-text-primary">
                              <div className="font-medium">{unit.unit_name}</div>
                              <div className="text-xs text-text-secondary">{unit.unit_code}</div>
                            </td>
                            <td className="px-4 py-2 text-sm text-text-primary text-right">
                              {unit.count.toLocaleString('pt-BR')}
                            </td>
                            <td className="px-4 py-2 text-sm text-text-primary text-right">
                              {unit.size_mb.toFixed(2)} MB
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Gerenciamento de Imagens */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-text-primary flex items-center gap-2">
                    <Icon name="Image" size={18} className="text-orange-500" />
                    Gerenciamento de Imagens
                  </h3>
                  <div className="flex items-center gap-2">
                    {/* Filtro de tipo */}
                    <select
                      value={imageFilter}
                      onChange={(e) => {
                        setImageFilter(e.target.value);
                        loadImages();
                      }}
                      className="text-xs px-2 py-1 rounded border border-border-secondary bg-bg-tertiary text-text-primary"
                    >
                      <option value="all">Todos os tipos</option>
                      <option value="comercial">Comercial</option>
                      <option value="recrutadora">Recrutadora</option>
                      <option value="profile">Perfil</option>
                      <option value="logo">Logo</option>
                      <option value="banner">Banner</option>
                      <option value="other">Outros</option>
                    </select>

                    {/* Botão Upload */}
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                        className="hidden"
                      />
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                        uploadingImage
                          ? 'bg-bg-tertiary text-text-secondary cursor-not-allowed'
                          : 'bg-accent-primary text-white hover:bg-accent-primary/90'
                      }`}>
                        <Icon name={uploadingImage ? "Loader2" : "Upload"} size={14} className={uploadingImage ? "animate-spin" : ""} />
                        {uploadingImage ? 'Enviando...' : 'Enviar Imagem'}
                      </div>
                    </label>
                  </div>
                </div>

                {/* Lista de Imagens */}
                {loadingImages ? (
                  <div className="py-8 flex items-center justify-center">
                    <Icon name="Loader2" size={24} className="animate-spin text-accent-primary" />
                    <span className="ml-3 text-text-secondary">Carregando imagens...</span>
                  </div>
                ) : images.length === 0 ? (
                  <div className="py-8 text-center text-text-secondary">
                    <Icon name="ImageOff" size={48} className="mx-auto mb-2 opacity-50" />
                    <p>Nenhuma imagem encontrada</p>
                    <p className="text-xs mt-1">Faça upload de uma imagem para começar</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {images.map((image) => (
                      <div
                        key={image.id}
                        className="bg-bg-tertiary rounded-lg overflow-hidden border border-border-secondary hover:border-accent-primary transition-colors"
                      >
                        {/* Preview da Imagem */}
                        <div className="relative aspect-video bg-bg-primary">
                          <img
                            src={image.public_url}
                            alt={image.original_filename}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23333" width="100" height="100"/%3E%3Ctext fill="%23666" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle"%3EError%3C/text%3E%3C/svg%3E';
                            }}
                          />
                          <div className="absolute top-2 right-2">
                            <span className="px-2 py-1 text-xs rounded bg-black/70 text-white">
                              {image.image_type}
                            </span>
                          </div>
                        </div>

                        {/* Informações */}
                        <div className="p-3">
                          <div className="text-sm font-medium text-text-primary truncate mb-1">
                            {image.original_filename}
                          </div>
                          <div className="text-xs text-text-secondary space-y-1">
                            <div className="flex items-center justify-between">
                              <span>Tamanho:</span>
                              <span>{(image.file_size / 1024).toFixed(1)} KB</span>
                            </div>
                            {image.width && image.height && (
                              <div className="flex items-center justify-between">
                                <span>Dimensões:</span>
                                <span>{image.width}x{image.height}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <span>Data:</span>
                              <span>{new Date(image.created_at).toLocaleDateString('pt-BR')}</span>
                            </div>
                          </div>

                          {/* Ações */}
                          <div className="flex items-center gap-2 mt-3">
                            <button
                              onClick={() => handleCopyImageUrl(image.public_url)}
                              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs bg-bg-primary hover:bg-accent-primary hover:text-white transition-colors text-text-secondary"
                              title="Copiar URL"
                            >
                              <Icon name="Link" size={12} />
                              Copiar URL
                            </button>
                            <button
                              onClick={() => window.open(image.public_url, '_blank')}
                              className="px-2 py-1.5 rounded text-xs bg-bg-primary hover:bg-blue-500 hover:text-white transition-colors"
                              title="Abrir em nova aba"
                            >
                              <Icon name="ExternalLink" size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteImage(image.id, image.original_filename)}
                              className="px-2 py-1.5 rounded text-xs bg-bg-primary hover:bg-red-500 hover:text-white transition-colors"
                              title="Excluir"
                            >
                              <Icon name="Trash2" size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Informações sobre limites */}
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Icon name="Info" size={16} className="text-blue-500 mt-0.5" />
                    <div className="text-xs text-text-secondary">
                      <p className="font-medium text-text-primary mb-1">Dicas de Uso:</p>
                      <ul className="space-y-1 list-disc list-inside">
                        <li>Tamanho máximo por imagem: 5 MB</li>
                        <li>Formatos suportados: JPG, PNG, GIF, WebP</li>
                        <li>Clique em "Copiar URL" para usar a imagem no sistema</li>
                        <li>Imagens são armazenadas no Cloudflare R2 (grátis até 10 GB)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Métricas Detalhadas do Banco de Dados */}
        {showDbDetails && (
          <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
            {loadingDbMetrics ? (
              <div className="p-8 flex items-center justify-center">
                <Icon name="Loader2" size={24} className="animate-spin text-accent-primary" />
                <span className="ml-3 text-text-secondary">Carregando métricas...</span>
              </div>
            ) : dbMetrics ? (
              <div className="p-5 space-y-5">
                {/* Informações Gerais + Storage Breakdown */}
                <div>
                  <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                    <Icon name="Info" size={18} />
                    Informações Gerais
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div className="bg-bg-tertiary rounded-lg p-3">
                      <div className="text-xs text-text-secondary mb-1">Conexões Ativas</div>
                      <div className="text-xl font-bold text-text-primary">
                        {dbMetrics.active_connections} / {dbMetrics.max_connections}
                      </div>
                    </div>
                    <div className="bg-bg-tertiary rounded-lg p-3">
                      <div className="text-xs text-text-secondary mb-1">Cache Hit Ratio</div>
                      <div className="text-xl font-bold text-text-primary">{dbMetrics.cache_hit_ratio.toFixed(1)}%</div>
                    </div>
                    <div className="bg-bg-tertiary rounded-lg p-3">
                      <div className="text-xs text-text-secondary mb-1">Transações</div>
                      <div className="text-xl font-bold text-text-primary">
                        {dbMetrics.transactions_committed.toLocaleString('pt-BR')}
                      </div>
                      <div className="text-xs text-text-secondary mt-1 flex items-center justify-between">
                        <span className="text-red-500">
                          {dbMetrics.transactions_rolled_back.toLocaleString('pt-BR')} rollbacks
                        </span>
                        <span className="text-green-500">
                          {((dbMetrics.transactions_committed / (dbMetrics.transactions_committed + dbMetrics.transactions_rolled_back)) * 100).toFixed(1)}% ok
                        </span>
                      </div>
                    </div>
                    <div className="bg-bg-tertiary rounded-lg p-3">
                      <div className="text-xs text-text-secondary mb-1">Tabelas</div>
                      <div className="text-lg font-bold text-text-primary">
                        {dbMetrics.tables_size_mb.toFixed(2)} MB
                      </div>
                      <div className="text-xs text-text-secondary">
                        {((dbMetrics.tables_size_mb / dbMetrics.total_size_mb) * 100).toFixed(1)}% do total
                      </div>
                    </div>
                    <div className="bg-bg-tertiary rounded-lg p-3">
                      <div className="text-xs text-text-secondary mb-1">Índices</div>
                      <div className="text-lg font-bold text-text-primary">
                        {dbMetrics.indexes_size_mb.toFixed(2)} MB
                      </div>
                      <div className="text-xs text-text-secondary">
                        {((dbMetrics.indexes_size_mb / dbMetrics.total_size_mb) * 100).toFixed(1)}% do total
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top Tabelas */}
                {dbMetrics.tables.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                      <Icon name="Table" size={18} />
                      Top 10 Tabelas por Tamanho
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-bg-tertiary">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary uppercase">Tabela</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-text-secondary uppercase">Registros</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-text-secondary uppercase">Tabela</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-text-secondary uppercase">Índices</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-text-secondary uppercase">Total</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-text-secondary uppercase">Última Atualização</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-secondary">
                          {dbMetrics.tables.slice(0, 10).map((table, idx) => {
                            const lastUpdate = table.last_update ? new Date(table.last_update) : null;
                            return (
                              <tr key={idx} className="hover:bg-bg-tertiary transition-colors">
                                <td className="px-4 py-2 text-sm font-medium text-text-primary">{table.table_name}</td>
                                <td className="px-4 py-2 text-sm text-text-secondary text-right">
                                  {table.row_count.toLocaleString()}
                                </td>
                                <td className="px-4 py-2 text-sm text-text-secondary text-right">
                                  {table.table_size_mb.toFixed(2)} MB
                                </td>
                                <td className="px-4 py-2 text-sm text-text-secondary text-right">
                                  {table.indexes_size_mb.toFixed(2)} MB
                                </td>
                                <td className="px-4 py-2 text-sm font-semibold text-text-primary text-right">
                                  {table.total_size_mb.toFixed(2)} MB
                                </td>
                                <td className="px-4 py-2 text-sm text-text-secondary text-right">
                                  {lastUpdate ? (
                                    <>
                                      <div>{lastUpdate.toLocaleDateString('pt-BR')}</div>
                                      <div className="text-xs">{lastUpdate.toLocaleTimeString('pt-BR')}</div>
                                    </>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-text-secondary">
                Erro ao carregar métricas do banco de dados
              </div>
            )}
          </div>
        )}

        {/* Distribuição por Tipo de Arquivo - R2 */}
        {metrics.by_type.length > 0 && (
          <div className="bg-bg-secondary rounded-lg border border-border-primary p-5">
            <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Icon name="Cloud" size={18} className="text-orange-500" />
              Cloudflare R2 - Distribuição por Tipo de Arquivo
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {metrics.by_type.map(type => (
                <div key={type.file_type} className="bg-bg-tertiary rounded-lg p-3">
                  <div className="text-xs text-text-secondary uppercase mb-1">{type.file_type}</div>
                  <div className="text-lg font-bold text-text-primary">{type.count}</div>
                  <div className="text-xs text-text-secondary">{formatSize(type.size_mb * 1024 * 1024)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Distribuição por Unidade - R2 */}
        {isSuperAdmin && metrics.by_unit.length > 0 && (
          <div className="bg-bg-secondary rounded-lg border border-border-primary p-5">
            <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Icon name="Cloud" size={18} className="text-orange-500" />
              Cloudflare R2 - Distribuição por Unidade
            </h3>
            <div className="space-y-2">
              {metrics.by_unit.slice(0, 10).map(unit => (
                <div key={unit.unit_id} className="flex items-center justify-between p-2 bg-bg-tertiary rounded">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-text-primary">{unit.unit_name}</div>
                    <div className="text-xs text-text-secondary">{unit.unit_code}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-text-primary">{unit.count} arquivos</div>
                    <div className="text-xs text-text-secondary">{formatSize(unit.size_mb * 1024 * 1024)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lista de Arquivos - R2 */}
        {filteredFiles.length > 0 && (
          <div className="bg-bg-secondary rounded-lg border border-border-primary">
            {/* Header com filtros */}
            <div className="p-5 border-b border-border-secondary">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-text-primary flex items-center gap-2">
                  <Icon name="Cloud" size={18} className="text-orange-500" />
                  Cloudflare R2 - Arquivos Recentes ({filteredFiles.length})
                </h3>
                {selectedFiles.size > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    disabled={isDeleting}
                    className="px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isDeleting ? (
                      <>
                        <Icon name="Loader2" size={14} className="animate-spin" />
                        Deletando...
                      </>
                    ) : (
                      <>
                        <Icon name="Trash2" size={14} />
                        Deletar ({selectedFiles.size})
                      </>
                    )}
                  </button>
                )}
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-3">
              {/* Busca */}
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Buscar por nome..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-sm focus:outline-none focus:border-accent-primary"
                />
              </div>

              {/* Provider */}
              <select
                value={filterProvider}
                onChange={(e) => setFilterProvider(e.target.value as FilterProvider)}
                className="px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-sm focus:outline-none focus:border-accent-primary"
              >
                <option value="all">Todos os providers</option>
                <option value="supabase">Supabase</option>
                <option value="r2">Cloudflare R2</option>
              </select>

              {/* Tipo */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FilterType)}
                className="px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-sm focus:outline-none focus:border-accent-primary"
              >
                <option value="all">Todos os tipos</option>
                <option value="xlsx">XLSX</option>
                <option value="pdf">PDF</option>
                <option value="csv">CSV</option>
                <option value="image">Imagem</option>
                <option value="backup">Backup</option>
              </select>
            </div>
          </div>

          {/* Tabela */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-bg-tertiary">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedFiles.size === filteredFiles.length && filteredFiles.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Arquivo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Provider</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Tamanho</th>
                  {isSuperAdmin && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Unidade</th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Upload</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-secondary">
                {filteredFiles.length === 0 ? (
                  <tr>
                    <td colSpan={isSuperAdmin ? 8 : 7} className="px-4 py-8 text-center text-text-secondary">
                      Nenhum arquivo encontrado
                    </td>
                  </tr>
                ) : (
                  filteredFiles.map(file => (
                    <tr key={file.id} className="hover:bg-bg-tertiary transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedFiles.has(file.id)}
                          onChange={() => toggleFileSelection(file.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-text-primary truncate max-w-xs" title={file.filename}>
                          {file.filename}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-accent-primary/10 text-accent-primary text-xs rounded uppercase">
                          {file.file_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded ${
                          file.storage_provider === 'r2'
                            ? 'bg-orange-500/10 text-orange-500'
                            : 'bg-green-500/10 text-green-500'
                        }`}>
                          {file.storage_provider === 'r2' ? 'R2' : 'Supabase'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {formatSize(file.file_size)}
                      </td>
                      {isSuperAdmin && (
                        <td className="px-4 py-3 text-sm text-text-secondary">
                          {file.unit_name || '-'}
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {new Date(file.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDownload(file)}
                          className="p-1.5 rounded hover:bg-bg-primary transition-colors"
                          title="Download"
                        >
                          <Icon name="Download" size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StorageManagementPage;
