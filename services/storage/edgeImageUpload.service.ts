/**
 * Edge Function Image Upload Service
 * 
 * Usa a Edge Function do Supabase para fazer upload de imagens para o Cloudflare R2
 */

import { supabase } from '../supabaseClient';

export interface ImageUploadResult {
  id: string;
  filename: string;
  public_url: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
}

/**
 * Faz upload de imagem via Edge Function
 */
export async function uploadImage(file: File): Promise<ImageUploadResult> {
  try {
    // Validar arquivo
    if (!file.type.startsWith('image/')) {
      throw new Error('Apenas arquivos de imagem são permitidos');
    }

    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      throw new Error('Arquivo muito grande. Tamanho máximo: 5 MB');
    }

    console.log('[Edge Upload] Enviando imagem:', file.name);

    // Criar FormData
    const formData = new FormData();
    formData.append('file', file);

    // Chamar Edge Function
    const { data, error } = await supabase.functions.invoke('upload-image-r2', {
      body: formData,
    });

    if (error) {
      console.error('[Edge Upload] Erro:', error);
      throw new Error(error.message || 'Erro ao fazer upload');
    }

    if (!data || !data.success) {
      throw new Error(data?.error || 'Falha no upload');
    }

    console.log('[Edge Upload] Upload concluído:', data.data);
    return data.data as ImageUploadResult;
  } catch (error) {
    console.error('[Edge Upload] Erro ao fazer upload:', error);
    throw error;
  }
}

/**
 * Salva metadados da imagem no localStorage
 */
export function saveImageMetadata(image: ImageUploadResult): void {
  try {
    const stored = localStorage.getItem('uploaded_images');
    const images: ImageUploadResult[] = stored ? JSON.parse(stored) : [];
    images.unshift(image);
    
    // Manter apenas últimas 100 imagens
    if (images.length > 100) {
      images.splice(100);
    }
    
    localStorage.setItem('uploaded_images', JSON.stringify(images));
    console.log('[Edge Upload] Metadata salva localmente');
  } catch (error) {
    console.error('[Edge Upload] Erro ao salvar metadata:', error);
  }
}

/**
 * Lista imagens do localStorage
 */
export function listUploadedImages(): ImageUploadResult[] {
  try {
    const stored = localStorage.getItem('uploaded_images');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('[Edge Upload] Erro ao listar imagens:', error);
    return [];
  }
}

/**
 * Remove imagem do localStorage
 */
export function deleteImageMetadata(id: string): void {
  try {
    const stored = localStorage.getItem('uploaded_images');
    if (!stored) return;
    
    const images: ImageUploadResult[] = JSON.parse(stored);
    const filtered = images.filter(img => img.id !== id);
    localStorage.setItem('uploaded_images', JSON.stringify(filtered));
    console.log('[Edge Upload] Imagem removida');
  } catch (error) {
    console.error('[Edge Upload] Erro ao deletar imagem:', error);
  }
}

export const edgeImageUploadService = {
  uploadImage,
  saveImageMetadata,
  listUploadedImages,
  deleteImageMetadata,
};
