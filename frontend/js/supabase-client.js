/**
 * HUVI — Supabase Client & Mock Mode Orquestrador
 * Inicializa o cliente Supabase oficial ou ativa o modo offline/mockado
 * caso as credenciais em config.js sejam os placeholders originais.
 */

// Abstração resiliente para armazenamento de dados
const SafeStorage = {
  memoryDb: {},
  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('[HUVI] LocalStorage bloqueado ou indisponível. Usando armazenamento em memória temporária para: ' + key);
      return this.memoryDb[key] || null;
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('[HUVI] LocalStorage bloqueado ou indisponível. Salvando em memória temporária para: ' + key);
      this.memoryDb[key] = value;
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      delete this.memoryDb[key];
    }
  }
};

let isMockMode = false;

// Verificar se as credenciais configuradas são placeholders
const isPlaceholderUrl = HUVI_CONFIG.SUPABASE_URL.includes('SEU_PROJETO') || !HUVI_CONFIG.SUPABASE_URL.startsWith('http');
const isPlaceholderKey = HUVI_CONFIG.SUPABASE_ANON_KEY.includes('SUA_ANON_KEY') || HUVI_CONFIG.SUPABASE_ANON_KEY.length < 20;

if (isPlaceholderUrl || isPlaceholderKey) {
  isMockMode = true;
  console.log('%c[HUVI] Servidor Supabase não configurado. Ativando MOCK MODE (Modo de Simulação Local)', 'color: #f47001; font-weight: bold; font-size: 12px;');
  
  // Adicionar badge no topo indicando modo de simulação
  window.addEventListener('DOMContentLoaded', () => {
    const badge = document.createElement('div');
    badge.id = 'mock-mode-badge';
    badge.style.position = 'fixed';
    badge.style.bottom = '16px';
    badge.style.right = '16px';
    badge.style.background = 'rgba(244, 112, 1, 0.9)';
    badge.style.color = '#fff';
    badge.style.padding = '8px 12px';
    badge.style.borderRadius = '20px';
    badge.style.fontSize = '12px';
    badge.style.fontWeight = 'bold';
    badge.style.zIndex = '9999';
    badge.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    badge.style.backdropFilter = 'blur(4px)';
    badge.style.border = '1px solid rgba(255,255,255,0.1)';
    badge.innerHTML = '⚡ Modo Simulação Local';
    document.body.appendChild(badge);
  });
}

// Declarar variável supabase globalmente usando var para garantir propagação correta no objeto window
var supabase;

// ────────────────────────────────────────────────────────────
// MOCK DATABASE & AUTH IMPLEMENTATION (Safe Storage)
// ────────────────────────────────────────────────────────────

