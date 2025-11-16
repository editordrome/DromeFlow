/**
 * Cloudflare R2 Storage Service
 * 
 * Cliente TypeScript para interagir com Cloudflare R2 (S3-compatible)
 * usando o AWS SDK v3.
 * 
 * Features:
 * - Upload de arquivos com metadata
 * - Download de arquivos
 * - Listagem de objetos
 * - Deleção de arquivos
 * - Geração de URLs públicas
 * - Integração com file_metadata table
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  type PutObjectCommandInput,
  type GetObjectCommandInput,
  type DeleteObjectCommandInput,
  type ListObjectsV2CommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { supabase } from '../supabaseClient';

// =====================================================
// TYPES
// =====================================================

export interface R2Config {
  accountId: string;
  apiToken: string;
  bucketName: string;
  endpoint: string;
}

export interface UploadFileOptions {
  file: File | Blob;
  key: string;
  unitId: string;
  fileType: 'xlsx' | 'pdf' | 'csv' | 'image' | 'backup';
  metadata?: Record<string, any>;
  isPublic?: boolean;
  expiresInDays?: number;
}

export interface FileMetadata {
  id: string;
  unit_id: string;
  filename: string;
  storage_key: string;
  storage_provider: string;
  file_type: string;
  mime_type: string | null;
  file_size: number;
  checksum: string | null;
  is_processed: boolean;
  processed_at: string | null;
  processing_error: string | null;
  metadata: Record<string, any>;
  is_public: boolean;
  public_url: string | null;
  expires_at: string | null;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ListFilesOptions {
  unitId?: string;
  fileType?: string;
  limit?: number;
  offset?: number;
}

// =====================================================
// R2 CLIENT INITIALIZATION
// =====================================================

let r2Client: S3Client | null = null;
let r2Config: R2Config | null = null;

/**
 * Inicializa o cliente R2 com credenciais do banco
 */
async function initR2Client(): Promise<void> {
  if (r2Client) return;

  try {
    // Buscar credenciais do access_credentials
    const { data: credentials, error } = await supabase
      .from('access_credentials')
      .select('name, value')
      .in('name', [
        'Cloudflare R2 - Account ID',
        'Cloudflare R2 - API Token',
        'Cloudflare R2 - Bucket Name',
        'Cloudflare R2 - Endpoint',
      ]);

    if (error) throw error;
    if (!credentials || credentials.length !== 4) {
      throw new Error('Credenciais R2 incompletas no banco');
    }

    // Montar config
    const credMap = credentials.reduce((acc, cred) => {
      acc[cred.name] = cred.value;
      return acc;
    }, {} as Record<string, string>);

    r2Config = {
      accountId: credMap['Cloudflare R2 - Account ID'],
      apiToken: credMap['Cloudflare R2 - API Token'],
      bucketName: credMap['Cloudflare R2 - Bucket Name'],
      endpoint: credMap['Cloudflare R2 - Endpoint'],
    };

    // Criar cliente S3
    r2Client = new S3Client({
      region: 'auto',
      endpoint: r2Config.endpoint,
      credentials: {
        accessKeyId: r2Config.accountId,
        secretAccessKey: r2Config.apiToken,
      },
    });

    console.log('[R2] Cliente inicializado com sucesso');
  } catch (error) {
    console.error('[R2] Erro ao inicializar cliente:', error);
    throw new Error('Falha ao conectar com Cloudflare R2');
  }
}

/**
 * Garante que o cliente está inicializado
 */
async function ensureClient(): Promise<{ client: S3Client; config: R2Config }> {
  if (!r2Client || !r2Config) {
    await initR2Client();
  }
  return { client: r2Client!, config: r2Config! };
}

// =====================================================
// UPLOAD FUNCTIONS
// =====================================================

/**
 * Faz upload de um arquivo para o R2 e registra metadata no banco
 */
