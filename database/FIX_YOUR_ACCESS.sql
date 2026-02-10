-- ==============================================================================
-- SCRIPT DE CORREÇÃO DE ACESSO (PERFIL DE ADMINISTRADOR)
-- ==============================================================================
-- Este script força a criação/atualização do perfil para o seu email,
-- garantindo que o cargo seja 'admin' e o RLS permita o acesso.

DO $$
DECLARE
  v_user_id uuid;
  v_email text := 'operacaomg@eletricom.me'; -- SEU EMAIL AQUI
BEGIN
  -- 1. Buscar o ID do usuário na tabela de autenticação
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NOT NULL THEN
    -- 2. Criar ou Atualizar o perfil na tabela pública
    INSERT INTO public.profiles (id, email, full_name, role, is_active)
    VALUES (
      v_user_id, 
      v_email, 
      'Super Administrador', -- Nome padrão
      'admin',               -- O PAPEL CRÍTICO QUE LIBERA O ACESSO
      true
    )
    ON CONFLICT (id) DO UPDATE
    SET 
      role = 'admin',      -- Força admin caso estivesse errado
      is_active = true,
      email = v_email;     -- Garante sincronia
    
    RAISE NOTICE '✅ SUCESSO! O usuário % agora é ADMIN confirmado.', v_email;
  ELSE
    RAISE NOTICE '❌ ERRO: Usuário % não encontrado no sistema de Auth.', v_email;
  END IF;
END $$;