if (isMockMode) {
  // Inicializar dados mockados no SafeStorage se não existirem
  const initMockData = () => {
    const tenantId = '11111111-1111-1111-1111-111111111111';
    
    // 1. Tenants
    if (!SafeStorage.getItem('huvi_mock_tenants')) {
      SafeStorage.setItem('huvi_mock_tenants', JSON.stringify([
        {
          id: tenantId,
          name: 'HUVI Corp Inc',
          email: 'admin@huvi.com.br',
          plan: 'premium',
          status: 'active',
          created_at: new Date().toISOString()
        }
      ]));
    }

    // 2. Profiles
    if (!SafeStorage.getItem('huvi_mock_profiles')) {
      SafeStorage.setItem('huvi_mock_profiles', JSON.stringify([
        {
          id: '22222222-2222-2222-2222-222222222222',
          tenant_id: tenantId,
          auth_user_id: '33333333-3333-3333-3333-333333333333',
          full_name: 'Hamilton Viana',
          email: 'admin@huvi.com.br',
          role: 'owner',
          status: 'active',
          created_at: new Date().toISOString()
        }
      ]));
    }

    // 3. Offers
    if (!SafeStorage.getItem('huvi_mock_offers')) {
      SafeStorage.setItem('huvi_mock_offers', JSON.stringify([
        {
          id: 'offer-1',
          tenant_id: tenantId,
          name: 'Consultoria de Vendas Inteligente',
          description: 'Consultoria estratégica para alavancar vendas e automatizar processos.',
          price: 1500.00,
          landing_page_url: 'https://seusite.com/consultoria',
          checkout_url: 'https://checkout.asaas.com/consultoria',
          calendar_url: 'https://evo2.nexus-flow.tech/consultoria',
          active: true,
          created_at: new Date().toISOString()
        },
        {
          id: 'offer-2',
          tenant_id: tenantId,
          name: 'SaaS HUVI Assinatura Mensal',
          description: 'Acesso completo à plataforma de automação comercial e inteligência.',
          price: 297.00,
          landing_page_url: 'https://seusite.com/saas',
          checkout_url: 'https://checkout.asaas.com/saas',
          calendar_url: null,
          active: true,
          created_at: new Date().toISOString()
        }
      ]));
    }

    // 4. Sources
    if (!SafeStorage.getItem('huvi_mock_sources')) {
      SafeStorage.setItem('huvi_mock_sources', JSON.stringify([
        { id: 'src-1', tenant_id: tenantId, source_type: 'google_maps', source_name: 'Clínicas Médicas', city: 'São Paulo', state: 'SP', active: true, created_at: new Date().toISOString() },
        { id: 'src-2', tenant_id: tenantId, source_type: 'instagram', source_name: 'Seguidores Concorrentes', active: true, created_at: new Date().toISOString() },
        { id: 'src-3', tenant_id: tenantId, source_type: 'website', source_name: 'Formulário Site Principal', active: true, created_at: new Date().toISOString() }
      ]));
    }

    // 5. Opportunities (com datas dos últimos 7 dias para carregar o Dashboard)
    if (!SafeStorage.getItem('huvi_mock_opportunities')) {
      const opps = [];
      const statuses = ['discovered', 'enriched', 'audited', 'scored', 'strategy_defined', 'campaign_created', 'contacted', 'in_conversation', 'converted'];
      const cities = ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Campinas', 'Porto Alegre'];
      const names = ['Clínica Sorriso Feliz', 'Espaço Saúde Integral', 'Dr. Marcos Cardoso Rossi', 'Dra. Ana Flávia Pediatra', 'Laboratório Diagnóstico', 'Nutrição Integrada'];
      
      const today = new Date();
      
      // Gerar 22 oportunidades fictícias distribuídas nos últimos 7 dias
      for (let i = 0; i < 22; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - (i % 7));
        d.setHours(10 + (i % 8), 15 * (i % 4), 0, 0);

        opps.push({
          id: `opp-${i}`,
          tenant_id: tenantId,
          source_id: `src-${(i % 3) + 1}`,
          company_name: names[i % names.length],
          contact_name: `Contato ${i + 1}`,
          email: `contato${i + 1}@clinica.com.br`,
          phone: `119999900${i.toString().padStart(2, '0')}`,
          website: `www.clinica${i + 1}.com.br`,
          instagram: `@clinica${i + 1}`,
          city: cities[i % cities.length],
          state: i % 2 === 0 ? 'SP' : 'RJ',
          status: statuses[i % statuses.length],
          score: Math.floor(Math.random() * 60) + 40,
          created_at: d.toISOString(),
          updated_at: d.toISOString(),
          deleted_at: null
        });
      }
      SafeStorage.setItem('huvi_mock_opportunities', JSON.stringify(opps));
    }

    // 6. Conversions
    if (!SafeStorage.getItem('huvi_mock_conversions')) {
      const convs = [];
      const today = new Date();
      // Gerar conversões nos últimos 7 dias
      for (let i = 0; i < 5; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - (i * 1.5));
        d.setHours(14, 20, 0, 0);

        convs.push({
          id: `conv-${i}`,
          tenant_id: tenantId,
          opportunity_id: `opp-${i * 3}`,
          conversion_type: 'direct_checkout',
          expected_value: 1500.00,
          closed_value: 1500.00,
          conversion_date: d.toISOString(),
          notes: `Venda via checkout Asaas #${i + 1}`,
          created_at: d.toISOString(),
          deleted_at: null
        });
      }
      SafeStorage.setItem('huvi_mock_conversions', JSON.stringify(convs));
    }

    // 7. Campaigns
    if (!SafeStorage.getItem('huvi_mock_campaigns')) {
      SafeStorage.setItem('huvi_mock_campaigns', JSON.stringify([
        { id: 'cmp-1', tenant_id: tenantId, opportunity_id: 'opp-1', channel: 'whatsapp', subject: null, message: 'Olá! Vimos seu perfil comercial...', status: 'sent', created_at: new Date().toISOString(), deleted_at: null },
        { id: 'cmp-2', tenant_id: tenantId, opportunity_id: 'opp-2', channel: 'email', subject: 'Proposta Comercial Especial', message: 'Prezados, analisamos sua presença digital...', status: 'approved', created_at: new Date().toISOString(), deleted_at: null },
        { id: 'cmp-3', tenant_id: tenantId, opportunity_id: 'opp-3', channel: 'whatsapp', subject: null, message: 'Gostaríamos de agendar um diagnóstico comercial...', status: 'sending', created_at: new Date().toISOString(), deleted_at: null }
      ]));
    }

    // 8. Communication Preferences
    if (!SafeStorage.getItem('huvi_mock_communication_preferences')) {
      SafeStorage.setItem('huvi_mock_communication_preferences', JSON.stringify([
        {
          id: 'pref-1',
          tenant_id: tenantId,
          email_enabled: true,
          whatsapp_enabled: true,
          quiet_hours: { start: '22:00', end: '08:00' },
          created_at: new Date().toISOString()
        }
      ]));
    }

    // 9. Session (Se o usuário fizer login)
    if (!SafeStorage.getItem('huvi_mock_session')) {
      // Começa com Hamilton logado por padrão para facilidade de testes do usuário!
      SafeStorage.setItem('huvi_mock_session', JSON.stringify({
        user: {
          id: '33333333-3333-3333-3333-333333333333',
          email: 'admin@huvi.com.br',
          raw_user_meta_data: { full_name: 'Hamilton Viana' },
          app_metadata: { tenant_id: tenantId }
        },
        expires_at: Math.floor(Date.now() / 1000) + 3600
      }));
    }

    // 10. Tenant Credits (Descoberta de Oportunidades)
    if (!SafeStorage.getItem('huvi_mock_tenant_credits')) {
      const cycleStart = new Date();
      const cycleReset = new Date(cycleStart.getTime() + 30 * 86400000);
      SafeStorage.setItem('huvi_mock_tenant_credits', JSON.stringify([
        {
          id: 'cred-1',
          tenant_id: tenantId,
          opportunity_limit: 80,
          opportunity_used: 0,
          analysis_limit: 20,
          analysis_used: 0,
          firecrawl_min_score: 40,
          firecrawl_status: 'active',
          weight_outscraper_search: 1,
          weight_firecrawl_search: 2,
          weight_firecrawl_scrape: 1,
          weight_firecrawl_audit: 3,
          cycle_start_at: cycleStart.toISOString(),
          cycle_reset_at: cycleReset.toISOString(),
          created_at: cycleStart.toISOString(),
          updated_at: cycleStart.toISOString()
        }
      ]));
    }

    // 11. Outscraper Search Log
    if (!SafeStorage.getItem('huvi_mock_outscraper_search_log')) {
      SafeStorage.setItem('huvi_mock_outscraper_search_log', JSON.stringify([]));
    }

    // 12. Outscraper Search Queue
    if (!SafeStorage.getItem('huvi_mock_outscraper_search_queue')) {
      SafeStorage.setItem('huvi_mock_outscraper_search_queue', JSON.stringify([]));
    }

    // 13. Opportunity Dedup Log
    if (!SafeStorage.getItem('huvi_mock_opportunity_dedup_log')) {
      SafeStorage.setItem('huvi_mock_opportunity_dedup_log', JSON.stringify([]));
    }
  };

  initMockData();

  // Query Builder Mock para simular chamadas fluentes ao Supabase
  class MockQueryBuilder {
    constructor(tableName) {
      this.tableName = tableName;
      this.data = JSON.parse(SafeStorage.getItem(`huvi_mock_${tableName}`)) || [];
      this.filters = [];
      this.sortColumn = null;
      this.sortAscending = true;
      this.limitValue = null;
      this.isSingle = false;
      this.exactCount = false;
      this.isDeleteOp = false;
      this.isUpdateOp = false;
      this.updatePayload = null;
    }

    select(columns, options = {}) {
      if (options.count === 'exact') {
        this.exactCount = true;
      }
      return this;
    }

    eq(column, value) {
      this.filters.push(item => item[column] === value);
      return this;
    }

    neq(column, value) {
      this.filters.push(item => item[column] !== value);
      return this;
    }

    is(column, value) {
      this.filters.push(item => item[column] === value);
      return this;
    }

    in(column, valuesArray) {
      this.filters.push(item => valuesArray.includes(item[column]));
      return this;
    }

    gte(column, value) {
      this.filters.push(item => item[column] >= value);
      return this;
    }

    lte(column, value) {
      this.filters.push(item => item[column] <= value);
      return this;
    }

    ilike(column, pattern) {
      const regexPattern = pattern.replace(/%/g, '.*');
      const regex = new RegExp(`^${regexPattern}$`, 'i');
      this.filters.push(item => regex.test(item[column] || ''));
      return this;
    }

    order(column, options = {}) {
      this.sortColumn = column;
      this.sortAscending = options.ascending !== false;
      return this;
    }

    limit(value) {
      this.limitValue = value;
      return this;
    }

    single() {
      this.isSingle = true;
      return this;
    }

    async insert(payload) {
      const payloads = Array.isArray(payload) ? payload : [payload];
      const newItems = payloads.map(p => ({
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...p
      }));
      this.data.push(...newItems);
      SafeStorage.setItem(`huvi_mock_${this.tableName}`, JSON.stringify(this.data));
      return { data: Array.isArray(payload) ? newItems : newItems[0], error: null };
    }

    update(payload) {
      this.isUpdateOp = true;
      this.updatePayload = payload;
      return this;
    }

    delete() {
      this.isDeleteOp = true;
      return this;
    }

    // Chamada no await
    then(onfulfilled, onrejected) {
      if (this.isUpdateOp) {
        const updatedData = this.data.map(item => {
          let matches = true;
          for (const filter of this.filters) {
            if (!filter(item)) { matches = false; break; }
          }
          if (matches) {
            return { ...item, ...this.updatePayload, updated_at: new Date().toISOString() };
          }
          return item;
        });
        this.data = updatedData;
        SafeStorage.setItem(`huvi_mock_${this.tableName}`, JSON.stringify(this.data));
        return Promise.resolve({ data: null, error: null }).then(onfulfilled, onrejected);
      }

      if (this.isDeleteOp) {
        const filteredOut = [];
        const remaining = [];
        this.data.forEach(item => {
          let matches = true;
          for (const filter of this.filters) {
            if (!filter(item)) { matches = false; break; }
          }
          if (matches) filteredOut.push(item);
          else remaining.push(item);
        });
        this.data = remaining;
        SafeStorage.setItem(`huvi_mock_${this.tableName}`, JSON.stringify(this.data));
        return Promise.resolve({ data: filteredOut, error: null }).then(onfulfilled, onrejected);
      }

      return this.execute().then(onfulfilled, onrejected);
    }

    async execute() {
      let result = [...this.data];

      for (const filter of this.filters) {
        result = result.filter(filter);
      }

      if (this.sortColumn) {
        result.sort((a, b) => {
          const valA = a[this.sortColumn];
          const valB = b[this.sortColumn];
          if (valA === valB) return 0;
          if (valA == null) return 1;
          if (valB == null) return -1;
          
          let comparison = 0;
          if (typeof valA === 'string') {
            comparison = valA.localeCompare(valB);
          } else {
            comparison = valA < valB ? -1 : 1;
          }
          return this.sortAscending ? comparison : -comparison;
        });
      }

      const count = result.length;

      if (this.limitValue !== null) {
        result = result.slice(0, this.limitValue);
      }

      if (this.isSingle) {
        return { data: result[0] || null, error: null, count };
      }

      return { data: result, error: null, count };
    }
  }

  // Objeto Supabase simulado
  const mockSupabase = {
    auth: {
      listeners: [],
      async signInWithPassword({ email, password }) {
        const profiles = JSON.parse(SafeStorage.getItem('huvi_mock_profiles')) || [];
        const profile = profiles.find(p => p.email.toLowerCase() === email.toLowerCase());
        
        if (!profile) {
          return { data: null, error: { message: 'Usuário não encontrado' } };
        }
        
        const session = {
          user: {
            id: profile.auth_user_id,
            email: profile.email,
            raw_user_meta_data: { full_name: profile.full_name },
            app_metadata: { tenant_id: profile.tenant_id }
          },
          expires_at: Math.floor(Date.now() / 1000) + 3600
        };
        
        SafeStorage.setItem('huvi_mock_session', JSON.stringify(session));
        this.triggerStateChange('SIGNED_IN', session);
        return { data: session, error: null };
      },
      async signUp({ email, password, options = {} }) {
        const newTenantId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11);
        const newUserId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11);
        const fullName = options.data?.full_name || email.split('@')[0];

        // Adicionar tenant
        const tenants = JSON.parse(SafeStorage.getItem('huvi_mock_tenants')) || [];
        tenants.push({
          id: newTenantId,
          name: `${fullName} Negócios`,
          email: email,
          plan: 'free',
          status: 'active',
          created_at: new Date().toISOString()
        });
        SafeStorage.setItem('huvi_mock_tenants', JSON.stringify(tenants));

        // Adicionar profile
        const profiles = JSON.parse(SafeStorage.getItem('huvi_mock_profiles')) || [];
        profiles.push({
          id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
          tenant_id: newTenantId,
          auth_user_id: newUserId,
          full_name: fullName,
          email: email,
          role: 'owner',
          status: 'active',
          created_at: new Date().toISOString()
        });
        SafeStorage.setItem('huvi_mock_profiles', JSON.stringify(profiles));

        // Criar preferências de comunicação padrão
        const prefs = JSON.parse(SafeStorage.getItem('huvi_mock_communication_preferences')) || [];
        prefs.push({
          id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
          tenant_id: newTenantId,
          email_enabled: true,
          whatsapp_enabled: true,
          quiet_hours: { start: '22:00', end: '08:00' },
          created_at: new Date().toISOString()
        });
        SafeStorage.setItem('huvi_mock_communication_preferences', JSON.stringify(prefs));

        const session = {
          user: {
            id: newUserId,
            email: email,
            raw_user_meta_data: { full_name: fullName },
            app_metadata: { tenant_id: newTenantId }
          },
          expires_at: Math.floor(Date.now() / 1000) + 3600
        };

        SafeStorage.setItem('huvi_mock_session', JSON.stringify(session));
        this.triggerStateChange('SIGNED_IN', session);
        return { data: session, error: null };
      },
      async signOut() {
        SafeStorage.removeItem('huvi_mock_session');
        this.triggerStateChange('SIGNED_OUT', null);
        return { error: null };
      },
      onAuthStateChange(callback) {
        this.listeners.push(callback);
        return { data: { subscription: { unsubscribe: () => {
          this.listeners = this.listeners.filter(l => l !== callback);
        }}}}
      },
      triggerStateChange(event, session) {
        this.listeners.forEach(l => l(event, session));
      },
      async getSession() {
        const session = JSON.parse(SafeStorage.getItem('huvi_mock_session'));
        return { data: { session }, error: null };
      },
      async getUser() {
        const session = JSON.parse(SafeStorage.getItem('huvi_mock_session'));
        return { data: { user: session ? session.user : null }, error: null };
      },
      async resetPasswordForEmail(email) {
        console.log(`[HUVI Auth Mock] Link de recuperação enviado para ${email}`);
        return { error: null };
      }
    },
    from(tableName) {
      return new MockQueryBuilder(tableName);
    }
  };
  
  // Atribuir no objeto global e na variável local
  window.supabase = mockSupabase;
  supabase = mockSupabase;
  window.isMockMode = true;
} else {
  // Inicialização oficial do Supabase
  const client = window.supabase.createClient(
    HUVI_CONFIG.SUPABASE_URL,
    HUVI_CONFIG.SUPABASE_ANON_KEY
  );
  window.supabase = client;
  supabase = client;
  window.isMockMode = false;
}

