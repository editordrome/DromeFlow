// Supabase Edge Function para upload de imagens no Cloudflare R2
// Deploy: supabase functions deploy upload-image-r2

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { S3Client, PutObjectCommand } from 'npm:@aws-sdk/client-s3@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Obter arquivo do form-data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      throw new Error('Nenhum arquivo enviado');
    }

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      throw new Error('Apenas imagens são permitidas');
    }

    // Validar tamanho (5 MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('Arquivo muito grande. Máximo: 5 MB');
    }

    // Gerar nome único
    const timestamp = Date.now();
    const random = crypto.randomUUID().split('-')[0];
    const extension = file.name.split('.').pop();
    const filename = `${timestamp}_${random}.${extension}`;

    // Credenciais do Cloudflare R2
    const accessKeyId = Deno.env.get('CLOUDFLARE_R2_ACCESS_KEY_ID');
    const secretAccessKey = Deno.env.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY');
    const endpoint = Deno.env.get('CLOUDFLARE_R2_ENDPOINT');
    const bucketName = Deno.env.get('CLOUDFLARE_R2_BUCKET_NAME') || 'dromeflow-files';
    const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');

    if (!accessKeyId || !secretAccessKey || !endpoint || !accountId) {
      throw new Error('Credenciais R2 não configuradas');
    }

    // Criar cliente S3
    const s3Client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    // Converter arquivo para bytes
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Upload para R2
    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: filename,
      Body: uint8Array,
      ContentType: file.type,
      Metadata: {
        'original-filename': file.name,
        'uploaded-at': new Date().toISOString(),
      },
    });

    await s3Client.send(uploadCommand);

    // Construir URL pública com domínio R2.dev
    const publicUrl = `https://pub-6077ce9475224cda951c773ddd1d54b9.r2.dev/${filename}`;

    // Retornar resposta
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: crypto.randomUUID(),
          filename,
          public_url: publicUrl,
          file_size: file.size,
          mime_type: file.type,
          uploaded_at: new Date().toISOString(),
        },
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Erro no upload:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro ao fazer upload',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
