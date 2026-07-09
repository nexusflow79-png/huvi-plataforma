# INSTRUÇÃO PARA O ANTIGRAVITY — GOOGLE MAPS (OUTSCRAPER)

Implementar o Google Maps como Fonte Oficial de Descoberta de Oportunidades do HUVI utilizando Outscraper.

O Google Maps é uma Fonte de Oportunidades.
O Outscraper é o Serviço de Descoberta.

O tenant seleciona:
- Segmento
- Estado
- Cidade (uma por busca)

O HUVI executa a busca através do Outscraper e cria oportunidades na Pipeline.

---

# FLUXO OBRIGATÓRIO

```
Google Maps
↓
Outscraper
↓
Tratamento de Erros
↓
Validação
↓
Deduplicação
↓
Supabase
↓
Pipeline de Oportunidades
```

---

# DADOS CAPTURADOS

Capturar sempre que disponível:

- Nome da Empresa
- Categoria
- Telefone
- Website
- Endereço
- Cidade
- Estado
- Avaliação
- Quantidade de Avaliações
- URL Google Maps

---

# CONTROLE DE CRÉDITOS

Utilizar tabela:

**tenant_credits**

Campos:

| Campo | Tipo | Descrição |
|---|---|---|
| `tenant_id` | uuid | Identificador do tenant (obrigatório) |
| `opportunity_limit` | integer | Limite de oportunidades do ciclo atual |
| `opportunity_used` | integer | Total consumido no ciclo atual |
| `cycle_start_at` | timestamp | Início do ciclo de faturamento atual |
| `cycle_reset_at` | timestamp | Data do próximo reset (gerada automaticamente) |

**Regra de reset:**
O campo `opportunity_used` é zerado automaticamente via cron job executado diariamente às 00:00 UTC. O job verifica se a data atual é igual ou posterior a `cycle_reset_at`. Quando o reset ocorre, `cycle_start_at` é atualizado para a data atual e `cycle_reset_at` é recalculado para 30 dias à frente. O ciclo é de 30 dias corridos a partir da data de ativação do plano do tenant, não do dia 1 do mês calendário.

---

# REGRA DE CONSUMO

Cada oportunidade válida **criada** consome 1 opportunity_credit.

Oportunidades descartadas por deduplicação **não** consomem crédito.
Buscas que resultarem em erro da API Outscraper **não** consomem crédito.

Exemplo:
```
Busca retornou:    100 empresas
Duplicatas:         13 descartadas
Erros de validação: 5  descartadas
Oportunidades criadas: 82
Créditos consumidos:   82
```

---

# REGRA DE DEDUPLICAÇÃO

Antes de criar uma oportunidade, verificar se já existe registro para o mesmo `tenant_id` com qualquer uma das seguintes condições (**lógica OR**):

1. `telefone` igual ao da nova empresa (quando ambos estiverem presentes e não vazios)
2. `website` igual ao da nova empresa (quando ambos estiverem presentes e não vazios)
3. `nome_empresa` com similaridade ≥ 90% (comparação case-insensitive, ignorando sufixos jurídicos como Ltda, ME, EIRELI, S.A.)

**Comportamento quando duplicata for identificada:**

- Não criar novo registro.
- Não consumir crédito.
- Executar merge de dados: atualizar apenas os campos que estiverem **nulos ou vazios** no registro existente com os dados recém-capturados. Campos já preenchidos não são sobrescritos.
- Registrar o evento de deduplicação na tabela `opportunity_dedup_log` (tenant_id, opportunity_id existente, data, campos atualizados).

**Campos que participam do merge:** telefone, website, endereço, avaliação, quantidade de avaliações, URL Google Maps.

---

# REGRA DE ISOLAMENTO

Toda oportunidade criada deverá possuir `tenant_id` obrigatório.

Nenhuma oportunidade poderá ser compartilhada entre tenants. Todas as queries na tabela de oportunidades devem incluir filtro por `tenant_id` no nível de aplicação e via Row Level Security (RLS) no Supabase.

---

# VALIDAÇÃO DE CRÉDITOS

Antes de executar qualquer busca, verificar:

```
opportunity_used < opportunity_limit
```

Se o limite for atingido:
- Bloquear execução.
- Exibir: `"Limite do ciclo atual de oportunidades atingido. Renova em [cycle_reset_at formatado]."`
- Exibir data de reset para que o tenant saiba quando poderá realizar novas buscas.

---

# TRATAMENTO DE ERROS DA API OUTSCRAPER

Toda chamada ao Outscraper deve ser envolvida em bloco de tratamento de erro. Os cenários e comportamentos esperados são:

