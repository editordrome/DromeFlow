/**
 * Cloudflare D1 Images Service
 * 
 * Serviço para gerenciar metadados de imagens no Cloudflare D1 (SQLite serverless)
 * Integrado com R2 para upload de arquivos.
 */

import { supabase } from '../supabaseClient';
import { r2Service } from './r2.service';

// =====================================================
// TYPES
// =====================================================

export interface ImageMetadata {
  id: string;
  filename: string;
  original_filename: string;
  storage_key: string;
  bucket_name: string;
  image_type: 'profile' | 'logo' | 'banner' | 'comercial' | 'recrutadora' | 'other';
  mime_type: string;
  file_size: number;
  width: number | null;
  height: number | null;
  public_url: string;
  thumbnail_url: string | null;
  unit_id: string | null;
  uploaded_by: string | null;
  usage_context: string | null;
  reference_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface UploadImageOptions {
  file: File;
  imageType: ImageMetadata['image_type'];
  unitId?: string;
  uploadedBy?: string;
  usageContext?: string;
  referenceId?: string;
}

export interface ListImagesOptions {
  imageType?: string;
  unitId?: string;
  usageContext?: string;
  limit?: number;
  offset?: number;
}

interface D1Credentials {
  accountId: string;
  apiToken: string;
  databaseId: string;
}

// =====================================================
// D1 CLIENT
// =====================================================

let d1Credentials: D1Credentials | null = null;

/**
 * Carrega credenciais do D1 do Supabase
 */
async function loadD1Credentials(): Promise<D1Credentials> {
  if (d1Credentials) return d1Credentials;

  try {
    const { data: credentials, error } = await supabase
      .from('access_credentials')
      .select('name, value')
      .in('name', ['cloudflare_account_id', 'cloudflare_api_token', 'cloudflare_d1_database_id']);

    if (error) throw error;
    if (!credentials || credentials.length === 0) {
      throw new Error('Credenciais do Cloudflare D1 não encontradas');
    }

    const accountId = credentials.find(c => c.name === 'cloudflare_account_id')?.value;
    const apiToken = credentials.find(c => c.name === 'cloudflare_api_token')?.value;
    const databaseId = credentials.find(c => c.name === 'cloudflare_d1_database_id')?.value;

    if (!accountId || !apiToken || !databaseId) {
      throw new Error('Credenciais do Cloudflare D1 incompletas');
    }

    d1Credentials = { accountId, apiToken, databaseId };
    return d1Credentials;
  } catch (error) {
    console.error('[D1 Images] Erro ao carregar credenciais:', error);
    throw error;
  }
}

/**
 * Executa query no D1
 */
async function executeD1Query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const creds = await loadD1Credentials();
  
  const url = `https://api.cloudflare.com/client/v4/accounts/${creds.accountId}/d1/database/${creds.databaseId}/query`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${creds.apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sql,
      params
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`D1 Query Error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(`D1 Query Failed: ${JSON.stringify(result.errors)}`);
  }

  return result.result[0]?.results || [];
}

// =====================================================
// IMAGE OPERATIONS
// =====================================================

/**
 * Faz upload de imagem para R2 e salva metadata no D1
 */
export async function uploadImage(options: UploadImageOptions): Promise<ImageMetadata> {
  try {
    const { file, imageType, unitId, uploadedBy, usageContext, referenceId } = options;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      throw new Error('Arquivo deve ser uma imagem');
    }

    // Verificar se as credenciais D1 estão configuradas
    try {
      await loadD1Credentials();
    } catch (error) {
      throw new Error('Sistema de imagens não configurado. Por favor, configure o Cloudflare D1 primeiro. Veja: docs/IMAGES_SETUP_GUIDE.md');
    }

    // Gerar ID único
    const id = self.crypto.randomUUID();
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '/');
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filename = `${id}.${extension}`;
    const storageKey = `images/${timestamp}/${filename}`;

    // Upload para R2
    const r2Result = await r2Service.uploadFile({
      file,
      key: storageKey,
      unitId: unitId || 'system',
      fileType: 'image',
      metadata: {
        image_type: imageType,
        usage_context: usageContext
      },
      isPublic: true
    });

    // Gerar URL pública
    const publicUrl = r2Result.public_url || `https://pub-cloudflare.r2.dev/${storageKey}`;

    // Obter dimensões da imagem
    const dimensions = await getImageDimensions(file);

    // Inserir metadata no D1
    const query = `
      INSERT INTO images (
        id, image_type, filename, storage_key, file_size, 
        mime_type, width, height, public_url, unit_id,
        uploaded_by, usage_context, reference_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `;

    const result = await executeD1Query<ImageMetadata>(query, [
      id,
      imageType,
      file.name,
      storageKey,
      file.size,
      file.type,
      dimensions?.width || null,
      dimensions?.height || null,
      publicUrl,
      unitId || null,
      uploadedBy,
      usageContext || null,
      referenceId || null,
      1  // is_active = true
    ]);

    if (!result || result.length === 0) {
      throw new Error('Falha ao salvar metadata no D1');
    }

    return result[0];
  } catch (error) {
    console.error('[D1 Images] Erro ao fazer upload:', error);
    throw error;
  }
}

