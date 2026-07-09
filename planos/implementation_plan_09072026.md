# Plano de Implementação Revisado — Deploy do Ecossistema HUVI
### Data: 09/07/2026 | Versão: 2.0

---

## Objetivo

Preparar e executar o deploy completo do HUVI (Hub de Vendas Inteligente) com a seguinte distribuição:

| Camada | Serviço | O que hospeda |
|--------|---------|--------------|
| Código-fonte | **GitHub** (repo privado) | Todo o projeto versionado |
| Frontend Tenant + Superadmin | **Vercel** | HTML/CSS/JS estático + Serverless Functions |
| Backend / Automações | **Easypanel (Hostinger VPS)** | n8n (workflows, webhooks) |
| Banco de Dados + Auth + Edge Functions | **Supabase Cloud** | Mantido como está (fonte oficial de verdade) |

---

## Perguntas em Aberto (Necessitam Resposta Antes da Execução)

1. **Domínio**: Qual domínio/subdomínio será utilizado para o frontend na Vercel? (ex: `huvi.app.br`, `app.huvi.com.br`)
2. **Domínio n8n**: Qual subdomínio para o n8n no Easypanel? (ex: `n8n.huvi.app.br`)
3. **Repositório GitHub**: Você já possui um repositório criado ou devo incluir os comandos para criar um novo?
4. **VPS Hostinger**: O VPS já está contratado e acessível via SSH?

---

## Visão Geral das Fases

```
Fase 1 (Segurança & Refatoração)
    ↓
Fase 2 (Infra Vercel / Serverless)
    ↓
Fase 3 (Backend n8n / Easypanel) — pode ser paralelo com Fase 1-2
    ↓
Fase 4 (GitHub & CI/CD)
    ↓
Fase 5 (Deploy & Validação)
```

---

# Fase 1 — Segurança & Refatoração de Código

**Objetivo**: Eliminar vulnerabilidades e preparar o código para rodar em ambiente de produção.

---

### 1.1 Remover chamadas diretas ao n8n no frontend

**[MODIFY] frontend/js/offer.js**

Problema: Linha 120 faz fetch direto a `https://n8n.nexus-flow.tech/webhook/huvi-conversion` do browser do visitante, sem autenticação.

Solução: Como offer.js é uma página pública (landing page), a chamada de conversão deve passar por uma Edge Function dedicada no Supabase que não exige autenticação de tenant, mas valida o tenant_id por existência.

- Criar nova target CONVERSION no proxy huvi-n8n-proxy OU criar uma nova Edge Function `huvi-conversion-webhook` pública
- Substituir o fetch direto pela chamada à Edge Function

**[MODIFY] frontend/js/conversations.js**

Problema: Linha 278 declara a URL do n8n diretamente (variável evolutionUrl sem uso direto, mas exposta). Na prática, as linhas 285-300 já usam o proxy corretamente via HUVI_CONFIG.N8N_PROXY.

Solução: Remover a variável evolutionUrl morta (linha 278) para não expor a URL.

---

### 1.2 Centralizar URLs do n8n em variáveis de ambiente

**[MODIFY] supabase/functions/huvi-n8n-proxy/index.ts**

Problema: Linhas 16-18 possuem URLs hardcoded dos webhooks do n8n.

Solução: Ler as URLs de variáveis de ambiente do Supabase:

```typescript
// ANTES (hardcoded):
const N8N_TARGETS: Record<string, string> = {
  PIPELINE: "https://n8n.nexus-flow.tech/webhook/huvi-opportunity-pipeline",
  ...
};

// DEPOIS (variáveis de ambiente):
const N8N_BASE_URL = Deno.env.get("N8N_BASE_URL") ?? "https://n8n.nexus-flow.tech";
const N8N_TARGETS: Record<string, string> = {
  PIPELINE: `${N8N_BASE_URL}/webhook/huvi-opportunity-pipeline`,
  DISPATCHER: `${N8N_BASE_URL}/webhook/huvi-dispatcher`,
  WHATSAPP_CONNECT: `${N8N_BASE_URL}/webhook/huvi-whatsapp-connect`,
  CONVERSION: `${N8N_BASE_URL}/webhook/huvi-conversion`,
};
```

Configurar no Supabase Dashboard: Settings > Edge Functions > Secrets → adicionar N8N_BASE_URL.

---

### 1.3 Restringir CORS da Edge Function

**[MODIFY] supabase/functions/huvi-n8n-proxy/index.ts**

```typescript
// ANTES:
"Access-Control-Allow-Origin": "*",

// DEPOIS:
"Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "https://huvi.app.br",
```

