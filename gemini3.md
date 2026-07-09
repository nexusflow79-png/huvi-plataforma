# Firecrawl — Web Intelligence Engine

> **Módulo:** Descoberta Web + Análise de Websites
> **Contexto:** Antigravity
> **Versão:** 2.0

---

## 1. Definição e papel do módulo

O Firecrawl é o **serviço de inteligência web** do HUVI, responsável por duas operações distintas:

| Modo | Agente | IA | Função |
|------|--------|----|--------|
| **Descoberta Web** | Hunter | Não | Buscar oportunidades em websites, blogs e páginas web |
| **Análise de Websites** | Auditor + Strategist | Sim (via HUVI Brain) | Aprofundar dados de leads que já possuem site |

Ambos os modos compartilham o mesmo pool de créditos e a mesma configuração de tenant, mas possuem gatilhos, regras e saídas independentes.

---

## 2. Modo Descoberta Web (Hunter)

O Firecrawl atua como **fonte ativa de descoberta**, buscando oportunidades na web a partir de palavras-chave definidas pelo tenant.

### 2.1 Gatilho

Acionado **manualmente** pelo tenant na página de Descoberta, informando:

- `keywords` — Palavras-chave de busca (obrigatório, mínimo 1)
- `include_domains` — Domínios para focar a busca (opcional)
- `exclude_domains` — Domínios para ignorar (opcional)
- `test_mode` — Modo teste (não consome créditos)

### 2.2 Fluxo obrigatório

```
Tenant insere keywords
        │
        ▼
Creditos disponiveis?
   NÃO → bloquear + notificar
   SIM ↓
        ▼
Executar busca web (Firecrawl Search API)
        │
        ├──► Validação dos resultados
        ├──► Deduplicação (telefone, website, nome)
        ├──► Scoring determinístico
        ├──► Inserção em opportunities
        ├──► Consumo de créditos
        └──► Registro em web_search_log
```

### 2.3 Dados capturados

Capturar sempre que disponível:

- Nome da empresa / página
- Website / URL
- Descrição / snippet
- Telefone
- Email
- Redes sociais detectadas
- Endereço (quando disponível)

### 2.4 Regra de consumo (Descoberta)

| Evento | Créditos consumidos |
|--------|---------------------|
| Oportunidade válida criada | `1 opportunity_credit` |
| Duplicata descartada | `0` |
| Erro na API / timeout | `0` |
| Modo teste | `0` |

### 2.5 Scoring determinístico (Descoberta Web)

| Critério | Pontos |
|----------|--------|
| Telefone presente | +15 |
| Website presente | +20 |
| Email presente | +15 |
| Descrição rica (>100 caracteres) | +10 |
| Redes sociais detectadas | +10 |
| Endereço presente | +10 |
| Múltiplas páginas/riqueza de conteúdo | +10 |
| **Total máximo** | **100** |

**Lead qualificado via web:** score >= 60 E pelo menos um contato (telefone ou email).

### 2.6 Deduplicação

Antes de criar uma oportunidade, verificar se já existe registro para o mesmo `tenant_id` com qualquer uma das condições (**lógica OR**):

1. `telefone` igual (quando presente e não vazio)
2. `website` igual (quando presente e não vazio, comparando domínio normalizado)
3. `nome_empresa` com similaridade >= 90% (case-insensitive, ignorando sufixos jurídicos)

**Comportamento em duplicata:**
- Não criar novo registro.
- Não consumir crédito.
- Fazer merge de dados: atualizar apenas campos **nulos ou vazios** no registro existente.
- Registrar em `opportunity_dedup_log`.

---

## 3. Modo Análise de Websites (Auditor + Strategist)

O Firecrawl atua **a jusante** do pipeline, analisando o site de um lead já existente e qualificado.

### 3.1 Gatilho

Acionado **automaticamente** pelo pipeline quando todas as condições são atendidas:

```
Lead qualificado (score >= 60)
  → Possui website?
    ├── NÃO → Strategist apenas (sem análise de site)
    └── SIM
        → lead.score >= tenant.firecrawl_min_score?
          ├── NÃO → encerrar (sem custo)
          └── SIM
              → tenant_credits.available > 0?
                ├── NÃO → bloquear + notificar
                └── SIM → executar análise
```

### 3.2 Regras de acionamento

