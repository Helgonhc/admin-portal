-- ==============================================================================
-- SCRIPT DE EMERGÊNCIA: DESBLOQUEIO TOTAL (AGORA VAI)
-- ==============================================================================
-- Se algo deu errado com as permissões, rode este script.
-- Ele DESATIVA a segurança (RLS) temporariamente para você voltar a trabalhar.

ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_contracts DISABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE load_surveys DISABLE ROW LEVEL SECURITY;

-- Além disso, vamos garantir (de novo) que seu usuário é admin
DO $$
DECLARE
  v_user_id uuid;
  v_email text := 'operacaomg@eletricom.me';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, role, is_active)
    VALUES (v_user_id, v_email, 'admin', true)
    ON CONFLICT (id) DO UPDATE SET role = 'admin', is_active = true;
  END IF;
END $$;
