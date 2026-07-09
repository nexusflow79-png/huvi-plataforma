-- ============================================================
-- HUVI — Migration 007: Google Maps (Outscraper) Discovery
-- Conforme: gemini2.md
-- ============================================================

-- ============================================================
-- 1. TABELA: tenant_credits
-- Controle de créditos de oportunidades por ciclo de 30 dias
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenant_credits (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  opportunity_limit integer NOT NULL DEFAULT 80,
  opportunity_used  integer NOT NULL DEFAULT 0,
  cycle_start_at    timestamptz NOT NULL DEFAULT now(),
  cycle_reset_at    timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_credits_tenant ON public.tenant_credits(tenant_id);

COMMENT ON TABLE public.tenant_credits IS 'Controle de créditos de oportunidades por ciclo de 30 dias (gemini2.md)';

-- Trigger updated_at
CREATE TRIGGER set_updated_at_tenant_credits
  BEFORE UPDATE ON public.tenant_credits
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 2. TABELA: opportunity_dedup_log
-- Log de deduplicações realizadas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.opportunity_dedup_log (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  opportunity_id  uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  source_data     jsonb,
  merged_fields   text[],
  match_type      text CHECK (match_type IN ('phone', 'website', 'name_similarity')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dedup_log_tenant ON public.opportunity_dedup_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dedup_log_opportunity ON public.opportunity_dedup_log(opportunity_id);

COMMENT ON TABLE public.opportunity_dedup_log IS 'Log de deduplicações — registra merges e descartes (gemini2.md)';

-- ============================================================
-- 3. TABELA: outscraper_search_log
-- Log de buscas para KPIs de custo
-- ============================================================
CREATE TABLE IF NOT EXISTS public.outscraper_search_log (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  search_id        text,
  segment          text NOT NULL,
  state            text NOT NULL,
  city             text NOT NULL,
  cost_usd         numeric(10,4) DEFAULT 0,
  results_count    integer NOT NULL DEFAULT 0,
  valid_count      integer NOT NULL DEFAULT 0,
  duplicates_count integer NOT NULL DEFAULT 0,
  errors_count     integer NOT NULL DEFAULT 0,
  status           text NOT NULL DEFAULT 'completed'
                     CHECK (status IN ('completed', 'failed', 'partial')),
  error_message    text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_log_tenant ON public.outscraper_search_log(tenant_id);

COMMENT ON TABLE public.outscraper_search_log IS 'Log de buscas Outscraper para KPIs de custo por oportunidade (gemini2.md)';

-- ============================================================
-- 4. TABELA: outscraper_search_queue
-- Fila FIFO de buscas por tenant
-- ============================================================
CREATE TABLE IF NOT EXISTS public.outscraper_search_queue (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  segment         text NOT NULL,
  state           text NOT NULL,
  city            text NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result_summary  jsonb,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  completed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_search_queue_tenant ON public.outscraper_search_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_search_queue_status ON public.outscraper_search_queue(tenant_id, status);

COMMENT ON TABLE public.outscraper_search_queue IS 'Fila FIFO de buscas Outscraper por tenant (gemini2.md)';

-- ============================================================
-- 5. NOVOS CAMPOS em opportunities
-- Dados capturados pelo Outscraper
-- ============================================================
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS rating_value numeric(3,1);
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS rating_count integer;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS google_maps_url text;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS origin text DEFAULT 'Manual';
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS source_service text;

COMMENT ON COLUMN public.opportunities.address IS 'Endereço completo da empresa';
COMMENT ON COLUMN public.opportunities.rating_value IS 'Avaliação do Google Maps (ex: 4.5)';
COMMENT ON COLUMN public.opportunities.rating_count IS 'Quantidade de avaliações no Google Maps';
COMMENT ON COLUMN public.opportunities.google_maps_url IS 'URL do perfil no Google Maps';
COMMENT ON COLUMN public.opportunities.category IS 'Categoria da empresa no Google Maps';
COMMENT ON COLUMN public.opportunities.origin IS 'Origem da oportunidade (Google Maps, Instagram, Manual, etc.)';
COMMENT ON COLUMN public.opportunities.source_service IS 'Serviço usado para descoberta (Outscraper, Manual, Importação, etc.)';

-- ============================================================
-- 6. RLS: Habilitar em novas tabelas
-- ============================================================
ALTER TABLE public.tenant_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_dedup_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outscraper_search_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outscraper_search_queue ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. POLÍTICAS RLS: tenant_credits
-- ============================================================
CREATE POLICY "tenant_credits_select" ON public.tenant_credits
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "tenant_credits_update" ON public.tenant_credits
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

CREATE POLICY "tenant_credits_insert" ON public.tenant_credits
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ============================================================
-- 8. POLÍTICAS RLS: opportunity_dedup_log
-- ============================================================
CREATE POLICY "dedup_log_select" ON public.opportunity_dedup_log
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "dedup_log_insert" ON public.opportunity_dedup_log
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ============================================================
-- 9. POLÍTICAS RLS: outscraper_search_log
-- ============================================================
CREATE POLICY "search_log_select" ON public.outscraper_search_log
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "search_log_insert" ON public.outscraper_search_log
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ============================================================
-- 10. POLÍTICAS RLS: outscraper_search_queue
-- ============================================================
CREATE POLICY "search_queue_select" ON public.outscraper_search_queue
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "search_queue_insert" ON public.outscraper_search_queue
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "search_queue_update" ON public.outscraper_search_queue
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- 11. ATUALIZAR TRIGGER ONBOARDING
-- Adicionar criação automática de tenant_credits (limit=80)
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

  -- Criar créditos de oportunidades padrão (80 por ciclo de 30 dias)
  INSERT INTO public.tenant_credits (tenant_id, opportunity_limit, opportunity_used)
  VALUES (new_tenant_id, 80, 0);

  -- Salvar tenant_id nos metadados do usuário para JWT
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('tenant_id', new_tenant_id)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 12. FUNÇÃO: reset_expired_credits()
-- Para cron job diário às 00:00 UTC
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
    cycle_start_at = now(),
    cycle_reset_at = now() + interval '30 days',
    updated_at = now()
  WHERE cycle_reset_at <= now();
END;
$$;

COMMENT ON FUNCTION public.reset_expired_credits IS 'Reset de créditos expirados — executar via cron diário 00:00 UTC (gemini2.md)';

-- ============================================================
-- FIM DA MIGRATION 007
-- ============================================================