#### Condição 1 — Score mínimo do tenant

```
IF lead.score >= tenant.firecrawl_min_score
  → prosseguir para verificação de crédito
ELSE
  → bloquear análise, registrar: "score insuficiente"
```

- `firecrawl_min_score` é configurável por tenant no painel.

#### Condição 2 — Saldo de créditos disponível

```
IF tenant.tenant_credits.available > 0
  → autorizar análise e consumir 1 analysis_credit
ELSE
  → bloquear, notificar tenant, registrar evento
```

- Verificação **imediatamente antes de cada análise**, não em lote.
- Verificação **atômica** para evitar race conditions.

### 3.3 Consumo de créditos (Análise)

| Evento | Créditos consumidos |
|--------|---------------------|
| Website analisado com sucesso | `1 analysis_credit` |
| Análise bloqueada (score) | `0` |
| Análise bloqueada (sem saldo) | `0` |
| Erro na análise (timeout etc) | `0` |

- Débito ocorre **após confirmação de sucesso** da análise.
- Créditos não utilizados no mês **não acumulam** (salvo contrato).

### 3.4 Saída da análise

Cada análise alimenta **obrigatoriamente** dois agentes **em paralelo**:

#### Auditor

Dados brutos estruturados do site para:

- Verificar consistência das informações do lead
- Identificar sinais de risco (site desatualizado, sem contato, domínio suspeito)
- Registrar avaliação no histórico do lead

#### Strategist

Dados processados para:

- Gerar insights sobre posicionamento e mercado
- Propor abordagem personalizada de campanha
- Atualizar score do lead com base nos dados analisados

---

## 4. Controle de Créditos (Unificado)

Ambos os modos compartilham a tabela `tenant_credits` com contadores separados:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `tenant_id` | uuid | Identificador do tenant |
| `opportunity_limit` | integer | Limite de descobertas no ciclo |
| `opportunity_used` | integer | Descobertas consumidas no ciclo |
| `analysis_limit` | integer | Limite de análises no ciclo |
| `analysis_used` | integer | Análises consumidas no ciclo |
| `cycle_start_at` | timestamptz | Início do ciclo |
| `cycle_reset_at` | timestamptz | Data do próximo reset |

> **Regra:** Ciclo de 30 dias corridos. Reset diário via cron job às 00:00 UTC verifica `cycle_reset_at`.

### Limite mensal e bloqueio

Ao atingir o limite de qualquer contador:

1. **Bloquear** novas operações daquele modo para o tenant.
2. **Notificar** tenant por canal configurado (data de reset, volume usado, upgrade).
3. **Registrar** evento de bloqueio com timestamp.
4. **Não interromper** outros fluxos do sistema.

---

## 5. Regras de Qualificação

### Pipeline completa

```
Oportunidade criada (qualquer modo)
        │
        ▼
Scorer (pontua com base nos dados disponiveis)
        │
        ▼
Lead qualificado? (score >= 60 E contato presente)
  ├── NÃO → "Lead Frio" — sem acionamento de agentes
  └── SIM
        ├── Possui website?
        │   ├── NÃO → "Lead Qualificado sem Site" — somente Strategist
        │   └── SIM → acionar análise Firecrawl → Auditor + Strategist (paralelo)
        │
        └── Seguir para Campaign → Dispatcher → SDR
```

### Critérios de qualificação

- Score >= 60 pontos
- Pelo menos um campo de contato: telefone, email ou website
- Categoria reconhecida (não nula)

---

## 6. Tratamento de Erros

### Descoberta Web

| Cenário | Comportamento |
|---------|---------------|
| Timeout / erro de rede | Retry 3x com backoff (2s, 4s, 8s). Se persistir, registrar falha. |
| Rate limit (429) | Aguardar `Retry-After`, 1 retry máximo. |
| Sem resultados | Retornar sem criar. Não consumir créditos. Exibir: "Nenhum resultado encontrado." |
| Erro de autenticação (401/403) | Bloquear execução. Alertar administrador. |
| Dados inválidos parciais | Descartar apenas registros inválidos. Processar válidos. |

### Análise de Websites

| Cenário | Comportamento |
|---------|---------------|
| Site offline / timeout | Retry 1x. Se falhar, pular análise. Não consumir crédito. |
| Domínio inválido | Bloquear análise. Registrar: "domínio inválido". |
| Conteúdo insuficiente | Analisar o que existe. Registrar warning. |

