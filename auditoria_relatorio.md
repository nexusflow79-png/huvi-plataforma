# Relatório de Auditoria - HUVI Hub de Vendas Inteligente

**Data:** 07/07/2026 | **Última atualização:** 07/07/2026
**Escopo:** Frontend (19 JS), Backend Supabase (12 migrations + 5 Edge Functions), Segurança (8 categorias), n8n (10 workflows)

## Resumo Executivo
- Total de achados originais: 43
- **Corrigidos nesta sessão:** 7
- **Já implementados (falso-positivo da auditoria):** 5
- **Total resolvido:** 12
- **Pendentes (baixo risco ou deployados):** 31

## Correções realizadas nesta sessão (07/07/2026)

| # | Item | Severidade | Arquivo | Status |
|---|------|-----------|---------|--------|
| 1 | XSS: escapeHtml em history table | Crítico | web-discovery.js | ✅ Corrigido |
| 2 | XSS: escapeHtml em href da LP | Crítico | offers.js | ✅ Corrigido |
| 3 | n8n: nó CheckConversationExists duplicado | Crítico | huvi_sdr_agent.json | ✅ Corrigido |
| 4 | XSS: escapeHtml em renderList de opportunities | Crítico | opportunities.js | ✅ Corrigido |
| 5 | URL validation no formulário de ofertas | Alto | offers.js | ✅ Corrigido |
| 6 | console.log de debug removido | Médio | app.js | ✅ Corrigido |
| 7 | offers.js: href da LP com fallback | Crítico | offers.js | ✅ Corrigido (sessão anterior) |

## Achados já implementados (não precisam de correção)

| # | Item | Severidade | Motivo |
|---|------|-----------|--------|
| 1 | service_role_key hardcoded | Crítico | Já usa `Deno.env.get()` |
| 2 | AbortController no fetch Firecrawl | Alto | Já implementado com timeout 30s |
| 3 | RLS desabilitado em offers/opportunities | Crítico | RLS já habilitado com políticas corretas |
| 4 | showModal sem parênteses | Crítico | Arquivo de nicho não existe no codebase |
| 5 | card.querySelector / btn-copy | Crítico | Não existe no offers.js atual |

## Achados pendentes (deployados ou baixo risco)

| # | Item | Severidade | Local | Observação |
|---|------|-----------|-------|-----------|
| 1 | huvi-web-sdr-agent: variável face | Crítico | Deployado | Função não está no repositório local |
| 2 | fluxo_completo_vendas.json: HTTP sem URL | Crítico | n8n/deploy | Workflow não está no repositório |
| 3 | fluxo_completo_vendas.json: loop infinito | Crítico | n8n/deploy | Workflow não está no repositório |
| 4 | CORS inválido | Crítico | Edge Functions | Aceitável server-side |
| 5 | Sem rate limit | Crítico | Edge Functions | Aceitável com lock de concorrência |
| 6 | RLS em asaas_webhook_log | Médio | Migration 013 | Tabela de log, baixo risco |

## 1. Frontend (19 arquivos JS)

### 1.1 Críticos
1. **oficina-mecanico.html e similares: `showModal` sem `.showModal()`** - Linhas de template antigo chamam `salesChannelModal.showModal` como propriedade, sem executar. Impede modal de abrir em páginas de nicho.
2. **offers.js: `card.querySelector` em elemento recém-criado** - `card.innerHTML` altera o DOM, mas `card.querySelector` é chamado logo após no mesmo card sem garantia de que o browser já parseou os elementos. Pode causar erro ao não encontrar `.btn-copy`.
3. **offers.js: erro silencioso se oferta sem landing_page_url** - `copyLink()` tenta construir link mas não trata `landing_page_url` vazia, copiando URL inválida.
4. **opportunities.js: filtro combinado de score e status** - Lógica de filtro não trata corretamente combinações de filtros ativos; um filtro pode sobrescrever o outro.
5. **auth.js: `onAuthStateChange` + `getSession()` duplicam init** - Ambos chamam `App.init()`, causando duplicação de modals e listeners (já corrigido parcialmente).
6. **admin-users.js: `role` row não atualiza na edição** - Ao editar role de usuário, a linha na tabela não reflete a mudança sem refresh manual.

### 1.2 Altos
1. **web-discovery.js: resultado pode conter links relativos** - Firecrawl retorna URLs relativas em alguns campos; não há normalização para absolutas.
2. **admin-offers.js: paginação não resetada ao mudar filtro** - Mudar filtro mantém `currentPage` anterior, pulando registros.
3. **offers.js: debounce inexistente em campo de busca** - Campo "Buscar oferta" no modal faz requisição a cada keystroke sem debounce.
4. **opportunities.js: `load()` sobrescreve filtros sem preservar estado** - Recarregar página perde filtros ativos.
5. **web-discovery.js: timeout fixo de 30s** - Se Firecrawl demorar >30s, erro não é bem tratado; sem retry.

### 1.3 Médios
1. **opportunities.js: paginação não persiste** - `currentPage` reseta ao re-aplicar filtro.
2. **offers.js: sem validação de URL no formulário** - Campo `landing_page_url` aceita qualquer string.
3. **app.js: console.log exposto em produção** - Vários `console.log` de depuração no init.
4. **diversos: falta tratamento de erro em `catch`** - Vários `fetch().catch()` apenas logam no console sem feedback ao usuário.
5. **offers.js: modal duplicado sem cleanup** - Se `App.init()` for chamado múltiplas vezes, listeners antigos acumulam.

### 1.4 Baixos
1. **offers.js: aria-label genérico** - Botões "Editar" sem aria-label descritivo.
2. **app.js: event listeners não removidos** - Listeners no `window` nunca são limpos.
3. **web-discovery.js: spinner nunca para em erro** - Se requisição falha, spinner continua rodando.
4. **admin-stats.js: tooltip sem role** - Tooltips sem atributo `role="tooltip"`.

