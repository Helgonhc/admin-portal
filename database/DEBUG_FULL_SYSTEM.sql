-- ==============================================================================
-- SCRIPT DE RAIO-X COMPLETO DO SISTEMA
-- ==============================================================================
-- Vamos ver quem é quem e se os contratos estão sendo salvos.

-- 1. LISTA DE TODOS OS USUÁRIOS E CARGOS
SELECT 
    p.email, 
    p.full_name, 
    p.role as "CARGO", 
    p.is_active,
    au.last_sign_in_at as "ULTIMO_LOGIN"
FROM public.profiles p
JOIN auth.users au ON p.id = au.id
ORDER BY p.role, p.email;

-- 2. LISTA DOS ÚLTIMOS 5 CONTRATOS CRIADOS
SELECT 
    mc.id, 
    mc.title, 
    mc.created_at, 
    p.email as "CRIADO_POR",
    mc.client_id
FROM maintenance_contracts mc
LEFT JOIN public.profiles p ON mc.created_by = p.id
ORDER BY mc.created_at DESC
LIMIT 5;

-- 3. DIAGNÓSTICO DE RLS
-- Tenta contar tudo (Se for Admin rodando no SQL Editor, deve ver tudo)
SELECT count(*) as "TOTAL_CONTRATOS" FROM maintenance_contracts;