> Em nenhum cenário de erro os créditos são consumidos antes da confirmação de sucesso.

---

## 7. KPIs por Ciclo

### Descoberta Web

| KPI | Descrição |
|-----|-----------|
| Oportunidades Encontradas | Total retornado pela busca |
| Oportunidades Válidas | Após validação e deduplicação |
| Duplicatas Evitadas | Descartados por dedup |
| Créditos Consumidos | `opportunity_used` no ciclo |
| Taxa de Aproveitamento | Válidas / Encontradas × 100 |

### Análise de Websites

| KPI | Descrição |
|-----|-----------|
| Análises Solicitadas | Total de análises disparadas |
| Análises Concluídas | Com sucesso |
| Análises Bloqueadas | Por score ou saldo |
| Créditos de Análise | `analysis_used` no ciclo |

---

## 8. Configuração por Tenant

| Parâmetro | Quem define | Descrição |
|-----------|-------------|-----------|
| `opportunity_limit` | Admin | Limite de descobertas por ciclo |
| `analysis_limit` | Admin | Limite de análises por ciclo |
| `firecrawl_min_score` | Admin | Score mínimo para acionar análise |
| `firecrawl_status` | Sistema | `active` \| `blocked` |
| `discovery_keywords` | Tenant | Palavras-chave padrão (pré-preenchimento) |
| `discovery_include_domains` | Tenant | Domínios para focar (opcional) |
| `discovery_exclude_domains` | Tenant | Domínios para ignorar (opcional) |

---

## 9. Fluxo Completo

```
┌──────────────────────────────────────────────────────────────┐
│                     FIRECRAWL ENGINE                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  MODO DESCOBERTA (Hunter)           MODO ANÁLISE (pós-lead) │
│  ┌──────────────────────┐           ┌──────────────────────┐ │
│  │ Keywords + filtros   │           │ Lead qualificado     │ │
│  │         ↓            │           │ com site             │ │
│  │ Firecrawl Search API │           │         ↓            │ │
│  │         ↓            │           │ Score >= min_score?  │ │
│  │ Validação + Dedup    │           │         ↓            │ │
│  │         ↓            │           │ Tem crédito?         │ │
│  │ Scoring + Insert     │           │         ↓            │ │
│  │         ↓            │           │ Firecrawl Scrape     │ │
│  │ opportunities[]      │           │         ↓            │ │
│  └──────────────────────┘           │  ┌──────┴──────┐     │ │
│                                      │  ▼            ▼     │ │
│                                      │ Auditor   Strategist │ │
│                                      │ (paralelo)          │ │
│                                      └──────────────────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │            Pool de Créditos (tenant_credits)              ││
│  │  opportunity_used  │  analysis_used  │  reset_at         ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
        │
        ▼
Pipeline de Oportunidades (Scorer → Campaign → Dispatcher → SDR)
```

---

## 10. Integração com n8n

### Workflows associados

| Workflow | Gatilho | Modo |
|----------|---------|------|
| `huvi_web_discovery` | Webhook do frontend | Descoberta |
| `huvi_opportunity_pipeline` | Lead qualificado com site | Análise |

### Tabelas do banco

| Tabela | Modo | Finalidade |
|--------|------|------------|
| `tenant_credits` | Ambos | Controle de créditos unificado |
| `opportunities` | Ambos | Oportunidades geradas |
| `opportunity_dedup_log` | Descoberta | Log de deduplicação |
| `web_search_log` | Descoberta | Log de buscas e KPIs |
| `web_search_queue` | Descoberta | Fila FIFO de buscas |
| `audits` | Análise | Resultado do Auditor |
| `strategies` | Análise | Resultado do Strategist |
| `agent_executions` | Ambos | Rastreabilidade |

---

## 11. Segurança e Isolamento

- Toda operação exige `tenant_id` obrigatório.
- RLS habilitado em todas as tabelas.
- Nenhum dado cruzado entre tenants.
- Chaves de API externas (Firecrawl) armazenadas apenas no servidor (Edge Functions / n8n).
- Frontend nunca expõe chaves de serviço.

---

**Versão:** 2.0
**Status:** OFICIAL
**Substitui:** gemini3.md v1.0
