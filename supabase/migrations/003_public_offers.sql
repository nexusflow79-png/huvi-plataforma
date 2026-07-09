-- ============================================================
-- HUVI — Hub de Vendas Inteligente
-- Migration 003: Public Offers Policy (Landing Page)
-- ============================================================

-- Permite leitura anônima/pública (para o frontend público) de ofertas desde que estejam ativas
CREATE POLICY "offers_public_select" ON public.offers
  FOR SELECT USING (active = true);
