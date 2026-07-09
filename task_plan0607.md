# task_plan.md
## Plano de Trabalho - HUVI

### 1. Inicialização do Projeto
- [x] Validar a existência dos documentos constitucionais e arquiteturais do HUVI (`gemini.md`, `supabase_architecture.md`, `agents_specification.md`, `prd_huvi.md`).
- [x] Criar arquivos obrigatórios do protocolo VLAEG (`findings.md`, `task_plan.md`, `progress.md`).
- [x] Inicializar servidor web local para visualização do frontend.

### 2. Fase de Testes e Validação (Fase G - Gatilho) ✅ CONCLUÍDA
- [x] Criar uma conta (onboarding) no frontend para gerar o `tenant_id` e o `profile` no Supabase real.
- [x] Adicionar uma Oferta e uma Fonte na interface.
- [x] Cadastrar uma Oportunidade com status inicial "discovered".
- [x] Acionar o workflow do n8n `HUVI_Opportunity_Pipeline` para rodar o pipeline completo de agentes.
- [x] Verificar a criação das tabelas vinculadas (`audits`, `scores`, `strategies`, `campaigns`) no Supabase.
- [x] Validar a mudança de status da oportunidade até "campaign_created".
- [x] Validar o envio de mensagens simuladas/reais no Dispatcher.

### 3. Pós-Fase G — Sprints 1-4 (03/07/2026) ✅ CONCLUÍDO
- [x] SDR Agent para conversação inteligente (detecção de resposta do lead no WhatsApp)
- [x] Asaas Subscription (assinatura + webhook de pagamento)
- [x] AI Usage tracking (tabela `ai_usage` para auditoria de tokens/custos)
- [x] Google Calendar Trigger (conversão Tipo 2)
- [x] Onboarding visual completo (cadastro → pagamento)
- [x] Dashboard financeiro com receita/ROI
- [x] Canal de email no Dispatcher + templates
- [x] Guardian Agent (segurança e controle de custos de IA)

### 4. Refatoração Follow-up (06/07/2026) ✅ CONCLUÍDO
- [x] HUVI_SDR_Agent: ao detectar resposta do lead → `campaigns.status = 'replied'` (impede follow-up automático em leads que já engajaram)
- [x] HUVI_Followup_Scheduler: removida redundância de 6 nós duplicados do Dispatcher. Novo scheduler enxuto (5 nós) — só checa timing (`delay_days` da `messages_matrix`) e delega envio ao Dispatcher via webhook
- [x] Pipeline e Dispatcher inalterados — validação de 06/07 preservada
- [x] Importar workflows no n8n (`huvi_sdr_agent.json` e `huvi_followup_scheduler.json`)
- [x] Patch no Check Conversation Exists (`huvi_sdr_agent.json`) corrigido para `length == 0` com syntax `typeVersion: 1`
- [x] Correção de `messages_matrix` gerado pelo pipeline fallback no frontend (`opportunities.js`)
- [x] UI do modal de campanhas auto-gerando tabs de cadência se ausentes
- [x] Exibição correta do status da campanha na listagem (`Em Cadência (Aguardando Follow-up)`) e correção do delay do Webhook

### 5. Blindagem e Prevenção de Leads Inúteis (06/07/2026) ✅ CONCLUÍDO
- [x] Blindagem da fonte Google Maps (Descoberta): Bloqueado a criação de leads que não possuem nenhuma forma de contato (telefone, e-mail ou website) na Edge Function `huvi-discovery/index.ts`
- [x] Otimização replicada para o modo teste e mock frontend (`discovery.js`)
- [x] Blindagem replicada também no workflow legado do n8n (`huvi_outscraper_discovery.json`)

### 6. Pendências
- [ ] Configurar credit_weights para os tenants
- [ ] Ajustar rate limit para discovery em cidades grandes (São Paulo)
- [ ] Estratégia de cache e versionamento do service worker
