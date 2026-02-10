-- ==============================================================================
-- SCRIPT DE INVESTIGAÇÃO DE PERFIL
-- ==============================================================================
-- Rode este script para ver EXATAMENTE como o banco enxerga seu usuário hoje.
-- Ele cruza a tabela secreta de login (auth.users) com o seu perfil público (profiles).

SELECT 
    au.email as "LOGIN_EMAIL",
    au.id as "LOGIN_ID",
    p.email as "PERFIL_EMAIL",
    p.role as "PERFIL_CARGO", 
    p.is_active as "PERFIL_ATIVO",
    CASE 
        WHEN p.id IS NULL THEN '❌ PERFIL NÃO EXISTE'
        WHEN p.role = 'admin' THEN '✅ CARGO ADMIN OK'
        ELSE '⚠️ CARGO ERRADO (' || COALESCE(p.role, 'NULO') || ')'
    END as "DIAGNOSTICO"
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE au.email = 'operacaomg@eletricom.me'; -- Seu email

-- Se a coluna PERFIL_CARGO não for "admin", o sistema boqueia.
-- Se PERFIL_EMAIL for nulo, significa que não existe perfil ligado ao login.
