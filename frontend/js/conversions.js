/**
 * HUVI — Conversions Module
 * Relatório de conversões reais e receitas consolidadas do inquilino
 */
const Conversions = (() => {
  const listEl = document.getElementById('conversions-list');
  const modalEl = document.getElementById('modal-conversion');
  const formEl = document.getElementById('conversion-form');
  const oppSelectEl = document.getElementById('conv-opportunity');
  
  const TYPE_LABELS = {
    direct_checkout: 'Asaas Checkout (Direta)',
    appointment: 'Agenda Nexus (Reunião)',
    hybrid: 'Mapeamento Híbrido',
    manual: 'Manual'
  };

  async function getTenantId() {
    return window.getTenantId ? await window.getTenantId() : null;
  }

  function renderList(conversions) {
    if (!conversions || conversions.length === 0) {
      listEl.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: var(--space-10); color: var(--text-muted);">
            Nenhuma venda ou conversão registrada ainda.
          </td>
        </tr>`;
      return;
    }

    listEl.innerHTML = conversions.map(c => `
      <tr style="border-bottom: 1px solid var(--surface-300); transition: background var(--transition-fast);" class="table-row">
        <td style="padding: var(--space-4) var(--space-5); font-weight: 600; color: var(--text-primary);">
          ${c.opportunities?.company_name || c.opportunities?.contact_name || 'Empresa Sem Nome'}
        </td>
        <td style="padding: var(--space-4) var(--space-5); color: var(--text-secondary);">
          ${TYPE_LABELS[c.conversion_type] || c.conversion_type}
        </td>
        <td style="padding: var(--space-4) var(--space-5); color: var(--text-muted); font-variant-numeric: tabular-nums;">
          ${c.expected_value ? `R$ ${parseFloat(c.expected_value).toFixed(2).replace('.', ',')}` : '-'}
        </td>
        <td style="padding: var(--space-4) var(--space-5); font-weight: 600; color: var(--success-600); font-variant-numeric: tabular-nums;">
          R$ ${parseFloat(c.closed_value || 0).toFixed(2).replace('.', ',')}
        </td>
        <td style="padding: var(--space-4) var(--space-5); color: var(--text-muted);">
          ${c.conversion_date ? new Date(c.conversion_date).toLocaleDateString('pt-BR') : '-'}
        </td>
        <td style="padding: var(--space-4) var(--space-5); color: var(--text-muted); font-size: var(--font-xs); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${c.notes || ''}">
          ${c.notes || '-'}
        </td>
      </tr>
    `).join('');
  }

  async function load() {
    const tenantId = await getTenantId();
    if (!tenantId) return;

    const { data, error } = await supabase
      .from('conversions')
      .select('*, opportunities(company_name, contact_name)')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('conversion_date', { ascending: false });

    if (error) {
      console.error('[HUVI] Erro ao carregar conversões:', error);
      return;
    }

    renderList(data);
  }

  // Carregar oportunidades ativas para registrar conversão manual
  async function loadOpportunitiesForSelect() {
    const tenantId = await getTenantId();
    if (!tenantId) return;

    // Buscar leads que não estão convertidos, perdidos ou arquivados
    const { data: opps, error } = await supabase
      .from('opportunities')
      .select('id, company_name, contact_name')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .not('status', 'in', '("converted","lost","archived")')
      .order('company_name', { ascending: true });

    if (error) {
      console.error('[HUVI] Erro ao carregar oportunidades:', error);
      oppSelectEl.innerHTML = `<option value="">Erro ao carregar leads</option>`;
      return;
    }

    if (!opps || opps.length === 0) {
      oppSelectEl.innerHTML = `<option value="">Nenhuma oportunidade ativa disponível</option>`;
      return;
    }

    oppSelectEl.innerHTML = '<option value="">-- Selecione uma Oportunidade --</option>' + 
      opps.map(o => {
        const name = o.company_name || o.contact_name || 'Sem nome';
        return `<option value="${o.id}">${name}</option>`;
      }).join('');
  }

  function openModal() {
    modalEl.classList.remove('hidden');
    loadOpportunitiesForSelect();
    formEl.reset();
  }

  function closeModal() {
    modalEl.classList.add('hidden');
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const opportunityId = oppSelectEl.value;
    const conversionType = document.getElementById('conv-type').value;
    const closedValueStr = document.getElementById('conv-closed-value').value.trim();
    const notes = document.getElementById('conv-notes').value;

    if (!opportunityId) {
      showToast('Selecione um lead / oportunidade', 'error');
      return;
    }

    // Parse do valor numérico
    const closedValue = parseFloat(closedValueStr.replace(',', '.'));
    if (isNaN(closedValue) || closedValue < 0) {
      showToast('Digite um valor fechado válido (ex: 1500,00)', 'error');
      return;
    }

    const tenantId = await getTenantId();
    if (!tenantId) return;

    try {
      // 1. Gravar a conversão
      const { error: convError } = await supabase
        .from('conversions')
        .insert({
          tenant_id: tenantId,
          opportunity_id: opportunityId,
          conversion_type: conversionType,
          expected_value: closedValue,
          closed_value: closedValue,
          conversion_date: new Date().toISOString(),
          notes: notes
        });

      if (convError) throw convError;

      // 2. Atualizar status do lead para 'converted'
      const { error: oppError } = await supabase
        .from('opportunities')
        .update({ status: 'converted' })
        .eq('id', opportunityId);

      if (oppError) throw oppError;

      showToast('Venda registrada com sucesso!', 'success');
      closeModal();
      await load();

      // Recarregar dashboard se o usuário navegar de volta pra lá
      if (window.Dashboard && typeof window.Dashboard.load === 'function') {
        window.Dashboard.load();
      }

    } catch (err) {
      console.error('[HUVI] Erro ao salvar conversão manual:', err);
      showToast('Erro ao salvar venda: ' + (err.message || err), 'error');
    }
  }

  function init() {
    const btnNew = document.getElementById('btn-new-conversion');
    const btnClose = document.getElementById('close-conversion-modal');
    const btnCancel = document.getElementById('cancel-conversion');

    if (btnNew) btnNew.addEventListener('click', openModal);
    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);
    if (formEl) formEl.addEventListener('submit', handleSubmit);
  }

  return { init, load };
})();
