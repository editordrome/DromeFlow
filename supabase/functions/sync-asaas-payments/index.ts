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

        console.log(`Syncing payments from Asaas for unit ${unit_id}`)

        // 2. Fetch all payments from Asaas
        let allPayments: any[] = []
        let offset = 0
        const limit = 100
        let hasMore = true

        while (hasMore) {
            const resp = await fetch(`${BASE_URL}/payments?offset=${offset}&limit=${limit}`, {
                headers: {
                    'access_token': integration.api_key
                }
            })

            if (!resp.ok) {
                const error = await resp.json()
                console.error('Asaas API Error:', error)
                return new Response(JSON.stringify({ error: 'Failed to fetch payments from Asaas', details: error }), {
                    status: resp.status,
                    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
                })
            }

            const data = await resp.json()
            allPayments = allPayments.concat(data.data || [])

            hasMore = data.hasMore || false
            offset += limit

            // Safety limit
            if (offset > 1000) {
                console.warn('Reached safety limit of 1000 payments')
                break
            }
        }

        console.log(`Fetched ${allPayments.length} payments from Asaas`)

        // 3. Sync payments to database
        const syncResults = {
            inserted: 0,
            updated: 0,
            skipped: 0,
            errors: [] as string[]
        }

        for (const payment of allPayments) {
            try {
                // Check if customer exists in unit_clients
                const { data: existingClient } = await supabase
                    .from('unit_clients')
                    .select('asaas_id')
                    .eq('asaas_id', payment.customer)
                    .single()

                // If customer doesn't exist, fetch from Asaas and create
                if (!existingClient && payment.customer) {
                    try {
                        const customerResp = await fetch(`${BASE_URL}/customers/${payment.customer}`, {
                            headers: {
                                'access_token': integration.api_key
                            }
                        })

                        if (customerResp.ok) {
                            const customerData = await customerResp.json()

                            // Create customer in unit_clients
                            await supabase
                                .from('unit_clients')
                                .insert({
                                    unit_id: unit_id,
                                    asaas_id: customerData.id,
                                    nome: customerData.name,
                                    email: customerData.email || null,
                                    telefone: customerData.phone || customerData.mobilePhone || null,
                                    cpf: customerData.cpfCnpj || null
                                })

                            console.log(`Created new customer: ${customerData.name}`)
                        }
                    } catch (customerErr: any) {
                        console.error(`Error creating customer ${payment.customer}:`, customerErr)
                    }
                }

                // Fetch customer name from unit_clients
                let customerName = null
                const { data: clientData } = await supabase
                    .from('unit_clients')
                    .select('nome')
                    .eq('asaas_id', payment.customer)
                    .single()

                if (clientData) {
                    customerName = clientData.nome
                }

                // Map Asaas status to our status
                let status = 'PENDING'
                if (payment.status === 'RECEIVED' || payment.status === 'RECEIVED_IN_CASH') status = 'RECEIVED'
                if (payment.status === 'CONFIRMED') status = 'RECEIVED'
                if (payment.status === 'OVERDUE') status = 'OVERDUE'

                const paymentData = {
                    cliente_asaas_id: payment.customer,
                    id_pagamento_asaas: payment.id,
                    status_pagamento: status,
                    valor: payment.value,
                    data_vencimento: payment.dueDate,
                    tipo_pagamento: payment.billingType,
                    data_pagamento: payment.paymentDate || null,
                    data_confirmacao: payment.confirmedDate || null,
                    data_disponivel_saque: payment.estimatedCreditDate || payment.creditDate || null,
                    link: payment.invoiceUrl || payment.bankSlipUrl || null,
                    numero_fatura: payment.invoiceNumber || null,
                    link_fatura: payment.invoiceUrl || null,
                    nome: customerName,
                    updated_at: new Date().toISOString()
                }

                // Upsert (insert or update)
                const { error: upsertError } = await supabase
                    .from('payment_records')
                    .upsert(paymentData, {
                        onConflict: 'id_pagamento_asaas',
                        ignoreDuplicates: false
                    })

                if (upsertError) {
                    console.error(`Error upserting payment ${payment.id}:`, upsertError)
                    syncResults.errors.push(`${payment.id}: ${upsertError.message}`)
                    syncResults.skipped++
                } else {
                    // Check if it was insert or update
                    const { data: existing } = await supabase
                        .from('payment_records')
                        .select('id')
                        .eq('id_pagamento_asaas', payment.id)
                        .single()

                    if (existing) {
                        syncResults.updated++
                    } else {
                        syncResults.inserted++
                    }
                }
            } catch (err: any) {
                console.error(`Error processing payment ${payment.id}:`, err)
                syncResults.errors.push(`${payment.id}: ${err.message}`)
                syncResults.skipped++
            }
        }

        console.log('Sync completed:', syncResults)

        return new Response(JSON.stringify({
            success: true,
            total_fetched: allPayments.length,
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
