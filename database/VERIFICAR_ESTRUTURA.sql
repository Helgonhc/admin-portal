-- SCRIPT PARA INSPEÇÃO DA ESTRUTURA DO BANCO
-- Execute este script no SQL Editor do Supabase e me mande o resultado (em JSON ou texto)

-- 1. Ver as Regras (Constraints) da tabela Profiles
SELECT 
    conname as constrain_name, 
    pg_get_constraintdef(c.oid) as regras_definidas
FROM pg_constraint c 
JOIN pg_namespace n ON n.oid = c.connamespace 
WHERE n.nspname = 'public' 
AND conrelid = 'public.profiles'::regclass;

-- 2. Ver o Gatilho (Trigger) que roda ao criar usuário
SELECT 
    tgname as nome_trigger,
    pg_get_triggerdef(oid) as definicao_trigger
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass;

-- 3. Ver definição da função handle_new_user
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'handle_new_user';