export async function uploadFileToR2(options: UploadFileOptions): Promise<FileMetadata> {
  const { client, config } = await ensureClient();
  const { file, key, unitId, fileType, metadata = {}, isPublic = false, expiresInDays } = options;

  try {
    // Converter File/Blob para Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload para R2
    const uploadCommand = new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: buffer,
      ContentType: file.type || 'application/octet-stream',
      Metadata: {
        unit_id: unitId,
        file_type: fileType,
        uploaded_at: new Date().toISOString(),
        ...Object.keys(metadata).reduce((acc, k) => {
          acc[k] = String(metadata[k]);
          return acc;
        }, {} as Record<string, string>),
      },
    });

    await client.send(uploadCommand);

    // Calcular data de expiração se especificada
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Salvar metadata no banco
    const { data: fileMetadata, error: dbError } = await supabase
      .from('file_metadata')
      .insert({
        unit_id: unitId,
        filename: file instanceof File ? file.name : `file_${Date.now()}`,
        storage_key: key,
        storage_provider: 'r2',
        file_type: fileType,
        mime_type: file.type || null,
        file_size: file.size,
        is_public: isPublic,
        expires_at: expiresAt,
        metadata,
      })
      .select()
      .single();

    if (dbError) throw dbError;

    console.log(`[R2] Arquivo enviado com sucesso: ${key}`);
    return fileMetadata as FileMetadata;
  } catch (error) {
    console.error('[R2] Erro ao fazer upload:', error);
    throw new Error(`Falha ao enviar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

/**
 * Gera uma chave única para o arquivo baseada em unidade e timestamp
 */
export function generateFileKey(unitCode: string, filename: string, prefix = 'uploads'): string {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${prefix}/${unitCode}/${timestamp}_${sanitizedFilename}`;
}

// =====================================================
// DOWNLOAD FUNCTIONS
// =====================================================

/**
 * Gera URL assinada temporária para download de arquivo
 */
export async function getFileDownloadUrl(storageKey: string, expiresIn = 3600): Promise<string> {
  const { client, config } = await ensureClient();

  try {
    const command = new GetObjectCommand({
      Bucket: config.bucketName,
      Key: storageKey,
    });

    const signedUrl = await getSignedUrl(client, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    console.error('[R2] Erro ao gerar URL de download:', error);
    throw new Error('Falha ao gerar URL de download');
  }
}

/**
 * Baixa arquivo diretamente do R2 (retorna stream)
 */
export async function downloadFileFromR2(storageKey: string): Promise<Blob> {
  const { client, config } = await ensureClient();

  try {
    const command = new GetObjectCommand({
      Bucket: config.bucketName,
      Key: storageKey,
    });

    const response = await client.send(command);

    if (!response.Body) {
      throw new Error('Arquivo não encontrado');
    }

    // Converter stream para blob
    const chunks: Uint8Array[] = [];
    const stream = response.Body as any;

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    const blob = new Blob(chunks, { type: response.ContentType });
    return blob;
  } catch (error) {
    console.error('[R2] Erro ao baixar arquivo:', error);
    throw new Error('Falha ao baixar arquivo');
  }
}

// =====================================================
// DELETE FUNCTIONS
// =====================================================

/**
 * Deleta arquivo do R2 e marca como deletado no banco (soft delete)
 */
export async function deleteFileFromR2(fileId: string): Promise<boolean> {
  try {
    // Buscar metadata do arquivo
    const { data: fileMetadata, error: fetchError } = await supabase
      .from('file_metadata')
      .select('storage_key, storage_provider')
      .eq('id', fileId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !fileMetadata) {
      throw new Error('Arquivo não encontrado');
    }

    // Deletar do R2 se for storage provider
    if (fileMetadata.storage_provider === 'r2') {
      const { client, config } = await ensureClient();

      const deleteCommand = new DeleteObjectCommand({
        Bucket: config.bucketName,
        Key: fileMetadata.storage_key,
      });

      await client.send(deleteCommand);
    }

    // Soft delete no banco
    const { error: deleteError } = await supabase
      .from('file_metadata')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', fileId);

    if (deleteError) throw deleteError;

    console.log(`[R2] Arquivo deletado com sucesso: ${fileId}`);
    return true;
  } catch (error) {
    console.error('[R2] Erro ao deletar arquivo:', error);
    throw new Error('Falha ao deletar arquivo');
  }
}

// =====================================================
// LIST FUNCTIONS
// =====================================================

/**
 * Lista arquivos do banco com filtros opcionais
 */
export async function listFiles(options: ListFilesOptions = {}): Promise<FileMetadata[]> {
  const { unitId, fileType, limit = 50, offset = 0 } = options;

  try {
    let query = supabase
      .from('file_metadata')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unitId) {
      query = query.eq('unit_id', unitId);
    }

    if (fileType) {
      query = query.eq('file_type', fileType);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data as FileMetadata[]) || [];
  } catch (error) {
    console.error('[R2] Erro ao listar arquivos:', error);
    throw new Error('Falha ao listar arquivos');
  }
}

/**
 * Lista objetos diretamente do bucket R2
 */
export async function listR2Objects(prefix?: string, maxKeys = 100): Promise<string[]> {
  const { client, config } = await ensureClient();

  try {
    const command = new ListObjectsV2Command({
      Bucket: config.bucketName,
      Prefix: prefix,
      MaxKeys: maxKeys,
    });

    const response = await client.send(command);

    return response.Contents?.map((obj) => obj.Key || '') || [];
  } catch (error) {
    console.error('[R2] Erro ao listar objetos R2:', error);
    throw new Error('Falha ao listar objetos');
  }
}

// =====================================================
// METADATA FUNCTIONS
// =====================================================

/**
 * Atualiza metadata de um arquivo
 */
export async function updateFileMetadata(
  fileId: string,
  updates: Partial<Pick<FileMetadata, 'is_processed' | 'processed_at' | 'processing_error' | 'metadata'>>
): Promise<FileMetadata> {
  try {
    const { data, error } = await supabase
      .from('file_metadata')
      .update(updates)
      .eq('id', fileId)
      .select()
      .single();

    if (error) throw error;

    return data as FileMetadata;
  } catch (error) {
    console.error('[R2] Erro ao atualizar metadata:', error);
    throw new Error('Falha ao atualizar metadata');
  }
}

/**
 * Busca estatísticas de storage por unidade
 */
export async function getUnitStorageStats(unitId: string) {
  try {
    const { data, error } = await supabase
      .rpc('get_unit_storage_stats', { p_unit_id: unitId })
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('[R2] Erro ao buscar estatísticas:', error);
    return { total_files: 0, total_size: 0, total_size_mb: 0, by_type: {} };
  }
}

// =====================================================
// EXPORTS
// =====================================================

export const r2Service = {
  uploadFile: uploadFileToR2,
  generateKey: generateFileKey,
  getDownloadUrl: getFileDownloadUrl,
  downloadFile: downloadFileFromR2,
  deleteFile: deleteFileFromR2,
  listFiles,
  listR2Objects,
  updateMetadata: updateFileMetadata,
  getStorageStats: getUnitStorageStats,
};

export default r2Service;
