-- =========================================================
-- Migration 005: Matriz de Comunicação e Follow-ups
-- Adiciona suporte a múltiplos passos de prospecção (cadência)
-- Retrocompatível: colunas opcionais, não quebra campanhas existentes
-- =========================================================

-- 1. Coluna messages_matrix (JSONB) — Armazena os 3 passos da prospecção
-- Formato esperado:
-- [
--   { "step": 1, "delay_days": 0, "subject": "...", "message": "..." },
--   { "step": 2, "delay_days": 3, "subject": "...", "message": "..." },
--   { "step": 3, "delay_days": 7, "subject": "...", "message": "..." }
-- ]
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS messages_matrix jsonb DEFAULT NULL;

-- 2. Coluna current_step — Indica o passo ativo/pendente
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS current_step integer DEFAULT 1;

-- 3. Coluna last_sent_at — Data/hora do último envio (base de cadência)
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz DEFAULT NULL;

-- 4. Comentários descritivos para documentação
COMMENT ON COLUMN campaigns.messages_matrix IS 'Matriz JSONB com os passos de prospecção (abordagem + follow-ups). Null para campanhas legadas.';
COMMENT ON COLUMN campaigns.current_step IS 'Passo atual da cadência (1-indexed). Default 1.';
COMMENT ON COLUMN campaigns.last_sent_at IS 'Timestamp do último disparo realizado. Usado para calcular cadência dos follow-ups.';