/**
 * Helper: Obter tenant_id do usuário autenticado
 */
async function getTenantId() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    // Tenta pegar do app_metadata (se já foi atualizado na sessão)
    let tenantId = user.app_metadata?.tenant_id;
    
    // Se não estiver no app_metadata (comum logo após o registro sem refresh), busca no profile
    if (!tenantId) {
      const { data, error } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('auth_user_id', user.id)
        .single();
        
      if (!error && data) {
        tenantId = data.tenant_id;
      }
    }
    
    return tenantId || null;
  } catch (e) {
    console.error('[HUVI] Erro ao obter tenant_id:', e);
    return null;
  }
}

/**
 * Helper: Obter profile do usuário autenticado
 */
async function getCurrentProfile() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_user_id', user.id)
      .single();

    if (error) {
      console.error('[HUVI] Erro ao buscar profile:', error);
      return null;
    }
    return data;
  } catch (e) {
    console.error('[HUVI] Erro no helper getCurrentProfile:', e);
    return null;
  }
}

/**
 * Helper: Obter dados do tenant atual
 */
async function getCurrentTenant() {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return null;

    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (error) {
      console.error('[HUVI] Erro ao buscar tenant:', error);
      return null;
    }
    return data;
  } catch (e) {
    console.error('[HUVI] Erro no helper getCurrentTenant:', e);
    return null;
  }
}
