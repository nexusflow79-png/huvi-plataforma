/**
 * HUVI — Configuração Geral do Frontend
 */
const HUVI_CONFIG = {
  // Credenciais do Supabase. Mude para as do seu projeto real quando fizer o deploy.
  SUPABASE_URL: 'https://nxejocnhtpztjejpovzd.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54ZWpvY25odHB6dGplanBvdnpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExODYxODksImV4cCI6MjA5Njc2MjE4OX0.eP9Kg66i3MsWGrgoq5S_NRq8j42Zn6sqcItIEoIzjEU', // Troque pelo seu Anon Key do Supabase

  // Webhooks Internos (Via Edge Function segura)
  N8N_PROXY: '/functions/v1/huvi-n8n-proxy',
  N8N_WEBHOOKS_TARGETS: {
    PIPELINE: 'PIPELINE',
    DISPATCHER: 'DISPATCHER',
    WHATSAPP_CONNECT: 'WHATSAPP_CONNECT'
  },

  // Mapeamento amigável para exibição dos tipos de fonte de pesquisa
  SOURCE_TYPES: {
    google_maps: '📍 Google Maps',
    instagram: '📸 Instagram',
    website: '🌐 Website',
    web_search: '🔎 Busca Web',
    directory: '📁 Diretório (Planilha)',
    manual: '✏️ Manual'
  }
};

window.HUVI_CONFIG = HUVI_CONFIG;
