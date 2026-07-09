/**
 * HUVI — Console Superadmin
 * Configuração
 */
const ADMIN_CONFIG = {
  // ── Supabase (Service Role Key — NUNCA expor no frontend do tenant) ──
  SUPABASE_URL: 'https://nxejocnhtpztjejpovzd.supabase.co',
  // A chave service_role NÃO está mais aqui. Usamos o proxy server-side (/api/admin-supabase).

  // ── Auth do Superadmin ──
  // A autenticação do superadmin será tratada exclusivamente pela Serverless Function (/api/admin-auth).

  // ── Planos ──
  PLANS: {
    free:    { label: 'Plano Gratuito (R$ 0,00 / mês)', value: 0 },
    start:   { label: 'Plano Start (R$ 49,90 / mês)',   value: 49.90 },
    pro:     { label: 'Plano Pro (R$ 89,90 / mês)',     value: 89.90 },
  },

  // ── Links Asaas ──
  ASAAS_LINK_START: 'https://www.asaas.com/c/v831fziyb1raabkm',
  ASAAS_LINK_PRO:   'https://www.asaas.com/c/huvi-pro',

  // ── Nichos ──
  NICHES: [
    'Barbearia', 'Clínica', 'Personal', 'Consultoria',
    'E-commerce', 'Restaurante', 'Imobiliária', 'Outro'
  ],

  // ── Status ──
  TENANT_STATUS: {
    active:    'Ativo',
    inactive:  'Inativo',
    suspended: 'Suspenso',
  },
};

Object.freeze(ADMIN_CONFIG);
Object.freeze(ADMIN_CONFIG.PLANS);
Object.freeze(ADMIN_CONFIG.TENANT_STATUS);
