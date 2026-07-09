# Filosofia da Oferta — HUVI

## Princípio Fundamental

**A oferta é o gatilho de todo o ecossistema.** Nada existe sem ela.

Diferente de abordagens tradicionais onde a prospecção é genérica ("vamos encontrar leads"), no HUVI a prospecção é direcionada por uma oferta concreta. A oferta define:

- **O que** será vendido (produto/serviço)
- **Para quem** (segmento de mercado)
- **Como** será vendido (checkout direto, reunião, híbrido)
- **Por quanto** (preço, proposta de valor)
- **Por onde** (WhatsApp, e-mail, landing page)

## Hierarquia do Ecossistema

```
                ┌──────────────────┐
                │     OFERTA       │ ◄── GATILHO
                │  (produto/serv.) │
                └────────┬─────────┘
                         │
                         ▼
                ┌──────────────────┐
                │     FONTE        │ ◄── segmento da oferta define onde buscar
                │  (ex: Google     │
                │   Maps,          │
                │   LinkedIn,      │
                │   diretórios)    │
                └────────┬─────────┘
                         │
                         ▼
                ┌──────────────────┐
                │   DESCOBERTA     │ ◄── busca empresas no segmento da oferta
                │  (Outscraper,    │
                │   Edge Function, │
                │   scraping)      │
                └────────┬─────────┘
                         │
                         ▼
                ┌──────────────────┐
                │  OPORTUNIDADE    │ ◄── empresa real, dados coletados
                │  (company_name,  │
                │   website, phone,│
                │   rating, city)  │
                └────────┬─────────┘
                         │
                         ▼
                ┌──────────────────┐
                │   CAMPANHA       │ ◄── copy inspirada na oferta +
                │  (messages_matrix│     personalizada com dados da
                │   channel,       │     oportunidade
                │   subject,       │
                │   message)       │
                └────────┬─────────┘
                         │
                         ▼
                ┌──────────────────┐
                │   CONVERSÃO      │ ◄── venda realizada
                │  (checkout,      │
                │   reunião,       │
                │   híbrido)       │
                └──────────────────┘
```

## Fluxo de Dados: Oferta → Copy

### 1. Oferta — O que é vendido

A oferta carrega os seguintes campos que alimentam todo o pipeline:

| Campo | Uso na copy | Obrigatório? |
|---|---|---|
| `name` | Nome do produto/serviço no pitch | Sim |
| `description` | Proposta de valor central da copy | Recomendado |
| `price` | Complemento da proposta de valor | Opcional |
| `checkout_url` | CTA direta na mensagem de follow-up | Se houver |
| `calendar_url` | CTA de agendamento na mensagem de follow-up | Se houver |
| `landing_page_url` | Destino alternativo | Opcional |

### 2. Oportunidade — Para quem

A oportunidade fornece o contexto que personaliza a copy:

| Campo | Uso na copy |
|---|---|
| `company_name` | Nome da empresa-alvo (personalização) |
| `segment` / `category` | Define o gancho setorial (ver template engine) |
| `website` | Se existir, menciona presença digital |
| `rating_value` | Se >= 4.0, adiciona reputação como gancho |
| `city` / `state` | Contexto geográfico |
| `contact_name` | Personalização adicional (se disponível) |

## Template Engine — Copy Personalizada

A copy é gerada por um template engine que combina **dados da oferta + dados da oportunidade**, seguindo esta hierarquia:

### 1. Proposta de Valor (vem da oferta)

```
valueProp = offer.description
         ?? offer.name + " — " + offer.price
         ?? offer.name
         ?? fallback genérico
```

A proposta de valor SEMPRE reflete a oferta. Se a descrição existe, ela é usada. Se há preço, ele complementa. O fallback nunca inventa características que a oferta não tem.

### 2. Gancho Setorial (vem do segmento da oportunidade)

O `segment` (ou `category`) da oportunidade define o **gancho emocional/racional** da abordagem:

| Segmento | Gancho | Tom |
|---|---|---|
| Academia / Fitness / Esporte | "atrair mais alunos e fidelizar" | Resultado |
| Clínica / Médico / Saúde / Dentista | "captar mais pacientes" | Consulta |
| Restaurante / Bar / Comércio | "aumentar o movimento" | Vendas |
| Oficina / Mecânico / Automotivo | "atrair mais serviços" | Serviço |
| Advocacia / Consultoria / Escritório | "captar mais clientes" | Profissional |
| Escola / Educação | "atrair mais alunos" | Crescimento |
| **Fallback genérico** | "crescer e captar mais clientes" | Genérico |

