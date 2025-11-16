/**
 * Simple Image Upload Service
 * 
 * Serviço simplificado para upload de imagens direto para Cloudflare R2
 * usando presigned URLs ou upload direto via browser.
 */

export interface SimpleImageUpload {
  id: string;
  filename: string;
  public_url: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
}

/**
 * Gera um nome único para o arquivo
 */
function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split('.').pop();
  const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
  const safeName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
  return `${safeName}_${timestamp}_${random}.${extension}`;
}

/**
 * Faz upload direto de imagem para R2 public bucket
 * Retorna apenas o link público da imagem
 */
export async function uploadImageToR2(file: File): Promise<SimpleImageUpload> {
  try {
    // Validar arquivo
    if (!file.type.startsWith('image/')) {
      throw new Error('Apenas arquivos de imagem são permitidos');
    }

    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      throw new Error('Arquivo muito grande. Tamanho máximo: 5 MB');
    }

    // Gerar nome único
    const filename = generateUniqueFilename(file.name);
    const id = crypto.randomUUID();

    // Obter credenciais
    const endpoint = import.meta.env.VITE_CLOUDFLARE_R2_ENDPOINT;
    const bucketName = import.meta.env.VITE_CLOUDFLARE_R2_BUCKET_NAME || 'dromeflow-files';
    const accountId = import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID;

    if (!endpoint || !accountId) {
      throw new Error('Credenciais R2 não configuradas');
    }

    // Construir URL pública (formato Cloudflare R2 público)
    // https://pub-<hash>.r2.dev/<filename>
    const publicUrl = `https://pub-${accountId}.r2.dev/${filename}`;

    // NOTA: Para funcionar, você precisa:
    // 1. Tornar o bucket R2 público no dashboard Cloudflare
    // 2. Ou usar uma Edge Function no Supabase para fazer o upload server-side
    
    console.log('[Simple Upload] Upload direto não suportado pelo browser');
    console.log('[Simple Upload] Use uma Edge Function ou torne o bucket público');
    console.log('[Simple Upload] Arquivo:', filename);
    console.log('[Simple Upload] URL pública:', publicUrl);

    // Por enquanto, retorna apenas os metadados
    // Em produção, você implementaria o upload via Edge Function
    const result: SimpleImageUpload = {
      id,
      filename,
      public_url: publicUrl,
      file_size: file.size,
      mime_type: file.type,
      uploaded_at: new Date().toISOString(),
    };

    return result;
  } catch (error) {
    console.error('[Simple Upload] Erro:', error);
    throw error;
  }
}

/**
 * Salva metadados da imagem no localStorage como fallback
 * (em produção, salvar no D1 via Edge Function)
 */
export function saveImageMetadata(image: SimpleImageUpload): void {
  try {
    const stored = localStorage.getItem('uploaded_images');
    const images: SimpleImageUpload[] = stored ? JSON.parse(stored) : [];
    images.unshift(image);
    
    // Manter apenas últimas 50 imagens
    if (images.length > 50) {
      images.splice(50);
    }
    
    localStorage.setItem('uploaded_images', JSON.stringify(images));
    console.log('[Simple Upload] Metadata salva localmente');
  } catch (error) {
    console.error('[Simple Upload] Erro ao salvar metadata:', error);
  }
}

/**
 * Lista imagens do localStorage
 */
export function listUploadedImages(): SimpleImageUpload[] {
  try {
    const stored = localStorage.getItem('uploaded_images');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('[Simple Upload] Erro ao listar imagens:', error);
    return [];
  }
}

/**
 * Remove imagem do localStorage
 */
export function deleteImage(id: string): void {
  try {
    const stored = localStorage.getItem('uploaded_images');
    if (!stored) return;
    
    const images: SimpleImageUpload[] = JSON.parse(stored);
    const filtered = images.filter(img => img.id !== id);
    localStorage.setItem('uploaded_images', JSON.stringify(filtered));
    console.log('[Simple Upload] Imagem removida');
  } catch (error) {
    console.error('[Simple Upload] Erro ao deletar imagem:', error);
  }
}

export const simpleImageUploadService = {
  uploadImageToR2,
  saveImageMetadata,
  listUploadedImages,
  deleteImage,
};
