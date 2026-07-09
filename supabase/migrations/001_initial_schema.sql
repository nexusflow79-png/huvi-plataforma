-- ============================================================
-- HUVI — Hub de Vendas Inteligente
-- Migration 001: Schema Inicial Completo
-- Versão: 1.0
-- Conforme: gemini.md, supabase_architecture.md
-- ============================================================

-- ============================================================
-- EXTENSÕES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- FUNÇÃO HELPER: get_tenant_id()
-- Extrai o tenant_id do JWT autenticado
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
-- 1. TABELA: tenants
-- Representa cada cliente da plataforma
-- ============================================================
CREATE TABLE public.tenants (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL,
  email       text NOT NULL UNIQUE,
  plan        text NOT NULL DEFAULT 'free',
  status      text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tenants IS 'Cada cliente da plataforma HUVI';

-- ============================================================
-- 2. TABELA: profiles
-- Usuários pertencentes a um tenant
-- ============================================================
CREATE TABLE public.profiles (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  auth_user_id uuid UNIQUE,  -- referência ao auth.users.id
  full_name   text NOT NULL,
  email       text NOT NULL,
  role        text NOT NULL DEFAULT 'owner'
                CHECK (role IN ('owner', 'admin', 'member')),
  status      text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'inactive')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_tenant ON public.profiles(tenant_id);
CREATE INDEX idx_profiles_auth_user ON public.profiles(auth_user_id);

COMMENT ON TABLE public.profiles IS 'Usuários pertencentes a um tenant';

-- ============================================================
-- 3. TABELA: offers
-- Produtos ou serviços promovidos pelo tenant
-- ============================================================
CREATE TABLE public.offers (
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
  deleted_at      timestamptz  -- Soft Delete
);

CREATE INDEX idx_offers_tenant ON public.offers(tenant_id);

COMMENT ON TABLE public.offers IS 'Produtos ou serviços promovidos pelo tenant';

-- ============================================================
-- 4. TABELA: sources
-- Origem das oportunidades
-- ============================================================
CREATE TABLE public.sources (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_name text NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sources_tenant ON public.sources(tenant_id);

COMMENT ON TABLE public.sources IS 'Origem das oportunidades (Instagram, Google Maps, etc.)';

-- ============================================================
-- 5. TABELA: opportunities
-- Entidade central do sistema
-- ============================================================
CREATE TABLE public.opportunities (
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
  deleted_at   timestamptz  -- Soft Delete
);

CREATE INDEX idx_opportunities_tenant ON public.opportunities(tenant_id);
CREATE INDEX idx_opportunities_status ON public.opportunities(tenant_id, status);
CREATE INDEX idx_opportunities_score ON public.opportunities(tenant_id, score DESC NULLS LAST);

-- Índices de unicidade (evitar duplicatas por tenant)
CREATE UNIQUE INDEX idx_opportunities_unique_email
  ON public.opportunities(tenant_id, email)
  WHERE email IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX idx_opportunities_unique_phone
  ON public.opportunities(tenant_id, phone)
  WHERE phone IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX idx_opportunities_unique_website
  ON public.opportunities(tenant_id, website)
  WHERE website IS NOT NULL AND deleted_at IS NULL;

COMMENT ON TABLE public.opportunities IS 'Entidade central: oportunidades comerciais descobertas';

-- ============================================================
-- 6. TABELA: opportunity_evidence
-- Evidências/provas coletadas sobre oportunidades
-- ============================================================
CREATE TABLE public.opportunity_evidence (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  opportunity_id  uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  evidence_type   text NOT NULL,
  evidence_text   text,
  evidence_url    text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_evidence_tenant ON public.opportunity_evidence(tenant_id);
CREATE INDEX idx_evidence_opportunity ON public.opportunity_evidence(opportunity_id);

COMMENT ON TABLE public.opportunity_evidence IS 'Provas e evidências coletadas pelo Hunter/Enricher';

-- ============================================================
-- 7. TABELA: opportunity_status_history
-- Histórico de mudanças de status
-- ============================================================
CREATE TABLE public.opportunity_status_history (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  opportunity_id  uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  previous_status text,
  new_status      text NOT NULL,
  changed_at      timestamptz NOT NULL DEFAULT now(),
  changed_by      text  -- agent name ou user id
);

CREATE INDEX idx_status_history_tenant ON public.opportunity_status_history(tenant_id);
CREATE INDEX idx_status_history_opportunity ON public.opportunity_status_history(opportunity_id);

COMMENT ON TABLE public.opportunity_status_history IS 'Rastreamento de mudanças de status das oportunidades';

-- ============================================================
-- 8. TABELA: audits
-- Resultado do Auditor (diagnóstico)
-- ============================================================
CREATE TABLE public.audits (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  opportunity_id  uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  audit_summary   text,
  strengths       text,
  weaknesses      text,
  recommendations text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audits_tenant ON public.audits(tenant_id);
CREATE INDEX idx_audits_opportunity ON public.audits(opportunity_id);

COMMENT ON TABLE public.audits IS 'Diagnósticos gerados pelo agente Auditor';

-- ============================================================
-- 9. TABELA: scores
-- Resultado do Scorer (classificação)
-- ============================================================
CREATE TABLE public.scores (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  opportunity_id   uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  commercial_score integer NOT NULL DEFAULT 0,
  viability_score  integer NOT NULL DEFAULT 0,
  justification    text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scores_tenant ON public.scores(tenant_id);
CREATE INDEX idx_scores_opportunity ON public.scores(opportunity_id);

COMMENT ON TABLE public.scores IS 'Classificação gerada pelo agente Scorer';

-- ============================================================
-- 10. TABELA: strategies
-- Resultado do Strategist
-- ============================================================
CREATE TABLE public.strategies (
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

CREATE INDEX idx_strategies_tenant ON public.strategies(tenant_id);
CREATE INDEX idx_strategies_opportunity ON public.strategies(opportunity_id);

COMMENT ON TABLE public.strategies IS 'Estratégias comerciais definidas pelo agente Strategist';

-- ============================================================
-- 11. TABELA: campaigns
-- Resultado do Campaign
-- ============================================================
CREATE TABLE public.campaigns (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  opportunity_id  uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  channel         text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  subject         text,
  message         text,
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'approved', 'sending', 'sent', 'failed', 'cancelled')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz  -- Soft Delete
);

CREATE INDEX idx_campaigns_tenant ON public.campaigns(tenant_id);
CREATE INDEX idx_campaigns_opportunity ON public.campaigns(opportunity_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(tenant_id, status);

COMMENT ON TABLE public.campaigns IS 'Campanhas comerciais geradas pelo agente Campaign';

-- ============================================================
-- 12. TABELA: conversations
-- Conversas com oportunidades
-- ============================================================
CREATE TABLE public.conversations (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  opportunity_id  uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  channel         text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  status          text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'active', 'waiting', 'closed', 'converted')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz  -- Soft Delete
);

CREATE INDEX idx_conversations_tenant ON public.conversations(tenant_id);
CREATE INDEX idx_conversations_opportunity ON public.conversations(opportunity_id);

COMMENT ON TABLE public.conversations IS 'Conversas gerenciadas pelo agente SDR';

-- ============================================================
-- 13. TABELA: messages
-- Mensagens dentro de conversas
-- ============================================================
CREATE TABLE public.messages (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender          text NOT NULL CHECK (sender IN ('system', 'lead', 'agent')),
  content         text NOT NULL,
  message_type    text NOT NULL DEFAULT 'text'
                    CHECK (message_type IN ('text', 'image', 'audio', 'document', 'template')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_tenant ON public.messages(tenant_id);
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id);

COMMENT ON TABLE public.messages IS 'Mensagens individuais dentro de conversas';

-- ============================================================
-- 14. TABELA: communication_preferences
-- Preferências de comunicação do tenant
-- ============================================================
CREATE TABLE public.communication_preferences (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  email_enabled    boolean NOT NULL DEFAULT true,
  whatsapp_enabled boolean NOT NULL DEFAULT true,
  quiet_hours      jsonb DEFAULT '{"start": "22:00", "end": "08:00"}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.communication_preferences IS 'Preferências de comunicação por tenant';

-- ============================================================
-- 15. TABELA: conversions
-- Conversões realizadas
-- ============================================================
CREATE TABLE public.conversions (
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
  deleted_at      timestamptz  -- Soft Delete
);

CREATE INDEX idx_conversions_tenant ON public.conversions(tenant_id);
CREATE INDEX idx_conversions_opportunity ON public.conversions(opportunity_id);

COMMENT ON TABLE public.conversions IS 'Conversões (receita) realizadas';

-- ============================================================
-- 16. TABELA: agent_executions
-- Registro de execuções dos agentes
-- ============================================================
CREATE TABLE public.agent_executions (
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

CREATE INDEX idx_agent_exec_tenant ON public.agent_executions(tenant_id);
CREATE INDEX idx_agent_exec_agent ON public.agent_executions(tenant_id, agent_name);

COMMENT ON TABLE public.agent_executions IS 'Rastreamento de execuções de todos os agentes';

-- ============================================================
-- 17. TABELA: audit_logs
-- Auditoria do sistema (Guardian)
-- ============================================================
CREATE TABLE public.audit_logs (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action      text NOT NULL,
  entity_type text,
  entity_id   uuid,
  user_id     uuid,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_tenant ON public.audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(tenant_id, action);

COMMENT ON TABLE public.audit_logs IS 'Logs de auditoria para rastreabilidade (Guardian)';

-- ============================================================
-- 18. TABELA: tenant_settings (Lacuna 1)
-- Configurações e credenciais por tenant
-- ============================================================
CREATE TABLE public.tenant_settings (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  setting_key   text NOT NULL,
  setting_value text,
  encrypted     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, setting_key)
);

CREATE INDEX idx_tenant_settings_tenant ON public.tenant_settings(tenant_id);

COMMENT ON TABLE public.tenant_settings IS 'Configurações e credenciais de integração por tenant';

-- ============================================================
-- 19. TABELA: dispatches (Lacuna 2)
-- Envios individuais do Dispatcher
-- ============================================================
CREATE TABLE public.dispatches (
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

CREATE INDEX idx_dispatches_tenant ON public.dispatches(tenant_id);
CREATE INDEX idx_dispatches_campaign ON public.dispatches(campaign_id);
CREATE INDEX idx_dispatches_status ON public.dispatches(tenant_id, status);

COMMENT ON TABLE public.dispatches IS 'Registro de cada envio individual feito pelo Dispatcher';

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

CREATE TRIGGER set_updated_at_tenants
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_opportunities
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_tenant_settings
  BEFORE UPDATE ON public.tenant_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

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

CREATE TRIGGER track_status_change
  AFTER UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.track_opportunity_status();

-- ============================================================
-- TRIGGER: Onboarding (registro → tenant + profile)
-- Executado após inserção em auth.users
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

  -- Salvar tenant_id nos metadados do usuário para JWT
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('tenant_id', new_tenant_id)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- O trigger será ativado no Supabase Dashboard:
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- RLS: Habilitar Row Level Security em TODAS as tabelas
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

-- ============================================================
-- POLÍTICAS RLS: tenants
-- Tenant só vê seu próprio registro
-- ============================================================
CREATE POLICY "tenants_select" ON public.tenants
  FOR SELECT USING (id = public.get_tenant_id());

CREATE POLICY "tenants_update" ON public.tenants
  FOR UPDATE USING (id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: profiles
-- ============================================================
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: offers
-- ============================================================
CREATE POLICY "offers_select" ON public.offers
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "offers_insert" ON public.offers
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "offers_update" ON public.offers
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

CREATE POLICY "offers_delete" ON public.offers
  FOR DELETE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: sources
-- ============================================================
CREATE POLICY "sources_select" ON public.sources
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "sources_insert" ON public.sources
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "sources_update" ON public.sources
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

CREATE POLICY "sources_delete" ON public.sources
  FOR DELETE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: opportunities
-- ============================================================
CREATE POLICY "opportunities_select" ON public.opportunities
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "opportunities_insert" ON public.opportunities
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "opportunities_update" ON public.opportunities
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

CREATE POLICY "opportunities_delete" ON public.opportunities
  FOR DELETE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: opportunity_evidence
-- ============================================================
CREATE POLICY "evidence_select" ON public.opportunity_evidence
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "evidence_insert" ON public.opportunity_evidence
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: opportunity_status_history
-- ============================================================
CREATE POLICY "status_history_select" ON public.opportunity_status_history
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "status_history_insert" ON public.opportunity_status_history
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: audits
-- ============================================================
CREATE POLICY "audits_select" ON public.audits
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "audits_insert" ON public.audits
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: scores
-- ============================================================
CREATE POLICY "scores_select" ON public.scores
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "scores_insert" ON public.scores
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: strategies
-- ============================================================
CREATE POLICY "strategies_select" ON public.strategies
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "strategies_insert" ON public.strategies
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: campaigns
-- ============================================================
CREATE POLICY "campaigns_select" ON public.campaigns
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "campaigns_insert" ON public.campaigns
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "campaigns_update" ON public.campaigns
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: conversations
-- ============================================================
CREATE POLICY "conversations_select" ON public.conversations
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "conversations_insert" ON public.conversations
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "conversations_update" ON public.conversations
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: messages
-- ============================================================
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: communication_preferences
-- ============================================================
CREATE POLICY "comm_prefs_select" ON public.communication_preferences
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "comm_prefs_insert" ON public.communication_preferences
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "comm_prefs_update" ON public.communication_preferences
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: conversions
-- ============================================================
CREATE POLICY "conversions_select" ON public.conversions
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "conversions_insert" ON public.conversions
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "conversions_update" ON public.conversions
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: agent_executions
-- ============================================================
CREATE POLICY "agent_exec_select" ON public.agent_executions
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "agent_exec_insert" ON public.agent_executions
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "agent_exec_update" ON public.agent_executions
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: audit_logs
-- ============================================================
CREATE POLICY "audit_logs_select" ON public.audit_logs
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: tenant_settings
-- ============================================================
CREATE POLICY "tenant_settings_select" ON public.tenant_settings
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "tenant_settings_insert" ON public.tenant_settings
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "tenant_settings_update" ON public.tenant_settings
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

CREATE POLICY "tenant_settings_delete" ON public.tenant_settings
  FOR DELETE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- POLÍTICAS RLS: dispatches
-- ============================================================
CREATE POLICY "dispatches_select" ON public.dispatches
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "dispatches_insert" ON public.dispatches
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "dispatches_update" ON public.dispatches
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- FIM DA MIGRATION 001
-- ============================================================
