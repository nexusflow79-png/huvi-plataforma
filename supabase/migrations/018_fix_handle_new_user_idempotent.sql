-- ============================================================
-- HUVI — Hub de Vendas Inteligente
-- Migration 018: Tornar handle_new_user idempotente
-- Motivo: Permitir criação de usuários auth para tenants criados
--         manualmente pelo Superadmin sem dar conflito de chave
--         única ou duplicar registros.
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
  -- 1. Verificar se o tenant já existe pelo e-mail
  SELECT id INTO new_tenant_id FROM public.tenants WHERE email = NEW.email LIMIT 1;

  -- 2. Se não existir, criar o tenant
  IF new_tenant_id IS NULL THEN
    INSERT INTO public.tenants (name, email)
    VALUES (
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      NEW.email
    )
    RETURNING id INTO new_tenant_id;
  END IF;

  -- 3. Criar ou atualizar profile (ON CONFLICT em auth_user_id)
  INSERT INTO public.profiles (tenant_id, auth_user_id, full_name, email, role)
  VALUES (
    new_tenant_id,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'owner'
  )
  ON CONFLICT (auth_user_id) DO UPDATE
  SET tenant_id = EXCLUDED.tenant_id,
      full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
      email = EXCLUDED.email;

  -- 4. Criar preferências de comunicação se não existirem
  IF NOT EXISTS (SELECT 1 FROM public.communication_preferences WHERE tenant_id = new_tenant_id) THEN
    INSERT INTO public.communication_preferences (tenant_id) VALUES (new_tenant_id);
  END IF;

  -- 5. Criar créditos se não existirem
  IF NOT EXISTS (SELECT 1 FROM public.tenant_credits WHERE tenant_id = new_tenant_id) THEN
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
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- FIM DA MIGRATION 018
-- ============================================================
