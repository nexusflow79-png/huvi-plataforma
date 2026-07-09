# ⚡ HUVI — Motor de Busca por Zonas Geográficas
**Product Requirements Document · v1.0 · Jun/2026 · Status: Aprovado**

---

## 1. Visão Geral do Produto

### 1.1 Contexto e Problema

O motor de Descoberta do HUVI realiza buscas no Google Maps via Outscraper para identificar leads qualificados por nicho e cidade. O modelo atual executa uma única requisição cobrindo a cidade inteira como polígono geográfico.

Esse modelo apresenta falha crítica de escala:

- **Maceió/AL** — busca por "clínicas odontológicas" leva até 5 minutos
- **São Paulo/SP** — mesma busca pode levar 20–40 minutos ou gerar timeout
- **Cidades médias** (Campinas, Recife, Fortaleza) — tempo imprevisível

> **💡 Diagnóstico Estratégico:** O problema não está na ferramenta (Outscraper). Está na arquitetura da requisição: busca linear e síncrona em polígono amplo = tempo proporcional à densidade urbana. Solução: decomposição geográfica paralela.

### 1.2 Objetivo do PRD

Definir a arquitetura, requisitos e implementação do **Motor de Busca por Zonas Geográficas** — substituindo o modelo de busca única por um sistema de requisições paralelas segmentadas por zona, garantindo performance previsível independente do porte da cidade.

### 1.3 Benefícios Esperados

| Métrica | Situação Atual | Meta Pós-implementação |
|---|---|---|
| Tempo de busca (Maceió) | ~5 minutos | < 90 segundos |
| Tempo de busca (São Paulo) | Inviável / timeout | < 3 minutos |
| Previsibilidade de créditos | Imprecisa | Calculável por zona |
| Taxa de aproveitamento | Não rastreada | Visível por bairro |
| Escalabilidade para novas cidades | Não suportada | Auto-configurável |

---

## 2. Arquitetura da Solução

### 2.1 Fluxo Geral

1. Usuário preenche **Nicho + Estado + Cidade** na interface HUVI e clica em Iniciar Descoberta
2. Frontend dispara webhook ao n8n com payload: `{ nicho, estado, cidade, limite_creditos }`
3. n8n consulta tabela de zonas (JSON/Google Sheets) e retorna array de zonas para a cidade
4. n8n executa N requisições em paralelo ao Outscraper — uma por zona
5. Cada resposta é processada individualmente: validação, normalização e deduplicação
6. Resultados válidos são agregados e enviados à Pipeline de Oportunidades do HUVI
7. KPIs do ciclo são atualizados em tempo real: Encontradas, Válidas, Duplicatas, Créditos Usados

### 2.2 Diagrama de Componentes

```
[ HUVI Frontend ] → webhook POST → [ n8n: Webhook Trigger ]
                                              |
                                  [ Lookup: Tabela de Zonas ]
                                  (JSON local ou Google Sheets)
                                              |
                            ┌─────────────────┼─────────────────┐
                       [Zona 1]           [Zona 2]  ...    [Zona N]
                     Outscraper         Outscraper        Outscraper
                            └─────────────────┼─────────────────┘
                                              |
                                [ Merge + Deduplicação ]
                                              |
                               [ Pipeline HUVI + KPIs ]
```

### 2.3 Tabela de Zonas — Estrutura JSON

```json
{
  "cidades": {
    "São Paulo": {
      "uf": "SP",
      "zonas": ["Centro", "Pinheiros", "Vila Mariana", "Mooca",
                "Santana", "Lapa", "Santo André", "Tatuapé",
                "Itaim Bibi", "Morumbi", "Campo Limpo", "Penha"]
    },
    "Maceió": {
      "uf": "AL",
      "zonas": ["Pajuçara", "Jatiúca", "Farol", "Ponta Verde",
                "Mangabeiras", "Centro", "Benedito Bentes", "Tabuleiro"]
    },
    "Fortaleza": {
      "uf": "CE",
      "zonas": ["Aldeota", "Meireles", "Fátima", "Benfica",
                "Messejana", "Maraponga", "Parangaba", "Caucaia"]
    }
  }
}
```

