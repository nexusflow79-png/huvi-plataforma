// HUVI — Edge Function: huvi-discovery
// Proxy seguro entre o frontend e a API Outscraper.
// Suporta busca paralela segmentada por zonas geográficas.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Constantes de Rate Limit (PRD v1.0) ──────────────────
const MAX_ZONES_PER_EXECUTION = 25;    // Máximo de zonas processadas por chamada (PRD: até 50)
const ZONE_TIMEOUT_MS = 45000;          // Timeout por zona (PRD: 45s)
const BATCH_DELAY_MS = 500;             // Delay entre lotes (500ms)
const BATCH_SIZE = 5;                   // Zonas por lote paralelo
const MAX_TOTAL_DURATION_MS = 180000;   // Duração máxima total (PRD: 3 min)
const CONCURRENCY_TTL_MS = 45000;       // TTL do lock de concorrência (45s)
const MIN_REQUEST_INTERVAL_MS = 15000;  // Intervalo mínimo entre buscas do mesmo tenant (15s)

// Helper: Delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  const ciclo_id = crypto.randomUUID();
  const abortController = new AbortController();

  // Timeout global: interrompe a função se exceder a duração máxima
  const globalTimer = setTimeout(() => {
    abortController.abort();
  }, MAX_TOTAL_DURATION_MS);

  try {
    // ── 1. Validar autenticação (JWT) ──────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      clearTimeout(globalTimer);
      return new Response(
        JSON.stringify({ success: false, message: "Não autorizado. Faça login no HUVI." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      clearTimeout(globalTimer);
      return new Response(
        JSON.stringify({ success: false, message: "Token inválido ou expirado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("auth_user_id", user.id)
      .single();

    if (!profile?.tenant_id) {
      clearTimeout(globalTimer);
      return new Response(
        JSON.stringify({ success: false, message: "Perfil de tenant não encontrado." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = profile.tenant_id;

    // ── 2. Rate Limit: Controle de concorrência por tenant ──
    // Usa uma tabela de lock para impedir buscas simultâneas do mesmo tenant
    const lockKey = `discovery_lock_${tenantId}`;

    // Verificar lock existente
    const { data: existingLock } = await supabase
      .from("web_search_queue")
      .select("id, created_at")
      .eq("tenant_id", tenantId)
      .eq("status", "processing")
      .limit(1)
      .maybeSingle();

    if (existingLock) {
      const lockAge = Date.now() - new Date(existingLock.created_at).getTime();
      if (lockAge < CONCURRENCY_TTL_MS) {
        clearTimeout(globalTimer);
        return new Response(
          JSON.stringify({
            success: false,
            message: `Já existe uma busca em andamento para este tenant. Aguarde a conclusão.`
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Lock expirado: podemos prosseguir
    }

    // ── 3. Ler parâmetros ───────────────────────────────────
    const body = await req.json();
    let { segment, state, city, zones, testMode } = body;

    if (!segment || !state || !city) {
      clearTimeout(globalTimer);
      return new Response(
        JSON.stringify({ success: false, message: "Parâmetros obrigatórios: segment, state, city." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 4. Verificar créditos disponíveis ────────────────────────────────
    const { data: credits } = await supabase
      .from("tenant_credits")
      .select("*")
      .eq("tenant_id", tenantId)
      .single();

    const maxLimit = credits?.opportunity_limit ?? 80;
    const used = credits?.opportunity_used ?? 0;
    const operationWeight = credits?.weight_outscraper_search ?? 1;
    let availableCredits = maxLimit - used;

    if (!testMode && availableCredits < operationWeight) {
      clearTimeout(globalTimer);
      return new Response(
        JSON.stringify({
          success: false,
          message: `Limite de créditos do ciclo atingido (${used}/${maxLimit}). Necessário ${operationWeight} crédito(s) por operação.`
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 5. Definir Zonas (Lookup se necessário) ─────────────────────────
    if (!zones || !Array.isArray(zones) || zones.length === 0) {
      const { data: cityZones } = await supabase
        .from("city_zones")
        .select("zones")
        .eq("state", state)
        .eq("city", city)
        .single();
      
      if (cityZones?.zones && Array.isArray(cityZones.zones) && cityZones.zones.length > 0) {
        zones = cityZones.zones;
      } else {
        zones = [""]; // Fallback: 1 zona em branco = busca cidade inteira
      }
    }

    if (testMode) {
      zones = zones.slice(0, 2); // Modo teste: max 2 zonas
    }

    // ── 5b. Rate Limit: Cap de zonas para evitar execução muito longa ──
    const totalZones = zones.length;
    if (totalZones > MAX_ZONES_PER_EXECUTION && !testMode) {
      console.warn(
        `[huvi-discovery] Tenant ${tenantId} | Cidade ${city} tem ${totalZones} zonas, limitando a ${MAX_ZONES_PER_EXECUTION}`
      );
      zones = zones.slice(0, MAX_ZONES_PER_EXECUTION);
    }

    // Estimar tempo e verificar se vale a pena prosseguir
    const estimatedBatches = Math.ceil(zones.length / BATCH_SIZE);
    const estimatedTimeMs = zones.length * 15000 + (estimatedBatches - 1) * BATCH_DELAY_MS; // ~15s média por zona
    const timeWarning = estimatedTimeMs > 60000
      ? `Estimativa de ${Math.ceil(estimatedTimeMs / 1000)}s para processar ${zones.length} zonas.`
      : null;

    // ── 6. Buscar na Outscraper (Rate Limited) ─────────────────────
    const outscraper_api_key = Deno.env.get("OUTSCRAPER_API_KEY");
    if (!outscraper_api_key) {
      clearTimeout(globalTimer);
      return new Response(
        JSON.stringify({ success: false, message: "Configuração de API incompleta." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[huvi-discovery] Tenant ${tenantId} | Teste: ${!!testMode} | Zonas: ${zones.length}/${totalZones} originais`);

    const fetchZone = async (zona: string, attempt = 1): Promise<{zona: string, leads: any[]}> => {
      if (abortController.signal.aborted) {
        throw new Error("Execução cancelada por timeout global.");
      }

      const locationQuery = zona ? `${zona} ${city} - ${state}` : `${city} - ${state}`;
      const searchQuery = encodeURIComponent(`${segment} em ${locationQuery}`);
      const outscrapeUrl = `https://api.outscraper.com/maps/search-v2?query=${searchQuery}&limit=20&language=pt&async=false`;

      try {
        const response = await fetch(outscrapeUrl, {
          headers: { "X-API-KEY": outscraper_api_key },
          signal: AbortSignal.timeout(ZONE_TIMEOUT_MS),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        
        if (data.status && data.status !== "Success" && data.status !== "Pending") {
           throw new Error(`API: ${data.status}`);
        }

        const leads = data?.data?.[0] ?? [];
        return { zona: zona || "Cidade Inteira", leads };
      } catch (err: any) {
        if (attempt < 2 && !abortController.signal.aborted) {
          console.warn(`[huvi-discovery] Retry zona "${zona}" (${err.message})`);
          await delay(1500);
          return fetchZone(zona, attempt + 1);
        }
        console.error(`[huvi-discovery] Falha final zona "${zona}": ${err.message}`);
        throw err;
      }
    };

    let allLeads: any[] = [];
    let fetchErrors = 0;
    const fetchErrorMessages: string[] = [];
    
    for (let i = 0; i < zones.length && !abortController.signal.aborted; i += BATCH_SIZE) {
      const batch = zones.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map(z => fetchZone(z)));
      
      for (const res of results) {
        if (res.status === "fulfilled") {
          const zoneLeads = res.value.leads.map((l: any) => ({ ...l, _zonaOrigem: res.value.zona }));
          allLeads = allLeads.concat(zoneLeads);
        } else {
          fetchErrors++;
          const errMsg = res.reason instanceof Error ? res.reason.message : String(res.reason);
          fetchErrorMessages.push(errMsg);
        }
      }
      if (i + BATCH_SIZE < zones.length && !abortController.signal.aborted) {
        await delay(BATCH_DELAY_MS);
      }
    }

    const found = allLeads.length;

    // ── 7. Deduplicação + Score ───────────────────────────────────────────
    const { data: existingOpps } = await supabase
      .from("opportunities")
      .select("phone, website, email")
      .eq("tenant_id", tenantId)
      .limit(5000);

    const existingPhones = new Set((existingOpps ?? []).map(o => o.phone).filter(Boolean));
    const existingWebsites = new Set((existingOpps ?? []).map(o => o.website).filter(Boolean));
    const existingEmails = new Set((existingOpps ?? []).map(o => o.email).filter(Boolean));

    const validLeads: any[] = [];
    let duplicates = 0;
    
    // Para evitar duplicatas na mesma busca
    const currentSessionKeys = new Set();

    for (const lead of allLeads) {
      if (!lead?.name) continue;

      // Extrair primeiro email (se array)
      let leadEmail = null;
      if (lead.email) leadEmail = lead.email;
      else if (lead.emails && Array.isArray(lead.emails) && lead.emails.length > 0) leadEmail = lead.emails[0];

      const phoneKey = lead.phone || null;
      const siteKey = lead.site || null;
      const emailKey = leadEmail || null;
      
      // BLINDAGEM DA FONTE: Só aceita o lead se houver pelo menos uma forma de contato
      if (!phoneKey && !siteKey && !emailKey) {
        continue; // Descarta lead sem contato
      }
      
      const sessionKey = phoneKey || siteKey || emailKey || lead.name;

      const isDuplicate =
        (phoneKey && existingPhones.has(phoneKey)) ||
        (siteKey && existingWebsites.has(siteKey)) ||
        (emailKey && existingEmails.has(emailKey)) ||
        currentSessionKeys.has(sessionKey);

      if (isDuplicate) {
        duplicates++;
        continue;
      }

      currentSessionKeys.add(sessionKey);

      let score = 0;
      if (lead.phone) score += 15;
      if (lead.site) score += 20;
      if (lead.rating >= 4.0) score += 20;
      if (lead.reviews >= 50) score += 15;
      if (lead.full_address) score += 10;
      if (lead.type) score += 20;

      validLeads.push({
        tenant_id: tenantId,
        company_name: lead.name,
        email: emailKey,
        phone: lead.phone ?? null,
        website: lead.site ?? null,
        address: lead.full_address ?? null,
        city,
        state,
        rating_value: lead.rating ?? null,
        rating_count: lead.reviews ?? null,
        google_maps_url: lead.business_url ?? null,
        category: lead.type ?? null,
        origin: "Google Maps",
        source_service: "Outscraper",
        status: score >= 60 ? "scored" : "discovered",
        score,
        zona_origem: lead._zonaOrigem,
        ciclo_id
      });
    }

    // ── 8. Aplicar limite de créditos ──────────────────────────────────────
    let leadsToInsert = validLeads;
    if (!testMode && availableCredits < validLeads.length) {
      leadsToInsert = validLeads.slice(0, availableCredits);
      // Os leads descartados por falta de crédito viram "erros" de inserção
    }

    // ── 9. Inserir no Supabase (se não for modo teste) ───────────────────
    let created = 0;
    let insertErrors = 0;

    if (!testMode && leadsToInsert.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < leadsToInsert.length; i += batchSize) {
        const batch = leadsToInsert.slice(i, i + batchSize);
        // Remove a propriedade temporária se existir
        batch.forEach(b => delete b._zonaOrigem);
        
        const { error: insertError } = await supabase.from("opportunities").insert(batch);
        if (insertError) {
          console.error(`[huvi-discovery] Erro inserir lote ${i}:`, insertError);
          insertErrors += batch.length;
        } else {
          created += batch.length;
        }
      }
    } else if (testMode) {
      created = leadsToInsert.length; // Simula criação no modo teste
    }

    // ── 10. Atualizar créditos (custo fixo por operação, não por lead) ──
    if (!testMode && credits) {
      const cost = operationWeight;
      const newUsed = used + cost;
      await supabase
        .from("tenant_credits")
        .update({ opportunity_used: newUsed })
        .eq("tenant_id", tenantId);
    }

    // ── 11. Registrar Log ────────────────────────────────────────────────
    const tempoTotalMs = Date.now() - startTime;
    await supabase.from("outscraper_search_log").insert({
      tenant_id: tenantId,
      segment,
      state,
      city,
      results_count: found,
      valid_count: created,
      duplicates_count: duplicates,
      errors_count: insertErrors + fetchErrors,
      status: "completed",
      zonas_executadas: zones,
      tempo_total_ms: tempoTotalMs,
      ciclo_id
    });

    console.log(`[huvi-discovery] Concluído em ${tempoTotalMs}ms: ${found} enc, ${created} cri, ${duplicates} dup`);

    // ── 12. Retornar Resumo ───────────────────────────────────────────────
    clearTimeout(globalTimer);
    return new Response(
      JSON.stringify({
        success: true,
        found,
        created,
        duplicates,
        errors: insertErrors + fetchErrors,
        credits: testMode ? 0 : operationWeight,
        testMode: !!testMode,
        zonas_processadas: zones.length,
        zonas_originais: totalZones,
        zonas_limitadas: totalZones > zones.length,
        timeWarning,
        tempo_total_ms: tempoTotalMs,
        debug_msg: (insertErrors > 0 || fetchErrors > 0) ? `Alguns erros ocorreram. Inserção: ${insertErrors}. API (${fetchErrors} erros): ${fetchErrorMessages.join("; ")}.` : ''
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    clearTimeout(globalTimer);
    console.error("[huvi-discovery] Erro inesperado:", err);
    if (abortController.signal.aborted) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "A busca foi interrompida por tempo limite. Sua cidade tem muitas zonas. Tente com um segmento mais específico, use menos zonas ou ative o modo teste.",
          timed_out: true
        }),
        { status: 408, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({
        success: false,
        message: `Erro interno: ${err?.message ?? "Erro desconhecido"}`
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
