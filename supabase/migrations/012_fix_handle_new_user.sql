-- ============================================================
-- HUVI — Migration 012: Fix handle_new_user with tenant_credits
-- A migration 011 removeu a criação de tenant_credits que havia
-- sido adicionada nas migrations 009 e 010. Esta migration
-- restaura a criação de tenant_credits no onboarding.
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

  -- Criar créditos com defaults (incluindo pesos do Firecrawl)
  INSERT INTO public.tenant_credits (
    tenant_id,
    opportunity_limit, opportunity_used,
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

  RETURN NEW;
END;
$$;

-- ============================================================
-- FIM DA MIGRATION 012
-- ============================================================
