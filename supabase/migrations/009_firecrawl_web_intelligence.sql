-- ============================================================
-- HUVI — Migration 009: Firecrawl Web Intelligence Engine
-- Conforme: gemini3.md v2.0
-- Modos: Descoberta Web (Hunter) + Análise de Websites (Auditor)
-- ============================================================

-- ============================================================
-- 1. ALTERAR TABELA: tenant_credits
-- Adicionar contadores de análise e score mínimo
-- ============================================================
ALTER TABLE public.tenant_credits
  ADD COLUMN IF NOT EXISTS analysis_limit integer NOT NULL DEFAULT 20;

ALTER TABLE public.tenant_credits
  ADD COLUMN IF NOT EXISTS analysis_used integer NOT NULL DEFAULT 0;

ALTER TABLE public.tenant_credits
  ADD COLUMN IF NOT EXISTS firecrawl_min_score integer NOT NULL DEFAULT 40;

ALTER TABLE public.tenant_credits
  ADD COLUMN IF NOT EXISTS firecrawl_status text NOT NULL DEFAULT 'active'
    CHECK (firecrawl_status IN ('active', 'blocked'));

COMMENT ON COLUMN public.tenant_credits.analysis_limit IS 'Limite de análises de sites por ciclo (gemini3.md)';
COMMENT ON COLUMN public.tenant_credits.analysis_used IS 'Análises consumidas no ciclo atual (gemini3.md)';
COMMENT ON COLUMN public.tenant_credits.firecrawl_min_score IS 'Score mínimo do lead para acionar análise de site (gemini3.md)';
COMMENT ON COLUMN public.tenant_credits.firecrawl_status IS 'active | blocked — bloqueado quando analysis_limit é atingido';

-- ============================================================
-- 2. ALTERAR TABELA: sources
-- Adicionar campos para descoberta web
-- ============================================================
ALTER TABLE public.sources
  ADD COLUMN IF NOT EXISTS keywords jsonb;

ALTER TABLE public.sources
  ADD COLUMN IF NOT EXISTS include_domains text[];

ALTER TABLE public.sources
  ADD COLUMN IF NOT EXISTS exclude_domains text[];

COMMENT ON COLUMN public.sources.keywords IS 'Palavras-chave para descoberta web (JSONB array)';
COMMENT ON COLUMN public.sources.include_domains IS 'Domínios para focar a busca web';
COMMENT ON COLUMN public.sources.exclude_domains IS 'Domínios para ignorar na busca web';

-- ============================================================
-- 3. ALTERAR TABELA: opportunities
-- Adicionar campo para dados do Firecrawl análise
-- ============================================================
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS firecrawl_data jsonb;

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS description text;

COMMENT ON COLUMN public.opportunities.firecrawl_data IS 'Dados estruturados da análise Firecrawl (site)';
COMMENT ON COLUMN public.opportunities.description IS 'Descrição/snippet da empresa capturado na descoberta web';

-- ============================================================
-- 4. TABELA: web_search_log
-- Log de buscas web para KPIs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.web_search_log (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  keywords          jsonb NOT NULL,
  include_domains   text[],
  exclude_domains   text[],
  results_count     integer NOT NULL DEFAULT 0,
  valid_count       integer NOT NULL DEFAULT 0,
  duplicates_count  integer NOT NULL DEFAULT 0,
  errors_count      integer NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'completed'
                      CHECK (status IN ('completed', 'failed', 'partial')),
  error_message     text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_web_search_log_tenant ON public.web_search_log(tenant_id);

COMMENT ON TABLE public.web_search_log IS 'Log de buscas web para KPIs (gemini3.md)';

-- ============================================================
-- 5. TABELA: web_search_queue
-- Fila FIFO de buscas web por tenant
-- ============================================================
CREATE TABLE IF NOT EXISTS public.web_search_queue (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  keywords        jsonb NOT NULL,
  include_domains text[],
  exclude_domains text[],
  source_id       uuid REFERENCES public.sources(id),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result_summary  jsonb,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  completed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_web_search_queue_tenant ON public.web_search_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_web_search_queue_status ON public.web_search_queue(tenant_id, status);

COMMENT ON TABLE public.web_search_queue IS 'Fila FIFO de buscas web por tenant (gemini3.md)';

-- ============================================================
-- 6. RLS: Habilitar em novas tabelas
-- ============================================================
ALTER TABLE public.web_search_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_search_queue ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. POLÍTICAS RLS: web_search_log
-- ============================================================
CREATE POLICY "web_search_log_select" ON public.web_search_log
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "web_search_log_insert" ON public.web_search_log
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ============================================================
-- 8. POLÍTICAS RLS: web_search_queue
-- ============================================================
CREATE POLICY "web_search_queue_select" ON public.web_search_queue
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "web_search_queue_insert" ON public.web_search_queue
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "web_search_queue_update" ON public.web_search_queue
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- 9. ATUALIZAR FUNÇÃO: handle_new_user()
-- Adicionar defaults de análise no onboarding
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

  -- Criar créditos com defaults de descoberta + análise
  INSERT INTO public.tenant_credits (
    tenant_id,
    opportunity_limit,
    opportunity_used,
    analysis_limit,
    analysis_used,
    firecrawl_min_score,
    firecrawl_status
  ) VALUES (
    new_tenant_id,
    80,    -- opportunity_limit padrão
    0,     -- opportunity_used
    20,    -- analysis_limit padrão
    0,     -- analysis_used
    40,    -- firecrawl_min_score padrão
    'active'
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
-- 10. ATUALIZAR FUNÇÃO: reset_expired_credits()
-- Incluir reset dos contadores de análise
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
-- FIM DA MIGRATION 009
-- ============================================================
