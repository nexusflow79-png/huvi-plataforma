// HUVI — Edge Function: huvi-n8n-proxy
// Proxy seguro para ocultar as URLs do n8n do frontend.
// Garante que apenas usuários autenticados possam acionar automações internas.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "https://huvi.nexus-flow.tech";

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// URL base do n8n vem das secrets do Supabase
const n8nBaseUrl = Deno.env.get("N8N_BASE_URL") || "https://n8n.nexus-flow.tech";

// Mapa de alvos permitidos para não expor as rotas reais no payload
const N8N_TARGETS: Record<string, string> = {
  PIPELINE: `${n8nBaseUrl}/webhook/huvi-opportunity-pipeline`,
  DISPATCHER: `${n8nBaseUrl}/webhook/huvi-dispatcher`,
  WHATSAPP_CONNECT: `${n8nBaseUrl}/webhook/huvi-whatsapp-connect`,
  CONVERSION: `${n8nBaseUrl}/webhook/huvi-conversion`
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── 1. Validar autenticação do Supabase ─────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: "Não autorizado. Faça login." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: "Sessão inválida ou expirada." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Opcional: Pegar o tenant_id para garantir que o usuário pertence a um tenant (validação extra)
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("auth_user_id", user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(
        JSON.stringify({ success: false, message: "Perfil de tenant não encontrado." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Ler e Validar o Payload da Requisição ────────────────────────
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ success: false, message: "Payload JSON inválido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { target, payload } = requestBody;

    if (!target || !N8N_TARGETS[target]) {
      return new Response(
        JSON.stringify({ success: false, message: "Alvo (target) inválido ou não permitido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const n8nWebhookUrl = N8N_TARGETS[target];

    // Aqui podemos injetar o tenant_id real forçadamente no payload para evitar Spoofing (Segurança Avançada)
    // Se o payload for um objeto, garantimos que a automação receba o tenant_id de quem disparou.
    const securePayload = typeof payload === 'object' && payload !== null 
      ? { ...payload, _secure_tenant_id: profile.tenant_id } 
      : payload;

    // ── 3. Repassar a requisição ao n8n ────────────────────────────────
    // Opcionalmente no futuro, podemos passar um header de autorização "N8N_SECRET_KEY" aqui
    // const n8nSecret = Deno.env.get("N8N_SECRET_KEY") ?? "";

    const n8nController = new AbortController();
    const n8nTimeout = setTimeout(() => n8nController.abort(), 25000);

    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // "Authorization": `Bearer ${n8nSecret}`, // Descomente quando configurar auth no Webhook do n8n
      },
      body: JSON.stringify(securePayload),
      signal: n8nController.signal
    }).finally(() => clearTimeout(n8nTimeout));

    let n8nData;
    try {
      n8nData = await n8nResponse.json();
    } catch (e) {
      // O n8n às vezes retorna apenas "Workflow started" em texto puro se for assíncrono
      n8nData = { message: "Requisição aceita pelo servidor de automação." };
    }

    if (!n8nResponse.ok) {
      console.error(`Erro no n8n (${n8nResponse.status}):`, n8nData);
      return new Response(
        JSON.stringify({ success: false, message: "Erro no processamento da automação.", details: n8nData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: n8nData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[huvi-n8n-proxy] Erro Interno:", err);
    return new Response(
      JSON.stringify({ success: false, message: "Erro interno no servidor (Proxy).", error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
