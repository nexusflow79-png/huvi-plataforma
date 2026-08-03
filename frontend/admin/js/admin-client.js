/**
 * HUVI — Console Superadmin
 * Cliente Supabase via proxy server-side (seguro)
 */

const AdminSafeStorage = {
  mem: {},
  get(k) {
    try {
      localStorage.removeItem(k);
      return sessionStorage.getItem(k);
    } catch(e) {
      return this.mem[k] || null;
    }
  },
  set(k, v) {
    try {
      localStorage.removeItem(k);
      sessionStorage.setItem(k, v);
    } catch(e) {
      this.mem[k] = v;
    }
  },
  del(k) {
    try {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    } catch(e) {
      delete this.mem[k];
    }
  },
  // ITEM 2: Expansão da purga de dados legados do localStorage
  purgeLegacy() {
    try {
      const keys = [
        'huvi_admin_session',
        'huvi_admin_session_token',
        'huvi_admin_tenants',
        'huvi_admin_logs',
        'huvi_admin_connections',
        'huvi_admin_tenant_credits'
      ];
      for (const k of keys) {
        localStorage.removeItem(k);
      }
    } catch(e) {}
  }
};

// Purgar resíduos antigos do localStorage na inicialização
AdminSafeStorage.purgeLegacy();

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

    if (res.status === 401 || res.status === 403) {
      AdminSafeStorage.del('huvi_admin_session');
      AdminSafeStorage.del('huvi_admin_session_token');
      if (typeof showToast === 'function') {
        showToast('Sessão administrativa expirada ou inválida. Por favor, faça login novamente.', 'error');
      }
      if (typeof showScreen === 'function') {
        showScreen('auth');
      }
      throw new Error('Sessão expirada ou inválida.');
    }

    if (res.status === 503) {
      if (typeof showToast === 'function') {
        showToast('Configuração administrativa indisponível no servidor. Entre em contato com o suporte.', 'error');
      }
      throw new Error('Configuração administrativa indisponível.');
    }

    const result = await res.json();
    if (result.error) throw new Error(typeof result.error === 'string' ? result.error : result.error.message);
    return { data: result.data, error: null };
  }

  insert(payload) { this._operation = 'insert'; this._payload = payload; return this; }
  update(payload) { this._operation = 'update'; this._payload = payload; return this; }
  delete() { this._operation = 'delete'; return this; }

  then(onFulfilled, onRejected) {
    return this._proxy(this._operation, this._payload)
      .then(onFulfilled, onRejected);
  }
}

const adminSupabase = {
  from(table) {
    return new AdminProxyQueryBuilder(table);
  },
  async changeTenantPassword(payload, password, full_name) {
    const payloadObj = typeof payload === 'object' && payload !== null
      ? payload
      : { email: payload, password, full_name };
    const builder = new AdminProxyQueryBuilder('tenants');
    return builder._proxy('change_tenant_password', payloadObj);
  }
};
