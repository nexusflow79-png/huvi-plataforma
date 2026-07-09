/**
 * HUVI — Campaigns Module
 * Listagem das campanhas geradas pela IA, edição, aprovação e exclusão (soft delete)
 */
const Campaigns = (() => {
  const listEl = document.getElementById('campaigns-list');
  const modal = document.getElementById('modal-campaign-msg');
  const form = document.getElementById('campaign-msg-form');

  const CHANNEL_ICONS = {
    whatsapp: '💬 WhatsApp',
    email: '✉️ E-mail'
  };

  const STATUS_LABELS = {
    draft: 'Rascunho (Aguardando Aprovação)',
    approved: 'Aprovada (Pronta para Enviar)',
    sending: 'Enviando...',
    sent: 'Enviada com Sucesso',
    failed: 'Falhou no Envio',
    cancelled: 'Cancelada'
  };

  let loadedCampaigns = [];

  let activeStep = 1;
  let tempMessagesMatrix = [];
  let currentCampaign = null;

  function saveCurrentStepData() {
    if (!currentCampaign) return;
    const subjectEl = document.getElementById('camp-msg-subject');
    const bodyEl = document.getElementById('camp-msg-body');
    
    if (tempMessagesMatrix && tempMessagesMatrix.length > 0) {
      const currentStepObj = tempMessagesMatrix.find(m => m.step === activeStep);
      if (currentStepObj) {
        currentStepObj.subject = currentCampaign.channel === 'email' ? subjectEl.value.trim() : null;
        currentStepObj.message = bodyEl.value.trim();
      }
    }
  }

  function loadStepData(step) {
    activeStep = step;
    const subjectEl = document.getElementById('camp-msg-subject');
    const bodyEl = document.getElementById('camp-msg-body');
    
    if (tempMessagesMatrix && tempMessagesMatrix.length > 0) {
      const stepData = tempMessagesMatrix.find(m => m.step === step);
      if (stepData) {
        subjectEl.value = stepData.subject || '';
        bodyEl.value = stepData.message || '';
      }
    }
    
    // Atualizar visual das abas
    const tabsHeader = document.getElementById('camp-msg-tabs-header');
    if (tabsHeader) {
      tabsHeader.querySelectorAll('.tab-btn').forEach(btn => {
        const btnStep = parseInt(btn.dataset.step);
        if (btnStep === step) {
          btn.style.background = 'var(--gradient-brand)';
          btn.style.color = 'var(--text-inverse)';
          btn.style.borderColor = 'transparent';
          btn.style.boxShadow = 'var(--shadow-md)';
        } else {
          btn.style.background = 'transparent';
          btn.style.color = 'var(--text-muted)';
          btn.style.borderColor = 'var(--surface-400)';
          btn.style.boxShadow = 'none';
        }
      });
    }
  }

  function generateFallbackMessage(camp, offer) {
    const opp = camp.opportunities || {};
    const channel = camp.channel || 'whatsapp';

    const companyName = opp.company_name || 'sua empresa';
    const contactName = opp.contact_name || '';

    const saudacao = contactName ? 'Ol' + String.fromCharCode(225) + ', ' + contactName + '!' : 'Ol' + String.fromCharCode(225) + '!';

    // 1) Contexto da oferta do tenant (protagonista da mensagem)
    const offerName = (offer && offer.name) ? offer.name : '';
    let ofertaDescricao = '';
    if (offer && offer.description) {
      ofertaDescricao = offer.description.length > 150
        ? offer.description.substring(0, 150) + '\u2026'
        : offer.description;
    }

    // 2) Dores do lead (weaknesses do audit / estatisticas)
    const audit = opp.audits && opp.audits.length > 0 ? opp.audits[0] : null;
    let doresTexto = '';
    if (audit) {
      const weaknesses = audit.weaknesses || '';
      if (weaknesses) {
        const lines = typeof weaknesses === 'string'
          ? weaknesses.split('\n').map(function(l) { return l.trim().replace(/^[\s\u2022\-*]+/, ''); }).filter(Boolean)
          : Array.isArray(weaknesses) ? weaknesses : [];
        if (lines.length > 0) {
          const top = lines.slice(0, 2);
          doresTexto = '\n\nIdentificamos alguns pontos que podem estar limitando seus resultados:\n' +
            top.map(function(d) { return '\u2022 ' + d; }).join('\n');
        }
      }
    }

    if (channel === 'whatsapp') {
      let msg = saudacao + ' Tudo bem?\n\n';
      if (offerName) {
        msg += 'Somos especializados em *' + offerName + '*';
        if (ofertaDescricao) {
          msg += ' \u2014 ' + ofertaDescricao;
        }
        msg += '.\n\nAcreditamos que a *' + companyName + '* tem o perfil ideal para se beneficiar do que oferecemos.';
      } else {
        msg += 'Acreditamos que a *' + companyName + '* tem um grande potencial de crescimento e gostar' + String.fromCharCode(237) + 'amos de ajudar.';
      }
      msg += doresTexto;
      msg += '\n\nPreparamos uma proposta personalizada para o seu neg' + String.fromCharCode(243) + 'cio. Vamos agendar uma r' + String.fromCharCode(225) + 'pida chamada de 10 minutos para conversarmos?';
      return msg;
    }

    // E-mail
    let subjectText = offerName
      ? offerName + ' \u2014 Proposta para ' + companyName
      : 'Proposta Comercial \u2014 ' + companyName;
    let bodyText = saudacao + ' Tudo bem?\n\n';
    if (offerName) {
      bodyText += 'Somos especializados em ' + offerName;
      if (ofertaDescricao) {
        bodyText += ' \u2014 ' + ofertaDescricao;
      }
      bodyText += '.\n\nAcreditamos que a ' + companyName + ' tem o perfil ideal para se beneficiar do que oferecemos.';
    } else {
      bodyText += 'Acreditamos que a ' + companyName + ' tem um grande potencial de crescimento e gostar' + String.fromCharCode(237) + 'amos de apresentar nossas solu' + String.fromCharCode(231) + String.fromCharCode(245) + 'es.';
    }
    bodyText += doresTexto;
    bodyText += '\n\nPreparamos uma proposta personalizada. Gostar' + String.fromCharCode(237) + 'amos de apresentar nossas ideias em uma conversa r' + String.fromCharCode(225) + 'pida de at' + String.fromCharCode(233) + ' 10 minutos.\n\n';
    bodyText += 'Qual seria o melhor hor' + String.fromCharCode(225) + 'rio esta semana?\n\n';
    bodyText += 'Atenciosamente,\nEquipe HUVI';
    return { subject: subjectText, body: bodyText };
  }
  async function openMessageModal(camp) {
    currentCampaign = camp;
    document.getElementById('camp-msg-id').value = camp.id;
    
    const subjectEl = document.getElementById('camp-msg-subject');
    const bodyEl = document.getElementById('camp-msg-body');
    const tabsContainer = document.getElementById('camp-msg-tabs-container');
    const tabsHeader = document.getElementById('camp-msg-tabs-header');
    
    // Ocultar assunto se for WhatsApp
    const subjectGroup = document.getElementById('camp-msg-subject-group');
    if (camp.channel === 'whatsapp') {
      subjectGroup.classList.add('hidden');
    } else {
      subjectGroup.classList.remove('hidden');
    }

    // Processar messages_matrix
    tempMessagesMatrix = [];
    if (camp.messages_matrix) {
      try {
        tempMessagesMatrix = typeof camp.messages_matrix === 'string' 
          ? JSON.parse(camp.messages_matrix) 
          : camp.messages_matrix;
      } catch (e) {
        console.error('[HUVI] Erro ao parsear messages_matrix:', e);
        tempMessagesMatrix = [];
      }
    }

    // Definir passo ativo inicial (current_step ou 1)
    activeStep = camp.current_step || 1;

    // Se a matriz existe e tem elementos
    if (Array.isArray(tempMessagesMatrix) && tempMessagesMatrix.length > 0) {
      tabsContainer.classList.remove('hidden');
      tabsHeader.innerHTML = tempMessagesMatrix.map(m => {
        const delayLabel = m.delay_days === 0 ? 'D0' : `D+${m.delay_days}`;
        return `
          <button type="button" class="btn tab-btn" data-step="${String(m.step).replace(/</g,'&lt;').replace(/>/g,'&gt;')}" style="padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); border: 1px solid var(--surface-400); font-weight: 500; font-size: var(--font-sm); cursor: pointer; transition: all var(--transition-fast);">
            Passo ${String(m.step).replace(/</g,'&lt;').replace(/>/g,'&gt;')} (${String(delayLabel).replace(/</g,'&lt;').replace(/>/g,'&gt;')})
          </button>
        `;
      }).join('');

      // Adicionar listeners para as abas
      tabsHeader.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          // Apenas permite salvar o estado anterior se NÃO estiver travado
          const isLocked = ['sending', 'sent', 'cancelled'].includes(camp.status);
          if (!isLocked) {
            saveCurrentStepData();
          }
          loadStepData(parseInt(btn.dataset.step));
        });
      });

      // Carregar os dados do passo ativo
      loadStepData(activeStep);
    } else {
      // Sem matrix: gerar automaticamente 3 passos de cadência
      let offer = null;
      try {
        const tenantId = await getTenantId();
        if (tenantId) {
          const { data: offerData } = await supabase
            .from('offers')
            .select('name, description')
            .eq('tenant_id', tenantId)
            .eq('active', true)
            .is('deleted_at', null)
            .limit(1)
            .maybeSingle();
          if (offerData) offer = offerData;
        }
      } catch(e) {
        console.warn('[HUVI] Erro ao carregar ofertas para fallback:', e);
      }

      const opp = camp.opportunities || {};
      const companyName = opp.company_name || 'sua empresa';
      const ofLabel = (offer && offer.name) ? offer.name : 'nossas solu\u00e7\u00f5es';

      // Passo 1: usar mensagem existente ou gerar fallback
      let step1Msg = camp.message || '';
      let step1Subject = camp.subject || '';
      if (!step1Msg) {
        const fallback = generateFallbackMessage(camp, offer);
        if (camp.channel === 'email') {
          step1Subject = fallback.subject;
          step1Msg = fallback.body;
        } else {
          step1Msg = fallback;
        }
      }

      // Passos 2 e 3: follow-ups contextualizados
      const step2Msg = `Ol\u00e1! Recentemente falamos sobre como ${ofLabel} pode ajudar a ${companyName}. Gostar\u00edamos de saber se h\u00e1 interesse em agendar uma conversa r\u00e1pida. Que tal?`;
      const step3Msg = `Ol\u00e1! Esta \u00e9 nossa \u00faltima mensagem sobre ${ofLabel}. Acreditamos que a ${companyName} tem o perfil ideal para o que oferecemos. Se tiver interesse, basta responder aqui.`;

      tempMessagesMatrix = [
        { step: 1, delay_days: 0, subject: step1Subject || 'Abordagem Inicial', message: step1Msg },
        { step: 2, delay_days: 3, subject: 'Follow-up \u2014 ' + ofLabel, message: step2Msg },
        { step: 3, delay_days: 7, subject: '\u00daltimo contato \u2014 ' + ofLabel, message: step3Msg }
      ];

      // Mostrar abas
      tabsContainer.classList.remove('hidden');
      tabsHeader.innerHTML = tempMessagesMatrix.map(m => {
        const delayLabel = m.delay_days === 0 ? 'D0' : `D+${m.delay_days}`;
        return `
          <button type="button" class="btn tab-btn" data-step="${String(m.step).replace(/</g,'&lt;').replace(/>/g,'&gt;')}" style="padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); border: 1px solid var(--surface-400); font-weight: 500; font-size: var(--font-sm); cursor: pointer; transition: all var(--transition-fast);">
            Passo ${String(m.step).replace(/</g,'&lt;').replace(/>/g,'&gt;')} (${String(delayLabel).replace(/</g,'&lt;').replace(/>/g,'&gt;')})
          </button>
        `;
      }).join('');

      tabsHeader.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const isLocked = ['sending', 'sent', 'cancelled'].includes(camp.status);
          if (!isLocked) {
            saveCurrentStepData();
          }
          loadStepData(parseInt(btn.dataset.step));
        });
      });

      activeStep = 1;
      loadStepData(1);
    }

    // Gerenciar visibilidade de botões do modal baseado no status
    const btnApprove = document.getElementById('btn-approve-camp');
    const btnSaveDraft = document.getElementById('btn-save-draft-camp');
    const btnSend = document.getElementById('btn-send-camp');
    
    // Se já estiver enviada ou enviando, não permite editar nem aprovar
    const isLocked = ['sending', 'sent', 'cancelled'].includes(camp.status);
    document.getElementById('camp-msg-subject').disabled = isLocked;
    document.getElementById('camp-msg-body').disabled = isLocked;

    if (isLocked) {
      btnApprove.classList.add('hidden');
      btnSaveDraft.classList.add('hidden');
      btnSend.classList.add('hidden');
    } else if (camp.status === 'approved') {
      // Campanha aprovada: pode editar, re-aprovar e ENVIAR
      btnApprove.classList.remove('hidden');
      btnApprove.textContent = 'Salvar Altera\u00e7\u00f5es';
      btnSaveDraft.classList.remove('hidden');
      btnSend.classList.remove('hidden');
    } else {
      // Rascunho: pode editar e aprovar, mas NÃO enviar direto
      btnApprove.classList.remove('hidden');
      btnApprove.textContent = 'Aprovar Campanha';
      btnSaveDraft.classList.remove('hidden');
      btnSend.classList.add('hidden');
    }

    // Resetar modo teste
    const testModeCheck = document.getElementById('camp-test-mode');
    const testFields = document.getElementById('camp-test-fields');
    if (testModeCheck) testModeCheck.checked = false;
    if (testFields) testFields.classList.add('hidden');

    modal.classList.remove('hidden');
  }

  function closeModal() {
    modal.classList.add('hidden');
  }

  async function executeDispatchWorkflow(id) {
    try {
      // 1. Carregar os dados detalhados da campanha
      const { data: camp, error: fetchErr } = await supabase
        .from('campaigns')
        .select('*, opportunities(*, audits(*))')
        .eq('id', id)
        .single();

      if (fetchErr || !camp) {
        console.error('[HUVI] Erro ao buscar campanha para disparo:', fetchErr);
        showToast('Erro ao buscar dados da campanha.', 'error');
        return false;
      }

      // Proteção: não reenviar se já está enviando ou enviada
      if (['sending', 'sent'].includes(camp.status)) {
        showToast('Esta campanha j\u00e1 foi enviada ou est\u00e1 sendo enviada.', 'info');
        return false;
      }

      const tenantId = camp.tenant_id;

      // 2. Modo Teste: sobrescrever contato do lead pelos dados de teste
      const testMode = document.getElementById('camp-test-mode')?.checked;
      if (testMode) {
        const testEmail = document.getElementById('camp-test-email')?.value.trim();
        const testPhone = document.getElementById('camp-test-phone')?.value.trim();
        if (camp.opportunities) {
          if (testEmail) camp.opportunities.email = testEmail;
          if (testPhone) camp.opportunities.phone = testPhone;
          camp.test_email = testEmail || null;
          camp.test_phone = testPhone || null;
        }
        console.log('[HUVI] Modo Teste ativado.');
      }

      // 3. Se a mensagem estiver vazia, gerar com base na oferta
      if (!camp.message) {
        let offer = null;
        try {
          if (tenantId) {
            const { data: offerData } = await supabase
              .from('offers')
              .select('name, description')
              .eq('tenant_id', tenantId)
              .eq('active', true)
              .is('deleted_at', null)
              .limit(1)
              .maybeSingle();
            if (offerData) offer = offerData;
          }
        } catch(e) {
          console.warn('[HUVI] Erro ao carregar ofertas para fallback:', e);
        }
        const fallback = generateFallbackMessage(camp, offer);
        if (camp.channel === 'email') {
          camp.subject = camp.subject || fallback.subject;
          camp.message = fallback.body;
        } else {
          camp.message = fallback;
        }
      }

      // 4. Marcar como 'sending' ANTES de disparar (única atualização)
      await supabase
        .from('campaigns')
        .update({ status: 'sending' })
        .eq('id', id);
      
      load();

      // 5. Disparar webhook para o n8n
      console.log('[HUVI] Disparando webhook do n8n Dispatcher ID:', camp?.id);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      let dispatchSuccess = false;
      try {
        const response = await fetch(HUVI_CONFIG.N8N_WEBHOOKS.DISPATCHER, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(camp),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          dispatchSuccess = true;
        } else {
          console.warn('[HUVI] Webhook do n8n respondeu com status:', response.status);
        }
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        console.error('[HUVI] Chamada ou timeout no webhook do n8n:', fetchErr);
        showToast('Falha de comunica\u00e7\u00e3o com o servidor de disparo.', 'error');
      }

      // 6. Aguardar o n8n processar e atualizar status final
      if (dispatchSuccess) {
        // Dar tempo para o n8n completar o fluxo e atualizar o status no banco
        showToast('Mensagem enviada! Atualizando status...', 'info');
        await new Promise(r => setTimeout(r, 4000));
        
        // Ler o status REAL do banco (atualizado pelo n8n)
        const { data: updatedCamp } = await supabase
          .from('campaigns')
          .select('status, current_step')
          .eq('id', id)
          .single();
        
        if (updatedCamp) {
          const finalStatus = updatedCamp.status;
          if (finalStatus === 'sent') {
            showToast('Campanha enviada com sucesso! Todos os passos conclu\u00eddos.', 'success');
          } else if (finalStatus === 'approved') {
            showToast(`Passo ${(updatedCamp.current_step || 1) - 1} enviado! Pr\u00f3ximo follow-up agendado.`, 'success');
          } else if (finalStatus === 'failed') {
            showToast('Falha no envio da campanha.', 'error');
          } else {
            showToast('Campanha processada.', 'success');
          }
        } else {
          showToast('Campanha enviada com sucesso!', 'success');
        }
      } else {
        await supabase
          .from('campaigns')
          .update({ status: 'failed' })
          .eq('id', id);
        showToast('Falha no envio da campanha comercial.', 'error');
      }

      load();
      return true;

    } catch (e) {
      console.error('[HUVI] Erro cr\u00edtico no fluxo de disparo:', e);
      showToast('Erro ao processar envio de campanha.', 'error');
      return false;
    }
  }

  async function updateCampaignStatusAndCopy(id, status, subject, message) {
    saveCurrentStepData();

    const hasMatrix = Array.isArray(tempMessagesMatrix) && tempMessagesMatrix.length > 0;
    const matrixPayload = hasMatrix ? tempMessagesMatrix : null;

    let finalSubject = subject;
    let finalMessage = message;

    if (hasMatrix) {
      const step1 = tempMessagesMatrix.find(m => m.step === 1) || tempMessagesMatrix[0];
      finalSubject = step1.subject || null;
      finalMessage = step1.message || '';
    }

    // Salvar a copy e o status (sem disparar envio)
    const payload = {
      status,
      subject: finalSubject || null,
      message: finalMessage || null,
      messages_matrix: matrixPayload || null
    };

    const { error } = await supabase
      .from('campaigns')
      .update(payload)
      .eq('id', id);

    if (error) {
      showToast('Erro ao salvar campanha: ' + (error.message || 'Erro desconhecido'), 'error');
      console.error('[HUVI] Erro update campanha:', error);
      return false;
    }

    if (status === 'approved') {
      showToast('Campanha aprovada! Clique em \"Enviar Agora\" para disparar.', 'success');
    } else {
      showToast('Rascunho salvo!', 'success');
    }
    closeModal();
    load();
    return true;
  }

  async function deleteCampaign(id) {
    if (!confirm('Deseja realmente excluir esta campanha comercial?')) return;

    const { error } = await supabase
      .from('campaigns')
      .update({ deleted_at: new Date().toISOString(), status: 'cancelled' })
      .eq('id', id);

    if (error) {
      showToast('Erro ao excluir campanha', 'error');
      console.error('[HUVI] Erro delete campanha:', error);
      return;
    }

    showToast('Campanha excluída com sucesso!', 'success');
    closeModal();
    load();
  }

  // ── Excluir selecionados ──
  async function deleteSelected() {
    const ids = [...listEl.querySelectorAll('.chk-camp:checked')].map(cb => cb.value);
    if (!ids.length) { showToast('Nenhum item selecionado.', 'info'); return; }
    if (!confirm(`Excluir ${ids.length} campanha(s)?`)) return;
    const { error } = await supabase
      .from('campaigns')
      .update({ deleted_at: new Date().toISOString(), status: 'cancelled' })
      .in('id', ids);
    if (error) { showToast('Erro ao excluir', 'error'); return; }
    showToast('Excluída(s) com sucesso!', 'success');
    load();
  }

  // ── Alternar estado do botão Excluir Selecionados ──
  function toggleDeleteSelectedBtn() {
    const btn = document.getElementById('camp-btn-delete-selected');
    if (!btn) return;
    const checked = listEl.querySelectorAll('.chk-camp:checked').length;
    btn.disabled = checked === 0;
  }

  async function approveDirectly(id) {
    const camp = loadedCampaigns.find(c => c.id === id);
    if (!camp) return;

    // Sempre abrir o modal para o usuário revisar e aprovar
    openMessageModal(camp);
  }

  async function sendDirectly(id) {
    const camp = loadedCampaigns.find(c => c.id === id);
    if (!camp) return;
    if (!confirm('Confirma o envio desta campanha para o lead?')) return;
    const ok = await executeDispatchWorkflow(id);
    if (ok) {
      load();
    }
  }

  function renderList(campaigns) {
    loadedCampaigns = campaigns;

    if (!campaigns || campaigns.length === 0) {
      listEl.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: var(--space-10); color: var(--text-muted);">
            Nenhuma campanha gerada no pipeline.
          </td>
        </tr>`;
      toggleDeleteSelectedBtn();
      return;
    }

    listEl.innerHTML = campaigns.map(c => {
      const isDraft = c.status === 'draft';
      const isLocked = ['sending', 'sent', 'cancelled'].includes(c.status);
      
      let statusLabel = STATUS_LABELS[c.status] || c.status;

      // Calcular total de passos se houver matriz
      let totalSteps = 1;
      let stepInfo = '';
      if (c.messages_matrix) {
        try {
          const matrix = typeof c.messages_matrix === 'string' ? JSON.parse(c.messages_matrix) : c.messages_matrix;
          if (Array.isArray(matrix) && matrix.length > 0) {
            totalSteps = matrix.length;
            const currentStep = c.current_step || 1;
            // current_step indica o PRÓXIMO passo a enviar, então enviados = currentStep - 1
            const sentSteps = Math.min(currentStep - 1, totalSteps);
            if (c.status === 'sent' || sentSteps >= totalSteps) {
              stepInfo = `<div style="font-size: var(--font-xs); color: var(--status-success); margin-top: 4px;">Conclu\u00edda (${totalSteps}/${totalSteps})</div>`;
            } else if (sentSteps > 0) {
              stepInfo = `<div style="font-size: var(--font-xs); color: var(--text-muted); margin-top: 4px;">Enviados: ${sentSteps}/${totalSteps} \u2014 Pr\u00f3ximo: Passo ${currentStep}</div>`;
              // Ajustar o label principal se estiver em cadência
              if (c.status === 'approved') {
                statusLabel = 'Em Cad\u00eancia (Aguardando Follow-up)';
              }
            } else {
              stepInfo = `<div style="font-size: var(--font-xs); color: var(--text-muted); margin-top: 4px;">Passo 1/${totalSteps} (aguardando envio)</div>`;
            }
          }
        } catch(e) {
          console.error(e);
        }
      }
      
      let dateDisplay = new Date(c.created_at).toLocaleDateString('pt-BR');
      if (c.status === 'sent') {
        let sentDate = null;
        if (c.dispatches && c.dispatches.length > 0) {
          const sorted = [...c.dispatches]
            .filter(d => d.sent_at)
            .sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));
          if (sorted.length > 0) {
            sentDate = new Date(sorted[0].sent_at);
          }
        }
        if (sentDate) {
          dateDisplay = `🚀 ${sentDate.toLocaleDateString('pt-BR')} ${sentDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        } else {
          dateDisplay = `🚀 ${new Date(c.created_at).toLocaleDateString('pt-BR')}`;
        }
      } else if (c.status === 'sending') {
        dateDisplay = `⏳ Enviando...`;
      }

      return `
        <tr style="border-bottom: 1px solid var(--surface-300); transition: background var(--transition-fast);" class="table-row">
          <td style="padding: var(--space-3) var(--space-4); text-align:center;">
            <input type="checkbox" class="chk-camp" value="${c.id}" title="Selecionar">
          </td>
          <td style="padding: var(--space-4) var(--space-5); font-weight: 600; color: var(--text-primary);">
            ${c.opportunities?.company_name || 'Empresa Sem Nome'}
          </td>
          <td style="padding: var(--space-4) var(--space-5); color: var(--text-secondary);">
            ${CHANNEL_ICONS[c.channel] || c.channel}
          </td>
          <td style="padding: var(--space-4) var(--space-5); color: var(--text-muted); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${c.subject || '-'}">
            ${c.subject || '-'}
          </td>
          <td style="padding: var(--space-4) var(--space-5); color: var(--text-muted); font-size: var(--font-sm);">
            ${dateDisplay}
          </td>
          <td style="padding: var(--space-4) var(--space-5);">
            <span class="badge badge-${c.status}">${statusLabel}</span>
            ${stepInfo}
          </td>
          <td style="padding: var(--space-4) var(--space-5); text-align: right; display: flex; gap: var(--space-2); justify-content: flex-end;">
            <button class="btn btn-ghost btn-sm btn-view-camp-msg" data-id="${c.id}">
              ${isLocked ? 'Ver Copy' : 'Editar Copy'}
            </button>
            ${isDraft ? `
              <button class="btn btn-ghost btn-sm btn-approve-camp-direct" data-id="${c.id}" style="color: var(--success-600);">
                Aprovar
              </button>
            ` : ''}
            ${c.status === 'approved' ? `
              <button class="btn btn-ghost btn-sm btn-send-camp-direct" data-id="${c.id}" style="color: var(--success-600); font-weight: 700;">
                \uD83D\uDE80 Enviar
              </button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');

    // Bind event listeners
    listEl.querySelectorAll('.btn-view-camp-msg').forEach(btn => {
      btn.addEventListener('click', () => {
        const camp = campaigns.find(c => c.id === btn.dataset.id);
        if (camp) openMessageModal(camp);
      });
    });

    listEl.querySelectorAll('.btn-approve-camp-direct').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        approveDirectly(btn.dataset.id);
      });
    });

    listEl.querySelectorAll('.btn-send-camp-direct').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        sendDirectly(btn.dataset.id);
      });
    });

    listEl.querySelectorAll('.chk-camp').forEach(cb => {
      cb.addEventListener('change', toggleDeleteSelectedBtn);
    });
    toggleDeleteSelectedBtn();
  }

  async function load() {
    try {
      const tenantId = await getTenantId();
      if (!tenantId) return;

      // Join oportunidades para obter os dados detalhados do lead e dispatches
      const { data, error } = await supabase
        .from('campaigns')
        .select('*, opportunities(*, audits(*)), dispatches(sent_at)')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        showToast('Erro ao carregar campanhas do banco: ' + error.message, 'error');
        console.error('[HUVI] Erro ao carregar campanhas:', error);
        return;
      }

      renderList(data);
    } catch (e) {
      showToast('Falha na renderização de campanhas: ' + e.message, 'error');
      console.error('[HUVI] Exceção ao carregar campanhas:', e);
    }
  }

  function init() {
    document.getElementById('close-camp-msg').addEventListener('click', closeModal);
    document.getElementById('btn-close-camp-msg').addEventListener('click', closeModal);
    modal.querySelector('.modal-overlay').addEventListener('click', closeModal);

    // Salvar Rascunho
    document.getElementById('btn-save-draft-camp').addEventListener('click', () => {
      const id = document.getElementById('camp-msg-id').value;
      const subject = document.getElementById('camp-msg-subject').value.trim();
      const message = document.getElementById('camp-msg-body').value.trim();
      updateCampaignStatusAndCopy(id, 'draft', subject, message);
    });

    // Aprovar Campanha (salva sem enviar)
    document.getElementById('btn-approve-camp').addEventListener('click', () => {
      const id = document.getElementById('camp-msg-id').value;
      const subject = document.getElementById('camp-msg-subject').value.trim();
      const message = document.getElementById('camp-msg-body').value.trim();
      updateCampaignStatusAndCopy(id, 'approved', subject, message);
    });

    // Enviar Agora (dispara o webhook)
    document.getElementById('btn-send-camp').addEventListener('click', async () => {
      const id = document.getElementById('camp-msg-id').value;
      if (!confirm('Confirma o envio desta campanha para o lead?')) return;
      // Salvar alterações pendentes antes de enviar
      const subject = document.getElementById('camp-msg-subject').value.trim();
      const message = document.getElementById('camp-msg-body').value.trim();
      await updateCampaignStatusAndCopy(id, 'approved', subject, message);
      const ok = await executeDispatchWorkflow(id);
      if (ok) {
        closeModal();
      }
    });

    // Excluir Campanha
    document.getElementById('btn-delete-camp').addEventListener('click', () => {
      const id = document.getElementById('camp-msg-id').value;
      deleteCampaign(id);
    });

    // Modo Teste toggle
    const testModeCheck = document.getElementById('camp-test-mode');
    const testFields = document.getElementById('camp-test-fields');
    if (testModeCheck && testFields) {
      testModeCheck.addEventListener('change', () => {
        testFields.classList.toggle('hidden', !testModeCheck.checked);
      });
    }

    // Batch delete
    document.getElementById('camp-btn-delete-selected').addEventListener('click', deleteSelected);
    document.getElementById('camp-check-all').addEventListener('change', (e) => {
      listEl.querySelectorAll('.chk-camp').forEach(cb => cb.checked = e.target.checked);
      toggleDeleteSelectedBtn();
    });
  }

  return { init, load, openMessageModal };
})();