---

## 3. Requisitos Funcionais

### RF-01 — Lookup de Zonas por Cidade

| Campo | Detalhe |
|---|---|
| Trigger | Recebimento do webhook de Descoberta |
| Entrada | `{ cidade, estado }` |
| Processamento | Consulta tabela de zonas e retorna array |
| Saída | Array de strings: `['Zona 1', 'Zona 2', ...]` |
| Fallback | Se cidade não encontrada → busca cidade inteira (comportamento atual) |
| Prioridade | **ALTA — bloqueante para demais RF** |

### RF-02 — Execução Paralela de Buscas

| Campo | Detalhe |
|---|---|
| Trigger | Array de zonas disponível (RF-01 concluído) |
| Entrada | Array de zonas + nicho + cidade |
| Query montada | `"[nicho]" + [zona] + [cidade] + [UF]` |
| Paralelismo | Máximo 5 requisições simultâneas (respeitar rate limit Outscraper) |
| Resultado por zona | Array de estabelecimentos com: nome, telefone, endereço, site, avaliação |
| Prioridade | **ALTA** |

### RF-03 — Deduplicação de Resultados

| Campo | Detalhe |
|---|---|
| Trigger | Merge de todos os arrays por zona |
| Critério primário | Número de telefone normalizado (sem máscara) |
| Critério secundário | Nome do estabelecimento (fuzzy match ≥ 85%) |
| Critério terciário | Endereço (rua + número) |
| Ação em duplicata | Manter primeiro registro. Incrementar contador DUPLICATAS |
| Prioridade | **ALTA** |

### RF-04 — Controle de Créditos por Ciclo

| Campo | Detalhe |
|---|---|
| Trigger | Antes de cada inserção na Pipeline |
| Verificação | Créditos disponíveis ≥ 1 antes de consumir |
| Consumo | 1 crédito por oportunidade válida inserida |
| Limite | Encerrar pipeline ao atingir limite do ciclo (ex.: 80) |
| Log | Registrar zona de origem, timestamp e crédito consumido |
| Prioridade | **ALTA** |

### RF-05 — Atualização de KPIs em Tempo Real

| KPI | Origem do Dado | Atualização |
|---|---|---|
| Encontradas | Total bruto retornado pelo Outscraper | Por zona concluída |
| Válidas | Registros após validação e deduplicação | Por zona concluída |
| Duplicatas | Registros descartados por duplicidade | Por zona concluída |
| Créditos Usados | Oportunidades inseridas na Pipeline | Por inserção |
| Aproveitamento % | Válidas / Encontradas × 100 | Calculado ao final |

---

## 4. Requisitos Não-Funcionais

### 4.1 Performance

- Tempo máximo de execução: **3 minutos** para qualquer cidade brasileira
- Timeout por requisição ao Outscraper: **45 segundos**
- Se zona exceder timeout: registrar falha, continuar demais zonas

### 4.2 Resiliência

- Falha em uma zona **NÃO** deve interromper o ciclo completo
- Retry automático: máximo 2 tentativas por zona com falha
- Log de erros por zona: `{ zona, erro, timestamp, tentativas }`
- Rollback de créditos se a execução falhar antes de qualquer inserção

### 4.3 Escalabilidade

- Adicionar nova cidade = adicionar entrada no JSON de zonas (zero código)
- Adicionar nova zona em cidade existente = editar JSON (zero impacto no fluxo)
- Estrutura suporta até 50 zonas por cidade sem alteração de arquitetura

### 4.4 Rastreabilidade

- Cada oportunidade deve carregar metadado: `zona_origem`, `timestamp_busca`, `ciclo_id`
- Histórico de buscas deve exibir: cidade, zonas executadas, tempo total, aproveitamento

---

## 5. Implementação no n8n (Antigravity)

### 5.1 Estrutura de Nós — Fluxo Principal

