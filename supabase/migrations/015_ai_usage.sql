-- Migration: 015_ai_usage.sql
-- Criar a tabela para auditoria e controle de custos de Inteligência Artificial

CREATE TABLE IF NOT EXISTS public.ai_usage (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  model               text NOT NULL,
  prompt_tokens       integer NOT NULL DEFAULT 0,
  completion_tokens   integer NOT NULL DEFAULT 0,
  total_tokens        integer NOT NULL DEFAULT 0,
  cost                numeric(12,6) NOT NULL DEFAULT 0.000000,
  agent_name          text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Criar Políticas de Segurança RLS
CREATE POLICY ai_usage_tenant_select ON public.ai_usage
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_tenant_id());

CREATE POLICY ai_usage_service_all ON public.ai_usage
  FOR ALL
  TO service_role
  USING (true);

-- Comentários de documentação da tabela
COMMENT ON TABLE public.ai_usage IS 'Registra o consumo de tokens e custos estimados das chamadas de IA por inquilino.';
COMMENT ON COLUMN public.ai_usage.cost IS 'Custo em dólares ou reais estimado com base no consumo de tokens e modelo da OpenAI.';
