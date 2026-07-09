-- ============================================================
-- HUVI — Hub de Vendas Inteligente
-- Migration 004: Correções RLS, Soft Delete e Ativação de Triggers
-- ============================================================

-- 1. CORREÇÃO DE SEGURANÇA (Vazamento de dados entre Tenants em Offers)
-- Remove a política pública genérica que causava contaminação via 'OR'
DROP POLICY IF EXISTS "offers_public_select" ON public.offers;
DROP POLICY IF EXISTS "offers_select" ON public.offers;

-- Cria a política pública de ofertas exclusiva para anon (leitura de LP pública)
CREATE POLICY "offers_public_select" ON public.offers
  FOR SELECT TO anon USING (active = true AND deleted_at IS NULL);

-- Cria a política de leitura de ofertas de forma exclusiva para inquilinos autenticados
CREATE POLICY "offers_select" ON public.offers
  FOR SELECT TO authenticated USING (tenant_id = public.get_tenant_id() AND deleted_at IS NULL);


-- 2. CORREÇÃO DE SEGURANÇA (RLS com suporte a Soft Delete em fontes e oportunidades)
-- Drop das políticas existentes de select
DROP POLICY IF EXISTS "sources_select" ON public.sources;
DROP POLICY IF EXISTS "opportunities_select" ON public.opportunities;

-- Recriar as políticas integrando de forma nativa a checagem de deleted_at IS NULL
CREATE POLICY "sources_select" ON public.sources
  FOR SELECT USING (tenant_id = public.get_tenant_id() AND deleted_at IS NULL);

CREATE POLICY "opportunities_select" ON public.opportunities
  FOR SELECT USING (tenant_id = public.get_tenant_id() AND deleted_at IS NULL);


-- 3. GARANTIA DE ATIVAÇÃO DO TRIGGER DE ONBOARDING
-- Cria o trigger de registro pós inserção no Auth se não existir
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
