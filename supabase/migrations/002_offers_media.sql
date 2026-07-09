-- ============================================================
-- HUVI — Hub de Vendas Inteligente
-- Migration 002: Mídia de Ofertas (image_url, video_url)
-- ============================================================

-- Adicionar coluna de URL da imagem (Supabase Storage)
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS image_url text;

-- Adicionar coluna de URL do vídeo (YouTube / Instagram)
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS video_url text;

COMMENT ON COLUMN public.offers.image_url IS 'URL pública da imagem da oferta armazenada no Supabase Storage';
COMMENT ON COLUMN public.offers.video_url IS 'URL de vídeo externo (YouTube, Instagram) da oferta';

-- ============================================================
-- NOTA: O bucket 'offer-images' deve ser criado via
-- Dashboard do Supabase (Storage > New Bucket):
--   Nome: offer-images
--   Public: true (leitura pública para envio via WhatsApp)
--
-- Políticas RLS do bucket (criar via Dashboard):
--
-- SELECT (leitura pública):
--   allow all
--
-- INSERT (somente tenant dono):
--   (bucket_id = 'offer-images') AND
--   (auth.role() = 'authenticated') AND
--   ((storage.foldername(name))[1] = (
--     SELECT get_tenant_id()::text
--   ))
--
-- UPDATE (somente tenant dono):
--   mesma lógica do INSERT
--
-- DELETE (somente tenant dono):
--   mesma lógica do INSERT
-- ============================================================
