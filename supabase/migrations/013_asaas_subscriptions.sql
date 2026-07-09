-- ============================================================
-- HUVI — Migration 013: Asaas Subscription Integration
-- Gerencia assinatura dos tenants via Asaas
-- ============================================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS asaas_customer_id text,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS subscription_updated_at timestamptz;

COMMENT ON COLUMN public.tenants.asaas_customer_id IS 'ID do cliente no Asaas';
COMMENT ON COLUMN public.tenants.asaas_subscription_id IS 'ID da assinatura no Asaas';
COMMENT ON COLUMN public.tenants.subscription_status IS 'Status: none | active | overdue | canceled | trial';
COMMENT ON COLUMN public.tenants.subscription_updated_at IS 'Última atualização do status de assinatura';

CREATE TABLE IF NOT EXISTS public.asaas_webhook_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  event text NOT NULL,
  asaas_id text,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.asaas_webhook_log IS 'Log de eventos recebidos do webhook Asaas';