### 3. Complementos Contextuais (vem da oportunidade)

Os complementos são adicionados condicionalmente — **nunca se inventa o que não existe**:

- `website` presente → "incluindo a presença digital"
- `rating >= 4.0` → "e a boa reputação"
- `city + state` presente → "na região de {city}/{state}"

### 4. Call to Action (vem da oferta)

O CTA varia conforme os recursos disponíveis na oferta:

- `checkout_url` presente → "Confira: {checkout_url}"
- `calendar_url` presente → "Reserve aqui: {calendar_url}"
- Nenhum dos dois → "Podemos conversar?" (pede resposta)

## Cadência de 3 Mensagens

Toda copy gera 3 mensagens com tom progressivo:

| Passo | Delay | Tom | Conteúdo |
|---|---|---|---|
| 1 | Dia 0 | Amigável | Apresentação + proposta de valor + CTA |
| 2 | Dia 3 | Reforço | Reitera valor, pergunta se viu, CTA direto (checkout/calendário) |
| 3 | Dia 7 | Urgência | Último contato, senso de urgência moderado |

## LLM vs Fallback: Duas Fontes, Mesma Filosofia

Independente da fonte (LLM via huvi-brain ou template engine), a copy segue a mesma filosofia:

1. **LLM** recebe no prompt: `offer.name`, `offer.description`, `offer.price`, `audit_summary`, `approach`, `conversion_type`, `company_name`
2. **Fallback** recebe os mesmos dados via template engine

Ambos produzem copy oferta-first. A diferença é que o LLM pode usar criatividade; o fallback usa regras determinísticas. Nenhum dos dois inventa dados que não existem.

## Implementando Novas Fontes

Ao adicionar uma nova fonte de pesquisa (ex: LinkedIn, diretórios, CRM):

### Checklist de Integração

1. **Mapear campos da fonte** para a tabela `opportunities`
   - `company_name` (obrigatório)
   - `segment` ou `category` (necessário para o gancho)
   - `city` / `state` (contexto geográfico)
   - `website` (complemento opcional)
   - `phone` (contato)
   - `rating_value` / `rating_count` (reputação)

2. **Validar que a oferta existe** antes de iniciar prospecção
   - Sem oferta ativa, o pipeline não deve ser executado
   - A oferta define o segmento a ser buscado

3. **Template engine** já suporta quaisquer segmentos via fallback genérico
   - Novos segmentos específicos podem ser adicionados no `CampaignFallback`
   - O fallback genérico cobre qualquer segmento não mapeado

4. **Testar o fluxo completo**:
   - Oferta → Fonte → Descoberta → Oportunidade → Campanha → Conversão
   - Validar que a copy reflete a oferta, não a fonte

### Exemplo: Nova Fonte "LinkedIn"

```
Oferta: "Consultoria de Vendas" (segmento: tecnologia)
  ↓
Fonte: LinkedIn (busca por empresas de tecnologia)
  ↓
Descoberta: encontra "TechX Ltda" em São Paulo/SP
  ↓
Oportunidade: { company_name: "TechX Ltda", segment: "tecnologia",
                city: "São Paulo", state: "SP", website: "techx.com.br" }
  ↓
Campanha (fallback):
  "Olá! Oferecemos Consultoria de Vendas para ajudar a TechX Ltda
   a captar mais clientes, incluindo a presença digital.
   Atuamos na região de São Paulo/SP. <proposta de valor>."
```

## Regras de Ouro

1. **A oferta é a gênese.** Sem oferta ativa, não há pipeline.
2. **Nunca se inventa o que não existe.** Se a oportunidade não tem website, não fale sobre site. Se não tem rating, não fale sobre reputação.
3. **O segmento dita o gancho, não o pitch.** O pitch (proposta de valor) sempre vem da oferta. O gancho varia por segmento.
4. **A fonte é irrelevante para a copy.** A copy deve ser a mesma independente de a oportunidade ter vindo do Google Maps, LinkedIn ou diretório. O que muda é o contexto (nome, local, segmento).
5. **Toda copy tem 3 mensagens.** Cadência completa com tom progressivo. A última mensagem SEMPRE sinaliza que é o último contato.
