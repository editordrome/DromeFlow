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

        console.log(`Syncing customers from Asaas for unit ${unit_id}`)

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

            // Safety limit
            if (offset > 1000) {
                console.warn('Reached safety limit of 1000 customers')
                break
            }
        }

        console.log(`Fetched ${allCustomers.length} customers from Asaas`)

        // 3. Sync customers to database
        const syncResults = {
            inserted: 0,
            updated: 0,
            skipped: 0,
            errors: [] as string[]
        }

        for (const customer of allCustomers) {
            try {
                // Check if customer already exists
                const { data: existing } = await supabase
                    .from('unit_clients')
                    .select('id')
                    .eq('asaas_id', customer.id)
                    .single()

                if (existing) {
                    // Update existing customer
                    const { error: updateError } = await supabase
                        .from('unit_clients')
                        .update({
                            nome: customer.name,
                            nome_norm: customer.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
                            contato: customer.mobilePhone || customer.phone || null,
                            endereco: customer.address || null,
                            tipo: customer.personType === 'FISICA' ? 'Pessoa Física' : 'Pessoa Jurídica',
                            updated_at: new Date().toISOString()
                        })
                        .eq('asaas_id', customer.id)

                    if (updateError) {
                        console.error(`Error updating customer ${customer.id}:`, updateError)
                        syncResults.errors.push(`${customer.id}: ${updateError.message}`)
                        syncResults.skipped++
                    } else {
                        syncResults.updated++
                    }
                } else {
                    // Insert new customer
                    const { error: insertError } = await supabase
                        .from('unit_clients')
                        .insert({
                            unit_id: unit_id,
                            asaas_id: customer.id,
                            nome: customer.name,
                            nome_norm: customer.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
                            contato: customer.mobilePhone || customer.phone || null,
                            endereco: customer.address || null,
                            tipo: customer.personType === 'FISICA' ? 'Pessoa Física' : 'Pessoa Jurídica',
                            is_verified: false
                        })

                    if (insertError) {
                        console.error(`Error inserting customer ${customer.id}:`, insertError)
                        syncResults.errors.push(`${customer.id}: ${insertError.message}`)
                        syncResults.skipped++
                    } else {
                        syncResults.inserted++
                    }
                }
            } catch (err: any) {
                console.error(`Error processing customer ${customer.id}:`, err)
                syncResults.errors.push(`${customer.id}: ${err.message}`)
                syncResults.skipped++
            }
        }

        console.log('Customer sync completed:', syncResults)

        return new Response(JSON.stringify({
            success: true,
            total_fetched: allCustomers.length,
            ...syncResults
        }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        })

    } catch (err: any) {
        console.error('Sync error:', err)
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        })
    }
})
