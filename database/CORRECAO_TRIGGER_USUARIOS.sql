-- ==============================================================================
-- CORREÇÃO DEFINITIVA: TRIGGER DE CRIAÇÃO DE USUÁRIOS
-- ==============================================================================
-- Este script substitui o gatilho (trigger) padrão de criação de usuários.
-- Ele garante que o 'client_id' enviado pelo Admin Portal seja gravado corretamente.
-- ==============================================================================

-- 1. Remover trigger e função antigos para recriar do zero (garante limpeza)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Criar a função correta
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_client_id UUID;
  v_full_name TEXT;
  v_phone TEXT;
BEGIN
  -- Extrair dados dos metadados (enviados pela API)
  v_role := COALESCE(new.raw_user_meta_data->>'role', 'technician'); -- Padrão técnico se nulo
  v_full_name := new.raw_user_meta_data->>'full_name';
  v_phone := new.raw_user_meta_data->>'phone';
  
  -- Tentar extrair client_id (pode vir como string vazia, tratar como NULL)
  BEGIN
    v_client_id := (new.raw_user_meta_data->>'client_id')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_client_id := NULL;
  END;

  -- Inserir no public.profiles
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    client_id,
    phone,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    new.id,
    new.email,
    v_full_name,
    v_role,
    v_client_id, -- AQUI ESTÁ A CORREÇÃO: Usando o ID que veio da API
    v_phone,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    client_id = EXCLUDED.client_id,
    updated_at = NOW();

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recriar o Trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- AJUSTE DE CONSTRAINT (OPCIONAL MAS RECOMENDADO)
-- Garante que se a role for Client, TEM que ter client_id
-- ==============================================================================

DO $$
BEGIN
  -- Remove constraint antiga se existir (para evitar duplicação ou versão incorreta)
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_client_role_consistency;
  
  -- Adiciona a constraint correta
  ALTER TABLE public.profiles 
    ADD CONSTRAINT check_client_role_consistency 
    CHECK (
      (role = 'client' AND client_id IS NOT NULL) OR 
      (role <> 'client')
    );
EXCEPTION 
  WHEN OTHERS THEN NULL;
END $$;

-- ==============================================================================
-- 🎉 PRONTO! AGORA O SUPABASE ACEITARÁ A CRIAÇÃO DIRETA DE CLIENTES.
-- ==============================================================================
