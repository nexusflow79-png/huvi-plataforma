// HUVI — Edge Function: huvi-asaas-webhook
// Recebe webhooks do Asaas e atualiza status de assinatura dos tenants

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── 1. Validar autenticação do webhook ──────────────────
    const authHeader = req.headers.get("Authorization");
    const asaasTokenHeader = req.headers.get("asaas-access-token");
    
    // Suportar tanto a chave de Produção quanto a do Sandbox simultaneamente
    const asaasApiKeyProd = Deno.env.get("ASAAS_API_KEY");
    const asaasApiKeySandbox = Deno.env.get("ASAAS_API_KEY_SANDBOX");

    // Asaas envia o access_token no header asaas-access-token (ou Authorization dependendo da config)
    let webhookToken = "";
    if (asaasTokenHeader) {
      webhookToken = asaasTokenHeader;
    } else if (authHeader) {
      webhookToken = authHeader.replace("Bearer ", "");
    }

    // Verificar se o token é válido (sandbox ou production key)
    const isProdKeyValid = asaasApiKeyProd && webhookToken === asaasApiKeyProd;
    const isSandboxKeyValid = asaasApiKeySandbox && webhookToken === asaasApiKeySandbox;

    if (!isProdKeyValid && !isSandboxKeyValid) {
      console.warn("=========================================");
      console.warn("[huvi-asaas-webhook] FALHA DE AUTENTICAÇÃO!");
      console.warn(`Token Recebido do Asaas : "${webhookToken}"`);
      console.warn(`Token Produção Esperado : "${asaasApiKeyProd}"`);
      console.warn(`Token Sandbox Esperado  : "${asaasApiKeySandbox}"`);
      console.warn("DICA: Verifique se os tokens não possuem espaços em branco no final lá no painel do Supabase Secrets.");
      console.warn("=========================================");
      return new Response(
        JSON.stringify({ success: false, message: "Token inválido." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Processar payload ───────────────────────────────
    const body = await req.json();
    const event = body.event;

    // Asaas envia os dados dentro de "payment" (para eventos de cobrança) 
    // ou "subscription" (para eventos de assinatura propriamente ditos).
    let subscriptionId = "";
    if (body.payment && body.payment.subscription) {
      subscriptionId = body.payment.subscription;
    } else if (body.subscription && body.subscription.id) {
      subscriptionId = body.subscription.id;
    }

    if (!event || !subscriptionId) {
      console.log(`[huvi-asaas-webhook] Evento ignorado: Sem ID de assinatura atrelada. (Pagamento Avulso)`);
      return new Response(
        JSON.stringify({ success: true, message: "Pagamento avulso ignorado com sucesso (não é assinatura)." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[huvi-asaas-webhook] Evento: ${event} | Subscription ID: ${subscriptionId}`);

    // ── 3. Log do evento ──────────────────────────────────
    await supabase.from("asaas_webhook_log").insert({
      event,
      asaas_id: subscriptionId,
      payload: body,
      processed: false,
    });

    // ── 4. Mapear status ──────────────────────────────────
    let newStatus: string | null = null;

    switch (event) {
      case "PAYMENT_RECEIVED":
      case "PAYMENT_CONFIRMED":
        newStatus = "active";
        break;

      case "PAYMENT_OVERDUE":
      case "PAYMENT_DELETED":
        newStatus = "overdue";
        break;

      case "SUBSCRIPTION_CANCELED":
      case "SUBSCRIPTION_INACTIVATED":
      case "SUBSCRIPTION_DELETED":
        newStatus = "canceled";
        break;

      case "SUBSCRIPTION_REACTIVATED":
        newStatus = "active";
        break;

      default:
        console.log(`[huvi-asaas-webhook] Evento ignorado: ${event}`);
    }

    // ── 5. Atualizar tenant ───────────────────────────────
    if (newStatus) {
      const { data: tenant, error: findError } = await supabase
        .from("tenants")
        .select("id")
        .eq("asaas_subscription_id", subscriptionId)
        .single();

      if (findError || !tenant) {
        console.error("[huvi-asaas-webhook] Tenant não encontrado para subscription:", subscriptionId);
        return new Response(
          JSON.stringify({ success: false, message: "Tenant não encontrado." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Atualizar status
      const { error: updateError } = await supabase
        .from("tenants")
        .update({
          subscription_status: newStatus,
          subscription_updated_at: new Date().toISOString(),
        })
        .eq("id", tenant.id);

      if (updateError) {
        console.error("[huvi-asaas-webhook] Erro atualizar tenant:", updateError);
        return new Response(
          JSON.stringify({ success: false, message: "Erro ao atualizar tenant." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Atualizar logs processados
      await supabase
        .from("asaas_webhook_log")
        .update({ processed: true })
        .eq("event", event)
        .eq("asaas_id", subscriptionId);

      console.log(`[huvi-asaas-webhook] Tenant ${tenant.id} atualizado para ${newStatus}`);
    }

    return new Response(
      JSON.stringify({ success: true, event, status: newStatus }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[huvi-asaas-webhook] Erro inesperado:", err);
    return new Response(
      JSON.stringify({ success: false, message: `Erro interno: ${err?.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