Configurar ALLOWED_ORIGIN nos secrets do Supabase.

---

### 1.4 Atualizar Content-Security-Policy do index.html

**[MODIFY] frontend/index.html**

Problema: A CSP na linha 20 lista explicitamente `https://n8n.nexus-flow.tech` no connect-src, permitindo que o browser faça chamadas diretas ao n8n.

Solução: Remover o domínio do n8n da CSP. O frontend só precisa se comunicar com *.supabase.co (as Edge Functions fazem o proxy).

```diff
-connect-src 'self' https://*.supabase.co https://n8n.nexus-flow.tech https://evo.nexus-flow.tech https://api.outscraper.com ...
+connect-src 'self' https://*.supabase.co https://api.outscraper.com ...
```

---

### 1.5 Remover credenciais expostas do admin-config.js

**[MODIFY] frontend/admin/js/admin-config.js**

Problema: ADMIN_USERNAME e ADMIN_PASSWORD_HASH estão no JavaScript do browser.

Solução: Remover essas linhas do config. A autenticação passará a ser feita 100% server-side na Fase 2.

```diff
 const ADMIN_CONFIG = {
   SUPABASE_URL: 'https://nxejocnhtpztjejpovzd.supabase.co',
-  ADMIN_USERNAME: 'superadmin',
-  ADMIN_PASSWORD_HASH: 'f6c21add2e12c84c97e72afd3d1fa8035155cf190cc3537be2838db617eba93a',
   // ... resto permanece
 };
```

---

# Fase 2 — Infraestrutura Vercel (Serverless Functions + Config)

**Objetivo**: Criar os arquivos necessários para que a Vercel hospede o frontend E as API routes que o Superadmin precisa.

---

### 2.1 Criar vercel.json

**[NEW] frontend/vercel.json**

```json
{
  "rewrites": [
    { "source": "/admin", "destination": "/admin/index.html" },
    { "source": "/admin/", "destination": "/admin/index.html" },
    { "source": "/offer", "destination": "/offer.html" },
    { "source": "/manual", "destination": "/manual.html" }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store, no-cache" },
        { "key": "X-Content-Type-Options", "value": "nosniff" }
      ]
    },
    {
      "source": "/admin/(.*)",
      "headers": [
        { "key": "X-Robots-Tag", "value": "noindex, nofollow" }
      ]
    }
  ]
}
```

---

### 2.2 Criar package.json mínimo

**[NEW] frontend/package.json**

```json
{
  "name": "huvi-frontend",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0"
  }
}
```

A Vercel instala as dependências automaticamente antes de executar as serverless functions. Não precisa de build script porque o frontend é estático.

---

### 2.3 Criar Serverless Function: Autenticação do Superadmin

**[NEW] frontend/api/admin-auth.js**

Responsabilidades:
- Receber { username, password } via POST
- Validar contra variáveis de ambiente ADMIN_USERNAME e ADMIN_PASSWORD_HASH (configuradas no Vercel Dashboard, nunca no código)
- Retornar um JWT token simples assinado com ADMIN_JWT_SECRET
- O token será usado nas chamadas subsequentes ao proxy Supabase

Variáveis de ambiente no Vercel:
- ADMIN_USERNAME
- ADMIN_PASSWORD_HASH (SHA-256 com salt)
- ADMIN_JWT_SECRET

---

### 2.4 Criar Serverless Function: Config check

**[NEW] frontend/api/admin-config.js**

```javascript
export default function handler(req, res) {
  res.json({ hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY });
}
```

Variáveis de ambiente no Vercel:
- SUPABASE_SERVICE_ROLE_KEY

---

### 2.5 Criar Serverless Function: Proxy Supabase do Admin

**[NEW] frontend/api/admin-supabase.js**

Responsabilidades:
- Receber requisições do AdminProxyQueryBuilder (tabela, operação, filtros, payload)
- Validar o JWT token do admin no header Authorization
- Executar a operação no Supabase usando a SUPABASE_SERVICE_ROLE_KEY (server-side, seguro)
- Retornar o resultado

Variáveis de ambiente no Vercel:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- ADMIN_JWT_SECRET (para validar o token)

---

### 2.6 Atualizar admin-auth.js do frontend (fallback)

**[MODIFY] frontend/admin/js/admin-auth.js**

Remover o fallback client-side (linhas 31-38) que valida credenciais no browser. Se a API /api/admin-auth falhar, deve retornar erro — não tentar validar localmente.

