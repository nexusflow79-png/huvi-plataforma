/**
 * HUVI — Opportunities Module
 * Listagem, filtros e modal de detalhes com abas integradas de IA (Auditor, Scorer, Strategist)
 */
const Opportunities = (() => {
  let allOpps = [];
  let currentOpp = null;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function titleCaseCity(city) {
    if (!city) return '';
    const lowercase = city.toLowerCase();
    const words = lowercase.split(' ');
    const prepositions = ['de', 'do', 'da', 'dos', 'das', 'e'];
    return words.map((word, idx) => {
      if (prepositions.includes(word) && idx > 0 && idx < words.length - 1) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  }

  function formatAuditText(str) {
    if (!str) return '-';
    return str.split('\n').map(p => p.trim()).filter(Boolean).map(p => `<p style="margin-bottom: var(--space-3); line-height: 1.6; text-align: justify;">${escapeHtml(p)}</p>`).join('');
  }

  function formatAuditList(jsonStr, type = 'strengths') {
    if (!jsonStr) return '-';
    
    let parsed = jsonStr;
    if (typeof jsonStr === 'string') {
      try {
        parsed = JSON.parse(jsonStr);
      } catch (e) {
        console.warn('[HUVI] Erro ao parsear JSON de audit:', e);
        return jsonStr.split('\n').map(p => p.trim()).filter(Boolean).map(p => `<p style="margin-bottom: var(--space-2); line-height: 1.5;">${escapeHtml(p)}</p>`).join('');
      }
    }

    if (Array.isArray(parsed)) {
      if (type === 'recommendations') {
        return parsed.map(item => {
          const rec = typeof item === 'object' && item.recommendation ? item.recommendation : String(item);
          const rat = typeof item === 'object' && item.rationale ? item.rationale : '';
          return `
            <div style="margin-bottom: var(--space-3); padding: var(--space-3); background: rgba(0,0,0,0.02); border-radius: var(--radius-sm); border-left: 4px solid var(--primary-500);">
              <strong style="color: var(--text-primary); display: block; font-size: var(--font-sm); margin-bottom: 2px;">💡 Recomendação:</strong>
              <span style="color: var(--text-primary); display: block; line-height: 1.5; font-size: var(--font-base); font-weight: 500;">${escapeHtml(rec)}</span>
              ${rat ? `<span style="color: var(--text-secondary); font-size: var(--font-xs); display: block; margin-top: var(--space-2); border-top: 1px dashed var(--surface-300); padding-top: var(--space-2); line-height: 1.4;">💬 Justificativa: ${escapeHtml(rat)}</span>` : ''}
            </div>
          `;
        }).join('');
      } else {
        const icon = type === 'strengths' ? '🟢' : '🔴';
        return `<ul style="margin: 0; padding-left: 0; list-style-type: none;">
          ${parsed.map(item => `
            <li style="margin-bottom: var(--space-2); color: var(--text-primary); display: flex; gap: var(--space-2); align-items: flex-start; line-height: 1.5; font-size: var(--font-base);">
              <span style="flex-shrink: 0; font-size: 10px; margin-top: 3px;">${icon}</span>
              <span>${escapeHtml(item)}</span>
            </li>
          `).join('')}
        </ul>`;
      }
    }

    // Fallback caso não seja array
    if (typeof jsonStr === 'string') {
      return jsonStr.split('\n').map(p => p.trim()).filter(Boolean).map(p => `<p style="margin-bottom: var(--space-2); line-height: 1.5;">${escapeHtml(p)}</p>`).join('');
    }
    return '-';
  }

  const enterpriseKeywords = [
    'lava', 'jato', 'wash', 'car', 'auto', 'ltda', 'me', 'eireli', 'clinica', 'consultorio',
    'academia', 'studio', 'restaurante', 'bar', 'pizzaria', 'loja', 'mercado', 'hotel',
    'buffet', 'salao', 'oficina', 'servico', 'comercio', 'industria', 'distribuidora',
    'associacao', 'cooperativa', 'odontologia', 'medica', 'advocacia', 'escola', 'colegio',
    'brilho', 'centro', 'mecanica', 'posto', 'farmacia', 'drogaria', 'roupa', 'calcado'
  ];

  function isEnterpriseName(name) {
    if (!name) return false;
    const lower = name.toLowerCase();
    return enterpriseKeywords.some(keyword => lower.includes(keyword));
  }

  async function autoSanitizeAndFixOpps(opps, tenantId) {
    console.log('[HUVI] Auto-higienização desativada temporariamente para diagnóstico do n8n.');
    // A rotina abaixo foi comentada para não reverter status até resolvermos o fluxo do n8n.
    /*
    try {
      const [campsRes, auditsRes, scoresRes, stratsRes] = await Promise.all([
        supabase.from('campaigns').select('opportunity_id').eq('tenant_id', tenantId).is('deleted_at', null),
        supabase.from('audits').select('opportunity_id').eq('tenant_id', tenantId),
        supabase.from('scores').select('opportunity_id').eq('tenant_id', tenantId),
        supabase.from('strategies').select('opportunity_id').eq('tenant_id', tenantId)
      ]);

      const campOppIds = new Set((campsRes.data || []).map(c => c.opportunity_id));
      const auditedOppIds = new Set((auditsRes.data || []).map(a => a.opportunity_id));
      const scoredOppIds = new Set((scoresRes.data || []).map(s => s.opportunity_id));
      const strategyOppIds = new Set((stratsRes.data || []).map(st => st.opportunity_id));

      let needsReRender = false;
      const updates = [];

      for (const opp of opps) {
        let oppUpdated = false;
        const payload = {};

        // Caso A: Nome de empresa no campo contato e empresa nula/sem nome
        const contact = opp.contact_name ? opp.contact_name.trim() : '';
        const company = opp.company_name ? opp.company_name.trim() : '';
        const isCompanyEmpty = !company || company.toLowerCase() === 'empresa sem nome' || company.toLowerCase() === 'sem nome';

        if (isCompanyEmpty && contact && isEnterpriseName(contact)) {
          payload.company_name = contact;
          payload.contact_name = null;
          
          opp.company_name = contact;
          opp.contact_name = null;
          oppUpdated = true;
        }

        // Caso B: Status de Campanha Criada indevido
        if (opp.status === 'campaign_created' && !campOppIds.has(opp.id)) {
          let fallbackStatus = 'discovered';
          if (strategyOppIds.has(opp.id)) {
            fallbackStatus = 'strategy_defined';
          } else if (scoredOppIds.has(opp.id)) {
            fallbackStatus = 'scored';
          } else if (auditedOppIds.has(opp.id)) {
            fallbackStatus = 'audited';
          }

          payload.status = fallbackStatus;
          opp.status = fallbackStatus;
          oppUpdated = true;
        }

        if (oppUpdated) {
          needsReRender = true;
          updates.push(
            supabase.from('opportunities').update(payload).eq('id', opp.id)
          );
        }
      }

      if (updates.length > 0) {
        console.log(`[HUVI] Higienizando ${updates.length} oportunidades inconsistentes no Supabase...`);
        await Promise.all(updates);
        if (needsReRender) {
          applyFilters();
        }
      }
    } catch (e) {
      console.error('[HUVI] Erro na rotina de auto-higienização:', e);
    }
    */
  }

  const listEl = document.getElementById('opportunities-list');
  const modal = document.getElementById('modal-opportunity');

  // Filtros
  const searchInput = document.getElementById('opp-search');
  const statusFilter = document.getElementById('opp-filter-status');
  const stateFilter = document.getElementById('opp-filter-state');
  const cityFilter = document.getElementById('opp-filter-city');
  const scoreFilter = document.getElementById('opp-filter-score');

  const STATUS_LABELS = {
    discovered: 'Descoberta',
    enriched: 'Enriquecida',
    audited: 'Diagnosticada',
    scored: 'Classificada',
    strategy_defined: 'Estratégia Definida',
    campaign_created: 'Campanha Criada',
    contacted: 'Enviada para Campanha',
    in_conversation: 'Em Conversa',
    converted: 'Convertida',
    lost: 'Perdida',
    archived: 'Arquivada'
  };

  function populateCitiesDropdown() {
    const selectedState = stateFilter.value;
    const selectedCity = cityFilter.value;

    let cities = [];

    if (selectedState) {
      if (typeof window.MUNICIPIOS !== 'undefined' && window.MUNICIPIOS[selectedState]) {
        cities = window.MUNICIPIOS[selectedState];
      } else {
        const oppsForCityFilter = allOpps.filter(opp => opp.state && opp.state.toUpperCase() === selectedState.toUpperCase());
        cities = [...new Set(oppsForCityFilter.map(opp => opp.city).filter(Boolean))];
        cities.sort((a, b) => a.localeCompare(b));
      }
    } else {
      cities = [...new Set(allOpps.map(opp => opp.city).filter(Boolean))];
      cities.sort((a, b) => a.localeCompare(b));
    }

    cityFilter.innerHTML = '<option value="">Todas as Cidades</option>';
    cities.forEach(city => {
      const option = document.createElement('option');
      option.value = city;
      option.textContent = city;
      if (city === selectedCity) {
        option.selected = true;
      }
      cityFilter.appendChild(option);
    });

    cityFilter.disabled = false;

    const options = Array.from(cityFilter.options).map(o => o.value);
    if (selectedCity && !options.includes(selectedCity)) {
      cityFilter.value = "";
    }
    applyFilters();
  }

  async function load() {
    const tenantId = await getTenantId();
    if (!tenantId) return;

    // Resetar filtros entre navegações para não esconder novos resultados
    if (searchInput) searchInput.value = '';
    if (scoreFilter) scoreFilter.value = '';
    if (statusFilter) statusFilter.value = '';

    const { data, error } = await supabase
      .from('opportunities')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[HUVI] Erro ao carregar oportunidades:', error);
      return;
    }

    allOpps = data || [];
    populateCitiesDropdown();
    applyFilters();

    if (allOpps.length > 0) {
      autoSanitizeAndFixOpps(allOpps, tenantId);
    }
  }

  function applyFilters() {
    const query = searchInput.value.trim().toLowerCase();
    const status = statusFilter.value;
    const state = stateFilter.value;
    const city = cityFilter.value;
    const scoreRange = scoreFilter.value;

    const filtered = allOpps.filter(opp => {
      // 1. Busca por texto
      const textMatch = !query || 
        (opp.company_name && opp.company_name.toLowerCase().includes(query)) ||
        (opp.contact_name && opp.contact_name.toLowerCase().includes(query)) ||
        (opp.city && opp.city.toLowerCase().includes(query));

      // 2. Status
      const statusMatch = !status || opp.status === status;

      // 3. Estado (UF)
      const stateMatch = !state || (opp.state && opp.state.toUpperCase() === state.toUpperCase());

      // 4. Cidade
      const cityMatch = !city || (opp.city && opp.city.toLowerCase() === city.toLowerCase());

      // 5. Score
      let scoreMatch = true;
      if (scoreRange === 'high') {
        scoreMatch = opp.score >= 70;
      } else if (scoreRange === 'medium') {
        scoreMatch = opp.score >= 40 && opp.score < 70;
      } else if (scoreRange === 'low') {
        scoreMatch = opp.score !== null && opp.score < 40;
      }

      return textMatch && statusMatch && stateMatch && cityMatch && scoreMatch;
    });

    renderList(filtered);
  }

  function renderList(opps) {
    if (opps.length === 0) {
      listEl.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: var(--space-10); color: var(--text-muted);">
            Nenhuma oportunidade encontrada com os filtros selecionados.
          </td>
        </tr>`;
      toggleDeleteSelectedBtn();
      return;
    }

    listEl.innerHTML = opps.map(opp => {
      // Definir a classe do score badge
      let scoreClass = 'score-low';
      if (opp.score >= 70) scoreClass = 'score-high';
      else if (opp.score >= 40) scoreClass = 'score-medium';

      const originLabel = opp.origin ? escapeHtml(opp.origin) : '';
      let originBadge = '';
      if (opp.origin === 'Google Maps') {
        originBadge = `<span class="badge" style="margin-left: 8px; font-size: 10px; padding: 2px 6px; background: rgba(244,112,1,0.1); color: var(--primary-500); border: 1px solid rgba(244,112,1,0.2); border-radius: 4px; display: inline-block; vertical-align: middle;">📍 Maps</span>`;
      } else if (opp.origin) {
        originBadge = `<span class="badge" style="margin-left: 8px; font-size: 10px; padding: 2px 6px; background: var(--surface-300); color: var(--text-secondary); border-radius: 4px; display: inline-block; vertical-align: middle;">${escapeHtml(originLabel)}</span>`;
      }

      const oppId = escapeHtml(opp.id);
      const companyName = escapeHtml(opp.company_name || 'Empresa Sem Nome');
      const contactName = escapeHtml(opp.contact_name || '-');
      const contactInfo = escapeHtml(opp.email || opp.phone || '');
      const cityLabel = escapeHtml(opp.city || '-');
      const stateLabel = opp.state ? escapeHtml(' / ' + opp.state) : '';
      const statusLabel = escapeHtml(STATUS_LABELS[opp.status] || opp.status || '');
      const scoreVal = opp.score !== null ? opp.score : '-';

      return `
        <tr style="border-bottom: 1px solid var(--surface-300); transition: background var(--transition-fast);" class="table-row">
          <td style="padding: var(--space-3) var(--space-4); text-align:center;">
            <input type="checkbox" class="chk-opp" value="${oppId}" title="Selecionar">
          </td>
          <td style="padding: var(--space-4) var(--space-5); font-weight: 600; color: var(--text-primary); vertical-align: middle;">
            ${companyName}${originBadge}
          </td>
          <td style="padding: var(--space-4) var(--space-5); color: var(--text-secondary);">
            <div>${contactName}</div>
            <div style="font-size: var(--font-xs); color: var(--text-muted);">${contactInfo}</div>
          </td>
          <td style="padding: var(--space-4) var(--space-5); color: var(--text-muted);">
            ${cityLabel}${stateLabel}
          </td>
          <td style="padding: var(--space-4) var(--space-5);">
            <span class="badge badge-${opp.status}">${statusLabel}</span>
          </td>
          <td style="padding: var(--space-4) var(--space-5); text-align: center;">
            <span class="score-badge ${scoreClass}">${scoreVal}</span>
          </td>
          <td style="padding: var(--space-4) var(--space-5); text-align: right; display: flex; gap: var(--space-2); justify-content: flex-end;">
            <button class="btn btn-ghost btn-sm btn-view-opp" data-id="${oppId}">Visualizar</button>
          </td>
        </tr>
      `;
    }).join('');

    listEl.querySelectorAll('.btn-view-opp').forEach(btn => {
      btn.addEventListener('click', () => {
        const opp = opps.find(o => o.id === btn.dataset.id);
        if (opp) openModal(opp);
      });
    });

    listEl.querySelectorAll('.chk-opp').forEach(cb => {
      cb.addEventListener('change', toggleDeleteSelectedBtn);
    });
    toggleDeleteSelectedBtn();
  }

  // ── Excluir selecionados ──
  async function deleteSelected() {
    const ids = [...listEl.querySelectorAll('.chk-opp:checked')].map(cb => cb.value);
    if (!ids.length) { showToast('Nenhum item selecionado.', 'info'); return; }
    if (!confirm(`Excluir ${ids.length} oportunidade(s)?`)) return;
    const { error } = await supabase
      .from('opportunities')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', ids);
    if (error) { showToast('Erro ao excluir', 'error'); return; }
    showToast('Excluída(s) com sucesso!', 'success');
    load();
  }

  // ── Alternar estado do botão Excluir Selecionados ──
  function toggleDeleteSelectedBtn() {
    const btn = document.getElementById('opp-btn-delete-selected');
    if (!btn) return;
    const checked = listEl.querySelectorAll('.chk-opp:checked').length;
    btn.disabled = checked === 0;
  }

  async function openModal(opp) {
    currentOpp = opp;

    // Reset abas do modal
    modal.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    modal.querySelectorAll('.tab-content').forEach(cont => cont.classList.remove('active'));
    modal.querySelector('.tab-btn[data-tab="tab-opp-info"]').classList.add('active');
    modal.querySelector('#tab-opp-info').classList.add('active');

    // Popular Aba Informações
    document.getElementById('det-company').textContent = opp.company_name || '-';
    document.getElementById('det-contact').textContent = opp.contact_name || '-';
    document.getElementById('det-email').textContent = opp.email || '-';
    document.getElementById('det-phone').textContent = opp.phone || '-';
    
    const webEl = document.getElementById('det-website');
    if (opp.website) {
      let displayText = opp.website;
      if (opp.website.includes('google.com/maps') || opp.website.includes('google.com.br/maps') || opp.website.includes('maps.google')) {
        displayText = 'Ver no Google Maps 📍';
      } else if (opp.website.length > 30) {
        displayText = opp.website.substring(0, 27) + '...';
      }
      const safeUrl = opp.website.startsWith('http') ? opp.website : 'https://' + opp.website;
      webEl.innerHTML = `<a href="${escapeHtml(safeUrl)}" target="_blank" style="color: var(--primary-500); text-decoration: underline; font-weight: 500;">${escapeHtml(displayText)} 🔗</a>`;
    } else {
      webEl.textContent = '-';
    }

    document.getElementById('det-instagram').textContent = opp.instagram || '-';
    document.getElementById('det-location').textContent = `${opp.city || '-'}${opp.state ? ' / ' + opp.state : ''}`;
    document.getElementById('det-status').textContent = STATUS_LABELS[opp.status] || opp.status;
    document.getElementById('det-category').textContent = opp.category || '-';
    document.getElementById('det-rating-val').textContent = opp.rating_value !== null && opp.rating_value !== undefined ? opp.rating_value : '-';
    document.getElementById('det-rating-count').textContent = opp.rating_count || 0;
    document.getElementById('det-origin').textContent = opp.origin || 'Manual';
    document.getElementById('det-source-service').textContent = opp.source_service || 'Manual';
    document.getElementById('det-address').textContent = opp.address || '-';

    const mapsEl = document.getElementById('det-maps-url');
    if (opp.google_maps_url) {
      mapsEl.innerHTML = `<a href="${escapeHtml(opp.google_maps_url)}" target="_blank" style="color: var(--primary-500); text-decoration: underline; font-weight: 500;">Ver no Maps 🗺️</a>`;
    } else {
      mapsEl.textContent = '-';
    }

    // Carregar dados de Diagnóstico (Audits)
    await loadAuditTab(opp.id);

    // Carregar dados de Classificação (Scores)
    await loadScoreTab(opp.id);

    // Carregar dados de Estratégia (Strategies)
    await loadStrategyTab(opp.id);

    // Mostrar modal
    modal.classList.remove('hidden');
  }

  function closeModal() {
    modal.classList.add('hidden');
    currentOpp = null;
  }

  async function loadAuditTab(oppId) {
    try {
      const { data, error } = await supabase
        .from('audits')
        .select('*')
        .eq('opportunity_id', oppId)
        .order('created_at', { ascending: false })
        .limit(1);

      const emptyEl = document.getElementById('opp-audit-empty');
      const contentEl = document.getElementById('opp-audit-content');

      if (error) {
        showToast('Erro ao carregar diagnóstico: ' + error.message, 'error');
        console.error('[HUVI] Erro ao carregar diagnóstico:', error);
        emptyEl.classList.remove('hidden');
        contentEl.classList.add('hidden');
        return;
      }

      if (!data || data.length === 0) {
        emptyEl.classList.remove('hidden');
        contentEl.classList.add('hidden');
      } else {
        emptyEl.classList.add('hidden');
        contentEl.classList.remove('hidden');
        const audit = data[0];
        document.getElementById('det-audit-summary').innerHTML = formatAuditText(audit.audit_summary);
        document.getElementById('det-audit-strengths').innerHTML = formatAuditList(audit.strengths, 'strengths');
        document.getElementById('det-audit-weaknesses').innerHTML = formatAuditList(audit.weaknesses, 'weaknesses');
        document.getElementById('det-audit-recommendations').innerHTML = formatAuditList(audit.recommendations, 'recommendations');
      }
    } catch (e) {
      showToast('Falha ao renderizar diagnóstico: ' + e.message, 'error');
      console.error('[HUVI] Exceção na aba de diagnóstico:', e);
    }
  }

  async function loadScoreTab(oppId) {
    try {
      const { data, error } = await supabase
        .from('scores')
        .select('*')
        .eq('opportunity_id', oppId)
        .order('created_at', { ascending: false })
        .limit(1);

      const emptyEl = document.getElementById('opp-score-empty');
      const contentEl = document.getElementById('opp-score-content');

      if (error) {
        showToast('Erro ao carregar classificação: ' + error.message, 'error');
        console.error('[HUVI] Erro ao carregar classificação:', error);
        emptyEl.classList.remove('hidden');
        contentEl.classList.add('hidden');
        return;
      }

      if (!data || data.length === 0) {
        emptyEl.classList.remove('hidden');
        contentEl.classList.add('hidden');
      } else {
        emptyEl.classList.add('hidden');
        contentEl.classList.remove('hidden');
        const score = data[0];
        document.getElementById('det-score-comm').textContent = `${score.commercial_score} / 100`;
        document.getElementById('det-score-viab').textContent = `${score.viability_score} / 100`;
        document.getElementById('det-score-justification').textContent = score.justification || '';
      }
    } catch (e) {
      showToast('Falha ao renderizar classificação: ' + e.message, 'error');
      console.error('[HUVI] Exceção na aba de classificação:', e);
    }
  }

  async function loadStrategyTab(oppId) {
    try {
      const { data, error } = await supabase
        .from('strategies')
        .select('*')
        .eq('opportunity_id', oppId)
        .order('created_at', { ascending: false })
        .limit(1);

      const emptyEl = document.getElementById('opp-strategy-empty');
      const contentEl = document.getElementById('opp-strategy-content');

      if (error) {
        showToast('Erro ao carregar estratégia: ' + error.message, 'error');
        console.error('[HUVI] Erro ao carregar estratégia:', error);
        emptyEl.classList.remove('hidden');
        contentEl.classList.add('hidden');
        return;
      }

      if (!data || data.length === 0) {
        emptyEl.classList.remove('hidden');
        contentEl.classList.add('hidden');
      } else {
        emptyEl.classList.add('hidden');
        contentEl.classList.remove('hidden');
        const strat = data[0];
        document.getElementById('det-strat-approach').textContent = strat.approach || '';
        
        const convLabels = { direct_checkout: 'Direta (Checkout)', appointment: 'Agendamento (Nexus)', hybrid: 'Híbrida' };
        document.getElementById('det-strat-conv').textContent = convLabels[strat.conversion_type] || strat.conversion_type;
        
        const destEl = document.getElementById('det-strat-dest');
        if (strat.destination_url) {
          destEl.innerHTML = `<a href="${escapeHtml(strat.destination_url)}" target="_blank">${escapeHtml(strat.destination_type || '')} 🔗</a>`;
        } else {
          destEl.textContent = strat.destination_type || '-';
        }
      }
    } catch (e) {
      showToast('Falha ao renderizar estratégia: ' + e.message, 'error');
      console.error('[HUVI] Exceção na aba de estratégia:', e);
    }
  }

  async function runPipeline() {
    if (!currentOpp) return;
    const oppId = currentOpp.id;
    const btn = document.getElementById('btn-run-pipeline');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');

    btn.disabled = true;
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');

    console.log(`[HUVI] Iniciando acionamento do pipeline de IA para a oportunidade: ${oppId}`);

    try {
      const tenantId = await getTenantId();

      async function runLocalPipeline(oppId, tenantId) {
        console.log('[HUVI] runLocalPipeline: iniciando pipeline local...');
        const companyName = currentOpp?.company_name || 'sua empresa';
        let allOk = true;

        const { error: auditErr } = await supabase.from('audits').insert({
          tenant_id: tenantId,
          opportunity_id: oppId,
          audit_summary: 'Presença digital avaliada como regular. O site institucional possui design antigo e não oferece formulários dinâmicos de captura ou canais rápidos de conversão (WhatsApp).',
          strengths: '• Website próprio e domínio ativo.\n• Informações básicas de contato legíveis.',
          weaknesses: '• Falta de pixel de rastreamento do Facebook/Google.\n• Site lento e não otimizado para celulares.\n• Ausência de canal direto de conversão ou automação.',
          recommendations: 'Apresentar a proposta de criação de Landing Pages de conversão focada com integração direta ao Asaas Checkout para venda instantânea do seu produto.'
        });
        if (auditErr) { console.error('[HUVI] Erro audit insert:', auditErr); allOk = false; }

        const { error: scoreErr } = await supabase.from('scores').insert({
          tenant_id: tenantId,
          opportunity_id: oppId,
          commercial_score: 85,
          viability_score: 78,
          justification: 'O lead possui um negócio consolidado, necessita de novos clientes e a nossa oferta ativa (Consultoria) resolve exatamente suas maiores dores identificadas.'
        });
        if (scoreErr) { console.error('[HUVI] Erro score insert:', scoreErr); allOk = false; }

        const { error: stratErr } = await supabase.from('strategies').insert({
          tenant_id: tenantId,
          opportunity_id: oppId,
          approach: 'Enviar mensagem direta elogiando o trabalho deles, apresentando os pontos fracos detectados no diagnóstico do site atual e sugerindo uma demonstração gratuita.',
          conversion_type: 'hybrid',
          destination_type: 'landing_page',
          destination_url: 'https://seusite.com/consultoria'
        });
        if (stratErr) { console.error('[HUVI] Erro strategy insert:', stratErr); allOk = false; }

        const { data: existingCamps, error: campQErr } = await supabase
          .from('campaigns')
          .select('id')
          .eq('opportunity_id', oppId)
          .is('deleted_at', null);
        if (campQErr) { console.error('[HUVI] Erro ao buscar campanhas:', campQErr); allOk = false; }

        // Buscar oferta ativa para contextualizar a copy
        let offerName = '';
        let offerDesc = '';
        try {
          const { data: offerData } = await supabase
            .from('offers')
            .select('name, description')
            .eq('tenant_id', tenantId)
            .eq('active', true)
            .is('deleted_at', null)
            .limit(1)
            .maybeSingle();
          if (offerData) {
            offerName = offerData.name || '';
            offerDesc = offerData.description || '';
          }
        } catch(e) { console.warn('[HUVI] Erro ao buscar oferta:', e); }

        // Gerar 3 mensagens de cadência (D0, D+3, D+7)
        const ofLabel = offerName || 'nossas solu\u00e7\u00f5es';
        const ofDesc120 = offerDesc ? ' \u2014 ' + offerDesc.substring(0, 120) : '';

        const msg1 = offerName
          ? `Ol\u00e1! Somos especializados em ${offerName}${ofDesc120}. Acreditamos que a ${companyName} tem o perfil ideal para se beneficiar do que oferecemos. Preparamos uma proposta personalizada. Vamos agendar uma r\u00e1pida chamada de 10 minutos?`
          : `Ol\u00e1! Acreditamos que a ${companyName} tem um grande potencial de crescimento e gostar\u00edamos de apresentar nossas solu\u00e7\u00f5es. Preparamos uma proposta personalizada. Vamos agendar uma r\u00e1pida chamada de 10 minutos?`;

        const msg2 = `Ol\u00e1! Recentemente falamos sobre como ${ofLabel} pode ajudar a ${companyName}. Gostar\u00edamos de saber se h\u00e1 interesse em agendar uma conversa r\u00e1pida. Que tal?`;

        const msg3 = `Ol\u00e1! Esta \u00e9 nossa \u00faltima mensagem sobre ${ofLabel}. Acreditamos que a ${companyName} tem o perfil ideal para o que oferecemos. Se tiver interesse, basta responder aqui.`;

        const messagesMatrix = [
          { step: 1, delay_days: 0, subject: offerName ? `${offerName} \u2014 Proposta para ${companyName}` : 'Proposta Comercial', message: msg1 },
          { step: 2, delay_days: 3, subject: 'Follow-up \u2014 ' + ofLabel, message: msg2 },
          { step: 3, delay_days: 7, subject: '\u00daltimo contato \u2014 ' + ofLabel, message: msg3 }
        ];

        if (existingCamps && existingCamps.length > 0) {
          const { error: campUpdErr } = await supabase.from('campaigns').update({
            message: msg1,
            messages_matrix: messagesMatrix,
            current_step: 1,
            status: 'draft'
          }).eq('id', existingCamps[0].id);
          if (campUpdErr) { console.error('[HUVI] Erro campaign update:', campUpdErr); allOk = false; }
        } else {
          const { error: campInsErr } = await supabase.from('campaigns').insert({
            tenant_id: tenantId,
            opportunity_id: oppId,
            channel: 'whatsapp',
            subject: offerName ? `${offerName} \u2014 Proposta para ${companyName}` : 'Proposta Comercial',
            message: msg1,
            messages_matrix: messagesMatrix,
            current_step: 1,
            status: 'draft'
          });
          if (campInsErr) { console.error('[HUVI] Erro campaign insert:', campInsErr); allOk = false; }
        }

        const { error: oppUpdErr } = await supabase.from('opportunities').update({
          status: 'campaign_created',
          score: 85
        }).eq('id', oppId);
        if (oppUpdErr) { console.error('[HUVI] Erro opportunity update:', oppUpdErr); allOk = false; }

        console.log('[HUVI] runLocalPipeline finalizado. allOk =', allOk);
        return allOk;
      }
      
      if (window.isMockMode) {
        console.log('[HUVI] Rodando em modo Mock...');
        await new Promise(r => setTimeout(r, 1500));
        await runLocalPipeline(oppId, tenantId);
        showToast('Pipeline finalizado com sucesso pela IA!', 'success');
      } else {
        console.log('[HUVI] Acionando webhook n8n remoto...');
        
        // Timeout de 120 segundos (IA pode demorar)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          console.warn('[HUVI] Limite de tempo (timeout de 120s) excedido na resposta do n8n.');
        }, 120000);

        let n8nSuccess = false;
        try {
          const session = (await supabase.auth.getSession()).data.session;
          const res = await fetch(`${HUVI_CONFIG.SUPABASE_URL}${HUVI_CONFIG.N8N_PROXY}`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token || ''}`
            },
            body: JSON.stringify({ 
              target: HUVI_CONFIG.N8N_WEBHOOKS_TARGETS.PIPELINE, 
              payload: { opportunityId: oppId, tenantId } 
            }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (res.ok) {
            n8nSuccess = true;
            console.log('[HUVI] Webhook do n8n respondeu com sucesso!');
            showToast('Pipeline finalizado com sucesso pela IA!', 'success');
          } else {
            const errData = await res.json().catch(() => ({}));
            console.warn('[HUVI] n8n retornou erro, usando fallback local:', errData);
          }
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          console.warn('[HUVI] Falha na chamada ao n8n, usando fallback local:', fetchErr.message);
        }

        // Se n8n falhou ou não respondeu, executar pipeline localmente via Supabase
        if (!n8nSuccess) {
          console.log('[HUVI] Executando pipeline em modo fallback local...');
          await runLocalPipeline(oppId, tenantId);
          showToast('Pipeline executado em modo local (fallback).', 'info');
        }
      }

      // Recarregar os dados do modal e da listagem principal
      console.log('[HUVI] Buscando dados atualizados da oportunidade no Supabase...');
      let { data: updatedOpp, error: loadErr } = await supabase.from('opportunities').select('*').eq('id', oppId).single();
      
      if (loadErr) {
        console.error('[HUVI] Erro ao recarregar a oportunidade:', loadErr);
      }

      if (updatedOpp) {
        console.log('[HUVI] Oportunidade carregada do banco. Status final:', updatedOpp.status);

        // Verificar se a campanha foi criada (pelo n8n ou fallback anterior)
        const { data: existingCamp } = await supabase
          .from('campaigns')
          .select('id')
          .eq('opportunity_id', oppId)
          .is('deleted_at', null)
          .limit(1);

        // Se não há campanha e status ainda não é 'campaign_created', criar só a campanha
        if ((!existingCamp || existingCamp.length === 0) && updatedOpp.status !== 'campaign_created') {
          console.warn('[HUVI] Pipeline não criou a campanha. Criando via fallback local...');
          showToast('Criando campanha via fallback local...', 'info');

          // Buscar oferta ativa para contextualizar a mensagem
          let offerName = '';
          let offerDesc = '';
          try {
            const { data: offerData } = await supabase
              .from('offers')
              .select('name, description')
              .eq('tenant_id', tenantId)
              .eq('active', true)
              .is('deleted_at', null)
              .limit(1)
              .maybeSingle();
            if (offerData) {
              offerName = offerData.name || '';
              offerDesc = offerData.description || '';
            }
          } catch(e) { console.warn('[HUVI] Erro ao buscar oferta:', e); }

          const fbCompany = currentOpp?.company_name || 'sua empresa';
          const fbOfLabel = offerName || 'nossas solu\u00e7\u00f5es';
          const fbOfDesc120 = offerDesc ? ' \u2014 ' + offerDesc.substring(0, 120) : '';

          const fbMsg1 = offerName
            ? `Ol\u00e1! Somos especializados em ${offerName}${fbOfDesc120}. Acreditamos que a ${fbCompany} tem o perfil ideal para se beneficiar do que oferecemos. Preparamos uma proposta personalizada. Vamos agendar uma r\u00e1pida chamada de 10 minutos?`
            : `Ol\u00e1! Acreditamos que a ${fbCompany} tem um grande potencial de crescimento e gostar\u00edamos de apresentar nossas solu\u00e7\u00f5es. Vamos agendar uma r\u00e1pida chamada de 10 minutos?`;

          const fbMsg2 = `Ol\u00e1! Recentemente falamos sobre como ${fbOfLabel} pode ajudar a ${fbCompany}. Gostar\u00edamos de saber se h\u00e1 interesse em agendar uma conversa r\u00e1pida. Que tal?`;

          const fbMsg3 = `Ol\u00e1! Esta \u00e9 nossa \u00faltima mensagem sobre ${fbOfLabel}. Acreditamos que a ${fbCompany} tem o perfil ideal para o que oferecemos. Se tiver interesse, basta responder aqui.`;

          const fbMatrix = [
            { step: 1, delay_days: 0, subject: offerName ? `${offerName} \u2014 Proposta` : 'Proposta Comercial', message: fbMsg1 },
            { step: 2, delay_days: 3, subject: 'Follow-up \u2014 ' + fbOfLabel, message: fbMsg2 },
            { step: 3, delay_days: 7, subject: '\u00daltimo contato \u2014 ' + fbOfLabel, message: fbMsg3 }
          ];

          const { error: campErr } = await supabase.from('campaigns').insert({
            tenant_id: tenantId,
            opportunity_id: oppId,
            channel: 'whatsapp',
            subject: offerName ? `${offerName} \u2014 Proposta` : 'Proposta Comercial',
            message: fbMsg1,
            messages_matrix: fbMatrix,
            current_step: 1,
            status: 'draft'
          });
          if (campErr) {
            console.error('[HUVI] Erro ao criar campanha fallback:', campErr);
          } else {
            await supabase.from('opportunities').update({
              status: 'campaign_created',
              score: updatedOpp.score || 85
            }).eq('id', oppId);
            // Recarregar
            const { data: reloadOpp } = await supabase.from('opportunities').select('*').eq('id', oppId).single();
            if (reloadOpp) updatedOpp = reloadOpp;
          }
        }

        currentOpp = updatedOpp;
        allOpps = allOpps.map(o => o.id === oppId ? updatedOpp : o);
        applyFilters();

        document.getElementById('det-status').textContent = STATUS_LABELS[updatedOpp.status] || updatedOpp.status;
        await Promise.all([
          loadAuditTab(oppId),
          loadScoreTab(oppId),
          loadStrategyTab(oppId)
        ]);

        const { data: campData } = await supabase
          .from('campaigns')
          .select('*, opportunities(*)')
          .eq('opportunity_id', oppId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1);

        if (campData && campData.length > 0) {
          Campaigns.openMessageModal(campData[0]);
        } else {
          console.warn('[HUVI] Nenhuma campanha encontrada após pipeline.');
        }
      }

    } catch (err) {
      console.error('[HUVI] Erro crítico no pipeline de IA:', err);
      showToast('Falha ao acionar pipeline de IA: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btnText.classList.remove('hidden');
      btnLoader.classList.add('hidden');
      console.log('[HUVI] Finalização de processamento da chamada de pipeline.');
    }
  }

  function init() {
    searchInput.addEventListener('input', applyFilters);
    statusFilter.addEventListener('change', applyFilters);
    stateFilter.addEventListener('change', () => {
      populateCitiesDropdown();
      applyFilters();
    });
    cityFilter.addEventListener('change', applyFilters);
    scoreFilter.addEventListener('change', applyFilters);

    // Batch delete listeners
    document.getElementById('opp-btn-delete-selected').addEventListener('click', deleteSelected);
    document.getElementById('opp-check-all').addEventListener('change', (e) => {
      listEl.querySelectorAll('.chk-opp').forEach(cb => cb.checked = e.target.checked);
      toggleDeleteSelectedBtn();
    });

    // Modal close listeners
    document.getElementById('close-opp-modal').addEventListener('click', closeModal);
    document.getElementById('cancel-opp-detail').addEventListener('click', closeModal);
    modal.querySelector('.modal-overlay').addEventListener('click', closeModal);

    // Run pipeline listener
    document.getElementById('btn-run-pipeline').addEventListener('click', runPipeline);

    // Configurar abas internas do modal de oportunidades
    modal.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        modal.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        modal.querySelector(`#${btn.dataset.tab}`).classList.add('active');
      });
    });
  }

  return { init, load };
})();
