# findings.md
## Descobertas e Estado Atual do HUVI

### 1. Estrutura do Frontend
- O frontend é uma aplicação web puramente estática localizada no diretório `/frontend`.
- Stack: HTML5, CSS customizado (design-system, components, layout, pages), JavaScript vanila para controle do app.
- Configuração do Supabase encontrada em [config.js](file:///c:/PROJETOS_ANTIGRAVITY/huvi_hub-de-vendas-inteligente/frontend/js/config.js) com URL e chave anônima ativas.
- Telas implementadas: Dashboard (com gráficos Chart.js), Oportunidades, Campanhas, Conversões, Ofertas, Fontes e Configurações.
- PWA integrado através de `manifest.json` e `sw.js`.

### 2. Estrutura do Banco de Dados (Supabase)
- Arquivo de migração SQL inicial localizado em [001_initial_schema.sql](file:///c:/PROJETOS_ANTIGRAVITY/huvi_hub-de-vendas-inteligente/supabase/migrations/001_initial_schema.sql).
- O banco possui suporte a multi-tenancy completo com a função helper `get_tenant_id()` e políticas de RLS (Row Level Security) habilitadas em todas as tabelas.
- Suporte a soft delete (`deleted_at`) nas tabelas críticas (`opportunities`, `offers`, `campaigns`, `conversations`, `conversions`).
- Triggers configurados para atualização do `updated_at`, histórico de status (`opportunity_status_history`) e onboarding de novos usuários (`handle_new_user` disparado após inserção no Auth).

### 3. Automação (n8n)
- Três fluxos de trabalho encontrados em `/n8n/workflows`:
  - `huvi_brain_orchestrator.json`
  - `huvi_dispatcher.json`
  - `huvi_opportunity_pipeline.json`
- O pipeline de oportunidades segue as fases oficiais de agentes: Descobrir (Hunter/Manual) -> Enriquecer (Enricher/Mock) -> Diagnosticar (Auditor/IA via Brain) -> Classificar (Scorer/Regras) -> Estratégia (Strategist/IA via Brain) -> Campanha (Campaign/IA via Brain).

### 4. Execução Local
- Iniciado um servidor HTTP local Python no diretório `/frontend` na porta `8080`.
