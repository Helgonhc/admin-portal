-- ==============================================================================
-- SCRIPT DE BLINDAGEM SEGURA (RLS V3 - SUPER COMPLETO)
-- ==============================================================================
-- Atualizado para incluir 'super_admin' e garantir acesso total.

-- 1. Habilitar RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE load_surveys ENABLE ROW LEVEL SECURITY;

-- 2. Limpeza de Políticas Antigas (Garante que não sobre lixo)
DROP POLICY IF EXISTS "Profiles View Policy" ON profiles;
DROP POLICY IF EXISTS "Profiles Update Policy" ON profiles;
DROP POLICY IF EXISTS "Profiles Insert Policy" ON profiles;
DROP POLICY IF EXISTS "Self View Profile" ON profiles;
DROP POLICY IF EXISTS "Admin/Tech View All Profiles" ON profiles;
DROP POLICY IF EXISTS "Self Update Profile" ON profiles;
DROP POLICY IF EXISTS "Admin Update Any Profile" ON profiles;
DROP POLICY IF EXISTS "Insert Profile" ON profiles;

DROP POLICY IF EXISTS "Clients View Policy" ON clients;
DROP POLICY IF EXISTS "View Clients" ON clients;
DROP POLICY IF EXISTS "Clients Admin Mutate Policy" ON clients;
DROP POLICY IF EXISTS "Admin Manage Clients" ON clients;

DROP POLICY IF EXISTS "Contracts View Policy" ON maintenance_contracts;
DROP POLICY IF EXISTS "View Contracts" ON maintenance_contracts;
DROP POLICY IF EXISTS "Contracts Admin Policy" ON maintenance_contracts;
DROP POLICY IF EXISTS "Admin Manage Contracts" ON maintenance_contracts;
DROP POLICY IF EXISTS "Tech Update Contracts" ON maintenance_contracts;

DROP POLICY IF EXISTS "Surveys View Policy" ON load_surveys;
DROP POLICY IF EXISTS "View Surveys" ON load_surveys;
DROP POLICY IF EXISTS "Surveys Tech/Admin Mutate Policy" ON load_surveys;
DROP POLICY IF EXISTS "Manage Surveys" ON load_surveys;

DROP POLICY IF EXISTS "History View Policy" ON maintenance_history;
DROP POLICY IF EXISTS "View History" ON maintenance_history;
DROP POLICY IF EXISTS "History Tech/Admin Insert Policy" ON maintenance_history;
DROP POLICY IF EXISTS "History Admin Mutate Policy" ON maintenance_history; 
DROP POLICY IF EXISTS "History Admin Delete Policy" ON maintenance_history;
DROP POLICY IF EXISTS "Tech/Admin Insert History" ON maintenance_history;
DROP POLICY IF EXISTS "Admin Manage History" ON maintenance_history;
DROP POLICY IF EXISTS "Admin Delete History" ON maintenance_history;


-- 3. FUNÇÕES DE CHECAGEM (SECURITY DEFINER = BYPASS RLS)
-- Fundamental para evitar o loop "preciso ser admin para saber se sou admin"
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  -- Agora inclui 'super_admin' explicitamente
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND (role = 'admin' OR role = 'manager' OR role = 'super_admin')
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
-- 4. POLÍTICAS SEGURAS REAPLICADAS
-- ==============================================================================

-- [PROFILES]
CREATE POLICY "Self View Profile" ON profiles FOR SELECT USING ( id = auth.uid() );
CREATE POLICY "Admin/Tech View All Profiles" ON profiles FOR SELECT USING ( is_admin() OR is_technician() );
CREATE POLICY "Self Update Profile" ON profiles FOR UPDATE USING ( id = auth.uid() );
CREATE POLICY "Admin Update Any Profile" ON profiles FOR UPDATE USING ( is_admin() );
CREATE POLICY "Insert Profile" ON profiles FOR INSERT WITH CHECK ( is_admin() OR id = auth.uid() );

-- [CLIENTS]
CREATE POLICY "View Clients" ON clients FOR SELECT 
USING ( is_admin() OR is_technician() OR id IN (SELECT client_id FROM profiles WHERE id = auth.uid()) );

CREATE POLICY "Admin Manage Clients" ON clients FOR ALL USING ( is_admin() );

-- [MAINTENANCE CONTRACTS]
CREATE POLICY "View Contracts" ON maintenance_contracts FOR SELECT 
USING ( is_admin() OR is_technician() OR client_id IN (SELECT client_id FROM profiles WHERE id = auth.uid()) );

CREATE POLICY "Admin Manage Contracts" ON maintenance_contracts FOR ALL USING ( is_admin() );

CREATE POLICY "Tech Update Contracts" ON maintenance_contracts FOR UPDATE USING ( is_technician() ) WITH CHECK ( is_technician() );

-- [LOAD SURVEYS]
CREATE POLICY "View Surveys" ON load_surveys FOR SELECT 
USING ( is_admin() OR is_technician() OR client_id IN (SELECT client_id FROM profiles WHERE id = auth.uid()) );

CREATE POLICY "Manage Surveys" ON load_surveys FOR ALL USING ( is_admin() OR is_technician() );

-- [MAINTENANCE HISTORY]
CREATE POLICY "View History" ON maintenance_history FOR SELECT 
USING ( 
    is_admin() OR is_technician() OR contract_id IN (
        SELECT id FROM maintenance_contracts 
        WHERE client_id IN (SELECT client_id FROM profiles WHERE id = auth.uid())
    )
);

CREATE POLICY "Tech/Admin Insert History" ON maintenance_history FOR INSERT WITH CHECK ( is_admin() OR is_technician() );

CREATE POLICY "Admin Manage History" ON maintenance_history FOR UPDATE USING ( is_admin() );

CREATE POLICY "Admin Delete History" ON maintenance_history FOR DELETE USING ( is_admin() );
