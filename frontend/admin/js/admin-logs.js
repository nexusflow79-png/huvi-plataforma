/**
 * HUVI — Console Superadmin
 * Logs Module (Terminal Inteligente)
 */
const AdminLogs = (() => {
  let currentLogs = [];

  async function load() {
    const { data } = await adminSupabase.from('audit_logs').select().order('created_at', { ascending: false });
    currentLogs = data || [];
    render(currentLogs);
  }

  function render(logs) {
    const container = document.getElementById('terminal-body');

    if (!logs.length) {
      container.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted);">Nenhum log registrado</div>';
      return;
    }

    container.innerHTML = `
      <div style="display:flex; justify-content:flex-end; margin-bottom:var(--space-3); gap:var(--space-2);">
        <button id="btn-delete-selected-logs" class="btn btn-danger btn-sm" style="display:none;">
          🗑️ Excluir Selecionados
        </button>
      </div>
    ` + logs.map(log => {
      const date = new Date(log.created_at);
      const dateStr = date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const typeClass = log.type?.includes('CRIADO') ? 'created' :
                        log.type?.includes('ACEITO') ? 'accepted' :
                        log.type?.includes('EXCLUIDO') ? 'deleted' : 'created';

      const typeIcon = log.type?.includes('CRIADO') ? '●' :
                       log.type?.includes('ACEITO') ? '●' :
                       log.type?.includes('EXCLUIDO') ? '●' : '●';

      return `
        <div class="log-entry">
          <label style="display:flex; align-items:flex-start; gap:var(--space-2);">
            <input type="checkbox" class="log-checkbox" data-id="${log.id}" style="margin-top:2px;">
            <div style="flex:1;">
              <div class="log-meta">
                <span class="log-tenant">[${esc(log.tenant_slug || '—')}]</span>
                <span class="log-role">— ${esc(log.role || 'Sistema')}</span>
                <span class="log-time">${dateStr}</span>
              </div>
              <div>
                <span class="log-action ${typeClass}">${typeIcon} ${esc(log.type || 'LOG')}</span>
                <span class="log-detail">${esc(log.detail || '')}</span>
              </div>
              ${log.suggestion ? `<div class="log-suggestion">💡 ${esc(log.suggestion)}</div>` : ''}
            </div>
          </label>
        </div>
      `;
    }).join('');

    const checkboxes = container.querySelectorAll('.log-checkbox');
    const deleteBtn = document.getElementById('btn-delete-selected-logs');

    const toggleDeleteBtn = () => {
      const checked = Array.from(checkboxes).some(cb => cb.checked);
      deleteBtn.style.display = checked ? 'inline-flex' : 'none';
    };

    checkboxes.forEach(cb => cb.addEventListener('change', toggleDeleteBtn));

    deleteBtn.addEventListener('click', async () => {
      const selected = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.dataset.id);
      if (!selected.length) return;
      if (!confirm(`Excluir ${selected.length} log(s) selecionado(s)?`)) return;

      for (const id of selected) {
        await adminSupabase.from('audit_logs').delete().eq('id', id);
      }
      showToast(`${selected.length} log(s) excluído(s)`, 'success');
      load();
    });
  }

  function init() {
    // Terminal está sempre ativo, sem interação extra
  }

  return { init, load };
})();