```diff
   } catch {}
-  const savedUser = AdminSafeStorage.get('huvi_admin_custom_username') || ADMIN_CONFIG.ADMIN_USERNAME;
-  const savedHash = AdminSafeStorage.get('huvi_admin_custom_password_hash') || ADMIN_CONFIG.ADMIN_PASSWORD_HASH;
-  const inputHash = await sha256(password);
-  if (username === savedUser && inputHash === savedHash) {
-    AdminSafeStorage.set('huvi_admin_session', 'active');
-    AdminSafeStorage.set('huvi_admin_session_token', password);
-    return { success: true };
-  }
+  // Sem fallback client-side. Autenticação é 100% server-side.
   return { success: false, message: 'Credenciais inválidas' };
```

---

# Fase 3 — Backend n8n no Easypanel (Hostinger VPS)

**Objetivo**: Instalar e configurar o n8n no VPS da Hostinger via Easypanel.

---

### 3.1 Preparação do VPS

1. Acessar o VPS via SSH
2. Instalar o Easypanel:
   ```bash
   curl -sSL https://get.easypanel.io | sh
   ```
3. Acessar o painel web do Easypanel (porta 3000 por padrão)

### 3.2 Criar Projeto n8n no Easypanel

1. No Easypanel: New Project → nome: huvi-backend
2. Add Service → App → Template: n8n
3. Configurar variáveis de ambiente:

| Variável | Valor |
|----------|-------|
| N8N_BASIC_AUTH_ACTIVE | true |
| N8N_BASIC_AUTH_USER | (definir) |
| N8N_BASIC_AUTH_PASSWORD | (definir) |
| N8N_HOST | n8n.seudominio.com.br |
| N8N_PROTOCOL | https |
| N8N_PORT | 5678 |
| WEBHOOK_URL | https://n8n.seudominio.com.br/ |
| N8N_ENCRYPTION_KEY | (gerar chave aleatória) |
| DB_TYPE | sqlite (ou postgresdb se usar Postgres no VPS) |

### 3.3 Configurar Domínio e SSL

