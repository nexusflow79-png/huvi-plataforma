-- ============================================================
-- HUVI — Migration 006: Adição de Campos de Localização para Fontes
-- Conforme: gemini.md, supabase_architecture.md
-- ============================================================

ALTER TABLE public.sources ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.sources ADD COLUMN IF NOT EXISTS city text;

COMMENT ON COLUMN public.sources.state IS 'Estado da busca da fonte (apenas para Google Maps)';
COMMENT ON COLUMN public.sources.city IS 'Cidade da busca da fonte (apenas para Google Maps)';