/**
 * Obtém URL base do R2 para construir URLs públicas
 */
async function getR2PublicUrl(): Promise<string> {
  try {
    const { data: credentials, error } = await supabase
      .from('access_credentials')
      .select('value')
      .eq('name', 'cloudflare_r2_endpoint')
      .single();

    if (error || !credentials) {
      return 'cloudflare.com'; // fallback
    }

    // Extrair parte pública do endpoint
    const endpoint = credentials.value;
    const match = endpoint.match(/pub-([a-zA-Z0-9]+)/);
    return match ? match[1] : 'cloudflare.com';
  } catch (error) {
    console.error('[D1 Images] Erro ao obter URL pública:', error);
    return 'cloudflare.com';
  }
}

/**
 * Lista imagens com filtros
 */
export async function listImages(options: ListImagesOptions = {}): Promise<ImageMetadata[]> {
  try {
    const { imageType, unitId, usageContext, limit = 100, offset = 0 } = options;

    let sql = 'SELECT * FROM images WHERE deleted_at IS NULL';
    const params: any[] = [];

    if (imageType) {
      sql += ' AND image_type = ?';
      params.push(imageType);
    }

    if (unitId) {
      sql += ' AND unit_id = ?';
      params.push(unitId);
    }

    if (usageContext) {
      sql += ' AND usage_context = ?';
      params.push(usageContext);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const images = await executeD1Query<ImageMetadata>(sql, params);
    return images;
  } catch (error) {
    console.error('[D1 Images] Erro ao listar imagens:', error);
    throw error;
  }
}

/**
 * Busca imagem por ID
 */
export async function getImageById(id: string): Promise<ImageMetadata | null> {
  try {
    const images = await executeD1Query<ImageMetadata>(
      'SELECT * FROM images WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    return images.length > 0 ? images[0] : null;
  } catch (error) {
    console.error('[D1 Images] Erro ao buscar imagem:', error);
    throw error;
  }
}

/**
 * Deleta imagem (soft delete no D1 + delete físico no R2)
 */
export async function deleteImage(id: string): Promise<void> {
  try {
    // Buscar imagem
    const image = await getImageById(id);
    if (!image) {
      throw new Error('Imagem não encontrada');
    }

    // Soft delete no D1
    await executeD1Query(
      'UPDATE images SET deleted_at = datetime("now"), updated_at = datetime("now") WHERE id = ?',
      [id]
    );

    // Delete físico no R2
    try {
      await r2Service.deleteFile(image.storage_key);
    } catch (error) {
      console.warn('[D1 Images] Erro ao deletar do R2 (continuando):', error);
    }
  } catch (error) {
    console.error('[D1 Images] Erro ao deletar imagem:', error);
    throw error;
  }
}

/**
 * Atualiza metadados da imagem
 */
export async function updateImageMetadata(
  id: string,
  updates: Partial<Pick<ImageMetadata, 'usage_context' | 'reference_id' | 'image_type'>>
): Promise<void> {
  try {
    const fields: string[] = [];
    const params: any[] = [];

    if (updates.usage_context !== undefined) {
      fields.push('usage_context = ?');
      params.push(updates.usage_context);
    }

    if (updates.reference_id !== undefined) {
      fields.push('reference_id = ?');
      params.push(updates.reference_id);
    }

    if (updates.image_type !== undefined) {
      fields.push('image_type = ?');
      params.push(updates.image_type);
    }

    if (fields.length === 0) return;

    fields.push('updated_at = datetime("now")');
    params.push(id);

    const sql = `UPDATE images SET ${fields.join(', ')} WHERE id = ?`;
    await executeD1Query(sql, params);
  } catch (error) {
    console.error('[D1 Images] Erro ao atualizar metadados:', error);
    throw error;
  }
}

/**
 * Obtém estatísticas de uso de imagens
 */
export async function getImagesStats(): Promise<{
  total: number;
  byType: Record<string, number>;
  totalSize: number;
}> {
  try {
    // Total de imagens
    const totalResult = await executeD1Query<{ count: number }>(
      'SELECT COUNT(*) as count FROM images WHERE deleted_at IS NULL'
    );

    // Por tipo
    const byTypeResult = await executeD1Query<{ image_type: string; count: number }>(
      'SELECT image_type, COUNT(*) as count FROM images WHERE deleted_at IS NULL GROUP BY image_type'
    );

    // Tamanho total
    const sizeResult = await executeD1Query<{ total_size: number }>(
      'SELECT SUM(file_size) as total_size FROM images WHERE deleted_at IS NULL'
    );

    const byType: Record<string, number> = {};
    byTypeResult.forEach(row => {
      byType[row.image_type] = row.count;
    });

    return {
      total: totalResult[0]?.count || 0,
      byType,
      totalSize: sizeResult[0]?.total_size || 0
    };
  } catch (error) {
    console.error('[D1 Images] Erro ao obter estatísticas:', error);
    throw error;
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Obtém dimensões de uma imagem
 */
async function getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
}

// =====================================================
// EXPORTS
// =====================================================

export const d1ImagesService = {
  uploadImage,
  listImages,
  getImageById,
  deleteImage,
  updateImageMetadata,
  getImagesStats
};

export default d1ImagesService;
