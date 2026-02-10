-- 1. Adicionar coluna signature_url na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signature_url TEXT;

-- 2. Garantir que o bucket 'os-photos' existe (normalmente já existe)
-- Se quiser criar um separado, use este comando:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('technician-signatures', 'technician-signatures', true) ON CONFLICT (id) DO NOTHING;

-- 3. Permitir que usuários façam upload de suas próprias assinaturas
-- (Ajuste se estiver usando um bucket diferente)
CREATE POLICY "Users can update their own signature" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'os-photos' 
  AND (storage.foldername(name))[1] = 'technician-signatures'
  AND (select auth.uid()) = (select id from public.profiles where id = auth.uid())
);
