/**
 * HUVI — Console Superadmin
 * Cliente Supabase via proxy server-side (seguro)
 */

const AdminSafeStorage = {
  mem: {},
  get(k) { try { return localStorage.getItem(k); } catch(e) { return this.mem[k] || null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch(e) { this.mem[k] = v; } },
  del(k) { try { localStorage.removeItem(k); } catch(e) { delete this.mem[k]; } },
};

let isAdminMockMode = false;

// ── Proxy Query Builder ──
class AdminProxyQueryBuilder {
  constructor(table) {
    this.table = table;
    this._filters = [];
    this._orderCol = null;
    this._orderAsc = true;
    this._isSingle = false;
    this._operation = 'select';
    this._payload = null;
  }

  select() { return this; }
  eq(col, val) { this._filters.push({ op: 'eq', col, val }); return this; }
  neq(col, val) { this._filters.push({ op: 'neq', col, val }); return this; }
  in(col, vals) { this._filters.push({ op: 'in', col, val: vals }); return this; }
  order(col, opts = {}) { this._orderCol = col; this._orderAsc = opts.ascending !== false; return this; }
  single() { this._isSingle = true; return this; }

  async _proxy(operation, payload) {
    const token = AdminSafeStorage.get('huvi_admin_session_token');
    const res = await fetch('/api/admin-supabase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`,
      },
      body: JSON.stringify({
        table: this.table,
        operation,
        filters: this._filters,
        payload,
        orderCol: this._orderCol,
        orderAsc: this._orderAsc,
        isSingle: this._isSingle,
      }),
    });
    const result = await res.json();
    if (result.error) throw new Error(typeof result.error === 'string' ? result.error : result.error.message);
    return { data: result.data, error: null };
  }

  insert(payload) { this._operation = 'insert'; this._payload = payload; return this; }
  update(payload) { this._operation = 'update'; this._payload = payload; return this; }
  delete() { this._operation = 'delete'; return this; }

  then(onFulfilled, onRejected) {
    return this._proxy(this._operation, this._payload).then(onFulfilled, onRejected);
  }
}

// ── Mock Query Builder (fallback) ──
class AdminMockQueryBuilder {
  constructor(storageKey) {
    this.storageKey = storageKey;
    this.data = JSON.parse(AdminSafeStorage.get(storageKey)) || [];
    this.filters = [];
    this.sortCol = null;
    this.sortAsc = true;
    this.isSingle = false;
    this.operation = 'select';
    this.payload = null;
  }

  select() { return this; }
  eq(col, val) { this.filters.push(i => i[col] === val); return this; }
  neq(col, val) { this.filters.push(i => i[col] !== val); return this; }
  order(col, opts = {}) { this.sortCol = col; this.sortAsc = opts.ascending !== false; return this; }
  single() { this.isSingle = true; return this; }

  insert(payload) { this.operation = 'insert'; this.payload = payload; return this; }
  update(payload) { this.operation = 'update'; this.payload = payload; return this; }
  delete() { this.operation = 'delete'; return this; }

  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
  }

  async execute() {
    if (this.operation === 'insert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload];
      const newItems = items.map(p => ({
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
        created_at: new Date().toISOString(),
        ...p
      }));
      this.data.push(...newItems);
      AdminSafeStorage.set(this.storageKey, JSON.stringify(this.data));
      return { data: Array.isArray(this.payload) ? newItems : newItems[0], error: null };
    }

    if (this.operation === 'update') {
      this.data = this.data.map(item => {
        if (this.filters.every(f => f(item))) {
          return { ...item, ...this.payload };
        }
        return item;
      });
      AdminSafeStorage.set(this.storageKey, JSON.stringify(this.data));
      return { data: null, error: null };
    }

    if (this.operation === 'delete') {
      this.data = this.data.filter(item => !this.filters.every(f => f(item)));
      AdminSafeStorage.set(this.storageKey, JSON.stringify(this.data));
      return { data: null, error: null };
    }

    // Select operation
    let result = [...this.data];
    for (const f of this.filters) result = result.filter(f);
    if (this.sortCol) {
      result.sort((a, b) => {
        const va = a[this.sortCol], vb = b[this.sortCol];
        if (va == null) return 1;
        if (vb == null) return -1;
        const cmp = typeof va === 'string' ? va.localeCompare(vb) : va < vb ? -1 : 1;
        return this.sortAsc ? cmp : -cmp;
      });
    }
    if (this.isSingle) return { data: result[0] || null, error: null };
    return { data: result, error: null };
  }
}

