// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[meta-save-token] ⚡ Function started!");

  try {
    const authHeader = req.headers.get("Authorization");
    console.log("[meta-save-token] Authorization header present:", !!authHeader);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader! },
        },
      }
    );

    console.log("[meta-save-token] Validating user via supabase.auth...");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error("[meta-save-token] User validation failed:", userError);
      throw new Error("Não autorizado. Usuário não encontrado.");
    }
    console.log("[meta-save-token] ✅ User validated. auth.users.id:", user.id);

    console.log("[meta-save-token] Parsing request body...");
    let body;
    try {
      body = await req.json();
    } catch (e) {
      throw new Error("Corpo da requisição inválido. Esperado JSON.");
    }
    console.log("[meta-save-token] Request BODY recebido:", JSON.stringify(body));

    const { unitId, type, accessToken, userId } = body;

    if (!unitId || !type || !accessToken) {
      throw new Error("Faltam paramêtros obrigatórios: unitId, type ou accessToken no body.");
    }

    console.log("[meta-save-token] Fetching profile for auth_user_id:", user.id);
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (profileError || !profile) {
       console.error("[meta-save-token] ❌ Profile não encontrado. DB Error:", profileError);
       throw new Error("Perfil de usuário não encontrado no sistema.");
    }
    console.log("[meta-save-token] ✅ Profile found. profile.id:", profile.id);

    const wabaId = "TODO_OBTER_WABA_DO_SDK_OU_API"; 
    const phoneNumberId = "TODO_OBTER_PHONE_ID"; 
    const phoneNumberStr = "+5500000000000"; // Placeholder
    
    console.log("[meta-save-token] Upserting connection into whatsapp_connections...");
    console.log(`[meta-save-token] Payload -> unit_id: ${unitId}, type: ${type}, profile: ${profile.id}`);

    const { error: upsertError } = await supabaseClient
      .from("whatsapp_connections")
      .upsert(
        {
          unit_id: unitId,
          connection_type: type,
          user_id: profile.id, // O ID real do Profile em vez do Auth ID!
          waba_id: wabaId,
          phone_number_id: phoneNumberId,
          phone_number: phoneNumberStr,
          access_token: accessToken,
          status: "connected",
        },
        {
          onConflict: "unit_id, connection_type",
        }
      );

    if (upsertError) {
      console.error("[meta-save-token] ❌ Erro no banco de dados (Upsert):", upsertError);
      throw new Error("Erro ao salvar no banco de dados: " + upsertError.message);
    }
    
    console.log("[meta-save-token] ✅ Database upsert successful!");

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("[meta-save-token] ❌ Catch Error Final:", error.message || error);
    return new Response(JSON.stringify({ error: error.message || "Erro desconhecido" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
