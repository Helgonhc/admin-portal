-- =====================================================
-- CORREÇÃO: CRIAÇÃO DE USUÁRIOS SEM AFETAR SESSÃO
-- =====================================================
-- Este script corrige o erro "function gen_salt(unknown) does not exist"
-- e define a função RPC create_user_admin corretamente.
-- =====================================================

-- 1️⃣ HABILITAR EXTENSÃO PGCRYPTO (Se já não estiver)
-- O Supabase geralmente coloca extensões no schema 'extensions'
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- 2️⃣ REMOVER VERSÃO ANTIGA (Se existir)
-- Isso é necessário porque mudamos o tipo de retorno para JSONB
DROP FUNCTION IF EXISTS create_user_admin(text,text,text,text,text,text,text);

-- 3️⃣ CRIAR OU ATUALIZAR A FUNÇÃO RPC
CREATE OR REPLACE FUNCTION create_user_admin(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_role TEXT DEFAULT 'technician',
  p_phone TEXT DEFAULT NULL,
  p_cpf TEXT DEFAULT NULL,
  p_cargo TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Verificar se o email já existe no auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este email já está cadastrado no sistema.');
  END IF;

  -- Criar usuário na tabela auth.users do Supabase
  -- Usamos extensions.crypt e extensions.gen_salt para evitar erros de schema
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', p_full_name, 'role', p_role),
    false,
    ''
  ) RETURNING id INTO v_user_id;

  -- O trigger handle_new_user() deve criar o profile automaticamente
  -- Mas vamos garantir que os dados extras (phone, cpf, cargo) sejam salvos
  -- Aguardamos um pequeno momento para o trigger processar ou fazemos o update direto
  
  -- Sincronizar dados no profiles
  -- Caso o trigger handle_new_user tenha falhado em capturar tudo
  INSERT INTO public.profiles (id, email, full_name, role, phone, cpf, cargo, is_active)
  VALUES (v_user_id, p_email, p_full_name, p_role, p_phone, p_cpf, p_cargo, true)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    phone = EXCLUDED.phone,
    cpf = EXCLUDED.cpf,
    cargo = EXCLUDED.cargo,
    is_active = true;

  RETURN jsonb_build_object(
    'success', true, 
    'user_id', v_user_id,
    'message', 'Usuário criado com sucesso'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false, 
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3️⃣ DAR PERMISSÃO DE EXECUÇÃO
GRANT EXECUTE ON FUNCTION create_user_admin TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_admin TO service_role;

-- =====================================================
-- 🎉 PRONTO! 
-- Agora você pode voltar ao site e criar o usuário.
-- =====================================================
