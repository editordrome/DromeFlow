import React, { useState } from 'react';
import { edgeImageUploadService, type ImageUploadResult } from '../../services/storage/edgeImageUpload.service';
import { Icon } from '../ui/Icon';

const SimpleImageUploadTest: React.FC = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<ImageUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<ImageUploadResult[]>([]);

  // Carregar imagens do localStorage
  React.useEffect(() => {
    setImages(edgeImageUploadService.listUploadedImages());
  }, []);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setUploadedImage(null);

    try {
      console.log('Fazendo upload de:', file.name);
      
      const result = await edgeImageUploadService.uploadImage(file);
      
      setUploadedImage(result);
      edgeImageUploadService.saveImageMetadata(result);
      setImages(edgeImageUploadService.listUploadedImages());
      
      console.log('Upload concluído!', result);
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer upload');
      console.error('Erro:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (id: string) => {
    edgeImageUploadService.deleteImageMetadata(id);
    setImages(edgeImageUploadService.listUploadedImages());
    if (uploadedImage?.id === id) {
      setUploadedImage(null);
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    alert('URL copiada para a área de transferência!');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-cyan to-brand-blue flex items-center justify-center">
          <Icon name="Image" className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text-primary">Upload de Imagens - Cloudflare R2</h2>
          <p className="text-sm text-text-secondary">Envie imagens via Edge Function do Supabase</p>
        </div>
      </div>

      {/* Upload Card */}
      <div className="bg-bg-secondary rounded-lg border border-border-primary p-6">
        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border-secondary rounded-lg cursor-pointer hover:border-accent-primary transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Icon 
              name={uploading ? "Loader2" : "Upload"} 
              className={`w-10 h-10 mb-3 ${uploading ? 'text-accent-primary animate-spin' : 'text-text-secondary'}`} 
            />
            <p className="mb-2 text-sm text-text-primary font-medium">
              {uploading ? 'Fazendo upload...' : 'Clique para selecionar imagem'}
            </p>
            <p className="text-xs text-text-tertiary">PNG, JPG até 5 MB</p>
          </div>
          <input 
            type="file" 
            className="hidden" 
            accept="image/*"
            onChange={handleFileSelect}
            disabled={uploading}
          />
        </label>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
            <Icon name="AlertCircle" className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {/* Success */}
        {uploadedImage && (
          <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg space-y-3">
            <div className="flex items-start gap-3">
              <Icon name="CheckCircle" className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-500 mb-1">Upload concluído!</p>
                <p className="text-xs text-text-secondary mb-2">{uploadedImage.filename}</p>
                
                <div className="bg-bg-tertiary rounded p-2 mb-2">
                  <p className="text-xs text-text-tertiary mb-1">URL Pública:</p>
                  <p className="text-xs text-text-primary font-mono break-all">{uploadedImage.public_url}</p>
                </div>

                <button
                  onClick={() => copyToClipboard(uploadedImage.public_url)}
                  className="text-xs px-3 py-1.5 bg-accent-primary hover:bg-accent-primary/80 text-white rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <Icon name="Copy" className="w-3.5 h-3.5" />
                  Copiar URL
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lista de Imagens */}
      {images.length > 0 && (
        <div className="bg-bg-secondary rounded-lg border border-border-primary p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            Imagens Enviadas ({images.length})
          </h3>
          
          <div className="space-y-2">
            {images.map((img) => (
              <div 
                key={img.id}
                className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg hover:bg-bg-hover transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{img.filename}</p>
                  <p className="text-xs text-text-tertiary">{new Date(img.uploaded_at).toLocaleString('pt-BR')}</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(img.public_url)}
                    className="p-2 hover:bg-bg-secondary rounded transition-colors"
                    title="Copiar URL"
                  >
                    <Icon name="Copy" className="w-4 h-4 text-text-secondary" />
                  </button>
                  
                  <button
                    onClick={() => handleDelete(img.id)}
                    className="p-2 hover:bg-red-500/10 rounded transition-colors"
                    title="Remover"
                  >
                    <Icon name="Trash2" className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleImageUploadTest;
