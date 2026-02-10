-- ATUALIZAR A VIEW PARA INCLUIR A NOVA COLUNA "PLANNED_NEXT_DATE"
-- Views no PostgreSQL não atualizam automaticamente quando colunas são adicionadas à tabela original com "SELECT *".
-- É necessário recriar a View.

DROP VIEW IF EXISTS active_maintenance_contracts;

CREATE OR REPLACE VIEW active_maintenance_contracts AS
SELECT 
    mc.*,
    c.name as client_name,
    c.email as client_email,
    c.phone as client_phone,
    mt.name as maintenance_type_name,
    mt.color as maintenance_color,
    -- Recalcular dias restantes
    (mc.next_maintenance_date::date - CURRENT_DATE) as days_until_maintenance,
    -- Recalcular status de urgência
    CASE 
        WHEN (mc.next_maintenance_date::date - CURRENT_DATE) < 0 THEN 'vencido'
        WHEN (mc.next_maintenance_date::date - CURRENT_DATE) <= 7 THEN 'urgente'
        WHEN (mc.next_maintenance_date::date - CURRENT_DATE) <= 30 THEN 'proximo'
        ELSE 'futuro'
    END as urgency_status
FROM maintenance_contracts mc
LEFT JOIN clients c ON mc.client_id = c.id
LEFT JOIN maintenance_types mt ON mc.maintenance_type_id = mt.id
WHERE mc.status = 'ativo';