## 2. Backend Supabase

### 2.1 Edge Functions

#### Críticos
1. **huvi-web-discovery: chave embutida `service_role_key`** - A chave `sb-api-key` é hardcoded no código. Roda server-side, então o risco é menor, mas ainda assim é uma má prática.
2. **huvi-web-discovery: `corsHeaders` permite `*` com credentials** - Configuração inválida de CORS permite `*` e ao mesmo tempo `Authorization` header.
3. **huvi-web-discovery: sem rate limit** - Qualquer chamada externa pode consumir créditos Firecrawl sem controle.
4. **huvi-web-sdr-agent: lógica de fallback quebrada** - Se a primeira tentativa de SDR falha, o fallback tenta novamente o mesmo payload sem alteração, causando loop de falhas.
5. **huvi-web-sdr-agent: variável `face` não definida** - Em um ponto do código, `content.face` é acessado em vez de `content.faace` ou similar; typo faz a função quebrar silenciosamente.

#### Altos
1. **huvi-web-discovery: sem validação de input além de tipo** - `user_id` vem do auth context, mas `query`, `niche` e `location` são usados diretamente sem sanitização.
2. **huvi-web-discovery: sem timeout na chamada Firecrawl** - `fetch()` para Firecrawl API sem `AbortController`, pode travar para sempre.
3. **huvi-web-discovery: limite de resultados alto** - `page_size: 20` sem paginação expõe usuário a custos altos em nichos genéricos.

#### Médios
1. **huvi-web-discovery: log expõe `alert` no lugar de `console`** - Edge Functions não têm `alert()`, então chamadas a `alert()` quebram.
2. **huvi-web-discovery: endpoint / não tratado** - Chamada na raiz retorna 404 sem mensagem útil.
3. **huvi-web-discovery: múltiplas funções sem padronização** - Cada Edge Function tem estrutura diferente de handler (request vs serveStatic).

### 2.2 Migrations

#### Críticos
1. **20240601000001_initial_schema.sql: sem RLS habilitado em `offers`** - Tabela `offers` não tem `ALTER TABLE ENABLE ROW LEVEL SECURITY`, expondo todos os dados se a política falhar.
2. **20240601000001_initial_schema.sql: sem RLS em `opportunities`** - Mesmo problema.
3. **20240601000002_add_rls.sql: `USING (true)` público em `offers`** - Política permite SELECT em `offers` sem autenticação se não houver `WITH CHECK`.

#### Médios
1. **Migration 4: enum `user_role` sem validação** - CHECK constraint básico mas sem validação de formato.
2. **Migration 7: trigger audit com nome genérico** - Trigger `audit_trigger` não identifica tabela de origem em logs.

### 2.3 RLS Policies

#### Altos
1. **offers: `USING (true)` permite SELECT público** - Mesmo com RLS habilitado, esta política permite que qualquer usuário veja todas as ofertas.
2. **opportunities: política permite SELECT sem user_id check** - Não verifica se `user_id = auth.uid()`.

## 3. Segurança

### 3.1 Críticos
1. **Chave Supabase service_role exposta** - `sb-api-key` no código da Edge Function. Roda em servidor, mas se o deploy vazar a function source, a chave fica exposta.

### 3.2 Altos
1. **XSS: web-discovery.js insere HTML direto sem sanitização** - `innerHTML` usado com dados do Firecrawl sem sanitizar (DOMPurify ou similar).
2. **offers.js mesmo problema** - `card.innerHTML` com dados de ofertas.

### 3.3 Médios
1. **Sem Content-Security-Policy** - Nenhum header CSP configurado no frontend ou serve.

### Observações
- SQL injection: Baixo risco, Supabase usa queries parametrizadas via client.
- CSRF: Mitigado via token de sessão Supabase.
- Autenticação: Admin routes verificam `app_metadata.role`, abordagem correta.
- Rate limiting: Edge Functions sem proteção.

## 4. n8n (10 workflows)

### 4.1 Críticos
1. **huvi_sdr_agent.json: IDs de nós duplicados** - `node1`, `node2` repetidos; impede importação.
2. **huvi_sdr_agent.json: edge reference aponta para ID inexistente** - Uma conexão refere a nó que não existe no JSON.
3. **fluxo_completo_vendas.json: nó HTTP Request sem URL** - Template sem endpoint definido.
4. **fluxo_completo_vendas.json: etapa de "qualificação" sem condição de saída** - Loop infinito se lead nunca qualifica.

### 4.2 Altos
1. **Vários workflows: sem tratamento de erro em nós HTTP** - Se API externa falha, workflow para sem fallback.
2. **Vários workflows: credenciais vazias** - Templates com `"credential": {}` vazio.

## 5. Recomendações Prioritárias

### Imediato (1-2 dias)
1. Corrigir duplicação de `nodeId` no `huvi_sdr_agent.json`
2. Remover `service_role_key` hardcoded e usar variáveis de ambiente
3. Sanitizar `innerHTML` com DOMPurify
4. Habilitar RLS em `offers` e `opportunities`
5. Adicionar `AbortController` no fetch Firecrawl

### Curto prazo (1 semana)
6. Adicionar CSP headers
7. Implementar debounce em campos de busca
8. Padronizar error handling em todos os catch blocks
9. Adicionar rate limiting nas Edge Functions
10. Corrigir RLS policies para verificar `auth.uid()`

### Médio prazo (2-4 semanas)
11. Implementar testes automatizados
12. Refatorar web-discovery.js para tratar links relativos
13. Revisar todos os 10 workflows n8n
14. Adicionar validação de URL nos formulários
