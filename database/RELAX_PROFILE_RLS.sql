-- ==============================================================================
-- SCRIPT DE AJUSTE FINO (RELAXAR LEITURA DE PERFIS)
-- ==============================================================================
-- O problema provável é um "Loop Infinito" onde o banco tenta ler o perfil para saber
-- se pode ler o perfil. Vamos simplificar apenas a leitura da tabela PROFILES.

-- 1. Remover políicas complexas de leitura em profiles
DROP POLICY IF EXISTS "Self View Profile" ON profiles;
DROP POLICY IF EXISTS "Admin/Tech View All Profiles" ON profiles;

-- 2. Criar política simples: "Se logou, pode ler perfis"
-- Isso resolve o problema do login e não expõe dados sensíveis (contratos continuam blindados)
CREATE POLICY "Authenticated View All Profiles" ON profiles FOR SELECT
USING ( auth.role() = 'authenticated' );

-- Mantenha as políticas de Escrita (Update/Insert) estritas!
-- (Elas não são afetadas por este script, pois só removemos as de SELECT)
