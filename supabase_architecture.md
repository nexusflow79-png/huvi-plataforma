# SUPABASE_ARCHITECTURE.md

## Arquitetura Oficial do Banco de Dados HUVI

### Versão 1.0

---

# 1. OBJETIVO

Este documento define a arquitetura oficial de dados do HUVI.

Todos os componentes da plataforma deverão utilizar esta estrutura como fonte única de persistência.

O Supabase é a Fonte Oficial da Verdade do sistema.

---

# 2. PRINCÍPIOS ARQUITETURAIS

## 2.1 Multi-Tenant Obrigatório

Toda entidade operacional deverá possuir:

tenant_id

obrigatório.

---

## 2.2 Isolamento Absoluto

Nenhum tenant poderá acessar dados de outro tenant.

Todo acesso deverá respeitar políticas RLS.

---

## 2.3 Unicidade de Oportunidades

Uma mesma oportunidade não poderá ser duplicada para o mesmo tenant.

---

## 2.4 Soft Delete

Entidades críticas deverão utilizar:

deleted_at

ao invés de remoção física.

---

## 2.5 Auditoria

Operações críticas deverão possuir rastreabilidade.

---

# 3. SCHEMA OFICIAL

Schema:

public

---

# 4. TABELAS PRINCIPAIS

## tenants

Representa cada cliente da plataforma.

Campos:

* id (uuid)
* name
* email
* plan
* status
* created_at
* updated_at

---

## profiles

Usuários pertencentes a um tenant.

Campos:

* id
* tenant_id
* full_name
* email
* role
* status
* created_at

Relacionamento:

profiles.tenant_id → tenants.id

---

# 5. OFERTAS

## offers

Produtos ou serviços promovidos.

Campos:

* id
* tenant_id
* name
* description
* price
* landing_page_url
* checkout_url
* calendar_url
* active
* created_at

---

# 6. FONTES DE DESCOBERTA

## sources

Origem das oportunidades.

Campos:

* id
* tenant_id
* source_type
* source_name
* active
* created_at

Exemplos:

* Instagram
* Google Maps
* Site
* Diretórios

---

# 7. OPORTUNIDADES

## opportunities

Entidade central do sistema.

Campos:

* id

* tenant_id

* source_id

* company_name

* contact_name

* email

* phone

* website

* instagram

* city

* state

* status

* score

* created_at

* updated_at

* deleted_at

---

## Índice de Unicidade

Combinação:

tenant_id
+
email

ou

tenant_id
+
phone

ou

tenant_id
+
website

---

# 8. EVIDÊNCIAS

## opportunity_evidence

Armazena provas coletadas.

Campos:

* id

* tenant_id

* opportunity_id

* evidence_type

* evidence_text

* evidence_url

* created_at

---

# 9. HISTÓRICO

## opportunity_status_history

Campos:

* id

* tenant_id

* opportunity_id

* previous_status

* new_status

* changed_at

* changed_by

---

# 10. DIAGNÓSTICOS

## audits

Resultado do Auditor.

Campos:

* id

* tenant_id

* opportunity_id

* audit_summary

* strengths

* weaknesses

* recommendations

* created_at

---

# 11. CLASSIFICAÇÃO

## scores

Resultado do Scorer.

Campos:

* id

* tenant_id

* opportunity_id

* commercial_score

* viability_score

* justification

* created_at

---

# 12. ESTRATÉGIAS

## strategies

Resultado do Strategist.

Campos:

* id

* tenant_id

* opportunity_id

* approach

* conversion_type

* destination_type

* destination_url

* created_at

Valores permitidos:

conversion_type

* direct_checkout
* appointment
* hybrid

destination_type

* landing_page
* checkout
* calendar
* whatsapp
* external

---

# 13. CAMPANHAS

## campaigns

Resultado do Campaign.

Campos:

* id

* tenant_id

* opportunity_id

* channel

* subject

* message

* status

* created_at

---

# 14. CONVERSAS

## conversations

Campos:

* id

* tenant_id

* opportunity_id

* channel

* status

* created_at

---

## messages

Campos:

* id

* tenant_id

* conversation_id

* sender

* content

* message_type

* created_at

---

# 15. COMUNICAÇÃO

## communication_preferences

Campos:

* id

* tenant_id

* email_enabled

* whatsapp_enabled

* quiet_hours

* created_at

---

# 16. CONVERSÕES

## conversions

Campos:

* id

* tenant_id

* opportunity_id

* conversion_type

* expected_value

* closed_value

* conversion_date

* notes

* created_at

---

# 17. EXECUÇÕES DOS AGENTES

## agent_executions

Campos:

* id

* tenant_id

* agent_name

* entity_type

* entity_id

* execution_status

* started_at

* finished_at

* execution_log

---

# 18. AUDITORIA

## audit_logs

Campos:

* id

* tenant_id

* action

* entity_type

* entity_id

* user_id

* created_at

---

# 19. RELACIONAMENTOS PRINCIPAIS

tenants
↓
profiles

tenants
↓
offers

tenants
↓
sources

sources
↓
opportunities

opportunities
↓
audits

opportunities
↓
scores

opportunities
↓
strategies

opportunities
↓
campaigns

opportunities
↓
conversations

conversations
↓
messages

opportunities
↓
conversions

---

# 20. POLÍTICAS DE RLS

Obrigatórias para:

* profiles
* offers
* sources
* opportunities
* audits
* scores
* strategies
* campaigns
* conversations
* messages
* conversions
* audit_logs

Regra:

Usuário somente acessa registros cujo:

tenant_id

seja igual ao tenant do JWT autenticado.

---

# 21. REGRA DE NÃO CONTAMINAÇÃO

Nenhum agente poderá:

* ler
* analisar
* utilizar
* compartilhar

dados pertencentes a outro tenant.

---

# 22. FONTE DA VERDADE

Nenhum agente poderá manter estado persistente fora do Supabase.

Toda informação operacional deverá ser registrada nesta arquitetura.

---

Versão: 1.0
Status: APROVADA
Documento: SUPABASE_ARCHITECTURE.md
