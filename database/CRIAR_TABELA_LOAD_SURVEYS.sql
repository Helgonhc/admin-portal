-- Tabela para armazenar os levantamentos de carga
CREATE TABLE IF NOT EXISTS public.load_surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_watts NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger para atualizar o updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_load_surveys_updated_at
    BEFORE UPDATE ON public.load_surveys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.load_surveys ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso
CREATE POLICY "Enable all for authenticated users" ON public.load_surveys
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
