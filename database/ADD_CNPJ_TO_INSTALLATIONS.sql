-- Adicionar coluna cnpj na tabela installations para permitir edição direta no agendamento
ALTER TABLE installations ADD COLUMN IF NOT EXISTS cnpj TEXT;