| Ordem | Nó n8n | Tipo | Função |
|---|---|---|---|
| 1 | Webhook Trigger | Webhook | Recebe `{ nicho, cidade, estado }` do HUVI |
| 2 | Set: Normalizar Payload | Set | Padroniza campos, gera `ciclo_id` (UUID) |
| 3 | HTTP: Buscar Zonas | HTTP Request | GET na planilha/JSON de zonas por cidade |
| 4 | IF: Cidade na Tabela? | IF | Se não → rota Fallback (busca cidade inteira) |
| 5 | Split in Batches | Split | Divide array de zonas em lotes de 5 |
| 6 | HTTP: Outscraper | HTTP Request | POST para Outscraper com query por zona |
| 7 | Wait | Wait | 500ms entre lotes (respeitar rate limit) |
| 8 | Merge: Agregar Resultados | Merge | Combina todos os arrays de zonas |
| 9 | Code: Deduplicar | Code (JS) | Remove duplicatas por telefone/nome |
| 10 | Code: Validar Registros | Code (JS) | Filtra registros sem telefone/nome |
| 11 | IF: Créditos Disponíveis? | IF | Verifica saldo antes de inserir |
| 12 | HTTP: Inserir na Pipeline | HTTP Request | POST na API do HUVI por registro válido |
| 13 | HTTP: Atualizar KPIs | HTTP Request | PATCH nos contadores do ciclo atual |
| 14 | HTTP: Log de Histórico | HTTP Request | POST no histórico de buscas |

### 5.2 Nó 6 — Configuração do Outscraper

```
query: "{{$json.nicho}} {{$json.zona_atual}} {{$json.cidade}} {{$json.estado}}"

Exemplo montado:
"clínicas odontológicas Pajuçara Maceió AL"

Parâmetros Outscraper:
  - limit: 20 (por zona — total = zonas × 20, deduplicado = ~80)
  - language: pt
  - region: BR
  - fields: name, phone, address, website, rating, reviews
```

### 5.3 Nó 9 — Código de Deduplicação

```javascript
// Code Node (JavaScript) — Deduplicação
const items = $input.all();
const seen = new Set();
const result = [];
let duplicates = 0;

for (const item of items) {
  const phone = (item.json.phone || "").replace(/\D/g, "");
  const name  = (item.json.name  || "").toLowerCase().trim();
  const key   = phone || name;

  if (key && !seen.has(key)) {
    seen.add(key);
    result.push(item);
  } else {
    duplicates++;
  }
}

return [{ json: { records: result, duplicates_count: duplicates } }];
```

### 5.4 Modo Teste (Webhook-Test)

- Manter toggle existente no HUVI: Modo Teste n8n (`/webhook-test`)
- Em modo teste: executar apenas **2 zonas** (primeiras do array) para validação rápida
- Não consumir créditos reais em modo teste
- Exibir resultado com flag: `[TESTE — dados não inseridos na Pipeline]`

---

## 6. Dados — Tabela de Zonas por Cidade

### 6.1 Cidades Prioritárias para Lançamento (v1.0)

| Cidade | UF | Nº de Zonas | Critério de Seleção |
|---|---|---|---|
| São Paulo | SP | 12 | Maior mercado — alta densidade |
| Rio de Janeiro | RJ | 10 | Segundo maior mercado |
| Maceió | AL | 8 | Cidade base — já testada |
| Fortaleza | CE | 9 | Capital nordestina estratégica |
| Recife | PE | 9 | Capital nordestina estratégica |
| Salvador | BA | 8 | Capital nordestina estratégica |
| Belo Horizonte | MG | 10 | Terceiro maior mercado |
| Curitiba | PR | 8 | Sul — alta renda per capita |
| Manaus | AM | 7 | Norte — pouco explorado |
| Brasília | DF | 7 | Capital federal |

### 6.2 Critérios para Definição de Zonas

- Cobrir regiões com densidade comercial representativa
- Mínimo 5 zonas por cidade (garante paralelismo real)
- Máximo 15 zonas por cidade (controle de créditos por ciclo)
- Nomenclatura baseada em bairros reais reconhecidos pelo Google Maps
- Validar queries manualmente antes de inserir na tabela de produção

