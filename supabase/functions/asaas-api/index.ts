import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: CORS_HEADERS })
    }

    try {
        const { action, unit_id, data } = await req.json()

        if (!unit_id) {
            return new Response(JSON.stringify({ error: 'Missing unit_id' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
        }

        // 1. Get Integration Config
        const { data: integration, error: intError } = await supabase
            .from('unit_integrations')
            .select('api_key')
            .eq('unit_id', unit_id)
            .eq('provider', 'asaas')
            .eq('is_active', true)
            .single()

        if (intError || !integration || !integration.api_key) {
            console.error('Integration error:', intError)
            return new Response(JSON.stringify({ error: 'Asaas integration not found or inactive' }), { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
        }

        const ASAAS_API_URL = integration.api_key.includes('$aact_') ? 'https://www.asaas.com/api/v3' : 'https://sandbox.asaas.com/api/v3'
        // Auto-detect environment based on key format usually works, or defaults to prod if not sure. 
        // Sandbox keys often don't have special prefix different from prod strictly, but usually users know.
        // For safety, let's assume PROD unless key explicitly looks like sandbox logic or we just default to one.
        // Actually, let's try to infer or default to standard URL. 
        // BETTER: If the key starts with '$aact_', it's an API Key.
        // NOTE: Asaas Sync vs Prod. 
        // Let's assume the user puts the correct key. We'll use www.asaas.com. If they want sandbox, they might need to config that.
        // For now, I'll default to the standard URL but check if the key works.

        // Simplification: We will support both if we can, but let's stick to PROD URL structure for now, 
        // or maybe the user can specificy environment.
        // Asaas docs say: "Sandbox: https://sandbox.asaas.com/api/v3" / "Prod: https://www.asaas.com/api/v3"
        // Since we don't store "environment" in DB, we'll heuristics:
        // Usually keys are opaque.
        // I will try to use the PROD url. If it fails with 401, it might be sandbox? No.
        // Let's assume PROD for now as standard.
        // If the user wants sandbox, we might need a flag. 
        // *Self-correction*: The implementation guide didn't specify environment flag.
        // I will use a simple heuristic: if the key contains "sandbox" or user explicitly requested (not yet).
        // Let's use a dynamic URL based on a check or defaulting to PROD.
        // Actually, let's look at the key provided in previous turns: "$aact_hmlg_..." -> HMLG usually means Homologation/Sandbox!
        // So:
        const isSandbox = integration.api_key.includes('hmlg') || integration.api_key.includes('sandbox')
        const BASE_URL = isSandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://www.asaas.com/api/v3'


        if (action === 'upsert_customer') {
            // data: { name, email, cpfCnpj, ... asaas_id? }
            let asaasId = data.asaas_id

            const customerData = {
                name: data.nome || data.name,
                email: data.email,
                cpfCnpj: data.cpfCnpj || data.cpf_cnpj,
                mobilePhone: data.mobilePhone || data.celular,
                phone: data.phone || data.telefone || data.contato,
                address: data.address || data.endereco,
            }

            let method = 'POST'
            let endpoint = '/customers'

            if (asaasId) {
                endpoint = `/customers/${asaasId}`
            }

            const resp = await fetch(`${BASE_URL}${endpoint}`, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'access_token': integration.api_key
                },
                body: JSON.stringify(customerData)
            })

            const respData = await resp.json()

            if (!resp.ok) {
                console.error('Asaas API Error:', respData)
                return new Response(JSON.stringify({ error: 'Asaas API Error', details: respData }), { status: resp.status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
            }

            return new Response(JSON.stringify(respData), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
        }

        return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })

    } catch (err: any) {
        console.error('Edge Function Error:', err)
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
    }
})
