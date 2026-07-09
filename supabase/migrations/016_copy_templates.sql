-- ============================================================
-- HUVI — Migration 016: Copy Templates Engine
-- Integra o Template-Copy-Followup.md no banco de dados
-- Permite personalização por tenant no futuro
-- ============================================================

-- ============================================================
-- 1. TABELA: copy_templates
-- Armazena os modelos de copy por etapa do follow-up
-- tenant_id NULL = template global (disponível para todos)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.copy_templates (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  step          integer NOT NULL CHECK (step BETWEEN 1 AND 3),
  model_number  integer NOT NULL CHECK (model_number BETWEEN 1 AND 10),
  template_text text NOT NULL,
  tone          text NOT NULL DEFAULT 'consultivo'
                  CHECK (tone IN ('consultivo', 'curioso', 'respeitoso')),
  conditions    jsonb DEFAULT NULL,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_copy_templates_tenant ON public.copy_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_copy_templates_step ON public.copy_templates(step, active);

COMMENT ON TABLE public.copy_templates IS 'Modelos de copy para follow-up — 5 modelos por etapa (Template-Copy-Followup.md v1.1)';
COMMENT ON COLUMN public.copy_templates.step IS '1=Primeiro Contato, 2=Segundo Contato (sem resposta), 3=Terceiro Contato (sem resposta)';
COMMENT ON COLUMN public.copy_templates.model_number IS 'Número do modelo dentro do step (1 a 5)';
COMMENT ON COLUMN public.copy_templates.template_text IS 'Texto do template com placeholders: {Nome}, {segmento}, {empresa}, {cidade}, {estado}, {oferta}, {descricao}, {rating_count}';
COMMENT ON COLUMN public.copy_templates.tone IS 'Tom da mensagem: consultivo (step 1), curioso (step 2), respeitoso (step 3)';
COMMENT ON COLUMN public.copy_templates.conditions IS 'Condições JSON para seleção baseada em dados. Ex: {"has_reviews": true, "min_rating": 4.0}';

-- Trigger updated_at
CREATE TRIGGER set_updated_at_copy_templates
  BEFORE UPDATE ON public.copy_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 2. TABELA: copy_personalization_rules
-- Regras de personalização dinâmica (snippets condicionais)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.copy_personalization_rules (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  condition_key   text NOT NULL,
  condition_check jsonb NOT NULL,
  snippet_text    text NOT NULL,
  priority        integer NOT NULL DEFAULT 0,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_copy_pers_rules_tenant ON public.copy_personalization_rules(tenant_id);

COMMENT ON TABLE public.copy_personalization_rules IS 'Regras de personalização dinâmica para copies — snippets condicionais (Template-Copy-Followup.md v1.1)';
COMMENT ON COLUMN public.copy_personalization_rules.condition_key IS 'Identificador da condição: has_many_reviews, few_reviews, has_whatsapp, no_website, has_schedule, has_team';
COMMENT ON COLUMN public.copy_personalization_rules.condition_check IS 'JSON com regra de avaliação. Ex: {"field": "rating_count", "operator": ">=", "value": 20}';
COMMENT ON COLUMN public.copy_personalization_rules.snippet_text IS 'Texto a ser inserido na copy. Pode conter placeholders.';
COMMENT ON COLUMN public.copy_personalization_rules.priority IS 'Prioridade de seleção (maior = preferência). Usado para ordenar snippets quando múltiplos match.';

-- ============================================================
-- 3. TABELA: copy_vocabulary
-- Palavras recomendadas e proibidas para copies
-- ============================================================
CREATE TABLE IF NOT EXISTS public.copy_vocabulary (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  word          text NOT NULL,
  category      text NOT NULL CHECK (category IN ('recommended', 'forbidden')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_copy_vocabulary_tenant ON public.copy_vocabulary(tenant_id);
CREATE INDEX IF NOT EXISTS idx_copy_vocabulary_category ON public.copy_vocabulary(category);

COMMENT ON TABLE public.copy_vocabulary IS 'Vocabulário controlado para copies — palavras recomendadas e proibidas';

-- ============================================================
-- 4. RLS: Habilitar em novas tabelas
-- ============================================================
ALTER TABLE public.copy_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copy_personalization_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copy_vocabulary ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. POLÍTICAS RLS: copy_templates
-- Templates globais (tenant_id IS NULL) são visíveis por todos
-- Templates de tenant são visíveis apenas pelo próprio tenant
-- ============================================================
CREATE POLICY "copy_templates_select" ON public.copy_templates
  FOR SELECT USING (
    tenant_id IS NULL
    OR tenant_id = public.get_tenant_id()
  );

CREATE POLICY "copy_templates_insert" ON public.copy_templates
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "copy_templates_update" ON public.copy_templates
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- 6. POLÍTICAS RLS: copy_personalization_rules
-- ============================================================
CREATE POLICY "copy_pers_rules_select" ON public.copy_personalization_rules
  FOR SELECT USING (
    tenant_id IS NULL
    OR tenant_id = public.get_tenant_id()
  );

CREATE POLICY "copy_pers_rules_insert" ON public.copy_personalization_rules
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "copy_pers_rules_update" ON public.copy_personalization_rules
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- 7. POLÍTICAS RLS: copy_vocabulary
-- ============================================================
CREATE POLICY "copy_vocabulary_select" ON public.copy_vocabulary
  FOR SELECT USING (
    tenant_id IS NULL
    OR tenant_id = public.get_tenant_id()
  );

CREATE POLICY "copy_vocabulary_insert" ON public.copy_vocabulary
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ============================================================
-- 8. SEED: Templates Globais (15 modelos — 5 por step)
-- Origem: Template-Copy-Followup.md v1.0
-- ============================================================

-- === STEP 1: PRIMEIRO CONTATO ===
-- Tom: Consultivo, Educado, Curioso
-- Objetivo: Iniciar conversa. Nunca vender. Nunca enviar apresentação longa.

INSERT INTO public.copy_templates (tenant_id, step, model_number, template_text, tone, conditions) VALUES

-- Modelo 1 — Para segmentos com agenda/agendamentos
(NULL, 1, 1,
E'Olá, {Nome}.\n\nVi que vocês trabalham com {segmento}.\n\nFiquei curioso sobre como vocês organizam hoje os agendamentos dos clientes.\n\nTenho acompanhado empresas parecidas que conseguiram reduzir bastante o tempo gasto com atendimento depois de organizarem esse processo.\n\nHoje vocês fazem esse controle manualmente?',
'consultivo',
'{"preferred_segments": ["saude", "fitness", "clinica", "dentista", "barbearia", "salao", "estetica", "veterinario"]}'),

-- Modelo 2 — Para oportunidades sem website (presença digital limitada)
(NULL, 1, 2,
E'Olá.\n\nEnquanto pesquisava empresas da região encontrei o perfil de vocês.\n\nPercebi que atendem um bom volume de clientes.\n\nPosso fazer uma pergunta?\n\nComo vocês controlam os horários e confirmações dos atendimentos?',
'consultivo',
'{"preferred_when": "no_website"}'),

-- Modelo 3 — Para oportunidades com muitas avaliações positivas
(NULL, 1, 3,
E'Olá, {Nome}.\n\nVi que a empresa de vocês possui excelentes avaliações.\n\nNormalmente empresas que crescem começam a enfrentar um desafio comum:\n\norganizar a agenda sem perder clientes.\n\nIsso acontece por aí também?',
'consultivo',
'{"min_rating": 4.0, "min_reviews": 20}'),

-- Modelo 4 — Para empresas com alto volume (WhatsApp ou vários funcionários)
(NULL, 1, 4,
E'Olá.\n\nUma curiosidade...\n\nComo vocês fazem quando vários clientes entram em contato ao mesmo tempo querendo agendar?\n\nPergunto porque tenho visto muitos negócios perdendo tempo justamente nessa etapa.',
'consultivo',
'{"preferred_when": "has_whatsapp_or_team"}'),

-- Modelo 5 — Genérico / fallback
(NULL, 1, 5,
E'Olá.\n\nVi o perfil da empresa de vocês e uma dúvida me chamou atenção.\n\nComo vocês evitam esquecimentos, cancelamentos e horários vagos na agenda?',
'consultivo',
'{"is_fallback": true}'),

-- === STEP 2: SEGUNDO CONTATO (sem resposta) ===
-- Tom: Curioso. Gerar curiosidade. Mostrar benefício. Sem pressão.

-- Modelo 1
(NULL, 2, 1,
E'Oi.\n\nPassei novamente porque essa situação é mais comum do que parece.\n\nMuitas empresas só descobrem quanto tempo perdem com organização da agenda quando começam a medir esse processo.\n\nVocês já chegaram a analisar isso?',
'curioso',
'{"preferred_segments": ["saude", "fitness", "clinica", "dentista", "barbearia", "salao", "estetica"]}'),

-- Modelo 2
(NULL, 2, 2,
E'Olá.\n\nTalvez minha mensagem anterior tenha passado despercebida.\n\nTenho visto empresas conseguindo reduzir bastante o trabalho operacional apenas organizando melhor os agendamentos.\n\nFiquei curioso para saber como vocês fazem hoje.',
'curioso',
'{"preferred_when": "no_website"}'),

-- Modelo 3
(NULL, 2, 3,
E'Uma pergunta rápida.\n\nQuando alguém cancela um horário de última hora, vocês conseguem preencher essa vaga rapidamente?',
'curioso',
'{"min_rating": 4.0, "min_reviews": 20}'),

-- Modelo 4
(NULL, 2, 4,
E'Oi.\n\nVi novamente o perfil de vocês.\n\nAcredito que exista uma boa oportunidade para deixar o atendimento ainda mais organizado.\n\nVale a pena conversarmos alguns minutos?',
'curioso',
'{"preferred_when": "has_whatsapp_or_team"}'),

-- Modelo 5
(NULL, 2, 5,
E'Olá.\n\nNem sempre percebemos quanto tempo a equipe dedica somente para responder mensagens e organizar horários.\n\nComo isso funciona atualmente na empresa?',
'curioso',
'{"is_fallback": true}'),

-- === STEP 3: TERCEIRO CONTATO (sem resposta) ===
-- Tom: Respeitoso. Última tentativa. Sem insistência. Porta aberta.

-- Modelo 1
(NULL, 3, 1,
E'Olá.\n\nEssa será minha última mensagem.\n\nCaso organizar os agendamentos ou reduzir o tempo gasto com atendimento faça sentido para vocês em algum momento, fico à disposição.\n\nDesejo muito sucesso.',
'respeitoso',
'{"preferred_segments": ["saude", "fitness", "clinica", "dentista", "barbearia", "salao", "estetica"]}'),

-- Modelo 2
(NULL, 3, 2,
E'Oi.\n\nImagino que este não seja o melhor momento.\n\nSem problema.\n\nSe no futuro fizer sentido conversar sobre formas de ganhar mais previsibilidade na agenda, será um prazer ajudar.',
'respeitoso',
'{"preferred_when": "no_website"}'),

-- Modelo 3
(NULL, 3, 3,
E'Olá.\n\nVou encerrar meu contato para não ser inconveniente.\n\nSe algum dia quiser trocar ideias sobre como empresas do seu segmento estão organizando melhor seus atendimentos, basta responder esta mensagem.',
'respeitoso',
'{"min_rating": 4.0, "min_reviews": 20}'),

-- Modelo 4
(NULL, 3, 4,
E'Passando apenas para finalizar nossa conversa.\n\nSe este assunto não faz sentido agora, tudo bem.\n\nMas, caso em algum momento queira reduzir o trabalho operacional da equipe, estarei por aqui.',
'respeitoso',
'{"preferred_when": "has_whatsapp_or_team"}'),

-- Modelo 5
(NULL, 3, 5,
E'Obrigado pelo seu tempo.\n\nMesmo sem retorno, espero que a empresa continue crescendo.\n\nSe futuramente fizer sentido conversar sobre organização dos atendimentos, pode contar comigo.',
'respeitoso',
'{"is_fallback": true}');

-- ============================================================
-- 9. SEED: Regras de Personalização Dinâmica
-- Snippets condicionais inseridos na copy
-- ============================================================

INSERT INTO public.copy_personalization_rules (tenant_id, condition_key, condition_check, snippet_text, priority) VALUES

(NULL, 'has_many_reviews',
'{"field": "rating_count", "operator": ">=", "value": 20, "field2": "rating_value", "operator2": ">=", "value2": 4.0}',
'Vi que vocês possuem mais de {rating_count} avaliações positivas.',
10),

(NULL, 'few_reviews',
'{"field": "rating_count", "operator": "<", "value": 5}',
'Vi que ainda existe espaço para fortalecer a presença digital da empresa.',
5),

(NULL, 'has_whatsapp',
'{"field": "phone", "operator": "exists", "contains_channel": "whatsapp"}',
'Vi que vocês recebem contatos pelo WhatsApp.',
7),

(NULL, 'no_website',
'{"field": "website", "operator": "is_null"}',
'Percebi que a maior parte do atendimento parece acontecer pelos canais diretos.',
6),

(NULL, 'has_schedule_segment',
'{"field": "category", "operator": "contains_any", "value": ["clinica", "dentista", "saude", "barbearia", "salao", "estetica", "academia", "fitness", "veterinario"]}',
'Imagino que manter a agenda organizada seja essencial para evitar horários ociosos.',
8),

(NULL, 'has_team',
'{"field": "firecrawl_data", "operator": "has_key", "value": "team_size", "min_value": 3}',
'Com uma equipe maior, normalmente organizar os atendimentos se torna ainda mais importante.',
4);

-- ============================================================
-- 10. SEED: Vocabulário Controlado
-- ============================================================

-- Palavras RECOMENDADAS (aumentam resposta)
INSERT INTO public.copy_vocabulary (tenant_id, word, category) VALUES
(NULL, 'organizar', 'recommended'),
(NULL, 'facilitar', 'recommended'),
(NULL, 'reduzir', 'recommended'),
(NULL, 'ganhar tempo', 'recommended'),
(NULL, 'previsibilidade', 'recommended'),
(NULL, 'crescimento', 'recommended'),
(NULL, 'atendimento', 'recommended'),
(NULL, 'agenda', 'recommended'),
(NULL, 'clientes', 'recommended'),
(NULL, 'confirmação', 'recommended'),
(NULL, 'pontualidade', 'recommended'),
(NULL, 'experiência', 'recommended'),
(NULL, 'resultado', 'recommended');

-- Palavras PROIBIDAS (nunca usar em copies)
INSERT INTO public.copy_vocabulary (tenant_id, word, category) VALUES
(NULL, 'robô', 'forbidden'),
(NULL, 'automação', 'forbidden'),
(NULL, 'IA', 'forbidden'),
(NULL, 'fluxo', 'forbidden'),
(NULL, 'integração', 'forbidden'),
(NULL, 'API', 'forbidden'),
(NULL, 'CRM', 'forbidden'),
(NULL, 'chatbot', 'forbidden'),
(NULL, 'sistema', 'forbidden'),
(NULL, 'software', 'forbidden'),
(NULL, 'funil', 'forbidden');

-- ============================================================
-- FIM DA MIGRATION 016
-- ============================================================
