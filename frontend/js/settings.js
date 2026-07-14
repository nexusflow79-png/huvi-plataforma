/**
 * HUVI — Settings Module
 * Configurações de Tenant, Profile e Comunicação
 */
const Settings = (() => {

  // Tabs
  function initTabs() {
    const settingsPage = document.getElementById('page-settings');
    if (!settingsPage) return;
    settingsPage.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        settingsPage.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        settingsPage.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        const target = settingsPage.querySelector(`#${btn.dataset.tab}`);
        if (target) target.classList.add('active');
      });
    });
  }

  // Carregar dados do Tenant
  async function loadTenant() {
    const tenant = await getCurrentTenant();
    if (!tenant) return;

    document.getElementById('tenant-name').value = tenant.name || '';
    document.getElementById('tenant-email').value = tenant.email || '';
    document.getElementById('tenant-plan').value = tenant.plan || 'free';
  }

  // Carregar dados do Profile
  async function loadProfile() {
    const profile = await getCurrentProfile();
    if (!profile) return;

    document.getElementById('profile-name').value = profile.full_name || '';
    document.getElementById('profile-email').value = profile.email || '';
  }

  // Carregar preferências de comunicação
  async function loadCommunication() {
    const tenantId = await getTenantId();
    if (!tenantId) return;

    const { data, error } = await supabase
      .from('communication_preferences')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) return;

    document.getElementById('comm-email-enabled').checked = data.email_enabled;
    document.getElementById('comm-whatsapp-enabled').checked = data.whatsapp_enabled;

    if (data.quiet_hours) {
      document.getElementById('comm-quiet-start').value = data.quiet_hours.start || '22:00';
      document.getElementById('comm-quiet-end').value = data.quiet_hours.end || '08:00';
    }
  }

  // Salvar Tenant
  async function saveTenant(e) {
    e.preventDefault();
    const name = document.getElementById('tenant-name').value.trim();
    const tenant = await getCurrentTenant();
    if (!tenant) { showToast('Erro ao identificar a empresa', 'error'); return; }

    const { error } = await supabase
      .from('tenants')
      .update({ name })
      .eq('id', tenant.id);

    if (error) {
      showToast('Erro ao salvar', 'error');
      return;
    }

    showToast('Empresa atualizada!', 'success');
  }

  // Salvar Profile
  async function saveProfile(e) {
    e.preventDefault();
    const fullName = document.getElementById('profile-name').value.trim();
    const profile = await getCurrentProfile();
    if (!profile) { showToast('Erro ao identificar o perfil', 'error'); return; }

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', profile.id);

    if (error) {
      showToast('Erro ao salvar', 'error');
      return;
    }

    showToast('Perfil atualizado!', 'success');
    // Atualizar nome no header
    document.getElementById('user-name').textContent = fullName;
  }

  // Salvar Comunicação
  async function saveCommunication(e) {
    e.preventDefault();

    const payload = {
      email_enabled: document.getElementById('comm-email-enabled').checked,
      whatsapp_enabled: document.getElementById('comm-whatsapp-enabled').checked,
      quiet_hours: {
        start: document.getElementById('comm-quiet-start').value,
        end: document.getElementById('comm-quiet-end').value,
      },
    };

    const { error } = await supabase
      .from('communication_preferences')
      .update(payload)
      .eq('tenant_id', await getTenantId());

    if (error) {
      showToast('Erro ao salvar', 'error');
      return;
    }

    showToast('Preferências atualizadas!', 'success');
  }

  // ── Lógica WhatsApp (Pairing Code) ──
  function switchWaState(stateId) {
    document.querySelectorAll('.wa-state').forEach(el => el.classList.add('hidden'));
    document.getElementById(stateId).classList.remove('hidden');
  }

  async function saveWhatsAppToDB(phone) {
    const tenantId = await getTenantId();
    if (!tenantId) throw new Error('Não foi possível obter o tenant_id do usuário');

    const { error } = await supabase
      .from('tenant_settings')
      .upsert([
        { tenant_id: tenantId, setting_key: 'evolution_instance', setting_value: 'HUVI' },
        { tenant_id: tenantId, setting_key: 'evolution_phone', setting_value: phone }
      ], { onConflict: 'tenant_id,setting_key' });

    if (error) throw error;
  }

  async function handleWaDirectSave() {
    const phoneInput = document.getElementById('wa-phone-number').value.trim();
    if (!phoneInput) {
      showToast('Digite o número de telefone', 'error');
      return;
    }

    const btn = document.getElementById('wa-btn-direct-save');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');
    
    btn.disabled = true;
    if (btnText) btnText.classList.add('hidden');
    if (btnLoader) btnLoader.classList.remove('hidden');

    try {
      await saveWhatsAppToDB(phoneInput);
      document.getElementById('wa-connected-phone').textContent = phoneInput;
      switchWaState('wa-state-connected');
      showToast('WhatsApp registrado diretamente com sucesso!', 'success');
    } catch (err) {
      console.error('[HUVI] Erro no registro direto do WhatsApp:', err);
      showToast('Erro ao salvar no banco: ' + (err.message || err), 'error');
    } finally {
      btn.disabled = false;
      if (btnText) btnText.classList.remove('hidden');
      if (btnLoader) btnLoader.classList.add('hidden');
    }
  }

  async function handleGenerateCode(e) {
    e.preventDefault();
    const phoneInput = document.getElementById('wa-phone-number').value.trim();
    if (!phoneInput) {
      showToast('Digite o número de telefone', 'error');
      return;
    }

    const btn = document.getElementById('wa-btn-generate');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');
    
    btn.disabled = true;
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');

    try {
      // Chama o Webhook do n8n (que atua como Proxy para a Evolution API)
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(`${HUVI_CONFIG.SUPABASE_URL}${HUVI_CONFIG.N8N_PROXY}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({ 
          target: HUVI_CONFIG.N8N_WEBHOOKS_TARGETS.WHATSAPP_CONNECT,
          payload: { phone: phoneInput, instanceName: 'HUVI' }
        })
      });

      if (!res.ok) throw new Error('Erro na comunicação com o servidor');

      const data = await res.json();
      
      if (data.success && data.code) {
        document.getElementById('wa-pairing-code').textContent = data.code;
        switchWaState('wa-state-pairing');
      } else {
        throw new Error('Não foi possível gerar o código.');
      }
    } catch (err) {
      console.error(err);
      if (confirm('Não foi possível contactar o servidor de pareamento (ele pode estar offline ou a instância já está pareada).\n\nDeseja registrar o número ' + phoneInput + ' e a instância HUVI diretamente no banco de dados para ativar os envios?')) {
        try {
          await saveWhatsAppToDB(phoneInput);
          document.getElementById('wa-connected-phone').textContent = phoneInput;
          switchWaState('wa-state-connected');
          showToast('Conexão registrada diretamente no Supabase!', 'success');
        } catch (dbErr) {
          console.error(dbErr);
          showToast('Erro ao gravar no banco de dados: ' + (dbErr.message || dbErr), 'error');
        }
      } else {
        showToast('Falha ao gerar código de pareamento.', 'error');
      }
    } finally {
      btn.disabled = false;
      btnText.classList.remove('hidden');
      btnLoader.classList.add('hidden');
    }
  }

  async function handleWaDone() {
    const phoneInput = document.getElementById('wa-phone-number').value.trim();
    try {
      await saveWhatsAppToDB(phoneInput);
      document.getElementById('wa-connected-phone').textContent = phoneInput;
      switchWaState('wa-state-connected');
      showToast('Dispositivo conectado e salvo com sucesso!', 'success');
    } catch (err) {
      console.error('[HUVI] Erro ao salvar conexao wa:', err);
      showToast('Erro ao salvar conexão no banco de dados: ' + (err.message || err), 'error');
    }
  }

  function handleWaCancel() {
    document.getElementById('wa-phone-number').value = '';
    switchWaState('wa-state-disconnected');
  }

  async function handleWaDisconnect() {
    if (!confirm('Deseja realmente desconectar este dispositivo do HUVI?')) return;
    const tenantId = await getTenantId();
    if (tenantId) {
      const { error } = await supabase
        .from('tenant_settings')
        .delete()
        .eq('tenant_id', tenantId)
        .in('setting_key', ['evolution_instance', 'evolution_phone']);
        
      if (error) {
        console.error('[HUVI] Erro ao deletar settings wa:', error);
        showToast('Erro ao remover conexão do banco.', 'error');
        return;
      }
    }
    document.getElementById('wa-phone-number').value = '';
    switchWaState('wa-state-disconnected');
    showToast('Dispositivo desconectado.', 'info');
  }

  async function loadWhatsAppSettings() {
    const tenantId = await getTenantId();
    if (!tenantId) return;

    const { data, error } = await supabase
      .from('tenant_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('setting_key', ['evolution_instance', 'evolution_phone']);

    if (error || !data || data.length === 0) {
      switchWaState('wa-state-disconnected');
      return;
    }

    const settings = {};
    data.forEach(item => {
      settings[item.setting_key] = item.setting_value;
    });

    if (settings.evolution_phone) {
      document.getElementById('wa-connected-phone').textContent = settings.evolution_phone;
      switchWaState('wa-state-connected');
    } else {
      switchWaState('wa-state-disconnected');
    }
  }

  function initWhatsApp() {
    const form = document.getElementById('wa-connect-form');
    if (form) form.addEventListener('submit', handleGenerateCode);

    const btnDirectSave = document.getElementById('wa-btn-direct-save');
    if (btnDirectSave) btnDirectSave.addEventListener('click', handleWaDirectSave);

    const btnCancel = document.getElementById('wa-btn-cancel');
    if (btnCancel) btnCancel.addEventListener('click', handleWaCancel);

    const btnDone = document.getElementById('wa-btn-done');
    if (btnDone) btnDone.addEventListener('click', handleWaDone);

    const btnDisconnect = document.getElementById('wa-btn-disconnect');
    if (btnDisconnect) btnDisconnect.addEventListener('click', handleWaDisconnect);
  }

  async function load() {
    await Promise.all([loadTenant(), loadProfile(), loadCommunication(), loadWhatsAppSettings(), loadSubscription()]);
  }

  // ── Assinatura Asaas ──
  async function loadSubscription() {
    const tenant = await getCurrentTenant();
    if (!tenant) return;

    const planEl = document.getElementById('sub-current-plan');
    const statusEl = document.getElementById('sub-current-status');
    const statusMsg = document.getElementById('sub-status-msg');
    const statusText = document.getElementById('sub-status-text');

    if (!planEl || !statusEl) return;

    const planNames = { free: 'Free', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' };
    const statusLabels = { none: 'Não assinado', active: 'Ativo', overdue: 'Atrasado', canceled: 'Cancelado', pending: 'Pendente' };
    const statusColors = { active: 'var(--success-500)', overdue: 'var(--error-500)', canceled: 'var(--text-muted)', pending: 'var(--warning-500)' };

    planEl.textContent = planNames[tenant.plan] || 'Free';
    statusEl.textContent = statusLabels[tenant.subscription_status] || 'Não assinado';
    statusEl.style.color = statusColors[tenant.subscription_status] || 'var(--text-muted)';

    if (tenant.subscription_status === 'overdue') {
      statusMsg.classList.remove('hidden');
      statusText.textContent = 'Sua assinatura está atrasada. Regularize o pagamento para continuar usando todos os recursos.';
    } else if (tenant.subscription_status === 'pending') {
      statusMsg.classList.remove('hidden');
      statusText.textContent = 'Aguardando confirmação do pagamento. Você será notificado quando for aprovado.';
    } else {
      statusMsg.classList.add('hidden');
    }

    // Desabilitar botão se já tem plano ativo
    document.querySelectorAll('.sub-btn').forEach(btn => {
      if (tenant.subscription_status === 'active' || tenant.subscription_status === 'pending') {
        btn.disabled = true;
        btn.textContent = tenant.plan === btn.dataset.plan ? 'Plano Atual' : 'Indisponível';
      }
    });
  }

  async function handleSubscribe(e) {
    const plan = e.target.dataset.plan;
    if (!plan) return;

    const btn = e.target;
    const btnText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Criando assinatura...';

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const res = await fetch(`${HUVI_CONFIG.SUPABASE_URL}/functions/v1/huvi-asaas-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': HUVI_CONFIG.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ plan }),
      });

      const data = await res.json();

      if (!data.success) throw new Error(data.message || 'Erro ao criar assinatura');

      if (data.checkout_url) {
        window.open(data.checkout_url, '_blank');
        showToast('Assinatura criada! Complete o pagamento na janela aberta.', 'success');
        setTimeout(() => loadSubscription(), 2000);
      }
    } catch (err) {
      console.error('[HUVI] Erro assinatura:', err);
      showToast('Erro ao criar assinatura: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = btnText;
    }
  }

  function initSubscription() {
    document.querySelectorAll('.sub-btn').forEach(btn => {
      btn.addEventListener('click', handleSubscribe);
    });
  }

  function init() {
    initTabs();
    initWhatsApp();
    initSubscription();
    document.getElementById('tenant-form').addEventListener('submit', saveTenant);
    document.getElementById('profile-form').addEventListener('submit', saveProfile);
    document.getElementById('communication-form').addEventListener('submit', saveCommunication);
  }

  return { init, load };
})();
