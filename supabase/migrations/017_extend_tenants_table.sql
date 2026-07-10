-- ============================================================
-- HUVI — Hub de Vendas Inteligente
-- Migration 017: Estender tabela tenants com campos do admin
-- Versão: 1.0
-- Motivo: A tabela tenants original não possuía os campos
--         necessários para o formulário do console superadmin.
--         Esta migration os adiciona de forma segura (IF NOT EXISTS).
-- ============================================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS slug             text UNIQUE,
  ADD COLUMN IF NOT EXISTS niche            text,
  ADD COLUMN IF NOT EXISTS owner_name       text,
  ADD COLUMN IF NOT EXISTS phone            text,
  ADD COLUMN IF NOT EXISTS monthly_value    numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_date         text,
  ADD COLUMN IF NOT EXISTS financial_status text NOT NULL DEFAULT 'em_dia'
    CHECK (financial_status IN ('em_dia', 'em_atraso')),
  ADD COLUMN IF NOT EXISTS terms_accepted   boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tenants.slug IS 'Slug único para rota de URL do tenant';
COMMENT ON COLUMN public.tenants.niche IS 'Nicho de atuação do tenant (ex: Barbearia, Clínica)';
COMMENT ON COLUMN public.tenants.owner_name IS 'Nome do responsável / dono do negócio';
COMMENT ON COLUMN public.tenants.phone IS 'Telefone WhatsApp do responsável';
COMMENT ON COLUMN public.tenants.monthly_value IS 'Valor mensal do plano contratado em R$';
COMMENT ON COLUMN public.tenants.due_date IS 'Data de vencimento da mensalidade (dd/mm/aaaa)';
COMMENT ON COLUMN public.tenants.financial_status IS 'Situação financeira: em_dia ou em_atraso';
COMMENT ON COLUMN public.tenants.terms_accepted IS 'Indica se o tenant aceitou os termos de uso';
