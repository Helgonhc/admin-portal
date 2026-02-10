-- ADICIONA NOVOS CAMPOS DE ENDEREÇO PARA TELEMETRIA
-- Execute este script no SQL Editor do Supabase

ALTER TABLE installations 
ADD COLUMN IF NOT EXISTS neighborhood TEXT,
ADD COLUMN IF NOT EXISTS city TEXT, -- Garantir que existe
ADD COLUMN IF NOT EXISTS cep TEXT;

-- Comentários para documentação
COMMENT ON COLUMN installations.neighborhood IS 'Bairro do local de instalação';
COMMENT ON COLUMN installations.city IS 'Cidade do local de instalação';
COMMENT ON COLUMN installations.cep IS 'CEP do local de instalação';
