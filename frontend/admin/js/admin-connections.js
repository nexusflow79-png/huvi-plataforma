/**
 * HUVI — Console Superadmin
 * Connections Module (Diagnóstico de Conexões)
 */
const AdminConnections = (() => {
  async function load() {
    const [tenantsRes, connsRes] = await Promise.all([
      adminSupabase.from('tenants').select(),
      adminSupabase.from('connections').select().order('tenant_name', { ascending: true })
    ]);
    const tenants = (tenantsRes.data || []).map(t => t.name?.toLowerCase());
    const conns = (connsRes.data || []).filter(c => tenants.includes(c.tenant_name?.toLowerCase()));
    render(conns);
  }

  function render(connections) {
    const container = document.getElementById('connections-grid');

    if (!connections.length) {
      container.innerHTML = '<div class="empty-state"><span class="empty-icon">🔌</span><p>Nenhuma conexão configurada</p></div>';
      return;
    }

    container.innerHTML = connections.map(c => {
      const statusClass = c.active ? 'active' : 'inactive';
      const statusLabel = c.active ? 'ATIVO' : 'INATIVO';
      const channels = c.channels || [];

      return `
        <div class="connection-card">
          <div class="connection-header">
            <span class="connection-name">${esc(c.tenant_name)}</span>
            <span class="connection-status ${statusClass}">${statusLabel}</span>
          </div>
          <div class="connection-channels">
            ${channels.includes('evolution_api') ? '<span class="channel-badge api">⚡ Evolution API</span>' : ''}
            ${channels.includes('email') ? '<span class="channel-badge email">📧 Email</span>' : ''}
            ${channels.includes('whatsapp') ? '<span class="channel-badge whatsapp">📱 WhatsApp</span>' : ''}
            ${channels.length === 0 ? '<span style="font-size:12px; color:var(--text-muted);">Sem canais configurados</span>' : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  function init() {}

  return { init, load };
})();
