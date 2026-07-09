-- ============================================================
-- HUVI — Migration 010: Credit Weight System
-- Modelo de créditos por peso de operação (gemini3.md v2.1)
-- ============================================================

-- ============================================================
-- 1. ALTERAR TABELA: tenant_credits
-- Adicionar pesos por tipo de operação
-- As colunas originais opportunity_used/analysis_used são
-- preservadas para compatibilidade com o fluxo existente.
-- ============================================================
ALTER TABLE public.tenant_credits
  ADD COLUMN IF NOT EXISTS weight_outscraper_search integer NOT NULL DEFAULT 1;

ALTER TABLE public.tenant_credits
  ADD COLUMN IF NOT EXISTS weight_firecrawl_search integer NOT NULL DEFAULT 2;

ALTER TABLE public.tenant_credits
  ADD COLUMN IF NOT EXISTS weight_firecrawl_scrape integer NOT NULL DEFAULT 1;

ALTER TABLE public.tenant_credits
  ADD COLUMN IF NOT EXISTS weight_firecrawl_audit integer NOT NULL DEFAULT 3;

COMMENT ON COLUMN public.tenant_credits.weight_outscraper_search IS 'Créditos HUVI consumidos por operação de busca Outscraper';
COMMENT ON COLUMN public.tenant_credits.weight_firecrawl_search IS 'Créditos HUVI consumidos por operação de busca Firecrawl';
COMMENT ON COLUMN public.tenant_credits.weight_firecrawl_scrape IS 'Créditos HUVI consumidos por análise individual de site (Firecrawl Scrape)';
COMMENT ON COLUMN public.tenant_credits.weight_firecrawl_audit IS 'Créditos HUVI consumidos por auditoria completa (Search + Scrape + extração)';

-- ============================================================
-- 2. ATUALIZAR FUNÇÃO: handle_new_user()
-- Incluir defaults dos pesos no onboarding
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id uuid;
BEGIN
  -- Criar tenant
  INSERT INTO public.tenants (name, email)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  RETURNING id INTO new_tenant_id;

  -- Criar profile
  INSERT INTO public.profiles (tenant_id, auth_user_id, full_name, email, role)
  VALUES (
    new_tenant_id,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'owner'
  );

  -- Criar preferências de comunicação padrão
  INSERT INTO public.communication_preferences (tenant_id)
  VALUES (new_tenant_id);

  -- Criar créditos com defaults + pesos
  INSERT INTO public.tenant_credits (
    tenant_id,
    opportunity_limit,
    opportunity_used,
    analysis_limit,
    analysis_used,
    firecrawl_min_score,
    firecrawl_status,
    weight_outscraper_search,
    weight_firecrawl_search,
    weight_firecrawl_scrape,
    weight_firecrawl_audit
  ) VALUES (
    new_tenant_id,
    80,    -- opportunity_limit
    0,     -- opportunity_used
    20,    -- analysis_limit
    0,     -- analysis_used
    40,    -- firecrawl_min_score
    'active',
    1,     -- weight_outscraper_search
    2,     -- weight_firecrawl_search
    1,     -- weight_firecrawl_scrape
    3      -- weight_firecrawl_audit
  );

  -- Salvar tenant_id nos metadados do usuário para JWT
  UPDATE auth.users
  SET raw_app_meta_data =
    COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('tenant_id', new_tenant_id)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. ATUALIZAR FUNÇÃO: reset_expired_credits()
-- Reset mantém os pesos inalterados (só zera contadores)
-- ============================================================
CREATE OR REPLACE FUNCTION public.reset_expired_credits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.tenant_credits
  SET
    opportunity_used = 0,
    analysis_used = 0,
    firecrawl_status = 'active',
    cycle_start_at = now(),
    cycle_reset_at = now() + interval '30 days',
    updated_at = now()
  WHERE cycle_reset_at <= now();
END;
$$;

COMMENT ON FUNCTION public.reset_expired_credits IS 'Reset de créditos expirados — executa diário 00:00 UTC (gemini3.md)';

-- ============================================================
-- 4. CONFIGURAR RLS para novas colunas (herdam da tabela)
-- As colunas adicionadas são protegidas pelas políticas existentes
-- ============================================================

-- ============================================================
-- FIM DA MIGRATION 010
-- ============================================================