1. No Easypanel: Domains → adicionar n8n.seudominio.com.br
2. No provedor DNS: criar registro A apontando n8n.seudominio.com.br → IP do VPS
3. Ativar SSL automático (Let's Encrypt) no Easypanel

### 3.4 Migrar Workflows

1. Na instância atual do n8n (n8n.nexus-flow.tech): Settings → Export All Workflows
2. Na nova instância: Settings → Import Workflows
3. Reconfigurar credenciais em cada workflow:
   - Supabase (URL e Service Role Key)
   - Outscraper API Key
   - Evolution API (se aplicável)

### 3.5 Atualizar variável no Supabase

Após confirmar que o n8n novo está operante:
- No Supabase Dashboard: atualizar o secret N8N_BASE_URL para https://n8n.seudominio.com.br

---

# Fase 4 — Repositório GitHub e CI/CD

**Objetivo**: Versionar o código e conectar com deploy automático na Vercel.

---

### 4.1 Reforçar .gitignore

**[MODIFY] .gitignore**

Adicionar:
```
# Dev Only
frontend/simple_server.ps1
validate_json.py
frontend/leads_teste.csv
frontend/debug-supabase.html
frontend/index_recuperado*.html

# Docs internos (não fazem parte do produto)
*.docx
```

---

### 4.2 Inicializar repositório

```bash
cd c:\PROJETOS_ANTIGRAVITY\huvi_hub-de-vendas-inteligente
git init
git remote add origin https://github.com/SEU_USUARIO/huvi-hub-de-vendas-inteligente.git
git add .
git commit -m "feat: initial commit - HUVI ecosystem"
git branch -M main
git push -u origin main
```

---

### 4.3 Conectar à Vercel

1. Acessar vercel.com → New Project → Import Git Repository
2. Selecionar o repositório huvi-hub-de-vendas-inteligente
3. Configurar:
   - Root Directory: frontend
   - Framework Preset: Other (sem framework)
   - Build Command: (vazio — não tem build)
   - Output Directory: . (serve a raiz do frontend/)
4. Adicionar variáveis de ambiente:

| Variável | Valor |
|----------|-------|
| SUPABASE_URL | https://nxejocnhtpztjejpovzd.supabase.co |
| SUPABASE_SERVICE_ROLE_KEY | (sua service role key — nunca commitar) |
| ADMIN_USERNAME | superadmin (ou o que preferir) |
| ADMIN_PASSWORD_HASH | (hash SHA-256 com salt da senha escolhida) |
| ADMIN_JWT_SECRET | (gerar string aleatória de 64 caracteres) |

5. Deploy → o primeiro deploy será automático
6. Configurar domínio customizado nas settings do projeto Vercel

---

# Fase 5 — Deploy Final e Validação

**Objetivo**: Verificar que tudo funciona corretamente em produção.

---

### 5.1 Checklist de Validação

| # | Teste | Como validar | Status esperado |
|---|-------|-------------|-----------------|
| 1 | Frontend Tenant carrega | Acessar https://seudominio.com.br | Tela de login aparece |
| 2 | Login funciona | Fazer login com credenciais do Supabase | Dashboard carrega com dados reais |
| 3 | Superadmin carrega | Acessar https://seudominio.com.br/admin | Tela de login do admin aparece |
| 4 | Superadmin autentica | Fazer login com credenciais definidas na Vercel | Dashboard admin carrega (sem badge MOCK) |
| 5 | Superadmin lê dados reais | Verificar lista de tenants | Mostra tenants reais do Supabase |
| 6 | n8n operante | Acessar https://n8n.seudominio.com.br | Painel do n8n com login |
| 7 | Webhook funciona | Disparar uma descoberta/pipeline pelo HUVI | n8n recebe e processa |
| 8 | Edge Function proxy | Verificar logs no Supabase Dashboard | Requisições chegam com N8N_BASE_URL correto |
| 9 | CSP não bloqueia | Abrir DevTools > Console no frontend | Zero erros de CSP |
| 10 | GitHub atualizado | Verificar repositório | Sem arquivos sensíveis (.env, service keys) |

### 5.2 Teste de Segurança Pós-Deploy

- [ ] Tentar acessar /api/admin-supabase sem token → deve retornar 401
- [ ] Verificar que SUPABASE_SERVICE_ROLE_KEY não aparece em nenhum JS do browser (DevTools > Sources)
- [ ] Verificar que hash de senha do admin não aparece no JavaScript (DevTools > Sources)
- [ ] Confirmar que chamadas diretas ao n8n pelo browser são bloqueadas pela CSP

---

## Resumo de Todos os Arquivos Afetados

### Arquivos Novos
| Arquivo | Fase | Descrição |
|---------|------|-----------|
| frontend/vercel.json | 2 | Configuração de rewrites e headers da Vercel |
| frontend/package.json | 2 | Dependências para serverless functions |
| frontend/api/admin-auth.js | 2 | Autenticação server-side do superadmin |
| frontend/api/admin-config.js | 2 | Health check do proxy admin |
| frontend/api/admin-supabase.js | 2 | Proxy Supabase com service role key |

### Arquivos Modificados
| Arquivo | Fase | O que muda |
|---------|------|-----------|
| frontend/js/offer.js | 1 | Remove chamada direta ao n8n |
| frontend/js/conversations.js | 1 | Remove variável evolutionUrl morta |
| supabase/functions/huvi-n8n-proxy/index.ts | 1 | URLs do n8n via env vars + CORS restrito |
| frontend/index.html | 1 | CSP atualizada (remove domínio n8n) |
| frontend/admin/js/admin-config.js | 1 | Remove credenciais expostas |
| frontend/admin/js/admin-auth.js | 2 | Remove fallback de auth client-side |
| .gitignore | 4 | Adiciona exclusões de arquivos de dev |

### Variáveis de Ambiente a Configurar
| Onde | Variável | Descrição |
|------|----------|-----------|
| Supabase (Edge Functions Secrets) | N8N_BASE_URL | URL base do novo n8n |
| Supabase (Edge Functions Secrets) | ALLOWED_ORIGIN | Domínio do frontend em produção |
| Vercel (Environment Variables) | SUPABASE_URL | URL do projeto Supabase |
| Vercel (Environment Variables) | SUPABASE_SERVICE_ROLE_KEY | Chave service role (secreta) |
| Vercel (Environment Variables) | ADMIN_USERNAME | Usuário do superadmin |
| Vercel (Environment Variables) | ADMIN_PASSWORD_HASH | Hash da senha com salt |
| Vercel (Environment Variables) | ADMIN_JWT_SECRET | Segredo para assinar tokens JWT |

---

## Ordem de Execução Recomendada

Execute as fases na ordem indicada. A Fase 1 é pré-requisito para todas as outras.

1. Fase 1 → Testar localmente (servidor PS1 deve continuar funcionando)
2. Fase 2 → Testar localmente com vercel dev (se disponível) ou validar a lógica das functions isoladamente
3. Fase 4 → Push para GitHub (o deploy na Vercel será automático se já estiver conectado)
4. Fase 3 → Pode ser feita em paralelo com as fases 1 e 2 (não tem dependência de código)
5. Fase 5 → Validação final após tudo estar no ar
