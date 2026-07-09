# PRD_HUVI.md

## Product Requirements Document

### HUVI — Hub de Vendas Inteligente

### Versão 1.0

---

# 1. VISÃO DO PRODUTO

HUVI (Hub de Vendas Inteligente) é uma plataforma SaaS multi-tenant projetada para transformar produtos e serviços em oportunidades reais de venda.

A plataforma combina:

* Descoberta de oportunidades
* Inteligência comercial
* Diagnóstico automatizado
* Estratégias de abordagem
* Geração de campanhas
* Comunicação automatizada
* Conversão orientada a receita

O objetivo principal é permitir que pequenos empresários e profissionais independentes gerem crescimento comercial previsível utilizando automação e inteligência artificial de forma controlada.

---

# 2. PÚBLICO-ALVO

## Público Principal

* Pequenas empresas
* Profissionais liberais
* Prestadores de serviços
* Consultores
* Clínicas
* Negócios locais

---

## Perfil

Usuários com pouco tempo para prospecção manual.

Necessitam:

* Encontrar clientes
* Melhorar vendas
* Automatizar abordagens
* Reduzir tarefas operacionais

---

# 3. PROBLEMA

A maioria dos pequenos negócios possui:

* dificuldade para encontrar oportunidades
* prospecção inconsistente
* ausência de processos comerciais
* dependência excessiva de indicação
* baixa previsibilidade de receita

---

# 4. SOLUÇÃO

O HUVI automatiza todo o ciclo:

Descobrir
↓
Analisar
↓
Priorizar
↓
Abordar
↓
Converter
↓
Mensurar

---

# 5. MVP OFICIAL

O MVP deverá entregar:

## Descoberta

* Busca de empresas
* Busca de profissionais

---

## Enriquecimento

* Email
* Telefone
* Website
* Instagram

---

## Diagnóstico

* Presença digital
* Comunicação
* Posicionamento

---

## Estratégia

* Definição de abordagem
* Definição de canal
* Definição da rota de conversão

---

## Campanhas

* WhatsApp
* Email

---

## Comunicação

* Envio automatizado
* Registro das interações

---

## Conversão

* Landing Page
* Checkout Asaas
* Agenda Nexus

---

## Relatórios

* Oportunidades
* Campanhas
* Conversões

---

# 6. FORA DO ESCOPO DO MVP

Não implementar nesta fase:

* CRM completo
* Aplicativo nativo
* LinkedIn
* Facebook Ads
* Google Ads
* Marketplace interno
* Revenda White Label
* Aprendizado avançado entre campanhas

---

# 7. ARQUITETURA FUNCIONAL

Fluxo principal:

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

---

# 8. MÓDULOS DO SISTEMA

## Módulo 1 — Descoberta

Responsável por localizar oportunidades.

Funções:

* Buscar empresas
* Buscar profissionais
* Registrar evidências

---

## Módulo 2 — Enriquecimento

Responsável por complementar dados.

Funções:

* Email
* Telefone
* Website
* Instagram

---

## Módulo 3 — Diagnóstico

Responsável por analisar a oportunidade.

Funções:

* Presença digital
* Comunicação
* Posicionamento

---

## Módulo 4 — Classificação

Responsável por priorizar oportunidades.

Funções:

* Score comercial
* Viabilidade

---

## Módulo 5 — Estratégia

Responsável por definir:

* abordagem
* canal
* oferta
* rota de conversão

---

## Módulo 6 — Campanhas

Responsável por gerar:

* emails
* mensagens WhatsApp
* sequências

---

## Módulo 7 — Comunicação

Responsável por executar envios.

---

## Módulo 8 — Conversão

Responsável por conduzir o lead até:

* checkout
* landing page
* agenda

---

## Módulo 9 — Governança

Responsável por:

* segurança
* auditoria
* custos
* conformidade

---

# 9. DASHBOARD PRINCIPAL

Exibir:

## Indicadores

* Oportunidades Encontradas
* Oportunidades Qualificadas
* Campanhas Ativas
* Conversões
* Receita Gerada

---

## Gráficos

* Oportunidades por período
* Conversões por período
* Receita por período

---

# 10. MENU PRINCIPAL

Dashboard

Oportunidades

Campanhas

Conversões

Ofertas

Fontes

Configurações

---

# 11. TELA DE OPORTUNIDADES

Lista com:

* Empresa
* Contato
* Cidade
* Status
* Score

Filtros:

* Status
* Cidade
* Score

Ações:

* Visualizar
* Diagnosticar
* Gerar Estratégia

---

# 12. TELA DE DIAGNÓSTICO

Exibir:

* Resumo
* Pontos fortes
* Pontos fracos
* Recomendações

---

# 13. TELA DE CAMPANHAS

Exibir:

* Canal
* Status
* Data
* Taxa de resposta

---

# 14. TELA DE CONVERSÕES

Exibir:

* Oportunidade
* Valor Esperado
* Valor Fechado
* Data

---

# 15. CONFIGURAÇÕES

Tenant

Perfil

Oferta

WhatsApp

Email

Integrações

---

# 16. INTEGRAÇÕES OFICIAIS

## MVP

Supabase

n8n

Asaas

Agenda Nexus

Email SMTP

WhatsApp API

---

# 17. MOBILE FIRST

O sistema deverá ser:

* Responsivo
* Mobile First
* Compatível com PWA

---

# 18. SEGURANÇA

Obrigatório:

* Multi-Tenant
* RLS
* Tenant Isolation
* Auditoria
* Soft Delete

Conforme definido na Constituição.

---

# 19. INTELIGÊNCIA ARTIFICIAL

Permitida apenas através do HUVI Brain.

Agentes autorizados:

* Auditor
* Strategist
* Campaign

SDR apenas sob demanda.

---

# 20. CONVERSÃO PADRÃO

Fluxo principal:

Lead
↓
Landing Page
↓
Checkout Asaas
↓
Pagamento
↓
Conversão

---

# 21. CONVERSÃO SECUNDÁRIA

Lead
↓
Agenda Nexus
↓
Reunião
↓
Conversão

---

# 22. CRITÉRIOS DE SUCESSO DO MVP

O HUVI será considerado validado quando permitir:

* Encontrar oportunidades
* Gerar campanhas
* Prospectar automaticamente
* Direcionar para conversão
* Registrar receita

com segurança, baixo custo operacional e experiência simples para o usuário.

---

# 23. STACK OFICIAL

Frontend:
Antigravity

Backend:
Supabase

Automação:
n8n

Pagamentos:
Asaas

Comunicação:
WhatsApp + Email

IA:
Controlada pelo HUVI Brain

---

Versão: 1.0

Status: APROVADA

Documento: PRD_HUVI.md
