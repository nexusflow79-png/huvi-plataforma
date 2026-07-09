# GEMINI.md
## Constituição Oficial do HUVI — Hub de Vendas Inteligente
### Versão 1.1 (Congelada)

---

# 1. PREÂMBULO

O HUVI (Hub de Vendas Inteligente) é uma plataforma SaaS multi-tenant criada para transformar produtos e serviços em oportunidades reais de venda através da combinação de inteligência comercial, automação, prospecção, comunicação e conversão.

O HUVI existe para permitir que pequenos empresários e profissionais liberais obtenham crescimento previsível, escalável e mensurável, reduzindo atividades operacionais manuais e maximizando retorno sobre investimento.

Esta Constituição estabelece os princípios, regras e limites que deverão orientar toda evolução do produto.

Nenhuma implementação poderá contrariar os princípios definidos neste documento.

---

# 2. MISSÃO

Transformar produtos e serviços em oportunidades reais de venda utilizando inteligência comercial, automação e conversão orientada a resultados.

---

# 3. VISÃO

Ser a principal plataforma brasileira de crescimento comercial inteligente para pequenas empresas e profissionais independentes.

---

# 4. OBJETIVO FUNDAMENTAL

O HUVI deverá ser capaz de:

- Descobrir oportunidades comerciais.
- Enriquecer informações.
- Diagnosticar potenciais melhorias.
- Definir estratégias comerciais.
- Gerar campanhas.
- Realizar prospecção.
- Conduzir oportunidades até a conversão.
- Medir resultados financeiros.

Toda funcionalidade deverá contribuir direta ou indiretamente para esse objetivo.

---

# 5. PRINCÍPIOS CONSTITUCIONAIS

## 5.1 Princípio da Receita

Toda funcionalidade do HUVI deverá contribuir para aumentar ou facilitar a geração de receita dos tenants.

Métricas de vaidade não poderão ser consideradas métricas principais da plataforma.

O sucesso do sistema será medido prioritariamente por:

- Oportunidades geradas
- Conversões realizadas
- Receita gerada

---

## 5.2 Princípio da Inteligência Progressiva

A inteligência artificial deverá ser utilizada apenas quando uma camada mais simples não for suficiente.

Hierarquia obrigatória:

```text
Regras
↓
Templates
↓
Motor de Decisão
↓
LLM
```

A IA deverá ser o último recurso.

---

## 5.3 Princípio da Eficiência Operacional

Toda automação deverá gerar benefício operacional superior ao custo computacional necessário para executá-la.

---

## 5.4 Princípio do ROI

Nenhuma funcionalidade deverá existir apenas porque é tecnicamente possível.

Toda funcionalidade deverá possuir justificativa comercial clara.

---

## 5.5 Princípio da Simplicidade

O HUVI deverá priorizar soluções simples, robustas e escaláveis.

Complexidade desnecessária deverá ser evitada.

---

# 6. MODELO OPERACIONAL

O HUVI deverá operar como:

```text
SaaS Multi-Tenant Tradicional
```

Estrutura:

```text
HUVI
├── Tenant A
├── Tenant B
├── Tenant C
```

Não existirão:

- Subtenants
- Workspaces
- Revendedores internos
- Estruturas hierárquicas de clientes

Cada tenant será totalmente independente.

---

# 7. ISOLAMENTO DE DADOS

## 7.1 Isolamento Absoluto

Dados pertencentes a um tenant jamais poderão ser acessados por outro tenant.

---

## 7.2 Não Contaminação de Contexto

Contextos operacionais não poderão ser compartilhados entre tenants.

Incluindo:

- Leads
- Oportunidades
- Conversas
- Campanhas
- Estratégias
- Resultados

---

## 7.3 Separação de Conhecimento

O aprendizado do sistema jamais poderá expor dados identificáveis de qualquer tenant.

---

# 8. SEGURANÇA

## 8.1 Segurança acima da Conveniência

A proteção dos dados deverá prevalecer sobre facilidade de implementação.

---

## 8.2 Tenant Obrigatório

Toda entidade operacional deverá possuir:

```text
tenant_id
```

obrigatório.

---

## 8.3 RLS Obrigatório

Toda tabela operacional deverá possuir:

