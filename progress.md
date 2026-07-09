# progress.md
## Progresso do Projeto HUVI

### Fases do Protocolo VLAEG
- [x] **Protocolo 0: Inicialização** (Arquivos criados, validações iniciais feitas, servidor iniciado).
- [x] **Fase V: Visão** (Alinhamento comercial, multi-tenant e Supabase validados).
- [x] **Fase L: Link** (Conexões ativas no Supabase e workflows carregados e ativos no n8n).
- [x] **Fase A: Arquitetura** (RLS, fluxo de agentes e HUVI Brain verificados no banco e no n8n).
- [x] **Fase E: Estilo** (Interface desktop/mobile testada e PWA ativo).
- [x] **Fase G: Gatilho** (Validação final e testes integrados concluídos).

### Histórico de Atividades
- **12/06/2026**: Inicialização da sessão, varredura do workspace, criação de `findings.md`, `task_plan.md` e `progress.md`, inicialização do servidor local na porta 8080.
- **12/06/2026**: Validação da conexão com o Supabase e checagem de workflows ativos no n8n-mcp. Transição para a fase de testes práticos.
- **12/06/2026**: Correções aplicadas no frontend (filtro por Estado em Oportunidades, placeholders e ajudas dinâmicas em Fontes). Diagnóstico do erro de cadastro de ofertas (falta de trigger de onboarding no banco) e roteiro de correção SQL preparado.
- **12/06/2026**: Correção do erro de execução no workflow "HUVI_Opportunity_Pipeline" no n8n. Foi resolvido o erro "Invalid or unexpected token" nos nós ParseAudit, ParseStrategy e ParseCampaign, substituindo a codificação incorreta de quebras de linha (`\\n`) para a forma correta do JSON (`\n`) tanto localmente quanto na API do n8n.
- **12/06/2026**: Tratamento do erro no nó "SupabaseInsertStrategy" devido à violação de check constraint no campo `destination_type`. O prompt de IA em "StrategistHuviBrain" foi refinado para especificar apenas os valores aceitos pelo banco de dados, e o nó "ParseStrategy" foi adaptado com mapeamento defensivo inteligente para garantir conformidade com os constraints do banco.
- **12/06/2026**: Refinamento do nó "CampaignHuviBrain" no n8n. Corrigimos a lógica de geração de copy das campanhas comerciais. O prompt foi ajustado para estruturar mensagens no modelo de prospecção B2B ativa (outbound) endereçadas à empresa lead, contendo cumprimentos naturais e focando em como a "Consultoria de Vendas Inteligente" ajuda o negócio deles, além de integrar o diagnóstico da auditoria.
- **12/06/2026**: Adicionado recurso de Ativar/Desativar Ofertas no frontend com controle de priorização exclusiva (apenas uma oferta ativa por vez). A ativação de uma oferta desativa automaticamente as demais ofertas do tenant, com indicação visual por meio de status badges.
- **26/06/2026**: Implementação do Firecrawl Web Intelligence Engine (gemini3.md v2.0):
  - Migration 009: `analysis_limit`/`analysis_used`/`firecrawl_min_score` em `tenant_credits`, tabelas `web_search_log` e `web_search_queue`, keywords em `sources`, `firecrawl_data`/`description` em `opportunities`.
  - Edge Function `huvi-web-discovery`: proxy Firecrawl Search API com autenticação, créditos, dedup, scoring e log.
  - Fonte `web_search` adicionada ao frontend (config.js, sources.js, index.html) com campo de keywords.
  - Módulo `web-discovery.js`: UI completa com créditos, busca por keywords, filtros de domínio, KPIs, histórico.
  - n8n workflow `huvi_web_discovery`: webhook → créditos → Firecrawl Search → dedup → scoring → insert → log.
  - Settings: `firecrawl_min_score` configurável na aba Descoberta.
- **01/07/2026**: Migrations 010 (`credit_weights`, `soft_delete_search_logs`) e 011 (`fix_onboarding_trigger`) aplicadas no Supabase remoto via `supabase db query --linked`.
- **02/07/2026**: **Fase G validada com sucesso!** Pipeline completo testado de ponta a ponta:
  - Autenticação com conta existente (Gabriel dos Anjos, tenant `b62fced9-8549-4dbf-9f82-b14f9835cf4a`).
  - Criação de oferta, fonte e oportunidade com status `discovered`.
  - Disparo do webhook n8n `HUVI_Opportunity_Pipeline` → pipeline executou todos os agentes.
  - Oportunidade evoluiu: `discovered` → `enriched` → `audited` → `scored` → `strategy_defined` → `campaign_created` → **`contacted`**.
  - Audit, Score, Strategy e Campaign (com messages_matrix de 3 etapas) criados.
  - Disparo de mensagem validado via webhook `HUVI_Dispatcher` → dispatch log criado com status `sent`.
  - Fase G completa e VLAEG Protocol finalizado.
- **03/07/2026**: Sprints 1-4 concluídas (~72% → 100%): SDR Agent, Asaas (assinatura + webhook), AI Usage tracking, Google Calendar, Onboarding visual, Dashboard financeiro, Canal de email, Guardian Agent.
- **06/07/2026**: 
  - Refatoração do `HUVI_Followup_Scheduler`: removida redundância (6 nós duplicados do Dispatcher). Novo scheduler com apenas 5 nós — só checa timing (delay_days da messages_matrix) e delega envio ao `HUVI_Dispatcher` via webhook.
  - `HUVI_SDR_Agent`: adicionado fluxo que ao detectar resposta do lead, atualiza `campaigns.status = 'replied'`, impedindo que o scheduler dispare follow-ups para leads que já engajaram.
  - **Pipeline e Dispatcher inalterados** — validação de 06/07 preservada.
