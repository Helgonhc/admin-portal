-- ==========================================================
-- SCRIPT DE CRIAO: MDULO DE INSTALAES E DOCUMENTOS
-- ==========================================================

-- 0. Adicionar coluna is_telemetry_client na tabela clients se no existir
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='is_telemetry_client') THEN
        ALTER TABLE clients ADD COLUMN is_telemetry_client BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 1. Criar tabela de instalaes
CREATE TABLE IF NOT EXISTS installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    location_address TEXT,
    state TEXT, -- UF do Brasil
    contact_name TEXT,
    contact_phone TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'scheduled', 'in_progress', 'completed', 'cancelled'
    scheduled_date TIMESTAMP WITH TIME ZONE,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    requires_travel BOOLEAN DEFAULT false,
    technician_id UUID REFERENCES profiles(id),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    telemetry_levels JSONB DEFAULT '[]'::jsonb,
    tower_cells INTEGER DEFAULT 1,
    wifi_ssid TEXT,
    wifi_password TEXT,
    technician_name TEXT,
    cnpj TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar colunas individualmente caso a tabela j exista
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='installations' AND column_name='state') THEN
        ALTER TABLE installations ADD COLUMN state TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='installations' AND column_name='start_date') THEN
        ALTER TABLE installations ADD COLUMN start_date TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='installations' AND column_name='end_date') THEN
        ALTER TABLE installations ADD COLUMN end_date TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='installations' AND column_name='requires_travel') THEN
        ALTER TABLE installations ADD COLUMN requires_travel BOOLEAN DEFAULT false;
    END IF;

    -- Garantir colunas de cliente e detalhes tcnicos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='installations' AND column_name='client_id') THEN
        ALTER TABLE installations ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='installations' AND column_name='telemetry_levels') THEN
        ALTER TABLE installations ADD COLUMN telemetry_levels JSONB DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='installations' AND column_name='tower_cells') THEN
        ALTER TABLE installations ADD COLUMN tower_cells INTEGER DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='installations' AND column_name='wifi_ssid') THEN
        ALTER TABLE installations ADD COLUMN wifi_ssid TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='installations' AND column_name='wifi_password') THEN
        ALTER TABLE installations ADD COLUMN wifi_password TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='installations' AND column_name='technician_name') THEN
        ALTER TABLE installations ADD COLUMN technician_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='installations' AND column_name='cnpj') THEN
        ALTER TABLE installations ADD COLUMN cnpj TEXT;
    END IF;
END $$;

-- 2. Criar tabela de documentos de instalao
CREATE TABLE IF NOT EXISTS installation_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_id UUID NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    uploaded_by UUID REFERENCES profiles(id)
);

-- 3. Habilitar RLS (Row Level Security)
ALTER TABLE installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE installation_documents ENABLE ROW LEVEL SECURITY;

-- 4. Criar Polticas de Segurana para as Tabelas
-- Permitir que todos os usurios autenticados vejam instalaes
DROP POLICY IF EXISTS "Permitir leitura para autenticados" ON installations;
CREATE POLICY "Permitir leitura para autenticados" 
ON installations FOR SELECT USING (auth.role() = 'authenticated');

-- Permitir que admins e tcnicos gerenciem instalaes
DROP POLICY IF EXISTS "Permitir gesto para autenticados" ON installations;
CREATE POLICY "Permitir gesto para autenticados" 
ON installations FOR ALL USING (auth.role() = 'authenticated');

-- Polticas para documentos
DROP POLICY IF EXISTS "Permitir leitura de documentos para autenticados" ON installation_documents;
CREATE POLICY "Permitir leitura de documentos para autenticados" 
ON installation_documents FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir gesto de documentos para autenticados" ON installation_documents;
CREATE POLICY "Permitir gesto de documentos para autenticados" 
ON installation_documents FOR ALL USING (auth.role() = 'authenticated');


-- ==========================================================
-- 5. CONFIGURAO DO BUCKET DE STORAGE (SUPABASE)
-- ==========================================================

-- Criar o bucket 'installation-documents' se ele no existir
INSERT INTO storage.buckets (id, name, public)
SELECT 'installation-documents', 'installation-documents', false
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'installation-documents'
);

-- 6. Polticas de Segurana para o Bucket no Storage
-- Permitir Upload (Insero)
DROP POLICY IF EXISTS "Permitir upload de documentos de instalao" ON storage.objects;
CREATE POLICY "Permitir upload de documentos de instalao"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'installation-documents');

-- Permitir Leitura (Seleo)
DROP POLICY IF EXISTS "Permitir leitura de documentos de instalao" ON storage.objects;
CREATE POLICY "Permitir leitura de documentos de instalao"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'installation-documents');

-- Permitir Deleo
DROP POLICY IF EXISTS "Permitir excluso de documentos de instalao" ON storage.objects;
CREATE POLICY "Permitir excluso de documentos de instalao"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'installation-documents');
