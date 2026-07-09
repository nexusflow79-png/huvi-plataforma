# AGENTS_SPECIFICATION.md

## Especificação Oficial dos Agentes do HUVI

### Versão 1.0

---

# 1. OBJETIVO

Este documento define os agentes oficiais do HUVI, suas responsabilidades, permissões, entradas, saídas e limitações.

Nenhum agente poderá executar funções que não estejam explicitamente previstas neste documento.

---

# 2. PRINCÍPIOS GERAIS

Todos os agentes deverão respeitar:

* Constituição HUVI (gemini.md)
* Segurança Multi-Tenant
* Isolamento de Dados
* Princípio da Receita
* Princípio da Inteligência Progressiva

---

# 3. ARQUITETURA OFICIAL

Fluxo operacional:

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

Agentes transversais:

* Guardian
* HUVI Brain

---

# 4. HUNTER

## Nome de Exibição

Descoberta

---

## Missão

Identificar oportunidades comerciais.

---

## Entradas

* Sources
* Ofertas
* Configurações do Tenant

---

## Saídas

* Opportunities

---

## Pode

* Buscar empresas
* Buscar profissionais
* Coletar informações públicas

---

## Não Pode

* Gerar campanhas
* Conversar com leads
* Utilizar LLM

---

## Consumo de IA

Não permitido.

---

# 5. ENRICHER

## Nome de Exibição

Enriquecimento

---

## Missão

Completar informações das oportunidades.

---

## Entradas

* Opportunities

---

## Saídas

* Dados enriquecidos

---

## Pode

* Localizar emails
* Localizar telefones
* Localizar websites
* Localizar redes sociais

---

## Não Pode

* Classificar oportunidades
* Criar campanhas
* Utilizar LLM

---

## Consumo de IA

Não permitido.

---

# 6. AUDITOR

## Nome de Exibição

Diagnóstico

---

## Missão

Analisar a maturidade comercial da oportunidade.

---

## Entradas

* Opportunity
* Evidências

---

## Saídas

* Audit

---

## Pode

* Avaliar presença digital
* Avaliar posicionamento
* Avaliar comunicação

---

## Não Pode

* Enviar mensagens
* Definir estratégia final

---

## Consumo de IA

Permitido via HUVI Brain.

---

# 7. SCORER

## Nome de Exibição

Classificação

---

## Missão

Priorizar oportunidades.

---

## Entradas

* Opportunity
* Audit

---

## Saídas

* Score

---

## Pode

* Calcular score comercial
* Calcular viabilidade

---

## Não Pode

* Utilizar LLM
* Criar campanhas

---

## Consumo de IA

Não permitido.

---

# 8. STRATEGIST

## Nome de Exibição

Estratégia

---

## Missão

Definir a melhor abordagem comercial.

---

## Entradas

* Opportunity
* Audit
* Score
* Oferta

---

## Saídas

* Strategy

---

## Define

* Abordagem
* Oferta
* Canal
* Rota de Conversão

---

## Não Pode

* Enviar mensagens

---

## Consumo de IA

Permitido via HUVI Brain.

---

# 9. CAMPAIGN

## Nome de Exibição

Campanhas

---

## Missão

Gerar campanhas comerciais.

---

## Entradas

* Strategy

---

## Saídas

* Campaign

---

## Pode

* Criar emails
* Criar mensagens WhatsApp
* Criar sequências

---

## Não Pode

* Enviar mensagens

---

## Consumo de IA

Permitido via HUVI Brain.

---

# 10. DISPATCHER

## Nome de Exibição

Comunicação

---

## Missão

Executar envios.

---

## Entradas

* Campaign

---

## Saídas

* Mensagens enviadas

---

## Pode

* Enviar email
* Enviar WhatsApp
* Registrar entregas

---

## Não Pode

* Criar conteúdo
* Utilizar LLM

---

## Consumo de IA

Não permitido.

---

# 11. SDR

## Nome de Exibição

Conversão

---

## Missão

Conduzir oportunidades até a conversão.

---

## Estrutura Obrigatória

Nível 1

Regras

---

Nível 2

Templates

---

Nível 3

Motor de Decisão

---

Nível 4

IA Sob Demanda

---

## Entradas

* Mensagens recebidas
* Estratégia
* Conversas

---

## Saídas

* Respostas
* Conversões

---

## Pode

* Responder leads
* Conduzir objeções
* Encaminhar para checkout
* Encaminhar para agenda

---

## Não Pode

* Alterar estratégia
* Alterar campanhas

---

## Consumo de IA

Permitido somente quando:

* confiança inferior ao limite definido
* pergunta fora do contexto
* negociação complexa

Sempre via HUVI Brain.

---

# 12. GUARDIAN

## Nome de Exibição

Governança

---

## Missão

Garantir conformidade do sistema.

---

## Atua de Forma Transversal

Não participa do fluxo operacional.

---

## Responsabilidades

* Segurança
* RLS
* Tenant Isolation
* Auditoria
* Custos
* Logs

---

## Pode

* Bloquear operações inválidas
* Registrar incidentes
* Emitir alertas

---

## Não Pode

* Criar campanhas
* Alterar estratégias
* Conversar com leads

---

## Consumo de IA

Não permitido.

---

# 13. HUVI BRAIN

## Nome de Exibição

HUVI Brain

---

## Missão

Governar toda utilização de inteligência artificial.

---

## Responsabilidades

* Seleção de modelos
* Controle de contexto
* Cache inteligente
* Controle de custos
* Orquestração de IA

---

## Regra Constitucional

Nenhum agente poderá acessar diretamente uma LLM.

Fluxo obrigatório:

Agente
↓
HUVI Brain
↓
LLM
↓
HUVI Brain
↓
Agente

---

## Pode

* Selecionar modelo
* Reutilizar contexto
* Cachear respostas

---

## Não Pode

* Persistir dados fora do Supabase
* Ignorar regras constitucionais

---

# 14. MATRIZ DE IA

Hunter

IA: NÃO

---

Enricher

IA: NÃO

---

Auditor

IA: SIM

---

Scorer

IA: NÃO

---

Strategist

IA: SIM

---

Campaign

IA: SIM

---

Dispatcher

IA: NÃO

---

SDR

IA: SOB DEMANDA

---

Guardian

IA: NÃO

---

HUVI Brain

IA: ORQUESTRADOR

---

# 15. MATRIZ DE RESPONSABILIDADE

Descoberta
→ Hunter

Enriquecimento
→ Enricher

Diagnóstico
→ Auditor

Classificação
→ Scorer

Estratégia
→ Strategist

Campanhas
→ Campaign

Comunicação
→ Dispatcher

Conversão
→ SDR

Governança
→ Guardian

Inteligência Artificial
→ HUVI Brain

---

Versão: 1.0

Status: APROVADA

Documento: AGENTS_SPECIFICATION.md
