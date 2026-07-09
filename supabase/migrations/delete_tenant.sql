-- UTILITÁRIO: Deletar Tenant de Forma Completa (Evitar "User Already Registered")
-- Este script remove o usuário corretamente tanto da tabela 'public.tenants'
-- quanto da tabela 'auth.users' do Supabase.
--
-- INSTRUÇÕES DE USO NO DASHBOARD DO SUPABASE:
-- 1. Vá até o "SQL Editor" no Supabase.
-- 2. Cole este código.
-- 3. Substitua 'seu@email.com' pelo e-mail do tenant que deseja excluir completamente.
-- 4. Clique em "Run".

DO $$
DECLARE
  target_email text := 'seu@email.com'; -- MUDE O E-MAIL AQUI
  target_user_id uuid;
  target_tenant_id uuid;
BEGIN
  -- 1. Encontrar o ID do usuário na tabela auth.users
  SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;

  IF target_user_id IS NOT NULL THEN
    -- 2. Encontrar o ID do tenant associado (pela tabela profiles)
    SELECT tenant_id INTO target_tenant_id FROM public.profiles WHERE auth_user_id = target_user_id;

    -- 3. Deletar as dependências no schema public (CASCADE normalmente já faria isso, mas garantimos aqui)
    IF target_tenant_id IS NOT NULL THEN
      DELETE FROM public.communication_preferences WHERE tenant_id = target_tenant_id;
      DELETE FROM public.profiles WHERE tenant_id = target_tenant_id;
      DELETE FROM public.tenants WHERE id = target_tenant_id;
      RAISE NOTICE 'Tenant % e seus dados foram apagados com sucesso do schema public.', target_tenant_id;
    END IF;

    -- 4. FINALMENTE: Deletar o usuário de auth.users (isso resolve o erro "User already registered")
    DELETE FROM auth.users WHERE id = target_user_id;
    RAISE NOTICE 'Usuário % (%) apagado completamente do auth.users.', target_email, target_user_id;
  ELSE
    RAISE NOTICE 'Usuário com e-mail % não encontrado na tabela auth.users.', target_email;
  END IF;
END $$;
