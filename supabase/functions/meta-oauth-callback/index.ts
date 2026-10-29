import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const stateRaw = url.searchParams.get('state');

    if (!code) {
       return new Response('Código de autorização ausente.', { status: 400 });
    }
    
    // O state traz os metadados do local onde foi clicado ({unit_id, type})
    let stateParams: any = {};
    if (stateRaw) {
       try {
         stateParams = JSON.parse(atob(stateRaw));
       } catch (e) {
         console.warn('Falha ao decodificar state:', e);
       }
    }

    const { unit_id, type } = stateParams;
    
    // Troca de code por Access Token (OAuth Flow)
    const client_id = Deno.env.get('META_APP_ID');
    const client_secret = Deno.env.get('META_APP_SECRET');
    const redirect_uri = Deno.env.get('META_CALLBACK_URL') || `https://${Deno.env.get('SUPABASE_PROJECT_REF')}.functions.supabase.co/meta-oauth-callback`;

    // Chamada à Graph API para trocar token (esboço)
    const tokenResponse = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&client_secret=${client_secret}&code=${code}`);
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
       return new Response(`Falha oauth: ${tokenData.error.message}`, { status: 400 });
    }

    const access_token = tokenData.access_token;

    // Busca dados da WABA (WhatsApp Business Account) vinculada a este access_token
    // IMPORTANTE: Ajustar endpoint conforme estrutura exata do WABA token
    // Exemplo genérico:
    const debugResponse = await fetch(`https://graph.facebook.com/v19.0/debug_token?input_token=${access_token}&access_token=${client_id}|${client_secret}`);
    const debugData = await debugResponse.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Salvar logicamente no banco (Esboço, precisa substituir as variaveis conforme retorno real da api)
    const waba_id = debugData.data?.granular_scopes?.find((s:any) => s.scope==='whatsapp_business_management')?.target_ids?.[0] || 'TODO_GET_WABA_ID';
    const phone_number_id = 'TODO_GET_PHONE_ID';

    const { error: dbError } = await supabaseAdmin
      .from('whatsapp_connections')
      .upsert({
         unit_id,
         connection_type: type,
         waba_id,
         phone_number_id,
         access_token,
         status: 'connected',
         updated_at: new Date().toISOString()
      }, { onConflict: 'unit_id, connection_type' });

    if (dbError) throw dbError;

    // Resposta final renderizando um HTML para fechamento auto
    return new Response(
      `<html>
        <body>
          <h2>WhatsApp Conectado com Sucesso!</h2>
          <p>Esta aba se fechará automaticamente...</p>
          <script>
             setTimeout(() => { window.close(); }, 3000);
          </script>
        </body>
      </html>`,
      { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
    );

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
