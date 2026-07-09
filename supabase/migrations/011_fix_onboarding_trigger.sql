-- ============================================================
-- HUVI — Hub de Vendas Inteligente
-- Migration 011: Correção do Trigger de Onboarding
-- 
-- Problema: Cadastro retornava erro 500 ("Database error saving
-- new user") porque a função handle_new_user() tentava fazer
-- UPDATE em auth.users sem as permissões corretas.
--
-- Solução:
-- 1. Removemos o UPDATE auth.users da função trigger
-- 2. Adicionamos fallback na get_tenant_id() para buscar
--    tenant_id da tabela profiles quando não estiver no JWT
-- ============================================================

-- 1. Recriar a função handle_new_user SEM o UPDATE em auth.users
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

  RETURN NEW;
END;
$$;

-- 2. Recriar o trigger no auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Atualizar a função get_tenant_id() com fallback para profiles
--    Isso garante que RLS funcione mesmo sem tenant_id no JWT
CREATE OR REPLACE FUNCTION public.get_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::json->'app_metadata'->>'tenant_id')::uuid,
    (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid,
    (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1),
    NULL
  );
$$;