---

## 7. Inteligência de Negócio — Dados Gerados

A arquitetura de zonas gera dados estratégicos que o modelo atual não produz. Esses dados devem ser armazenados e exibidos no Dashboard do HUVI.

### 7.1 Métricas por Zona

| Dado | Como usar estrategicamente |
|---|---|
| Leads encontrados por zona | Mapa de calor de densidade de mercado |
| Taxa de aproveitamento por zona | Identificar zonas com mais leads qualificados |
| Tempo de resposta por zona | Detectar zonas com sobrecarga (otimizar limite) |
| Duplicatas por zona | Detectar sobreposição geográfica — refinar polígonos |

### 7.2 Inteligência de Nicho por Região

> **🎯 Diferencial Competitivo:** Com os dados acumulados de múltiplas buscas, o HUVI pode exibir: *"Zona com maior concentração de clínicas odontológicas sem presença digital em São Paulo: Penha (38 leads — 71% sem site)"*. Isso transforma o produto de ferramenta operacional em sistema de inteligência de mercado.

---

## 8. Critérios de Aceite

| ID | Critério | Como Validar |
|---|---|---|
| CA-01 | Busca em Maceió conclui em < 90 segundos | Teste cronometrado com nicho odontológico |
| CA-02 | Busca em São Paulo conclui em < 3 minutos | Teste cronometrado com nicho odontológico |
| CA-03 | Zero duplicatas na Pipeline após busca | Verificar registros com mesmo telefone |
| CA-04 | KPIs atualizados corretamente ao final | Conferir ENCONTRADAS = soma de todas zonas |
| CA-05 | Falha em 1 zona não cancela ciclo | Simular timeout em zona intermediária |
| CA-06 | Créditos não ultrapassam limite do ciclo | Executar busca com saldo = 5 créditos |
| CA-07 | Modo teste não consome créditos reais | Verificar saldo antes/depois de teste |
| CA-08 | Nova cidade adicionável sem código | Inserir cidade no JSON e executar busca |

---

## 9. Roadmap de Implementação

| Fase | Entregável | Prazo Est. |
|---|---|---|
| Fase 1 | JSON de zonas para 10 cidades prioritárias | Dia 1 |
| Fase 2 | Fluxo n8n: Lookup + Split + Parallel Outscraper | Dias 2–3 |
| Fase 3 | Nó de deduplicação e validação de registros | Dia 3 |
| Fase 4 | Integração com Pipeline HUVI + atualização de KPIs | Dia 4 |
| Fase 5 | Testes com Maceió e São Paulo — ajuste de rate limit | Dia 5 |
| Fase 6 | Rollout para demais cidades + documentação de zonas | Dia 7 |

---

## 10. Dependências e Riscos

### 10.1 Dependências

- **Outscraper:** conta ativa com créditos suficientes para testes paralelos
- **n8n (Antigravity):** permissão para execução de Code Nodes em JavaScript
- **HUVI API:** endpoint de inserção na Pipeline deve aceitar requisições individuais (não bulk)
- **HUVI API:** endpoint PATCH para atualização de KPIs do ciclo atual

### 10.2 Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Rate limit Outscraper em buscas paralelas | Média | Lote máximo de 5 + Wait de 500ms entre lotes |
| Zona não reconhecida pelo Google Maps | Baixa | Validação manual da tabela antes do deploy |
| API HUVI sem endpoint de atualização de KPIs | Média | Mapear endpoints disponíveis antes da Fase 4 |
| Timeout em cidade com muitas zonas (SP) | Baixa | Timeout por zona de 45s + retry automático |
| Créditos insuficientes para testes | Baixa | Usar Modo Teste para validação (sem consumo) |

---

## Aprovação e Histórico

| Versão | Data | Autor | Alteração |
|---|---|---|---|
| 1.0 | Jun/2026 | Hamilton José | Versão inicial — arquitetura de zonas geográficas |

---

*Este documento é confidencial e de uso interno do HUVI. Qualquer reprodução ou distribuição sem autorização é proibida.*
