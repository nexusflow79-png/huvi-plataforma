-- ============================================================
-- MIGRATION 010: Soft delete para search_logs + padronização
-- ============================================================

-- 1. Adicionar deleted_at em outscraper_search_log
ALTER TABLE public.outscraper_search_log
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_search_log_deleted
  ON public.outscraper_search_log(tenant_id, deleted_at);

-- 2. Adicionar deleted_at em web_search_log
ALTER TABLE public.web_search_log
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_web_search_log_deleted
  ON public.web_search_log(tenant_id, deleted_at);

-- 3. RLS: UPDATE policy para outscraper_search_log (soft delete)
DROP POLICY IF EXISTS "search_log_update" ON public.outscraper_search_log;
CREATE POLICY "search_log_update" ON public.outscraper_search_log
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- 4. RLS: UPDATE policy para web_search_log (soft delete)
DROP POLICY IF EXISTS "web_search_log_update" ON public.web_search_log;
CREATE POLICY "web_search_log_update" ON public.web_search_log
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- 5. RLS: UPDATE policy para opportunities (caso não exista)
DROP POLICY IF EXISTS "opportunities_update_soft_delete" ON public.opportunities;
CREATE POLICY "opportunities_update_soft_delete" ON public.opportunities
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- 6. RLS: UPDATE policy para campaigns (caso não exista)
DROP POLICY IF EXISTS "campaigns_update_soft_delete" ON public.campaigns;
CREATE POLICY "campaigns_update_soft_delete" ON public.campaigns
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- 7. Remover DELETE policies (não usaremos mais hard delete via frontend)
DROP POLICY IF EXISTS "search_log_delete" ON public.outscraper_search_log;
DROP POLICY IF EXISTS "web_search_log_delete" ON public.web_search_log;
