import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("Asaas Webhook Handler Initiated")

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

serve(async (req) => {
    try {
        const url = new URL(req.url)
        const unitId = url.searchParams.get('unit_id')

        // 1. Validation basics
        if (req.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 })
        }

        if (!unitId) {
            return new Response('Missing unit_id in query params', { status: 400 })
        }

        // Note: Asaas webhooks don't send custom authorization headers
        // We rely on the unique webhook URL with unit_id for security
        // For production, consider IP whitelisting or webhook signature validation

        // 2. Fetch Unit Integration Config
        // We use the service role key to access the protected unit_integrations table
        const { data: integration, error: integrationError } = await supabase
            .from('unit_integrations')
            .select('webhook_token, is_active')
            .eq('unit_id', unitId)
            .eq('provider', 'asaas')
            .single()

        if (integrationError || !integration) {
            console.error('Integration not found or error:', integrationError)
            return new Response('Integration not found for this unit', { status: 404 })
        }

        if (!integration.is_active) {
            return new Response('Integration is inactive', { status: 403 })
        }

        // 3. Parse webhook payload
        const body = await req.json()
        const { event, payment } = body


        console.log(`Received event ${event} for unit ${unitId}`)

        // 4. Process Events
        // Common Asaas Events: PAYMENT_RECEIVED, PAYMENT_OVERDUE, PAYMENT_CONFIRMED

        if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_OVERDUE' || event === 'PAYMENT_DELETED') {
            if (payment && payment.id) {
                let status = 'PENDING'
                if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') status = 'RECEIVED'
                if (event === 'PAYMENT_OVERDUE') status = 'OVERDUE'
                if (event === 'PAYMENT_DELETED') status = 'DELETED'

                const updateData: any = {
                    status_pagamento: status,
                    updated_at: new Date().toISOString()
                }

                // Set payment date when received
                if (event === 'PAYMENT_RECEIVED' && payment.paymentDate) {
                    updateData.data_pagamento = payment.paymentDate
                }

                // Set confirmation date when confirmed
                if (event === 'PAYMENT_CONFIRMED' && payment.confirmedDate) {
                    updateData.data_confirmacao = payment.confirmedDate
                }

                // Set withdrawal availability date (Asaas: estimatedCreditDate or creditDate)
                if (payment.estimatedCreditDate) {
                    updateData.data_disponivel_saque = payment.estimatedCreditDate
                } else if (payment.creditDate) {
                    updateData.data_disponivel_saque = payment.creditDate
                }

                const { error: updateError } = await supabase
                    .from('payment_records')
                    .update(updateData)
                    .eq('id_pagamento_asaas', payment.id)

                if (updateError) {
                    console.error('Error updating payment:', updateError)
                    return new Response('Error processing internal update', { status: 500 })
                }
            }
        }

        // Handle status changes or other events as needed
        // ...

        return new Response(JSON.stringify({ received: true }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        })

    } catch (err) {
        console.error('Webhook processing error:', err)
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { "Content-Type": "application/json" },
            status: 500,
        })
    }
})
