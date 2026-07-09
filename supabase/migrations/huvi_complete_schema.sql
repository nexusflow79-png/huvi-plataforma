-- ============================================================
-- HUVI — Hub de Vendas Inteligente
-- Schema Completo + RLS faltantes
-- Geração única para aplicar no Supabase SQL Editor
-- ============================================================

-- ============================================================
-- EXTENSÕES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- FUNÇÃO HELPER: get_tenant_id()
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::json->'app_metadata'->>'tenant_id')::uuid,
    (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid,
    NULL
  );
$$;

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 1. TABELA: tenants
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenants (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL,
  email       text NOT NULL UNIQUE,
  plan        text NOT NULL DEFAULT 'free',
  status      text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_updated_at_tenants ON public.tenants;
CREATE TRIGGER set_updated_at_tenants
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 2. TABELA: profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  auth_user_id uuid UNIQUE,
  full_name   text NOT NULL,
  email       text NOT NULL,
  role        text NOT NULL DEFAULT 'owner'
                CHECK (role IN ('owner', 'admin', 'member')),
  status      text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'inactive')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON public.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user ON public.profiles(auth_user_id);

-- ============================================================
-- 3. TABELA: offers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.offers (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  price           numeric(12,2),
  landing_page_url text,
  checkout_url    text,
  calendar_url    text,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_offers_tenant ON public.offers(tenant_id);

-- ============================================================
-- 4. TABELA: sources
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sources (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_name text NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sources_tenant ON public.sources(tenant_id);

-- ============================================================
-- 5. TABELA: opportunities
-- ============================================================
CREATE TABLE IF NOT EXISTS public.opportunities (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_id    uuid REFERENCES public.sources(id),
  company_name text,
  contact_name text,
  email        text,
  phone        text,
  website      text,
  instagram    text,
  city         text,
  state        text,
  status       text NOT NULL DEFAULT 'discovered'
                 CHECK (status IN (
                   'discovered', 'enriched', 'audited', 'scored',
                   'strategy_defined', 'campaign_created', 'contacted',
                   'in_conversation', 'converted', 'lost', 'archived'
                 )),
  score        integer,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_opportunities_tenant ON public.opportunities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON public.opportunities(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_opportunities_score ON public.opportunities(tenant_id, score DESC NULLS LAST);

CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunities_unique_email
  ON public.opportunities(tenant_id, email)
  WHERE email IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunities_unique_phone
  ON public.opportunities(tenant_id, phone)
  WHERE phone IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunities_unique_website
  ON public.opportunities(tenant_id, website)
  WHERE website IS NOT NULL AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS set_updated_at_opportunities ON public.opportunities;
CREATE TRIGGER set_updated_at_opportunities
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 6. TABELA: opportunity_evidence
-- ============================================================
CREATE TABLE IF NOT EXISTS public.opportunity_evidence (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  opportunity_id  uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  evidence_type   text NOT NULL,
  evidence_text   text,
  evidence_url    text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_tenant ON public.opportunity_evidence(tenant_id);
CREATE INDEX IF NOT EXISTS idx_evidence_opportunity ON public.opportunity_evidence(opportunity_id);

-- ============================================================
-- 7. TABELA: opportunity_status_history
-- ============================================================
CREATE TABLE IF NOT EXISTS public.opportunity_status_history (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  opportunity_id  uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  previous_status text,
  new_status      text NOT NULL,
  changed_at      timestamptz NOT NULL DEFAULT now(),
  changed_by      text
);

CREATE INDEX IF NOT EXISTS idx_status_history_tenant ON public.opportunity_status_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_status_history_opportunity ON public.opportunity_status_history(opportunity_id);

-- ============================================================
-- 8. TABELA: audits
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audits (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  opportunity_id  uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  audit_summary   text,
  strengths       text,
  weaknesses      text,
  recommendations text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audits_tenant ON public.audits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audits_opportunity ON public.audits(opportunity_id);

-- ============================================================
-- 9. TABELA: scores
-- ============================================================
CREATE TABLE IF NOT EXISTS public.scores (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  opportunity_id   uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  commercial_score integer NOT NULL DEFAULT 0,
  viability_score  integer NOT NULL DEFAULT 0,
  justification    text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scores_tenant ON public.scores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scores_opportunity ON public.scores(opportunity_id);

-- ============================================================
-- 10. TABELA: strategies
-- ============================================================
CREATE TABLE IF NOT EXISTS public.strategies (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  opportunity_id   uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  approach         text,
  conversion_type  text NOT NULL DEFAULT 'direct_checkout'
                     CHECK (conversion_type IN ('direct_checkout', 'appointment', 'hybrid')),
  destination_type text NOT NULL DEFAULT 'landing_page'
                     CHECK (destination_type IN ('landing_page', 'checkout', 'calendar', 'whatsapp', 'external')),
  destination_url  text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_strategies_tenant ON public.strategies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_strategies_opportunity ON public.strategies(opportunity_id);

-- ============================================================
-- 11. TABELA: campaigns
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campaigns (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  opportunity_id  uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  channel         text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  subject         text,
  message         text,
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'approved', 'sending', 'sent', 'failed', 'cancelled')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON public.campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_opportunity ON public.campaigns(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(tenant_id, status);

-- ============================================================
-- 12. TABELA: conversations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  opportunity_id  uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  channel         text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  status          text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'active', 'waiting', 'closed', 'converted')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON public.conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_opportunity ON public.conversations(opportunity_id);

-- ============================================================
-- 13. TABELA: messages
-- ============================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender          text NOT NULL CHECK (sender IN ('system', 'lead', 'agent')),
  content         text NOT NULL,
  message_type    text NOT NULL DEFAULT 'text'
                    CHECK (message_type IN ('text', 'image', 'audio', 'document', 'template')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_tenant ON public.messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);

-- ============================================================
-- 14. TABELA: communication_preferences
-- ============================================================
CREATE TABLE IF NOT EXISTS public.communication_preferences (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  email_enabled    boolean NOT NULL DEFAULT true,
  whatsapp_enabled boolean NOT NULL DEFAULT true,
  quiet_hours      jsonb DEFAULT '{"start": "22:00", "end": "08:00"}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 15. TABELA: conversions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.conversions (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  opportunity_id  uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  conversion_type text NOT NULL DEFAULT 'direct_checkout'
                    CHECK (conversion_type IN ('direct_checkout', 'appointment', 'hybrid', 'manual')),
  expected_value  numeric(12,2),
  closed_value    numeric(12,2),
  conversion_date timestamptz,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_conversions_tenant ON public.conversions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversions_opportunity ON public.conversions(opportunity_id);

-- ============================================================
-- 16. TABELA: agent_executions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agent_executions (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agent_name       text NOT NULL CHECK (agent_name IN (
                     'hunter', 'enricher', 'auditor', 'scorer',
                     'strategist', 'campaign', 'dispatcher', 'sdr',
                     'guardian', 'huvi_brain'
                   )),
  entity_type      text,
  entity_id        uuid,
  execution_status text NOT NULL DEFAULT 'running'
                     CHECK (execution_status IN ('running', 'completed', 'failed', 'cancelled')),
  started_at       timestamptz NOT NULL DEFAULT now(),
  finished_at      timestamptz,
  execution_log    jsonb
);

CREATE INDEX IF NOT EXISTS idx_agent_exec_tenant ON public.agent_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_exec_agent ON public.agent_executions(tenant_id, agent_name);

-- ============================================================
-- 17. TABELA: audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action      text NOT NULL,
  entity_type text,
  entity_id   uuid,
  user_id     uuid,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(tenant_id, action);

-- ============================================================
-- 18. TABELA: tenant_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenant_settings (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  setting_key   text NOT NULL,
  setting_value text,
  encrypted     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant ON public.tenant_settings(tenant_id);

DROP TRIGGER IF EXISTS set_updated_at_tenant_settings ON public.tenant_settings;
CREATE TRIGGER set_updated_at_tenant_settings
  BEFORE UPDATE ON public.tenant_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 19. TABELA: dispatches
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dispatches (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id     uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  opportunity_id  uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  channel         text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'bounced')),
  sent_at         timestamptz,
  delivered_at    timestamptz,
  read_at         timestamptz,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispatches_tenant ON public.dispatches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_campaign ON public.dispatches(campaign_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_status ON public.dispatches(tenant_id, status);

-- ============================================================
-- 20. TABELA: tenant_credits
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenant_credits (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  opportunity_limit integer NOT NULL DEFAULT 80,
  opportunity_used  integer NOT NULL DEFAULT 0,
  analysis_limit    integer NOT NULL DEFAULT 20,
  analysis_used     integer NOT NULL DEFAULT 0,
  firecrawl_min_score integer NOT NULL DEFAULT 40,
  firecrawl_status  text NOT NULL DEFAULT 'active'
                      CHECK (firecrawl_status IN ('active', 'blocked')),
  weight_outscraper_search integer NOT NULL DEFAULT 1,
  weight_firecrawl_search  integer NOT NULL DEFAULT 2,
  weight_firecrawl_scrape  integer NOT NULL DEFAULT 1,
  weight_firecrawl_audit   integer NOT NULL DEFAULT 3,
  cycle_start_at    timestamptz NOT NULL DEFAULT now(),
  cycle_reset_at    timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_credits_tenant ON public.tenant_credits(tenant_id);

DROP TRIGGER IF EXISTS set_updated_at_tenant_credits ON public.tenant_credits;
CREATE TRIGGER set_updated_at_tenant_credits
  BEFORE UPDATE ON public.tenant_credits
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 21. TABELA: opportunity_dedup_log
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

-- ============================================================
-- 22. TABELA: outscraper_search_log
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

-- ============================================================
-- 23. TABELA: outscraper_search_queue
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

-- ============================================================
-- 24. TABELA: web_search_log
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

-- ============================================================
-- 25. TABELA: web_search_queue
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

-- ============================================================
-- CAMPOS ADICIONAIS EM opportunities (Outscraper)
-- ============================================================
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS rating_value numeric(3,1);
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS rating_count integer;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS google_maps_url text;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS origin text DEFAULT 'Manual';
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS source_service text;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS firecrawl_data jsonb;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS description text;

-- ============================================================
-- CAMPOS ADICIONAIS EM sources (Web Discovery)
-- ============================================================
ALTER TABLE public.sources ADD COLUMN IF NOT EXISTS keywords jsonb;
ALTER TABLE public.sources ADD COLUMN IF NOT EXISTS include_domains text[];
ALTER TABLE public.sources ADD COLUMN IF NOT EXISTS exclude_domains text[];

-- ============================================================
-- CAMPOS ADICIONAIS EM sources (Soft Delete)
-- ============================================================
ALTER TABLE public.sources ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- ============================================================
-- TRIGGER: Histórico de status das oportunidades
-- ============================================================
CREATE OR REPLACE FUNCTION public.track_opportunity_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.opportunity_status_history (
      tenant_id, opportunity_id, previous_status, new_status, changed_by
    ) VALUES (
      NEW.tenant_id, NEW.id, OLD.status, NEW.status, 'system'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS track_status_change ON public.opportunities;
CREATE TRIGGER track_status_change
  AFTER UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.track_opportunity_status();

-- ============================================================
-- TRIGGER: Onboarding (handle_new_user)
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
  INSERT INTO public.tenants (name, email)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  RETURNING id INTO new_tenant_id;

  INSERT INTO public.profiles (tenant_id, auth_user_id, full_name, email, role)
  VALUES (
    new_tenant_id,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'owner'
  );

  INSERT INTO public.communication_preferences (tenant_id)
  VALUES (new_tenant_id);

  INSERT INTO public.tenant_credits (
    tenant_id, opportunity_limit, opportunity_used,
    analysis_limit, analysis_used,
    firecrawl_min_score, firecrawl_status,
    weight_outscraper_search, weight_firecrawl_search,
    weight_firecrawl_scrape, weight_firecrawl_audit
  ) VALUES (
    new_tenant_id,
    80, 0,
    20, 0,
    40, 'active',
    1, 2,
    1, 3
  );

  UPDATE auth.users
  SET raw_app_meta_data =
    COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('tenant_id', new_tenant_id)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- ============================================================
-- FUNÇÃO: reset_expired_credits()
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

-- ============================================================
-- RLS: HABILITAR EM TODAS AS TABELAS
-- ============================================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_dedup_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outscraper_search_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outscraper_search_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_search_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_search_queue ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLÍTICAS RLS: tenants
-- ============================================================
DROP POLICY IF EXISTS "tenants_select" ON public.tenants;
CREATE POLICY "tenants_select" ON public.tenants
  FOR SELECT USING (id = public.get_tenant_id());

DROP POLICY IF EXISTS "tenants_update" ON public.tenants;
CREATE POLICY "tenants_update" ON public.tenants
  FOR UPDATE USING (id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: profiles
-- ============================================================
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: offers
-- ============================================================
DROP POLICY IF EXISTS "offers_select" ON public.offers;
CREATE POLICY "offers_select" ON public.offers
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "offers_insert" ON public.offers;
CREATE POLICY "offers_insert" ON public.offers
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "offers_update" ON public.offers;
CREATE POLICY "offers_update" ON public.offers
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "offers_delete" ON public.offers;
CREATE POLICY "offers_delete" ON public.offers
  FOR DELETE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: sources
-- ============================================================
DROP POLICY IF EXISTS "sources_select" ON public.sources;
CREATE POLICY "sources_select" ON public.sources
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "sources_insert" ON public.sources;
CREATE POLICY "sources_insert" ON public.sources
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "sources_update" ON public.sources;
CREATE POLICY "sources_update" ON public.sources
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "sources_delete" ON public.sources;
CREATE POLICY "sources_delete" ON public.sources
  FOR DELETE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: opportunities
-- ============================================================
DROP POLICY IF EXISTS "opportunities_select" ON public.opportunities;
CREATE POLICY "opportunities_select" ON public.opportunities
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "opportunities_insert" ON public.opportunities;
CREATE POLICY "opportunities_insert" ON public.opportunities
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "opportunities_update" ON public.opportunities;
CREATE POLICY "opportunities_update" ON public.opportunities
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "opportunities_delete" ON public.opportunities;
CREATE POLICY "opportunities_delete" ON public.opportunities
  FOR DELETE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: opportunity_evidence
-- ============================================================
DROP POLICY IF EXISTS "evidence_select" ON public.opportunity_evidence;
CREATE POLICY "evidence_select" ON public.opportunity_evidence
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "evidence_insert" ON public.opportunity_evidence;
CREATE POLICY "evidence_insert" ON public.opportunity_evidence
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: opportunity_status_history
-- ============================================================
DROP POLICY IF EXISTS "status_history_select" ON public.opportunity_status_history;
CREATE POLICY "status_history_select" ON public.opportunity_status_history
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "status_history_insert" ON public.opportunity_status_history;
CREATE POLICY "status_history_insert" ON public.opportunity_status_history
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: audits
-- ============================================================
DROP POLICY IF EXISTS "audits_select" ON public.audits;
CREATE POLICY "audits_select" ON public.audits
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "audits_insert" ON public.audits;
CREATE POLICY "audits_insert" ON public.audits
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: scores
-- ============================================================
DROP POLICY IF EXISTS "scores_select" ON public.scores;
CREATE POLICY "scores_select" ON public.scores
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "scores_insert" ON public.scores;
CREATE POLICY "scores_insert" ON public.scores
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: strategies
-- ============================================================
DROP POLICY IF EXISTS "strategies_select" ON public.strategies;
CREATE POLICY "strategies_select" ON public.strategies
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "strategies_insert" ON public.strategies;
CREATE POLICY "strategies_insert" ON public.strategies
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: campaigns
-- ============================================================
DROP POLICY IF EXISTS "campaigns_select" ON public.campaigns;
CREATE POLICY "campaigns_select" ON public.campaigns
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "campaigns_insert" ON public.campaigns;
CREATE POLICY "campaigns_insert" ON public.campaigns
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "campaigns_update" ON public.campaigns;
CREATE POLICY "campaigns_update" ON public.campaigns
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: conversations
-- ============================================================
DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
CREATE POLICY "conversations_select" ON public.conversations
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;
CREATE POLICY "conversations_insert" ON public.conversations
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "conversations_update" ON public.conversations;
CREATE POLICY "conversations_update" ON public.conversations
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: messages
-- ============================================================
DROP POLICY IF EXISTS "messages_select" ON public.messages;
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "messages_insert" ON public.messages;
CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: communication_preferences
-- ============================================================
DROP POLICY IF EXISTS "comm_prefs_select" ON public.communication_preferences;
CREATE POLICY "comm_prefs_select" ON public.communication_preferences
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "comm_prefs_insert" ON public.communication_preferences;
CREATE POLICY "comm_prefs_insert" ON public.communication_preferences
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "comm_prefs_update" ON public.communication_preferences;
CREATE POLICY "comm_prefs_update" ON public.communication_preferences
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: conversions
-- ============================================================
DROP POLICY IF EXISTS "conversions_select" ON public.conversions;
CREATE POLICY "conversions_select" ON public.conversions
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "conversions_insert" ON public.conversions;
CREATE POLICY "conversions_insert" ON public.conversions
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "conversions_update" ON public.conversions;
CREATE POLICY "conversions_update" ON public.conversions
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: agent_executions
-- ============================================================
DROP POLICY IF EXISTS "agent_exec_select" ON public.agent_executions;
CREATE POLICY "agent_exec_select" ON public.agent_executions
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "agent_exec_insert" ON public.agent_executions;
CREATE POLICY "agent_exec_insert" ON public.agent_executions
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "agent_exec_update" ON public.agent_executions;
CREATE POLICY "agent_exec_update" ON public.agent_executions
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: audit_logs
-- ============================================================
DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
CREATE POLICY "audit_logs_select" ON public.audit_logs
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: tenant_settings
-- ============================================================
DROP POLICY IF EXISTS "tenant_settings_select" ON public.tenant_settings;
CREATE POLICY "tenant_settings_select" ON public.tenant_settings
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "tenant_settings_insert" ON public.tenant_settings;
CREATE POLICY "tenant_settings_insert" ON public.tenant_settings
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "tenant_settings_update" ON public.tenant_settings;
CREATE POLICY "tenant_settings_update" ON public.tenant_settings
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "tenant_settings_delete" ON public.tenant_settings;
CREATE POLICY "tenant_settings_delete" ON public.tenant_settings
  FOR DELETE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: dispatches
-- ============================================================
DROP POLICY IF EXISTS "dispatches_select" ON public.dispatches;
CREATE POLICY "dispatches_select" ON public.dispatches
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "dispatches_insert" ON public.dispatches;
CREATE POLICY "dispatches_insert" ON public.dispatches
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "dispatches_update" ON public.dispatches;
CREATE POLICY "dispatches_update" ON public.dispatches
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: tenant_credits
-- ============================================================
DROP POLICY IF EXISTS "tenant_credits_select" ON public.tenant_credits;
CREATE POLICY "tenant_credits_select" ON public.tenant_credits
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "tenant_credits_insert" ON public.tenant_credits;
CREATE POLICY "tenant_credits_insert" ON public.tenant_credits
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "tenant_credits_update" ON public.tenant_credits;
CREATE POLICY "tenant_credits_update" ON public.tenant_credits
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: opportunity_dedup_log
-- ============================================================
DROP POLICY IF EXISTS "dedup_log_select" ON public.opportunity_dedup_log;
CREATE POLICY "dedup_log_select" ON public.opportunity_dedup_log
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "dedup_log_insert" ON public.opportunity_dedup_log;
CREATE POLICY "dedup_log_insert" ON public.opportunity_dedup_log
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: outscraper_search_log (CRÍTICO: DELETE adicionado)
-- ============================================================
DROP POLICY IF EXISTS "search_log_select" ON public.outscraper_search_log;
CREATE POLICY "search_log_select" ON public.outscraper_search_log
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "search_log_insert" ON public.outscraper_search_log;
CREATE POLICY "search_log_insert" ON public.outscraper_search_log
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ⚠️ POLÍTICA FALTANTE: permite o frontend excluir registros do histórico
DROP POLICY IF EXISTS "search_log_delete" ON public.outscraper_search_log;
CREATE POLICY "search_log_delete" ON public.outscraper_search_log
  FOR DELETE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: outscraper_search_queue
-- ============================================================
DROP POLICY IF EXISTS "search_queue_select" ON public.outscraper_search_queue;
CREATE POLICY "search_queue_select" ON public.outscraper_search_queue
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "search_queue_insert" ON public.outscraper_search_queue;
CREATE POLICY "search_queue_insert" ON public.outscraper_search_queue
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "search_queue_update" ON public.outscraper_search_queue;
CREATE POLICY "search_queue_update" ON public.outscraper_search_queue
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: web_search_log (CRÍTICO: DELETE adicionado)
-- ============================================================
DROP POLICY IF EXISTS "web_search_log_select" ON public.web_search_log;
CREATE POLICY "web_search_log_select" ON public.web_search_log
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "web_search_log_insert" ON public.web_search_log;
CREATE POLICY "web_search_log_insert" ON public.web_search_log
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ⚠️ POLÍTICA FALTANTE: permite o frontend excluir registros do histórico web
DROP POLICY IF EXISTS "web_search_log_delete" ON public.web_search_log;
CREATE POLICY "web_search_log_delete" ON public.web_search_log
  FOR DELETE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: web_search_queue
-- ============================================================
DROP POLICY IF EXISTS "web_search_queue_select" ON public.web_search_queue;
CREATE POLICY "web_search_queue_select" ON public.web_search_queue
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "web_search_queue_insert" ON public.web_search_queue;
CREATE POLICY "web_search_queue_insert" ON public.web_search_queue
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "web_search_queue_update" ON public.web_search_queue;
CREATE POLICY "web_search_queue_update" ON public.web_search_queue
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- REACTIVAR TRIGGER DE ONBOARDING (se ainda não ativo)
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FIM
-- ============================================================
