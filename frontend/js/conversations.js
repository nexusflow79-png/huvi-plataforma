/**
 * HUVI — Conversas (Chat SDR)
 * Módulo para gerenciar, visualizar e interagir com conversas do WhatsApp/Email
 */
const Conversations = (() => {
  let activeConversationId = null;
  let activeOpportunityId = null;
  let conversationsData = [];
  let pollInterval = null;

  async function getTenantId() {
    return window.getTenantId ? await window.getTenantId() : null;
  }

  // 1. Inicializar Módulo
  function init() {
    console.log('[HUVI] Inicializando módulo de Conversas...');

    // Evento de envio de mensagem
    const sendForm = document.getElementById('chat-send-form');
    if (sendForm) {
      sendForm.addEventListener('submit', handleSendMessage);
    }

    // Botão de atualizar lista
    const refreshBtn = document.getElementById('btn-refresh-conversations');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', load);
    }
  }

  // 2. Carregar Lista de Conversas
  async function load() {
    try {
      const tenantId = await getTenantId();
      if (!tenantId) return;

      // Buscar conversas da tabela conversations com join simples da oportunidade vinculada
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select(`
          id,
          channel,
          status,
          created_at,
          opportunity:opportunities (
            id,
            company_name,
            contact_name,
            phone,
            email,
            status
          )
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[HUVI] Erro ao buscar conversas:', error);
        showToast('Erro ao carregar conversas', 'error');
        return;
      }

      conversationsData = conversations || [];
      renderConversationsList();

      // Iniciar polling curto se estiver na página ativa
      startPolling();

    } catch (err) {
      console.error('[HUVI] Erro load conversas:', err);
    }
  }

  // 3. Renderizar Lista Lateral
  function renderConversationsList() {
    const listContainer = document.getElementById('conversations-list-container');
    if (!listContainer) return;

    if (conversationsData.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: var(--space-5); font-size: var(--font-sm);">
          Nenhuma conversa aberta no momento.
        </div>
      `;
      return;
    }

    listContainer.innerHTML = conversationsData.map(c => {
      const opp = c.opportunity || {};
      const name = opp.company_name || opp.contact_name || 'Lead sem Nome';
      const detail = opp.phone || opp.email || '';
      const isActive = c.id === activeConversationId ? 'background: var(--primary-50); border-left: 4px solid var(--primary-500);' : '';
      const statusBadge = getStatusBadge(c.status);

      return `
        <div class="conversation-item" data-id="${c.id}" style="padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--surface-100); cursor: pointer; transition: all 0.2s; ${isActive}" onclick="Conversations.selectConversation('${c.id}')">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
            <strong style="font-size: var(--font-sm); color: var(--text-main); display: block; max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${name}</strong>
            ${statusBadge}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: var(--font-xs); color: var(--text-secondary);">${detail}</span>
            <span style="font-size: var(--font-xs); color: var(--text-muted);">${c.channel === 'whatsapp' ? '🟢 WA' : '📧 Email'}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Retorna HTML da badge de status da conversa
  function getStatusBadge(status) {
    let color = 'var(--text-muted)';
    let bg = 'var(--surface-100)';
    let label = status;

    if (status === 'open') { label = 'Aberta'; color = 'var(--primary-600)'; bg = 'var(--primary-50)'; }
    else if (status === 'active') { label = 'Ativa'; color = 'var(--success-600)'; bg = 'rgba(81, 207, 102, 0.1)'; }
    else if (status === 'waiting') { label = 'Aguardando'; color = 'var(--warning-600)'; bg = 'rgba(244, 112, 1, 0.08)'; }
    else if (status === 'closed') { label = 'Fechada'; color = 'var(--text-muted)'; bg = 'var(--surface-200)'; }

    return `<span class="badge" style="color: ${color}; background: ${bg}; padding: 2px 6px; font-size: 10px; font-weight: 700; border-radius: 4px; border: none;">${label}</span>`;
  }

  // 4. Selecionar Conversa Ativa
  async function selectConversation(id) {
    activeConversationId = id;
    const conversation = conversationsData.find(c => c.id === id);
    if (!conversation) return;

    activeOpportunityId = conversation.opportunity?.id || null;

    // Atualizar UI da lista lateral (marcação do item selecionado)
    renderConversationsList();

    // Mostrar os estados de visualização de conversa ativa
    document.getElementById('chat-empty-state').classList.add('hidden');
    document.getElementById('chat-active-state').classList.remove('hidden');

    // Atualizar informações do Lead no header do chat
    document.getElementById('chat-lead-name').textContent = conversation.opportunity?.company_name || 'Lead';
    document.getElementById('chat-lead-company').textContent = conversation.opportunity?.contact_name || '';
    
    const badge = document.getElementById('chat-status-badge');
    badge.textContent = conversation.status === 'open' ? 'Aberta' : conversation.status === 'active' ? 'Ativa' : conversation.status === 'waiting' ? 'Aguardando' : 'Fechada';
    badge.className = `badge badge-${conversation.status === 'open' || conversation.status === 'active' ? 'success' : 'warning'}`;

    // Carregar mensagens
    await loadMessages();
  }

  // 5. Carregar e Renderizar Mensagens
  async function loadMessages() {
    if (!activeConversationId) return;

    try {
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', activeConversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[HUVI] Erro ao buscar mensagens:', error);
        return;
      }

      renderMessages(messages || []);

    } catch (err) {
      console.error(err);
    }
  }

  // Renderizar balões de mensagem
  function renderMessages(messages) {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    if (messages.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: var(--space-4); font-size: var(--font-sm);">
          Nenhuma mensagem nesta conversa ainda.
        </div>
      `;
      return;
    }

    container.innerHTML = messages.map(m => {
      const isLead = m.sender === 'lead';
      const isSystem = m.sender === 'system';
      
      let bubbleBg = 'var(--primary-500)';
      let textColor = '#fff';
      let align = 'align-self: flex-end;';
      let nameLabel = 'Você';

      if (isLead) {
        bubbleBg = '#fff';
        textColor = 'var(--text-main)';
        align = 'align-self: flex-start;';
        nameLabel = 'Lead';
      } else if (isSystem) {
        bubbleBg = 'var(--surface-200)';
        textColor = 'var(--text-secondary)';
        align = 'align-self: center; text-align: center; font-size: var(--font-xs);';
        nameLabel = 'Sistema';
      }

      const formattedTime = new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      return `
        <div class="message-bubble-wrapper" style="display: flex; flex-direction: column; max-width: 70%; ${align}">
          <span style="font-size: 10px; color: var(--text-muted); margin-bottom: 2px; ${isLead ? 'align-self: flex-start;' : 'align-self: flex-end;'}">${nameLabel} • ${formattedTime}</span>
          <div style="background: ${bubbleBg}; color: ${textColor}; padding: var(--space-3) var(--space-4); border-radius: var(--radius-lg); box-shadow: 0 1px 2px rgba(0,0,0,0.05); font-size: var(--font-sm); white-space: pre-wrap; word-break: break-word;">
            ${m.content}
          </div>
        </div>
      `;
    }).join('');

    // Rolar para o final do chat
    container.scrollTop = container.scrollHeight;
  }

  // 6. Enviar Mensagem Rápida
  async function handleSendMessage(e) {
    e.preventDefault();
    if (!activeConversationId) return;

    const input = document.getElementById('chat-message-input');
    const content = input.value.trim();
    if (!content) return;

    try {
      const tenantId = await getTenantId();
      
      // 1. Inserir a mensagem localmente no banco do Supabase
      const { data: newMsg, error } = await supabase
        .from('messages')
        .insert({
          tenant_id: tenantId,
          conversation_id: activeConversationId,
          sender: 'agent',
          content: content,
          message_type: 'text'
        })
        .select()
        .single();

      if (error) {
        console.error('[HUVI] Erro ao gravar mensagem:', error);
        showToast('Erro ao enviar mensagem no banco', 'error');
        return;
      }

      // Limpar o input
      input.value = '';

      // Atualizar mensagens na tela imediatamente
      await loadMessages();

      // 2. Disparar o envio real pelo WhatsApp do lead via API do n8n / Evolution API
      const conversation = conversationsData.find(c => c.id === activeConversationId);
      const opportunity = conversation?.opportunity || {};

      if (conversation.channel === 'whatsapp' && opportunity.phone) {
        // Enviar para o n8n que dispara a mensagem
        // Mapeamos para o webhook do n8n que podemos conectar ao Evolution API
        const settingsRes = await supabase
          .from('tenant_settings')
          .select('setting_value')
          .eq('tenant_id', tenantId)
          .eq('setting_key', 'evolution_instance')
          .single();

        const instanceName = settingsRes.data?.setting_value || 'HUVI';

        // Disparar requisição de envio para a Evolution API via proxy n8n ou direto
        // Usamos um nó de dispatch manual
        // Para manter simples e encapsulado, o n8n gerencia isso.
        // Simulamos o webhook para enviar a mensagem manual do chat
        const session = (await supabase.auth.getSession()).data.session;
        fetch(`${HUVI_CONFIG.SUPABASE_URL}${HUVI_CONFIG.N8N_PROXY}`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || ''}`
          },
          body: JSON.stringify({
            target: HUVI_CONFIG.N8N_WEBHOOKS_TARGETS.WHATSAPP_CONNECT,
            payload: {
              phone: opportunity.phone,
              messageText: content,
              instanceName: instanceName,
              action: 'send'
            }
          })
        }).catch(err => console.error('[HUVI] Falha ao despachar webhook WhatsApp:', err));
      }

    } catch (err) {
      console.error('[HUVI] Erro ao processar envio:', err);
    }
  }

  // 7. Polling de Mensagens
  function startPolling() {
    stopPolling();
    // Executa a cada 5 segundos se estiver visualizando a página de conversas
    pollInterval = setInterval(() => {
      const activePage = document.querySelector('.page.active');
      if (activePage && activePage.id === 'page-conversations') {
        loadMessages();
      } else {
        stopPolling();
      }
    }, 5000);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  return {
    init,
    load,
    selectConversation
  };
})();

// Tornar público globalmente para navegação inline
window.Conversations = Conversations;
