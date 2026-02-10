-- SCRIPT DE CORREÇÃO: ADICIONAR COLUNAS DE ASSINATURA E ENDEREÇO
-- Execute este script no SQL Editor do Supabase (app.supabase.com)

DO $$ 
BEGIN 
    -- 1. Campos de Assinatura (Base64)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='installations' AND column_name='customer_signature') THEN
        ALTER TABLE installations ADD COLUMN customer_signature TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='installations' AND column_name='technician_signature') THEN
        ALTER TABLE installations ADD COLUMN technician_signature TEXT;
    END IF;

    -- 2. Campos de Endereço Detalhado
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='installations' AND column_name='city') THEN
        ALTER TABLE installations ADD COLUMN city TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='installations' AND column_name='neighborhood') THEN
        ALTER TABLE installations ADD COLUMN neighborhood TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='installations' AND column_name='cep') THEN
        ALTER TABLE installations ADD COLUMN cep TEXT;
    END IF;

    -- 3. Adicionar campo 'notes' caso queira separar da 'description' (Opcional, mas recomendado)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='installations' AND column_name='notes') THEN
        ALTER TABLE installations ADD COLUMN notes TEXT;
    END IF;

END $$;
