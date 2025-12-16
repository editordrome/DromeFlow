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
        const { unit_id } = await req.json()

        if (!unit_id) {
            return new Response(JSON.stringify({ error: 'Missing unit_id' }), {
                status: 400,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            })
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
            return new Response(JSON.stringify({ error: 'Asaas integration not found or inactive' }), {
                status: 404,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            })
        }

        // Detect environment
        const isSandbox = integration.api_key.includes('hmlg') || integration.api_key.includes('sandbox')
        const BASE_URL = isSandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://www.asaas.com/api/v3'

        console.log(`Matching Asaas customers to existing clients for unit ${unit_id}`)

        // 2. Fetch all customers from Asaas
        let allCustomers: any[] = []
        let offset = 0
        const limit = 100
        let hasMore = true

        while (hasMore) {
            const resp = await fetch(`${BASE_URL}/customers?offset=${offset}&limit=${limit}`, {
                headers: {
                    'access_token': integration.api_key
                }
            })

            if (!resp.ok) {
                const error = await resp.json()
                console.error('Asaas API Error:', error)
                return new Response(JSON.stringify({ error: 'Failed to fetch customers from Asaas', details: error }), {
                    status: resp.status,
                    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
                })
            }

            const data = await resp.json()
            allCustomers = allCustomers.concat(data.data || [])

            hasMore = data.hasMore || false
            offset += limit

            if (offset > 1000) break
        }

        console.log(`Fetched ${allCustomers.length} customers from Asaas`)

        // 3. Match and update existing clients
        const matchResults = {
            matched: 0,
            not_found: 0,
            already_linked: 0,
            errors: [] as string[]
        }

        for (const customer of allCustomers) {
            try {
                // Find existing client by exact name match (case-insensitive)
                const { data: existingClients, error: searchError } = await supabase
                    .from('unit_clients')
                    .select('id, asaas_id, nome')
                    .eq('unit_id', unit_id)
                    .ilike('nome', customer.name)

                if (searchError) {
                    console.error(`Error searching for client ${customer.name}:`, searchError)
                    matchResults.errors.push(`${customer.name}: ${searchError.message}`)
                    continue
                }

                if (!existingClients || existingClients.length === 0) {
                    matchResults.not_found++
                    console.log(`No match found for: ${customer.name}`)
                    continue
                }

                // Update first match (or the one without asaas_id)
                const clientToUpdate = existingClients.find(c => !c.asaas_id) || existingClients[0]

                if (clientToUpdate.asaas_id) {
                    matchResults.already_linked++
                    console.log(`Already linked: ${customer.name} -> ${clientToUpdate.asaas_id}`)
                    continue
                }

                // Update with Asaas ID
                const { error: updateError } = await supabase
                    .from('unit_clients')
                    .update({
                        asaas_id: customer.id,
                        contato: customer.mobilePhone || customer.phone || clientToUpdate.contato,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', clientToUpdate.id)

                if (updateError) {
                    console.error(`Error updating client ${customer.name}:`, updateError)
                    matchResults.errors.push(`${customer.name}: ${updateError.message}`)
                } else {
                    matchResults.matched++
                    console.log(`✅ Matched: ${customer.name} -> ${customer.id}`)
                }

            } catch (err: any) {
                console.error(`Error processing customer ${customer.name}:`, err)
                matchResults.errors.push(`${customer.name}: ${err.message}`)
            }
        }

        console.log('Matching completed:', matchResults)

        return new Response(JSON.stringify({
            success: true,
            total_asaas_customers: allCustomers.length,
            ...matchResults
        }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        })

    } catch (err: any) {
        console.error('Match error:', err)
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        })
    }
})