```text
Row Level Security
```

habilitado.

---

## 8.4 Auditoria

Operações críticas deverão possuir rastreabilidade.

---

## 8.5 Soft Delete

Registros operacionais não deverão ser removidos fisicamente quando houver necessidade de auditoria futura.

---

# 9. FONTE OFICIAL DA VERDADE

## Supabase

O Supabase é a única fonte oficial de verdade do HUVI.

Nenhum agente poderá manter estado persistente fora do Supabase.

---

# 10. ARQUITETURA OFICIAL DE AGENTES

## Fluxo Operacional

```text
Hunter
↓
Enricher
↓
Auditor
↓
Scorer
↓
Strategist
↓
Campaign
↓
Dispatcher
↓
SDR
↓
Conversion
```

---

# 11. AGENTES OFICIAIS

## Hunter

Responsável por descobrir oportunidades.

---

## Enricher

Responsável por enriquecer informações.

---

## Auditor

Responsável por diagnosticar oportunidades.

---

## Scorer

Responsável por classificar oportunidades.

---

## Strategist

Responsável por definir estratégia comercial.

---

## Campaign

Responsável por gerar campanhas.

---

## Dispatcher

Responsável por executar comunicações.

---

## SDR

Responsável por conduzir conversas e conversões.

---

## Guardian

Responsável por governança, segurança, auditoria e conformidade.

---

## HUVI Brain

Responsável pela governança de inteligência artificial.

---

# 12. HUVI BRAIN

O HUVI Brain é o único componente autorizado a interagir diretamente com modelos de IA.

Fluxo obrigatório:

```text
Agente
↓
HUVI Brain
↓
LLM
↓
HUVI Brain
↓
Agente
```

---

## Responsabilidades

- Controle de contexto
- Controle de custos
- Seleção de modelos
- Cache inteligente
- Governança de IA

---

# 13. POLÍTICA DE IA

A IA deverá ser utilizada prioritariamente por:

- Auditor
- Strategist
- Campaign

O SDR poderá utilizar IA sob demanda.

A IA não deverá ser utilizada para tarefas determinísticas.

---

# 14. POLÍTICA DE CUSTOS

O consumo de IA deverá ser monitorado continuamente.

O sistema deverá buscar:

- Menor custo possível
- Maior retorno possível
- Menor consumo de tokens possível

---

# 15. COMUNICAÇÃO OFICIAL

Os canais oficiais do MVP serão:

- WhatsApp
- E-mail

Novos canais poderão ser adicionados futuramente.

---

# 16. CONVERSÕES OFICIAIS

## Conversão Tipo 1 — Direta

```text
Lead
↓
Landing Page
↓
Checkout
↓
Pagamento
↓
Conversão
```

---

## Conversão Tipo 2 — Agendamento

```text
Lead
↓
Agenda Nexus
↓
Reunião
↓
Conversão
```

---

## Conversão Tipo 3 — Híbrida

```text
Lead
↓
Landing Page
↓
Agenda Nexus
↓
Conversão
```

---

# 17. PADRÃO OFICIAL DO MVP

A rota principal do MVP será:

```text
Lead
↓
Landing Page
↓
Checkout Asaas
↓
Pagamento
↓
Conversão
```

A rota secundária será:

```text
Lead
↓
Agenda Nexus
↓
Reunião
↓
Conversão
```

---

# 18. INDEPENDÊNCIA TECNOLÓGICA

O HUVI não poderá depender exclusivamente de um único fornecedor de inteligência artificial.

O HUVI Brain deverá permitir futura compatibilidade com múltiplos provedores.

---

# 19. EVOLUÇÃO DO SISTEMA

Toda evolução futura deverá respeitar esta Constituição.

Caso exista conflito entre implementação e Constituição:

```text
A Constituição prevalece.
```

---

# 20. CLÁUSULA FINAL

O HUVI existe para gerar crescimento comercial sustentável, previsível e mensurável.

Toda decisão arquitetural, operacional ou tecnológica deverá preservar:

- Segurança
- Simplicidade
- Escalabilidade
- Eficiência
- Receita

Fim da Constituição Oficial HUVI.

Versão: 1.1
Status: CONGELADA