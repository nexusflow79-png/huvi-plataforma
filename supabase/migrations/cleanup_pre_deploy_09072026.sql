-- ============================================================
-- HUVI — Script de Limpeza Completa para Deploy de Produção
-- Data: 09/07/2026
-- 
-- ATENÇÃO: Este script apaga TODOS os dados operacionais.
-- Preserva: estrutura, índices, RLS, triggers, funções.
-- Preserva: copy_templates, copy_personalization_rules,
--           copy_vocabulary, city_zones.
-- 
-- EXECUTE APENAS APÓS FAZER BACKUP!
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────
-- 1. LIMPAR TABELAS DEPENDENTES (filhas primeiro)
--    Ordem respeitando foreign keys para evitar erros
-- ────────────────────────────────────────────────────────

-- Grupo: Mensagens e Conversas
TRUNCATE TABLE public.messages CASCADE;
TRUNCATE TABLE public.conversations CASCADE;

-- Grupo: Dispatches e Campanhas
TRUNCATE TABLE public.dispatches CASCADE;
TRUNCATE TABLE public.campaigns CASCADE;

-- Grupo: Conversões
TRUNCATE TABLE public.conversions CASCADE;

-- Grupo: Análise (Auditor, Scorer, Strategist)
TRUNCATE TABLE public.audits CASCADE;
TRUNCATE TABLE public.scores CASCADE;
TRUNCATE TABLE public.strategies CASCADE;

-- Grupo: Evidências e Histórico de Oportunidades
TRUNCATE TABLE public.opportunity_evidence CASCADE;
TRUNCATE TABLE public.opportunity_status_history CASCADE;
TRUNCATE TABLE public.opportunity_dedup_log CASCADE;

-- Grupo: Oportunidades (depois das dependentes)
TRUNCATE TABLE public.opportunities CASCADE;

-- Grupo: Fontes
TRUNCATE TABLE public.sources CASCADE;

-- Grupo: Ofertas
TRUNCATE TABLE public.offers CASCADE;

-- Grupo: Logs de Busca
TRUNCATE TABLE public.outscraper_search_log CASCADE;
TRUNCATE TABLE public.outscraper_search_queue CASCADE;
TRUNCATE TABLE public.web_search_log CASCADE;
TRUNCATE TABLE public.web_search_queue CASCADE;

-- Grupo: Logs do Sistema
TRUNCATE TABLE public.audit_logs CASCADE;
TRUNCATE TABLE public.agent_executions CASCADE;
TRUNCATE TABLE public.ai_usage CASCADE;
TRUNCATE TABLE public.asaas_webhook_log CASCADE;

-- Grupo: Configurações por Tenant
TRUNCATE TABLE public.communication_preferences CASCADE;
TRUNCATE TABLE public.tenant_settings CASCADE;
TRUNCATE TABLE public.tenant_credits CASCADE;

-- Grupo: Core (por último — são as tabelas pai)
TRUNCATE TABLE public.profiles CASCADE;
TRUNCATE TABLE public.tenants CASCADE;

-- ────────────────────────────────────────────────────────
-- 2. LIMPAR USUÁRIOS DE AUTENTICAÇÃO
--    Remove todos os usuários da tabela auth.users
--    (resolve erros "User already registered")
-- ────────────────────────────────────────────────────────

DELETE FROM auth.users;

-- ────────────────────────────────────────────────────────
-- 3. VERIFICAÇÃO PÓS-LIMPEZA
--    Estas queries devem retornar 0 em todas
-- ────────────────────────────────────────────────────────

DO $$
DECLARE
  cnt_tenants int;
  cnt_profiles int;
  cnt_users int;
  cnt_opps int;
BEGIN
  SELECT count(*) INTO cnt_tenants FROM public.tenants;
  SELECT count(*) INTO cnt_profiles FROM public.profiles;
  SELECT count(*) INTO cnt_users FROM auth.users;
  SELECT count(*) INTO cnt_opps FROM public.opportunities;
  
  RAISE NOTICE '=== VERIFICAÇÃO PÓS-LIMPEZA ===';
  RAISE NOTICE 'Tenants: %', cnt_tenants;
  RAISE NOTICE 'Profiles: %', cnt_profiles;
  RAISE NOTICE 'Auth Users: %', cnt_users;
  RAISE NOTICE 'Opportunities: %', cnt_opps;
  
  IF cnt_tenants = 0 AND cnt_profiles = 0 AND cnt_users = 0 AND cnt_opps = 0 THEN
    RAISE NOTICE '✅ Limpeza concluída com sucesso! Banco pronto para produção.';
  ELSE
    RAISE WARNING '⚠️ Ainda existem registros residuais. Verifique manualmente.';
  END IF;
END $$;

COMMIT;
