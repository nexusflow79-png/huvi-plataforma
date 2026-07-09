// HUVI — Edge Function: huvi-web-discovery
// Proxy seguro entre o frontend e a API Firecrawl Search.
// Busca oportunidades em websites, blogs e páginas web por keywords.
// Conforme: gemini3.md v2.0 (Modo Descoberta Web)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface WebLead {
  title: string;
  url: string;
  description: string;
  phone?: string;
  email?: string;
}

// ── Constantes de Rate Limit ─────────────────────────────
const MAX_TOTAL_DURATION_MS = 90000;   // Duração máxima total (90s)
const CONCURRENCY_TTL_MS = 20000;      // TTL do lock de concorrência (20s)
const MAX_SCRAPE_CANDIDATES = 5;       // Máximo de sites para extração adicional

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  const abortController = new AbortController();

  const globalTimer = setTimeout(() => {
    abortController.abort();
  }, MAX_TOTAL_DURATION_MS);

  try {
    // ── 1. Validar autenticação ─────────────────────────────
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

    // ── 1b. Rate Limit: Concorrência por tenant ────────────
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
            message: "Já existe uma busca web em andamento. Aguarde a conclusão."
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── 2. Ler parâmetros ─────────────────────────────────
    const body = await req.json();
    let { keywords, include_domains, exclude_domains, source_id, testMode } = body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      clearTimeout(globalTimer);
      return new Response(
        JSON.stringify({ success: false, message: "Parâmetro obrigatório: keywords (array não vazio)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 3. Verificar créditos (por peso de operação) ──────
    const { data: credits } = await supabase
      .from("tenant_credits")
      .select("*")
      .eq("tenant_id", tenantId)
      .single();

    const maxLimit = credits?.analysis_limit ?? 20;
    const used = credits?.analysis_used ?? 0;
    const operationWeight = credits?.weight_firecrawl_audit ?? 3;
    let availableCredits = maxLimit - used;

    if (!testMode && availableCredits < operationWeight) {
      clearTimeout(globalTimer);
      return new Response(
        JSON.stringify({
          success: false,
          message: `Limite de análises do ciclo atingido (${used}/${maxLimit}). Necessário ${operationWeight} crédito(s) por operação.`
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 4. Buscar na Firecrawl Search API (v2) ────────────
    const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");
    const firecrawlApiUrl = Deno.env.get("FIRECRAWL_API_URL") ?? "https://api.firecrawl.dev/v2";

    if (!firecrawlApiKey) {
      return new Response(
        JSON.stringify({ success: false, message: "Configuração de API incompleta (FIRECRAWL_API_KEY)." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Montar query combinando keywords
    const query = keywords.join(" ");
    console.log(`[huvi-web-discovery] Tenant ${tenantId} | Query: "${query}" | Teste: ${!!testMode}`);

    let found = 0;
    let allResults: WebLead[] = [];

    try {
      const searchPayload: Record<string, unknown> = {
        query,
        limit: testMode ? 10 : 30,
        country: "br",
        lang: "pt"
      };

      // Firecrawl v2: includeDomains e excludeDomains são mutuamente exclusivos
      // Limpar domínios: remover protocolo, path, www
      const cleanDomain = (d: unknown) => {
        const cleaned = String(d).trim()
          .replace(/^https?:\/\//, '')
          .replace(/\/.*$/, '')
          .replace(/^www\./, '')
          .toLowerCase();
        // Firecrawl requires a full valid hostname (e.g., example.com)
        // Discard loose TLDs like '.com' or strings without dots
        if (cleaned.startsWith('.') || !cleaned.includes('.')) return null;
        return cleaned;
      };
      
      if (include_domains && include_domains.length > 0) {
        const domains = include_domains.map(cleanDomain).filter(Boolean);
        if (domains.length > 0) searchPayload.includeDomains = domains;
      } else if (exclude_domains && exclude_domains.length > 0) {
        const domains = exclude_domains.map(cleanDomain).filter(Boolean);
        if (domains.length > 0) searchPayload.excludeDomains = domains;
      }

      const searchResponse = await fetch(`${firecrawlApiUrl}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${firecrawlApiKey}`,
        },
        body: JSON.stringify(searchPayload),
        signal: AbortSignal.any([
          AbortSignal.timeout(30000),
          abortController.signal,
        ]),
      });

      if (!searchResponse.ok) {
        const errText = await searchResponse.text();
        throw new Error(`Firecrawl Search API HTTP ${searchResponse.status}: ${errText}`);
      }

      const searchData = await searchResponse.json();
      const results = searchData?.data?.web ?? searchData?.data ?? [];

      // Extrair dados estruturados
      for (const item of results) {
        allResults.push({
          title: item.title || item.metadata?.title || "",
          url: item.url || "",
          description: item.description || item.metadata?.description || "",
        });
      }

      found = allResults.length;

      // ── 5. Extração adicional (tentar extrair contatos via scrape) ──
      // Limitado a MAX_SCRAPE_CANDIDATES para não exceder rate limit da API
      const scrapeCandidates = allResults.slice(0, testMode ? 2 : MAX_SCRAPE_CANDIDATES);
      const scrapePromises = scrapeCandidates.map(async (lead) => {
        try {
          const scrapePayload = {
            url: lead.url,
            formats: ["json"],
            jsonOptions: {
              prompt: "Extract the business name, phone number, and email address from this page.",
              schema: {
                type: "object",
                properties: {
                  business_name: { type: "string" },
                  phone: { type: "string" },
                  email: { type: "string" },
                },
              },
            },
            onlyMainContent: true,
          };

          const scrapeResponse = await fetch(`${firecrawlApiUrl}/scrape`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${firecrawlApiKey}`,
            },
            body: JSON.stringify(scrapePayload),
            signal: AbortSignal.any([
              AbortSignal.timeout(15000),
              abortController.signal,
            ]),
          });

          if (scrapeResponse.ok) {
            const scrapeData = await scrapeResponse.json();
            const extracted = scrapeData?.data?.json;
            if (extracted) {
              lead.phone = extracted.phone || undefined;
              lead.email = extracted.email || undefined;
              if (extracted.business_name) {
                lead.title = extracted.business_name;
              }
            }
          }
        } catch {
          // Falha no scrape não interrompe o fluxo
        }
      });

      await Promise.allSettled(scrapePromises);

    } catch (err: any) {
      if (err?.name === "AbortError" || abortController.signal.aborted) {
        clearTimeout(globalTimer);
        return new Response(
          JSON.stringify({
            success: false,
            message: "⏱️ A busca web excedeu o tempo limite da API (90s). Tente com menos palavras-chave.",
            timed_out: true,
          }),
          { status: 408, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("[huvi-web-discovery] Erro na API:", err);
      clearTimeout(globalTimer);
      return new Response(
        JSON.stringify({
          success: false,
          message: `Erro na busca: ${err?.message ?? "Erro desconhecido"}`,
          error_name: err?.name || null,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 6. Deduplicação + Scoring ──────────────────────────
    const { data: existingOpps } = await supabase
      .from("opportunities")
      .select("phone, website, email")
      .eq("tenant_id", tenantId)
      .limit(5000);

    const existingPhones = new Set((existingOpps ?? []).map(o => o.phone).filter(Boolean));
    const existingWebsites = new Set((existingOpps ?? []).map(o => o.website).filter(Boolean));
    const existingEmails = new Set((existingOpps ?? []).map(o => o.email).filter(Boolean));

    const validLeads: Record<string, unknown>[] = [];
    let duplicates = 0;
    const currentSessionKeys = new Set<string>();

    for (const lead of allResults) {
      if (!lead.title && !lead.url) continue;

      const siteKey = lead.url || null;
      const phoneKey = lead.phone || null;
      const emailKey = lead.email || null;
      const sessionKey = phoneKey || siteKey || emailKey || lead.title;

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
      if (lead.url) score += 20;
      if (lead.email) score += 15;
      if (lead.description && lead.description.length > 100) score += 10;
      if (lead.title && lead.title.length > 3) score += 10;

      validLeads.push({
        tenant_id: tenantId,
        source_id: source_id || null,
        company_name: lead.title,
        website: lead.url || null,
        email: lead.email || null,
        phone: lead.phone || null,
        description: lead.description || null,
        origin: "Web Discovery",
        source_service: "Firecrawl",
        status: score >= 60 ? "scored" : "discovered",
        score,
      });
    }

    // ── 7. Aplicar limite de créditos ─────────────────────
    let leadsToInsert = validLeads;
    if (!testMode && availableCredits < validLeads.length) {
      leadsToInsert = validLeads.slice(0, availableCredits);
    }

    // ── 8. Inserir no Supabase ────────────────────────────
    let created = 0;
    let insertErrors = 0;

    if (!testMode && leadsToInsert.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < leadsToInsert.length; i += batchSize) {
        const batch = leadsToInsert.slice(i, i + batchSize);
        const { error: insertError } = await supabase.from("opportunities").insert(batch);
        if (insertError) {
          console.error("[huvi-web-discovery] Erro inserir lote:", insertError);
          insertErrors += batch.length;
        } else {
          created += batch.length;
        }
      }
    } else if (testMode) {
      created = leadsToInsert.length;
    }

    // ── 9. Atualizar créditos (custo fixo por operação) ──
    if (!testMode && credits) {
      const cost = operationWeight;
      const newUsed = used + cost;
      await supabase
        .from("tenant_credits")
        .update({ analysis_used: newUsed })
        .eq("tenant_id", tenantId);
    }

    // ── 10. Registrar Log ─────────────────────────────────
    const tempoTotalMs = Date.now() - startTime;
    await supabase.from("web_search_log").insert({
      tenant_id: tenantId,
      keywords,
      include_domains: include_domains || null,
      exclude_domains: exclude_domains || null,
      results_count: found,
      valid_count: created,
      duplicates_count: duplicates,
      errors_count: insertErrors,
      status: "completed",
    });

    console.log(`[huvi-web-discovery] ${tempoTotalMs}ms: ${found} enc, ${created} cri, ${duplicates} dup`);

    const timeWarning = tempoTotalMs > MAX_TOTAL_DURATION_MS * 0.7
      ? `⏱️ A busca demorou ${(tempoTotalMs / 1000).toFixed(0)}s. Para melhor performance, use menos palavras-chave.`
      : "";

    clearTimeout(globalTimer);
    return new Response(
      JSON.stringify({
        success: true,
        found,
        created,
        duplicates,
        errors: insertErrors,
        credits: testMode ? 0 : operationWeight,
        testMode: !!testMode,
        timeWarning,
        debug_msg: insertErrors > 0 ? `${insertErrors} erros na inserção.` : "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    clearTimeout(globalTimer);
    if (err?.name === "AbortError" || abortController.signal.aborted) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "⏱️ A busca web excedeu o tempo limite global (90s).",
          timed_out: true,
        }),
        { status: 408, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.error("[huvi-web-discovery] Erro inesperado:", err);
    const errBody = JSON.stringify({
      success: false,
      message: `Erro interno: ${err?.message ?? "Erro desconhecido"}`,
      error_stack: err?.stack || null,
      error_name: err?.name || null,
    });
    console.error("[huvi-web-discovery] Retornando 500:", errBody);
    return new Response(errBody, { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