| Cenário | Comportamento |
|---|---|
| Timeout ou erro de rede | Retry automático até 3 tentativas com backoff exponencial (2s, 4s, 8s). Se persistir, registrar falha e notificar tenant. |
| Rate limit da API (429) | Aguardar o tempo indicado no header `Retry-After` e tentar novamente. Máximo de 1 retry nesse caso. |
| Sem resultados (array vazio) | Retornar sem criar oportunidades. Não consumir créditos. Exibir: `"Nenhuma empresa encontrada para os critérios selecionados."` |
| Erro de autenticação (401/403) | Bloquear execução. Alertar o administrador do sistema. Não exibir detalhes técnicos ao tenant. |
| Resposta com dados inválidos | Descartar apenas os registros inválidos. Processar os válidos normalmente. Registrar os descartados em log. |

Em nenhum cenário de erro os créditos do tenant devem ser consumidos antes da confirmação de criação bem-sucedida da oportunidade no Supabase.

---

# CONFIGURAÇÃO DO TENANT

Tela: **Configurações → Descoberta de Oportunidades**

Campos:

| Campo | Quem define | Descrição |
|---|---|---|
| Limite do Ciclo | Admin do sistema | Quantidade total de oportunidades permitidas por ciclo de 30 dias. Não editável pelo tenant. |
| Segmento Preferencial | Tenant | Pré-preenche o campo de segmento em novas buscas. Editável a cada busca. |
| Estado Padrão | Tenant | Pré-preenche o estado em novas buscas. Editável a cada busca. |
| Cidade Padrão | Tenant | Pré-preenche a cidade em novas buscas. Editável a cada busca. |

Exibir na mesma tela: créditos utilizados no ciclo atual, limite do ciclo e data de reset.

---

# EXECUÇÃO DE BUSCA

Cada busca é executada para uma combinação de **Segmento + Estado + Cidade**.

O tenant pode iniciar múltiplas buscas sequencialmente, mas o sistema deve:

1. Processar uma busca por vez por tenant (fila FIFO).
2. Bloquear nova busca enquanto houver uma em andamento para o mesmo tenant.
3. Exibir status da busca em andamento: `"Buscando empresas em [Cidade/Estado] — Segmento: [Segmento]"`.
4. Ao concluir, exibir resumo: oportunidades encontradas, criadas, duplicatas evitadas e créditos consumidos.

---

# RESULTADO DA BUSCA

Toda busca deverá alimentar automaticamente a **Pipeline de Oportunidades**.

- Status inicial: `Novo Lead`
- Origem: `Google Maps`
- Fonte: `Outscraper`

---

# INTEGRAÇÃO COM O HUVI

Após a criação da oportunidade, o fluxo de qualificação é executado automaticamente:

```
Oportunidade criada
↓
Scorer (pontua a oportunidade com base nos dados disponíveis)
↓
Classificação
↓
Lead Qualificado? (score ≥ 60 E pelo menos um de: telefone, website ou avaliação presente)
├── NÃO → Status: "Lead Frio" | Permanece na pipeline sem acionamento de agentes
└── SIM
    ↓
    Website disponível?
    ├── NÃO → Status: "Lead Qualificado sem Site" | Acionar somente Strategist
    └── SIM
        ↓
        Firecrawl (coleta dados do site)
        ↓
        Auditor (analisa presença digital)
        ↓
        Strategist (gera estratégia personalizada)
```

**Critérios de qualificação (Lead Qualificado):**

- Score do Scorer ≥ 60 pontos
- Pelo menos um campo de contato presente: telefone ou website
- Categoria da empresa reconhecida pelo sistema (não nula)

**Critérios de score do Scorer (referência para implementação):**

| Critério | Pontos |
|---|---|
| Telefone presente | +15 |
| Website presente | +20 |
| Avaliação ≥ 4.0 | +20 |
| Quantidade de avaliações ≥ 50 | +15 |
| Endereço completo presente | +10 |
| Categoria mapeada no sistema | +20 |
| **Total máximo** | **100** |

---

# REGRA DE EFICIÊNCIA

O Outscraper deverá ser utilizado **apenas para descoberta**.

- Não utilizar Outscraper para análises.
- Não utilizar Outscraper para enriquecimento.
- Não utilizar Outscraper para diagnóstico.

Sua única responsabilidade é alimentar a Pipeline de Oportunidades do HUVI com dados confiáveis provenientes do Google Maps.

---

# KPI PRINCIPAL

Monitorar por tenant e por ciclo:

| KPI | Descrição |
|---|---|
| Oportunidades Encontradas | Total retornado pelo Outscraper |
| Oportunidades Válidas | Total após validação e deduplicação |
| Oportunidades Duplicadas Evitadas | Total descartado por deduplicação |
| Créditos Consumidos | Total de opportunity_credits gastos no ciclo |
| Taxa de Aproveitamento | Oportunidades Válidas / Oportunidades Encontradas × 100 |
| Custo por Oportunidade | Custo financeiro da busca no Outscraper / Oportunidades Válidas |

Para o KPI de **Custo por Oportunidade**, registrar na tabela `outscraper_search_log`:
- `tenant_id`
- `search_id`
- `cost_usd` (valor cobrado pela API Outscraper para a busca)
- `results_count`
- `valid_count`
- `created_at`

O objetivo é maximizar oportunidades qualificadas com o menor custo operacional possível.
