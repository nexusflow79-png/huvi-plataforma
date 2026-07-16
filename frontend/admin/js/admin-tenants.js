/**
 * HUVI — Console Superadmin
 * Tenants Module (CRUD completo)
 */
const AdminTenants = (() => {
  const listEl = document.getElementById('tenants-table-body');
  const modal = document.getElementById('modal-tenant');

  // ── Load ──
  async function load() {
    const { data, error } = await adminSupabase
      .from('tenants')
      .select()
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ADMIN] Erro ao carregar tenants:', error);
      return;
    }
    render(data || []);
  }

  // ── Render ──
  function render(tenants) {
    if (!tenants.length) {
      listEl.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:40px; color:var(--text-muted);">Nenhum tenant cadastrado</td></tr>`;
      return;
    }

    listEl.innerHTML = tenants.map((t, i) => {
      const statusBadge = t.status === 'active' ? 'badge-active' :
                          t.status === 'suspended' ? 'badge-suspended' : 'badge-inactive';
      const statusLabel = ADMIN_CONFIG.TENANT_STATUS[t.status] || t.status;
      const finBadge = t.financial_status === 'em_dia' ? 'badge-em-dia' : 'badge-em-atraso';
      const finLabel = t.financial_status === 'em_dia' ? 'Em Dia' : 'Em Atraso';
      const shortId = (t.id || '').substring(0, 8).toUpperCase();
      const planLabel = ADMIN_CONFIG.PLANS[t.plan]?.label?.split('(')[0]?.trim() || t.plan;

      return `
        <tr style="animation: fadeIn ${250 + i * 50}ms ease-out">
          <td><span class="tenant-id-cell">${shortId}</span></td>
          <td>
            <div class="tenant-info-cell">
              <span class="name">${esc(t.name)}</span>
              <span class="niche">${esc(t.niche || '—')}</span>
            </div>
          </td>
          <td><span class="tenant-slug">${esc(t.slug || '—')}</span></td>
          <td>${esc(t.owner_name || '—')}</td>
          <td>
            <div style="font-size:12px;">${esc(t.email || '—')}</div>
            <div style="font-size:11px; color:var(--text-muted);">${esc(t.phone || '')}</div>
          </td>
          <td><span class="badge ${statusBadge}">${statusLabel}</span></td>
          <td>
            <span class="badge ${finBadge}">${finLabel}</span>
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${t.due_date ? 'Venc. ' + t.due_date : 'Sem disparos'}</div>
          </td>
          <td>
            <div class="table-actions">
              <button class="action-btn edit" data-id="${t.id}" title="Alterar">✏️ Alterar</button>
              <button class="action-btn suspend" data-id="${t.id}" data-status="${t.status}" title="Suspender/Ativar">
                ${t.status === 'active' ? '⏸️ Suspender' : '▶️ Ativar'}
              </button>
              <button class="action-btn delete" data-id="${t.id}" title="Excluir">🗑️ Excluir</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Bind actions
    listEl.querySelectorAll('.action-btn.edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const tenant = tenants.find(t => t.id === btn.dataset.id);
        if (tenant) openModal(tenant);
      });
    });

    listEl.querySelectorAll('.action-btn.suspend').forEach(btn => {
      btn.addEventListener('click', () => toggleStatus(btn.dataset.id, btn.dataset.status));
    });

    listEl.querySelectorAll('.action-btn.delete').forEach(btn => {
      btn.addEventListener('click', () => deleteTenant(btn.dataset.id));
    });
  }

  // ── Open Modal ──
  function openModal(tenant = null) {
    const form = document.getElementById('tenant-form');
    const title = document.getElementById('modal-tenant-title');
    form.reset();
    document.getElementById('tenant-edit-id').value = '';

    // Reset credit fields
    document.getElementById('tenant-credit-limit').value = 50;
    document.getElementById('tenant-credit-used').value = 0;
    document.getElementById('tenant-credit-start').value = '';
    document.getElementById('tenant-credit-reset').value = '';

    // Reset weight fields
    document.getElementById('tenant-weight-os').value = 1;
    document.getElementById('tenant-weight-fc').value = 2;
    document.getElementById('tenant-weight-scrape').value = 1;
    document.getElementById('tenant-weight-audit').value = 3;

    // Populate plan select
    const planSelect = document.getElementById('tenant-plan');
    planSelect.innerHTML = Object.entries(ADMIN_CONFIG.PLANS).map(([key, p]) =>
      `<option value="${key}">${p.label}</option>`
    ).join('');

    // Populate niche select
    const nicheInput = document.getElementById('tenant-niche');

    if (tenant) {
      title.innerHTML = '✏️ Editar Tenant';
      document.getElementById('tenant-edit-id').value = tenant.id;
      document.getElementById('tenant-name').value = tenant.name || '';
      document.getElementById('tenant-slug').value = tenant.slug || '';
      nicheInput.value = tenant.niche || '';
      document.getElementById('tenant-owner').value = tenant.owner_name || '';
      document.getElementById('tenant-email').value = tenant.email || '';
      document.getElementById('tenant-phone').value = tenant.phone || '';
      document.getElementById('tenant-password').value = '';
      planSelect.value = tenant.plan || 'free';
      document.getElementById('tenant-value').value = tenant.monthly_value || 0;
      document.getElementById('tenant-due').value = tenant.due_date || '';

      // Carregar créditos do tenant
      loadTenantCredits(tenant.id);
    } else {
      title.innerHTML = '⚡ Adicionar Cliente Contratante';
    }

    // Plan change updates value
    planSelect.addEventListener('change', () => {
      const plan = ADMIN_CONFIG.PLANS[planSelect.value];
      if (plan) document.getElementById('tenant-value').value = plan.value;
    });

    // Auto-generate slug when creating a new tenant
    const nameInput = document.getElementById('tenant-name');
    const slugInput = document.getElementById('tenant-slug');
    nameInput.addEventListener('input', () => {
      const editId = document.getElementById('tenant-edit-id').value;
      if (!editId) { // Only auto-fill if it's a new tenant
        slugInput.value = nameInput.value
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-');
      }
    });

    modal.classList.remove('hidden');
  }

  async function loadTenantCredits(tenantId) {
    const { data: credits } = await adminSupabase
      .from('tenant_credits')
      .select()
      .eq('tenant_id', tenantId)
      .single();

    if (credits) {
      document.getElementById('tenant-credit-limit').value = credits.opportunity_limit || 50;
      document.getElementById('tenant-credit-used').value = credits.opportunity_used || 0;
      if (credits.cycle_start_at) {
        document.getElementById('tenant-credit-start').value = new Date(credits.cycle_start_at).toLocaleDateString('pt-BR');
      }
      if (credits.cycle_reset_at) {
        document.getElementById('tenant-credit-reset').value = new Date(credits.cycle_reset_at).toLocaleDateString('pt-BR');
      }

      // Pesos de operação
      document.getElementById('tenant-weight-os').value = credits.weight_outscraper_search ?? 1;
      document.getElementById('tenant-weight-fc').value = credits.weight_firecrawl_search ?? 2;
      document.getElementById('tenant-weight-scrape').value = credits.weight_firecrawl_scrape ?? 1;
      document.getElementById('tenant-weight-audit').value = credits.weight_firecrawl_audit ?? 3;
    }
  }

  async function saveTenantCredits(tenantId, limit) {
    const weightOs = parseInt(document.getElementById('tenant-weight-os').value) || 1;
    const weightFc = parseInt(document.getElementById('tenant-weight-fc').value) || 2;
    const weightScrape = parseInt(document.getElementById('tenant-weight-scrape').value) || 1;
    const weightAudit = parseInt(document.getElementById('tenant-weight-audit').value) || 3;

    const { data: existing } = await adminSupabase
      .from('tenant_credits')
      .select()
      .eq('tenant_id', tenantId)
      .single();

    if (existing) {
      await adminSupabase
        .from('tenant_credits')
        .update({
          opportunity_limit: limit,
          weight_outscraper_search: weightOs,
          weight_firecrawl_search: weightFc,
          weight_firecrawl_scrape: weightScrape,
          weight_firecrawl_audit: weightAudit
        })
        .eq('tenant_id', tenantId);
    } else {
      await adminSupabase
        .from('tenant_credits')
        .insert({
          tenant_id: tenantId,
          opportunity_limit: limit,
          opportunity_used: 0,
          weight_outscraper_search: weightOs,
          weight_firecrawl_search: weightFc,
          weight_firecrawl_scrape: weightScrape,
          weight_firecrawl_audit: weightAudit,
          cycle_start_at: new Date().toISOString(),
          cycle_reset_at: new Date(Date.now() + 30 * 86400000).toISOString()
        });
    }
  }

  async function resetTenantCredits() {
    const tenantId = document.getElementById('tenant-edit-id').value;
    if (!tenantId) {
      showToast('Salve o tenant primeiro', 'error');
      return;
    }

    if (!confirm('Deseja resetar os créditos deste tenant para 0 consumidos e reiniciar o ciclo?')) return;

    const now = new Date();
    const resetAt = new Date(now.getTime() + 30 * 86400000);

    const { data: existing } = await adminSupabase
      .from('tenant_credits')
      .select()
      .eq('tenant_id', tenantId)
      .single();

    if (existing) {
      await adminSupabase
        .from('tenant_credits')
        .update({
          opportunity_used: 0,
          analysis_used: 0,
          firecrawl_status: 'active',
          cycle_start_at: now.toISOString(),
          cycle_reset_at: resetAt.toISOString()
        })
        .eq('tenant_id', tenantId);
    } else {
      const limit = parseInt(document.getElementById('tenant-credit-limit').value) || 50;
      await adminSupabase
        .from('tenant_credits')
        .insert({
          tenant_id: tenantId,
          opportunity_limit: limit,
          opportunity_used: 0,
          analysis_limit: 20,
          analysis_used: 0,
          firecrawl_status: 'active',
          weight_outscraper_search: parseInt(document.getElementById('tenant-weight-os').value) || 1,
          weight_firecrawl_search: parseInt(document.getElementById('tenant-weight-fc').value) || 2,
          weight_firecrawl_scrape: parseInt(document.getElementById('tenant-weight-scrape').value) || 1,
          weight_firecrawl_audit: parseInt(document.getElementById('tenant-weight-audit').value) || 3,
          cycle_start_at: now.toISOString(),
          cycle_reset_at: resetAt.toISOString()
        });
    }

    document.getElementById('tenant-credit-used').value = 0;
    document.getElementById('tenant-credit-start').value = now.toLocaleDateString('pt-BR');
    document.getElementById('tenant-credit-reset').value = resetAt.toLocaleDateString('pt-BR');
    showToast('Créditos resetados com sucesso!', 'success');
  }

  function closeModal() {
    modal.classList.add('hidden');
  }

  // ── Save ──
  async function save(e) {
    e.preventDefault();
    const id = document.getElementById('tenant-edit-id').value;
    const tenantPassword = document.getElementById('tenant-password').value;
    const payload = {
      name: document.getElementById('tenant-name').value.trim(),
      slug: document.getElementById('tenant-slug').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      niche: document.getElementById('tenant-niche').value.trim(),
      owner_name: document.getElementById('tenant-owner').value.trim(),
      email: document.getElementById('tenant-email').value.trim(),
      phone: document.getElementById('tenant-phone').value.trim(),
      plan: document.getElementById('tenant-plan').value,
      monthly_value: parseFloat(document.getElementById('tenant-value').value) || 0,
      due_date: document.getElementById('tenant-due').value || null,
      status: 'active',
      financial_status: 'em_dia',
      terms_accepted: false,
    };

    if (!payload.name || !payload.email) {
      showToast('Preencha nome e e-mail', 'error');
      return;
    }

    // Validar senha se preenchida
    if (tenantPassword && tenantPassword.length < 6) {
      showToast('A senha deve ter pelo menos 6 caracteres', 'error');
      return;
    }

    const creditLimit = parseInt(document.getElementById('tenant-credit-limit').value) || 50;

    try {
      if (id) {
        delete payload.status;
        delete payload.financial_status;
        delete payload.terms_accepted;
        const { error } = await adminSupabase.from('tenants').update(payload).eq('id', id);
        if (error) { showToast('Erro ao atualizar: ' + (error.message || error), 'error'); return; }

        // Salvar créditos
        await saveTenantCredits(id, creditLimit);

        showToast('Tenant atualizado!', 'success');
      } else {
        const { data: newTenant, error } = await adminSupabase.from('tenants').insert(payload).select().single();
        if (error) { showToast('Erro ao criar: ' + (error.message || error), 'error'); return; }

        // Criar créditos para o novo tenant
        const newId = newTenant?.id;
        if (newId) {
          await saveTenantCredits(newId, creditLimit);
        }

        // Log
        if (newTenant?.id) {
          await adminSupabase.from('audit_logs').insert({
            tenant_id: newTenant.id,
            action: 'TENANT_CRIADO',
            entity_type: 'tenant',
            entity_id: newTenant.id,
            metadata: {
              company_name: payload.name,
              niche: payload.niche,
              slug: payload.slug,
              role: 'Superadmin',
            },
          });
        }

        showToast('Infraestrutura criada com sucesso!', 'success');
      }

      // Alterar/criar senha mestra do tenant (se preenchida)
      if (tenantPassword) {
        try {
          const { data: pwResult, error: pwError } = await adminSupabase.changeTenantPassword({
            email: payload.email,
            password: tenantPassword,
            full_name: payload.owner_name || payload.name,
          });

          if (pwError) {
            const errMsg = typeof pwError === 'string' ? pwError : pwError.message || JSON.stringify(pwError);
            showToast('Tenant salvo, mas erro na senha: ' + errMsg, 'error');
            console.error('[HUVI ADMIN] Erro ao alterar senha:', pwError);
          } else {
            const action = pwResult?.action === 'created' ? 'criado' : 'atualizado';
            showToast(`Senha do tenant ${action} com sucesso!`, 'success');
          }
        } catch (pwErr) {
          showToast('Tenant salvo, mas falha ao alterar senha: ' + pwErr.message, 'error');
          console.error('[HUVI ADMIN] Exceção ao alterar senha:', pwErr);
        }
      }

      closeModal();
      load();
    } catch (err) {
      console.error('[HUVI ADMIN] Erro ao salvar tenant:', err);
      showToast('Erro inesperado: ' + err.message, 'error');
    }
  }


  // ── Toggle Status ──
  async function toggleStatus(id, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const { error } = await adminSupabase.from('tenants').update({ status: newStatus }).eq('id', id);
    if (error) { showToast('Erro ao alterar status', 'error'); return; }
    showToast(newStatus === 'active' ? 'Tenant ativado!' : 'Tenant suspenso!', 'success');
    load();
  }

  // ── Delete ──
  async function deleteTenant(id) {
    if (!confirm('Tem certeza que deseja excluir este tenant? Esta ação é irreversível.')) return;
    const { error } = await adminSupabase.from('tenants').delete().eq('id', id);
    if (error) { showToast('Erro ao excluir', 'error'); return; }
    showToast('Tenant excluído', 'success');
    load();
  }

  // ── Search/Filter ──
  function setupSearch() {
    const searchInput = document.getElementById('tenants-search');
    const filterNiche = document.getElementById('filter-niche');
    const filterStatus = document.getElementById('filter-status-tenant');

    const doFilter = async () => {
      const q = searchInput.value.toLowerCase();
      const niche = filterNiche.value;
      const status = filterStatus.value;

      const { data } = await adminSupabase.from('tenants').select().order('created_at', { ascending: false });
      let filtered = data || [];

      if (q) {
        filtered = filtered.filter(t =>
          (t.name || '').toLowerCase().includes(q) ||
          (t.owner_name || '').toLowerCase().includes(q) ||
          (t.slug || '').toLowerCase().includes(q) ||
          (t.email || '').toLowerCase().includes(q)
        );
      }
      if (niche) filtered = filtered.filter(t => t.niche === niche);
      if (status) filtered = filtered.filter(t => t.status === status);

      render(filtered);
    };

    searchInput.addEventListener('input', doFilter);
    filterNiche.addEventListener('change', doFilter);
    filterStatus.addEventListener('change', doFilter);
  }

  // ── Init ──
  function init() {
    document.getElementById('btn-new-tenant').addEventListener('click', () => openModal());
    document.getElementById('close-tenant-modal').addEventListener('click', closeModal);
    document.getElementById('cancel-tenant').addEventListener('click', closeModal);
    modal.querySelector('.modal-overlay').addEventListener('click', closeModal);
    document.getElementById('tenant-form').addEventListener('submit', save);
    const resetBtn = document.getElementById('btn-reset-credits');
    if (resetBtn) resetBtn.addEventListener('click', resetTenantCredits);

    // Toggle visibilidade da senha mestra
    const togglePwBtn = document.getElementById('toggle-tenant-password');
    if (togglePwBtn) {
      togglePwBtn.addEventListener('click', () => {
        const pwInput = document.getElementById('tenant-password');
        if (pwInput.type === 'password') {
          pwInput.type = 'text';
          togglePwBtn.textContent = '🙈';
        } else {
          pwInput.type = 'password';
          togglePwBtn.textContent = '👁️';
        }
      });
    }
    
    // Lógica de envio rápido de link de acesso Global (fora do modal)
    function handleGlobalSendAccess() {
      const email = document.getElementById('global-quick-link-email')?.value.trim();
      let whatsapp = document.getElementById('global-quick-link-whatsapp')?.value.trim();
      const feedback = document.getElementById('global-quick-link-feedback');
      const slug = document.getElementById('global-quick-link-slug')?.value.trim();
      
      if (!slug) {
        if (feedback) {
          feedback.textContent = 'Preencha o Slug Rota URL primeiro!';
          feedback.style.color = 'var(--error)';
        }
        return;
      }

      // Monta o link de autenticação usando query params para evitar Erro 404 de pastas inexistentes
      const host = window.location.host; // ex: huvi.nexus-flow.tech
      const link = `https://${host}/?tenant=${slug}`;
      
      const showFeedback = (msg, isError = false) => {
        if (feedback) {
          feedback.textContent = msg;
          feedback.style.color = isError ? 'var(--error)' : 'var(--success)';
          setTimeout(() => { feedback.textContent = ''; }, 4500);
        }
      };
      
      if (whatsapp && email) {
        // Se ambos foram preenchidos
        whatsapp = whatsapp.replace(/\D/g, '');
        const msg = encodeURIComponent(`Olá! Segue o link para o seu primeiro acesso ao painel HUVI:\n\n${link}`);
        window.open(`https://wa.me/${whatsapp}?text=${msg}`, '_blank');
        
        const subject = encodeURIComponent('HUVI - Seu Link de Acesso');
        const body = encodeURIComponent(`Olá!\n\nSegue o link para o seu primeiro acesso ao painel HUVI:\n\n${link}`);
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`;
        
        setTimeout(() => window.open(gmailUrl, '_blank'), 200);
        showFeedback('✓ Janelas abertas (Email pode ser bloqueado por popup blocker).');
      } else if (whatsapp) {
        whatsapp = whatsapp.replace(/\D/g, ''); // Limpa formatações
        const msg = encodeURIComponent(`Olá! Segue o link para o seu primeiro acesso ao painel HUVI:\n\n${link}`);
        window.open(`https://wa.me/${whatsapp}?text=${msg}`, '_blank');
        showFeedback('✓ WhatsApp aberto com sucesso!');
      } else if (email) {
        const subject = encodeURIComponent('HUVI - Seu Link de Acesso');
        const body = encodeURIComponent(`Olá!\n\nSegue o link para o seu primeiro acesso ao painel HUVI:\n\n${link}`);
        
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`;
        window.open(gmailUrl, '_blank');
        showFeedback('✓ Janela do Gmail aberta com sucesso!');
      } else {
        window.open(link, '_blank');
        showFeedback('✓ Link de acesso aberto!', false);
      }
    }

    document.getElementById('btn-global-send-access')?.addEventListener('click', handleGlobalSendAccess);

    setupSearch();
  }

  return { init, load };
})();
