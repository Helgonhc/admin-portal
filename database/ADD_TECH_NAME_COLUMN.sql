-- Adicionar coluna technician_name na tabela installations para evitar erro de schema cache
ALTER TABLE installations ADD COLUMN IF NOT EXISTS technician_name TEXT;
