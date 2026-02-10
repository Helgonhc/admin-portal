-- Adicionar coluna para armazenar a data planejada do PRÓXIMO ciclo
-- Isso permite que o usuário defina uma data personalizada para a manutenção subsequente
-- diferente do cálculo automático da frequência.

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance_contracts' AND column_name='planned_next_date') THEN
        ALTER TABLE maintenance_contracts ADD COLUMN planned_next_date TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;
