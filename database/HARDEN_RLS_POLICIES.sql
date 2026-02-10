-- ==============================================================================
-- SCRIPT DE BLINDAGEM DE SEGURANÇA (RLS - ROW LEVEL SECURITY)
-- ==============================================================================
-- Este script revoga as permissões genéricas antigas e aplica regras estritas
-- baseadas no cargo (role) do usuário na tabela 'profiles'.
--
-- ROLES:
-- 'admin': Acesso total (SELECT, INSERT, UPDATE, DELETE)
-- 'technician': Ver tudo, editar status/fotos, inserir logs. NÃO PODE DELETAR.
-- 'client': Ver apenas seus próprios dados.
-- 'manager': (Se existir) tratado como admin por enquanto.
-- ==============================================================================

-- 1. Habilitar RLS nas tabelas críticas (caso não esteja)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE load_surveys ENABLE ROW LEVEL SECURITY;

-- 2. Limpar Políticas Antigas (Para evitar conflitos)
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on email" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

DROP POLICY IF EXISTS "Enable read access for all users" ON clients;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON clients;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON clients;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON clients;

DROP POLICY IF EXISTS "Enable read access for all users" ON maintenance_contracts;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON maintenance_contracts;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON maintenance_contracts;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON maintenance_contracts;

DROP POLICY IF EXISTS "Enable read access for all users" ON load_surveys;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON load_surveys;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON load_surveys;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON load_surveys;


-- ==============================================================================
-- 3. HELPER FUNCTION: is_admin() e is_technician()
-- ==============================================================================
-- Funções auxiliares para simplificar as políticas e melhorar performance
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_technician()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'technician'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- 4. POLÍTICAS DA TABELA PROFILES
-- ==============================================================================
-- LEITURA: Admins veem todos. Usuários veem a si mesmos. Técnicos veem todos (para atribuir tarefas).
CREATE POLICY "Profiles View Policy" ON profiles FOR SELECT
USING ( is_admin() OR is_technician() OR id = auth.uid() );

-- ATUALIZAÇÃO: Admins editam qualquer um. Usuários editam a si mesmos.
CREATE POLICY "Profiles Update Policy" ON profiles FOR UPDATE
USING ( is_admin() OR id = auth.uid() );

-- INSERÇÃO: Trigger automático (handler_new_user) faz isso, mas deixamos admin por segurança.
CREATE POLICY "Profiles Insert Policy" ON profiles FOR INSERT
WITH CHECK ( is_admin() OR id = auth.uid() );


-- ==============================================================================
-- 5. POLÍTICAS DA TABELA CLIENTS
-- ==============================================================================
-- LEITURA: Admins e Técnicos veem todos. Clientes só veem se o ID bater (se houver link no profile).
-- Nota: Para clientes verem seus dados, o profile deles deve ter client_id preenchido.
CREATE POLICY "Clients View Policy" ON clients FOR SELECT
USING ( 
    is_admin() 
    OR is_technician() 
    OR id IN (SELECT client_id FROM profiles WHERE id = auth.uid()) 
);

-- ESCRITA TOTAL (INSERT/UPDATE/DELETE): Apenas Admins.
CREATE POLICY "Clients Admin Mutate Policy" ON clients FOR ALL
USING ( is_admin() );


-- ==============================================================================
-- 6. POLÍTICAS DA TABELA MAINTENANCE_CONTRACTS
-- ==============================================================================
-- LEITURA: Admins e Técnicos veem todos. Clientes veem os seus.
CREATE POLICY "Contracts View Policy" ON maintenance_contracts FOR SELECT
USING ( 
    is_admin() 
    OR is_technician() 
    OR client_id IN (SELECT client_id FROM profiles WHERE id = auth.uid()) 
);

-- ADMIN: Pode fazer tudo.
CREATE POLICY "Contracts Admin Policy" ON maintenance_contracts FOR ALL
USING ( is_admin() );

-- TÉCNICO: Pode atuar? 
-- Técnicos geralmente não criam contratos, mas se o app permitir, descomente abaixo.
-- Por enquanto, vamos permitir que técnicos ATUALIZEM contratos (ex: concluir manutenção), mas não CRIEM/DELETEM.
CREATE POLICY "Contracts Tech Update Policy" ON maintenance_contracts FOR UPDATE
USING ( is_technician() )
WITH CHECK ( is_technician() ); 


-- ==============================================================================
-- 7. POLÍTICAS DA TABELA LOAD_SURVEYS (Levantamento de Cargas)
-- ==============================================================================
-- LEITURA: Admin/Tec veem tudo. Cliente vê o seu.
CREATE POLICY "Surveys View Policy" ON load_surveys FOR SELECT
USING ( 
    is_admin() 
    OR is_technician() 
    OR client_id IN (SELECT client_id FROM profiles WHERE id = auth.uid()) 
);

-- ESCRITA: Admin e TÉCNICOS podem criar e editar levantamentos.
CREATE POLICY "Surveys Tech/Admin Mutate Policy" ON load_surveys FOR ALL
USING ( is_admin() OR is_technician() );


-- ==============================================================================
-- 8. POLÍTICAS DA TABELA MAINTENANCE_HISTORY (Histórico)
-- ==============================================================================
-- LEITURA: Igual contratos.
CREATE POLICY "History View Policy" ON maintenance_history FOR SELECT
USING ( 
    is_admin() 
    OR is_technician() 
    OR contract_id IN (
        SELECT id FROM maintenance_contracts 
        WHERE client_id IN (SELECT client_id FROM profiles WHERE id = auth.uid())
    )
);

-- ESCRITA: Admin e Técnicos (para logar conclusão).
CREATE POLICY "History Tech/Admin Insert Policy" ON maintenance_history FOR INSERT
WITH CHECK ( is_admin() OR is_technician() );

-- Atualização/Delete de histórico: Só admin.
CREATE POLICY "History Admin Mutate Policy" ON maintenance_history FOR UPDATE
USING ( is_admin() );

CREATE POLICY "History Admin Delete Policy" ON maintenance_history FOR DELETE
USING ( is_admin() );
