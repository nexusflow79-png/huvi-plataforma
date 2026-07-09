// HUVI — Edge Function: huvi-asaas-subscription
// Cria gerencia assinaturas de tenants via API Asaas (sandbox)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ASAAS_API_URL = Deno.env.get("ASAAS_API_URL") ?? "https://sandbox.asaas.com/api/v3";

const PLANS: Record<string, { name: string; value: number; cycle: string }> = {
  starter: { name: "HUVI Starter", value: 59.00, cycle: "MONTHLY" },
  pro:     { name: "HUVI Pro",     value: 97.00, cycle: "MONTHLY" },
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── 1. Autenticar ──────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: "Não autorizado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: "Token inválido." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id, full_name, email")
      .eq("auth_user_id", user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(
        JSON.stringify({ success: false, message: "Tenant não encontrado." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = profile.tenant_id;

    // ── 2. Ler parâmetros ─────────────────────────────────
    const body = await req.json();
    const { plan } = body;

    if (!plan || !PLANS[plan]) {
      return new Response(
        JSON.stringify({ success: false, message: `Plano inválido. Opções: ${Object.keys(PLANS).join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const planInfo = PLANS[plan];

    // ── 3. Verificar se já existe assinatura ativa ─────────
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, name, email, asaas_customer_id, asaas_subscription_id, subscription_status")
      .eq("id", tenantId)
      .single();

    if (tenant?.subscription_status === "active") {
      return new Response(
        JSON.stringify({ success: false, message: "Tenant já possui assinatura ativa." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 4. Criar ou buscar customer no Asaas ──────────────
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    if (!asaasApiKey) {
      return new Response(
        JSON.stringify({ success: false, message: "API key do Asaas não configurada." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let customerId = tenant?.asaas_customer_id;

    if (!customerId) {
      // Criar customer
      const customerRes = await fetch(`${ASAAS_API_URL}/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${asaasApiKey}`,
        },
        body: JSON.stringify({
          name: profile.full_name || tenant?.name || "HUVI Tenant",
          email: profile.email || tenant?.email,
          cpfCnpj: "",  // Pode ser preenchido depois
          phone: "",
        }),
      });

      const customerData = await customerRes.json();

      if (!customerRes.ok || !customerData.id) {
        console.error("[huvi-asaas] Erro criar customer:", customerData);
        return new Response(
          JSON.stringify({ success: false, message: "Erro ao criar cliente no Asaas." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      customerId = customerData.id;

      // Salvar no banco
      await supabase
        .from("tenants")
        .update({ asaas_customer_id: customerId })
        .eq("id", tenantId);
    }

    // ── 5. Criar assinatura no Asaas ──────────────────────
    const subscriptionRes = await fetch(`${ASAAS_API_URL}/subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${asaasApiKey}`,
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: "UNDEFINED",
        value: planInfo.value,
        cycle: planInfo.cycle,
        description: planInfo.name,
        nextDueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 7 dias
      }),
    });

    const subscriptionData = await subscriptionRes.json();

    if (!subscriptionRes.ok || !subscriptionData.id) {
      console.error("[huvi-asaas] Erro criar assinatura:", subscriptionData);
      return new Response(
        JSON.stringify({ success: false, message: "Erro ao criar assinatura no Asaas." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 6. Gerar link de pagamento ────────────────────────
    const paymentLinkRes = await fetch(`${ASAAS_API_URL}/subscriptions/${subscriptionData.id}/subscriptionWithDiscount`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${asaasApiKey}`,
      },
    });

    // Fallback: usar link direto do Asaas
    let checkoutUrl = subscriptionData.subscriptionUrl;
    if (!checkoutUrl) {
      checkoutUrl = `https://sandbox.asaas.com/payment/${subscriptionData.id}`; // sandbox
      // Em produção: https://www.asaas.com/payment/${subscriptionData.id}
    }

    // ── 7. Salvar no banco ────────────────────────────────
    await supabase
      .from("tenants")
      .update({
        asaas_subscription_id: subscriptionData.id,
        subscription_status: "pending",
        subscription_updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId);

    return new Response(
      JSON.stringify({
        success: true,
        subscription_id: subscriptionData.id,
        checkout_url: checkoutUrl,
        plan,
        value: planInfo.value,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[huvi-asaas] Erro inesperado:", err);
    return new Response(
      JSON.stringify({ success: false, message: `Erro interno: ${err?.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
