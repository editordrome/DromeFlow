import { serve } from "std/http/server.ts"

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
    // Manejo de preflight CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: CORS_HEADERS })
    }

    try {
        const { url, method, headers, body } = await req.json()

        if (!url) {
            return new Response(JSON.stringify({ error: 'Missing target URL' }), {
                status: 400,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            })
        }

        console.log(`Proxying request: ${method} ${url}`)

        // Realizar a chamada real para o Typebot
        const response = await fetch(url, {
            method: method || 'GET',
            headers: headers || {},
            body: body ? JSON.stringify(body) : undefined
        })

        const responseData = await response.text()
        let parsedData
        try {
            parsedData = JSON.parse(responseData)
        } catch {
            parsedData = responseData
        }

        return new Response(JSON.stringify(parsedData), {
            status: response.status,
            headers: {
                ...CORS_HEADERS,
                'Content-Type': 'application/json'
            }
        })

    } catch (error: any) {
        console.error('Proxy Error:', error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        })
    }
})