// ── Mock Data ──
function initAdminMockData() {
  if (!AdminSafeStorage.get('huvi_admin_tenants')) {
    const now = new Date().toISOString();
    const d1 = new Date(); d1.setDate(d1.getDate() - 15);
    const d2 = new Date(); d2.setDate(d2.getDate() - 5);
    AdminSafeStorage.set('huvi_admin_tenants', JSON.stringify([
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Neres Barbearia', slug: 'neres-barbearia', niche: 'Barbearia',
        owner_name: 'Antônio Neres da Silva', email: 'profneres65@gmail.com',
        phone: '82991737685', status: 'active', plan: 'start',
        monthly_value: 24.90, due_date: '11/08/2026',
        financial_status: 'em_dia', terms_accepted: true,
        created_at: d1.toISOString(),
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        name: 'Oficina Teste', slug: 'oficina-teste', niche: 'Outro',
        owner_name: 'Pedro Jorge', email: 'pedro@oficina.com',
        phone: '11988887777', status: 'active', plan: 'pro',
        monthly_value: 49.90, due_date: '15/07/2026',
        financial_status: 'em_dia', terms_accepted: true,
        created_at: d2.toISOString(),
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        name: 'Clínica Sorriso', slug: 'clinica-sorriso', niche: 'Clínica',
        owner_name: 'Dra. Maria Souza', email: 'maria@sorriso.com',
        phone: '21977776666', status: 'suspended', plan: 'free',
        monthly_value: 0, due_date: null,
        financial_status: 'em_atraso', terms_accepted: false,
        created_at: now,
      },
    ]));
  }

  if (!AdminSafeStorage.get('huvi_admin_logs')) {
    const logs = [
      { id: 'log-1', tenant_slug: 'neres-barbearia', role: 'Administrador / Proprietário', type: 'TERMOS_ACEITOS', detail: '{"email":"profneres65@gmail.com","owner_name":"Antônio Neres da Silva","company_name":"Neres Barbearia"}', created_at: new Date(Date.now() - 86400000).toISOString() },
      { id: 'log-2', tenant_slug: 'oficina-teste', role: 'Fri', type: 'AGENDAMENTO_CRIADO', detail: '{"service_type":"Serviços Preventivos","appointment_date":"2026-06-17","appointment_time":"09:05"}', created_at: new Date(Date.now() - 172800000).toISOString() },
      { id: 'log-3', tenant_slug: 'neres-barbearia', role: 'Superadmin', type: 'TENANT_CRIADO', detail: '{"niche":"Barbearia","company_name":"Neres Barbearia"}', created_at: new Date(Date.now() - 259200000).toISOString() },
      { id: 'log-4', tenant_slug: 'oficina-teste', role: 'pedro jorge', type: 'AGENDAMENTO_CRIADO', detail: '{"service_type":"Alinhamento","appointment_date":"2026-07-02","appointment_time":"10:00"}', created_at: new Date(Date.now() - 345600000).toISOString() },
      { id: 'log-5', tenant_slug: 'oficina-teste', role: 'Adria', type: 'AGENDAMENTO_EXCLUIDO', detail: '{"appointment_id":"31a654bf-3c4c-49c8-95ea-a08818a750d9"}', created_at: new Date(Date.now() - 432000000).toISOString(), suggestion: 'Verifique se os dados foram exportados antes da exclusão permanente.' },
      { id: 'log-6', tenant_slug: 'oficina-teste', role: 'Adria', type: 'AGENDAMENTO_CRIADO', detail: '{"service_type":"Troca de Óleo","appointment_date":"2026-06-09","appointment_time":"17:00"}', created_at: new Date(Date.now() - 518400000).toISOString() },
    ];
    AdminSafeStorage.set('huvi_admin_logs', JSON.stringify(logs));
  }

  if (!AdminSafeStorage.get('huvi_admin_connections')) {
    AdminSafeStorage.set('huvi_admin_connections', JSON.stringify([
      { tenant_name: 'Neres Barbearia', active: true, channels: ['evolution_api', 'email'] },
      { tenant_name: 'Oficina Teste', active: true, channels: ['evolution_api', 'email'] },
      { tenant_name: 'Clínica Sorriso', active: false, channels: [] },
    ]));
  }

  if (!AdminSafeStorage.get('huvi_admin_tenant_credits')) {
    const now = new Date();
    const resetAt = new Date(now.getTime() + 30 * 86400000);
    AdminSafeStorage.set('huvi_admin_tenant_credits', JSON.stringify([
      {
        id: 'credit-1',
        tenant_id: '11111111-1111-1111-1111-111111111111',
        opportunity_limit: 80,
        opportunity_used: 12,
        cycle_start_at: now.toISOString(),
        cycle_reset_at: resetAt.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        id: 'credit-2',
        tenant_id: '22222222-2222-2222-2222-222222222222',
        opportunity_limit: 80,
        opportunity_used: 75,
        cycle_start_at: now.toISOString(),
        cycle_reset_at: resetAt.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        id: 'credit-3',
        tenant_id: '33333333-3333-3333-3333-333333333333',
        opportunity_limit: 80,
        opportunity_used: 0,
        cycle_start_at: now.toISOString(),
        cycle_reset_at: resetAt.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      }
    ]));
  }

  if (!AdminSafeStorage.get('huvi_admin_session')) {
    AdminSafeStorage.set('huvi_admin_session', null);
  }
}

// ── Admin client initialization (síncrona) ──
var adminSupabase;

function initAdminClient() {
  try {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/admin-config', false);
    xhr.send();
    if (xhr.status === 200) {
      var config = JSON.parse(xhr.responseText);
      if (config.hasServiceKey) {
        adminSupabase = {
          from(table) { return new AdminProxyQueryBuilder(table); }
        };
        console.log('[HUVI ADMIN] Proxy Supabase ativo');
        return;
      }
    }
  } catch (e) {
    console.warn('[HUVI ADMIN] Erro ao verificar proxy:', e);
  }
  isAdminMockMode = true;
  initAdminMockData();
  adminSupabase = {
    from(table) {
      var keyMap = {
        tenants: 'huvi_admin_tenants',
        audit_logs: 'huvi_admin_logs',
        connections: 'huvi_admin_connections',
        tenant_credits: 'huvi_admin_tenant_credits',
      };
      return new AdminMockQueryBuilder(keyMap[table] || ('huvi_admin_' + table));
    }
  };
  console.log('%c[HUVI ADMIN] Proxy indisponível — MOCK MODE ativado', 'color: #f47001; font-weight: bold;');
}

// Auto-init (síncrono)
initAdminClient();
