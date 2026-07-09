/**
 * HUVI — Discovery Module (Google Maps / Outscraper)
 * Descoberta de Oportunidades via Google Maps usando Outscraper
 * Conforme: gemini2.md
 */
const Discovery = (() => {
  function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

  // ── Referências do DOM ──
  const creditsUsedEl = document.getElementById('disc-credits-used');
  const creditsLimitEl = document.getElementById('disc-credits-limit');
  const creditsResetEl = document.getElementById('disc-credits-reset');
  const creditsBarEl = document.getElementById('disc-credits-bar');
  const segmentInput = document.getElementById('disc-segment');
  const stateSelect = document.getElementById('disc-state');
  const citySelect = document.getElementById('disc-city');
  const zoneSelect = document.getElementById('disc-zone');
  const searchBtn = document.getElementById('disc-btn-search');
  const testModeToggle = document.getElementById('disc-test-mode');
  const searchStatusEl = document.getElementById('disc-search-status');
  const searchStatusText = document.getElementById('disc-search-status-text');
  const resultEl = document.getElementById('disc-result');
  const resultBody = document.getElementById('disc-result-body');
  const historyBody = document.getElementById('disc-history-body');

  // KPIs
  const kpiFound = document.getElementById('disc-kpi-found');
  const kpiValid = document.getElementById('disc-kpi-valid');
  const kpiDuplicates = document.getElementById('disc-kpi-duplicates');
  const kpiCreditsUsed = document.getElementById('disc-kpi-credits');
  const kpiRate = document.getElementById('disc-kpi-rate');

  let currentCredits = null;
  let isSearching = false;

  // ── Scorer Determinístico (gemini2.md) ──
  function calculateScore(opp) {
    let score = 0;
    if (opp.phone) score += 15;
    if (opp.website) score += 20;
    if (opp.rating_value && parseFloat(opp.rating_value) >= 4.0) score += 20;
    if (opp.rating_count && parseInt(opp.rating_count) >= 50) score += 15;
    if (opp.address) score += 10;
    if (opp.category) score += 20;
    return score;
  }

  // ── Carregar Créditos ──
  async function loadCredits() {
    const tenantId = await getTenantId();
    if (!tenantId) return;

    const { data, error } = await supabase
      .from('tenant_credits')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      // Tenant ainda não tem créditos — criar com padrão
      if (!data) {
        const { data: newCredits } = await supabase
          .from('tenant_credits')
          .insert({ tenant_id: tenantId, opportunity_limit: 80, opportunity_used: 0 });
        currentCredits = { opportunity_limit: 80, opportunity_used: 0, cycle_reset_at: new Date(Date.now() + 30 * 86400000).toISOString() };
      }
    } else {
      currentCredits = data;
    }

    if (currentCredits) {
      const used = currentCredits.opportunity_used || 0;
      const limit = currentCredits.opportunity_limit || 80;
      const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

      if (creditsUsedEl) creditsUsedEl.textContent = used;
      if (creditsLimitEl) creditsLimitEl.textContent = limit;
      if (creditsBarEl) {
        creditsBarEl.style.width = `${pct}%`;
        creditsBarEl.style.background = pct >= 90 ? 'var(--error-500)' :
                                        pct >= 70 ? 'var(--warning-500)' : 'var(--primary-500)';
      }
      if (creditsResetEl && currentCredits.cycle_reset_at) {
        const resetDate = new Date(currentCredits.cycle_reset_at);
        creditsResetEl.textContent = resetDate.toLocaleDateString('pt-BR');
      }
    }
  }

  // ── Carregar KPIs do Ciclo ──
  async function loadKPIs() {
    const tenantId = await getTenantId();
    if (!tenantId) return;

    const { data: logs } = await supabase
      .from('outscraper_search_log')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (!logs || logs.length === 0) {
      if (kpiFound) kpiFound.textContent = '0';
      if (kpiValid) kpiValid.textContent = '0';
      if (kpiDuplicates) kpiDuplicates.textContent = '0';
      if (kpiCreditsUsed) kpiCreditsUsed.textContent = '0';
      if (kpiRate) kpiRate.textContent = '0%';
      return;
    }

    const totalFound = logs.reduce((acc, l) => acc + (l.results_count || 0), 0);
    const totalValid = logs.reduce((acc, l) => acc + (l.valid_count || 0), 0);
    const totalDuplicates = logs.reduce((acc, l) => acc + (l.duplicates_count || 0), 0);
    const rate = totalFound > 0 ? ((totalValid / totalFound) * 100).toFixed(1) : '0';

    if (kpiFound) kpiFound.textContent = totalFound;
    if (kpiValid) kpiValid.textContent = totalValid;
    if (kpiDuplicates) kpiDuplicates.textContent = totalDuplicates;
    if (kpiCreditsUsed) kpiCreditsUsed.textContent = currentCredits?.opportunity_used || 0;
    if (kpiRate) kpiRate.textContent = `${rate}%`;
  }

  // ── Excluir selecionados ──
  async function deleteSelected() {
    const ids = [...historyBody.querySelectorAll('.chk-history:checked')].map(cb => cb.value);
    if (!ids.length) { showToast('Nenhum item selecionado.', 'info'); return; }
    if (!confirm(`Excluir ${ids.length} entrada(s) do histórico?`)) return;
    const tenantId = await getTenantId();
    const { error } = await supabase
      .from('outscraper_search_log')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', ids)
      .eq('tenant_id', tenantId);
    if (error) { showToast('Erro ao excluir', 'error'); return; }
    await loadHistory();
    await loadKPIs();
    showToast('Excluído(s) com sucesso!', 'success');
  }

  // ── Limpar histórico completo ──
  async function clearAllHistory() {
    if (!confirm('Tem certeza? Todo o histórico de buscas será excluído permanentemente.')) return;
    const tenantId = await getTenantId();
    const { error } = await supabase
      .from('outscraper_search_log')
      .update({ deleted_at: new Date().toISOString() })
      .eq('tenant_id', tenantId);
    if (error) { showToast('Erro ao limpar histórico', 'error'); return; }
    await loadHistory();
    await loadKPIs();
    showToast('Histórico limpo!', 'success');
  }

  // ── Alternar estado do botão Excluir Selecionados ──
  function toggleDeleteSelectedBtn() {
    const btn = document.getElementById('disc-btn-delete-selected');
    if (!btn) return;
    const checked = historyBody.querySelectorAll('.chk-history:checked').length;
    btn.disabled = checked === 0;
  }

  // ── Carregar Histórico de Buscas ──
  async function loadHistory() {
    const tenantId = await getTenantId();
    if (!tenantId || !historyBody) return;

    const { data: logs } = await supabase
      .from('outscraper_search_log')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!logs || logs.length === 0) {
      historyBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:var(--space-6); color:var(--text-muted);">Nenhuma busca realizada ainda.</td></tr>`;
      toggleDeleteSelectedBtn();
      return;
    }

    historyBody.innerHTML = logs.map(log => {
      const date = new Date(log.created_at).toLocaleDateString('pt-BR');
      return `
        <tr>
          <td style="padding:var(--space-3) var(--space-4); text-align:center;">
            <input type="checkbox" class="chk-history" value="${log.id}" title="Selecionar">
          </td>
          <td style="padding:var(--space-3) var(--space-4);">${log.segment}</td>
          <td style="padding:var(--space-3) var(--space-4);">${log.city}/${log.state}</td>
          <td style="padding:var(--space-3) var(--space-4); text-align:center;">${log.results_count}</td>
          <td style="padding:var(--space-3) var(--space-4); text-align:center; color:var(--success-600); font-weight:600;">${log.valid_count}</td>
          <td style="padding:var(--space-3) var(--space-4); text-align:center; color:var(--text-muted);">${log.duplicates_count}</td>
          <td style="padding:var(--space-3) var(--space-4); text-align:center;">${date}</td>
        </tr>
      `;
    }).join('');

    historyBody.querySelectorAll('.chk-history').forEach(cb => {
      cb.addEventListener('change', toggleDeleteSelectedBtn);
    });

    toggleDeleteSelectedBtn();
  }

  // ── Popular Cidades via municipios.js ──
  function populateCities() {
    const selectedState = stateSelect.value;
    citySelect.innerHTML = '<option value="">Selecione a Cidade</option>';
    citySelect.disabled = !selectedState;
    
    if (zoneSelect) {
      zoneSelect.innerHTML = '<option value="">Todas as zonas</option>';
      zoneSelect.disabled = true;
    }

    if (selectedState && typeof MUNICIPIOS !== 'undefined' && MUNICIPIOS[selectedState]) {
      MUNICIPIOS[selectedState].forEach(city => {
        const opt = document.createElement('option');
        opt.value = city;
        opt.textContent = city;
        citySelect.appendChild(opt);
      });
    }
  }

  // ── Popular Zonas via Supabase ──
  async function populateZones() {
    if (!zoneSelect) return;
    const state = stateSelect.value;
    const city = citySelect.value;
    
    zoneSelect.innerHTML = '<option value="">Todas as zonas</option>';
    zoneSelect.disabled = true;

    if (!state || !city) return;

    try {
      const { data, error } = await supabase
        .from('city_zones')
        .select('zones')
        .eq('state', state)
        .eq('city', city)
        .single();
        
      if (!error && data && data.zones && data.zones.length > 0) {
        data.zones.forEach(zone => {
          const opt = document.createElement('option');
          opt.value = zone;
          opt.textContent = zone;
          zoneSelect.appendChild(opt);
        });
        zoneSelect.disabled = false;
      }
    } catch (err) {
      console.error('[HUVI Discovery] Erro ao buscar zonas', err);
    }
  }

  // ── Verificar busca em andamento ──
  async function checkPendingSearch() {
    const tenantId = await getTenantId();
    if (!tenantId) return false;

    const { data } = await supabase
      .from('outscraper_search_queue')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'processing')
      .limit(1);

    if (data && data.length > 0) {
      const search = data[0];
      showSearchStatus(`Buscando empresas em ${search.city}/${search.state} — Segmento: ${search.segment}`);
      isSearching = true;
      searchBtn.disabled = true;
      return true;
    }
    return false;
  }

  function showSearchStatus(text) {
    if (searchStatusEl) searchStatusEl.classList.remove('hidden');
    if (searchStatusText) searchStatusText.textContent = text;
  }

  function hideSearchStatus() {
    if (searchStatusEl) searchStatusEl.classList.add('hidden');
    isSearching = false;
    if (searchBtn) searchBtn.disabled = false;
  }

  function showResult(summary, debugMsg = '') {
    if (!resultEl || !resultBody) return;
    resultEl.classList.remove('hidden');
    
    let warnings = '';
    if (summary.timeWarning) {
      warnings += `
        <div style="margin-top: var(--space-3); padding: var(--space-3); background: rgba(244, 112, 1, 0.08); border-left: 3px solid var(--primary-500); border-radius: var(--radius-sm); font-size: var(--font-xs); color: var(--primary-700); text-align: left;">
          ⏱️ ${escapeHtml(summary.timeWarning)}
        </div>
      `;
    }
    if (summary.zonas_limitadas) {
      warnings += `
        <div style="margin-top: var(--space-3); padding: var(--space-3); background: rgba(244, 112, 1, 0.08); border-left: 3px solid var(--warning-500); border-radius: var(--radius-sm); font-size: var(--font-xs); color: var(--warning-700); text-align: left;">
          ⚠️ Cidade com muitas regiões (${summary.zonas_originais}). Foram processadas apenas as ${summary.zonas_processadas} principais para evitar timeout. 
          Se precisar de mais resultados, refine o segmento ou use o modo teste.
        </div>
      `;
    }

    let html = `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:var(--space-4); text-align:center;">
        <div>
          <div style="font-size:var(--font-2xl); font-weight:800; color:var(--text-primary);">${summary.found}</div>
          <div style="font-size:var(--font-xs); color:var(--text-muted);">Encontradas</div>
        </div>
        <div>
          <div style="font-size:var(--font-2xl); font-weight:800; color:var(--success-600);">${summary.created}</div>
          <div style="font-size:var(--font-xs); color:var(--text-muted);">Criadas</div>
        </div>
        <div>
          <div style="font-size:var(--font-2xl); font-weight:800; color:var(--warning-500);">${summary.duplicates}</div>
          <div style="font-size:var(--font-xs); color:var(--text-muted);">Duplicatas</div>
        </div>
        <div>
          <div style="font-size:var(--font-2xl); font-weight:800; color:var(--error-500);">${summary.errors}</div>
          <div style="font-size:var(--font-xs); color:var(--text-muted);">Erros</div>
        </div>
        <div>
          <div style="font-size:var(--font-2xl); font-weight:800; color:var(--primary-500);">${summary.credits}</div>
          <div style="font-size:var(--font-xs); color:var(--text-muted);">Créditos Usados</div>
        </div>
      </div>
    `;
    html += warnings;

    if (debugMsg) {
      html += `
        <div style="margin-top: var(--space-4); padding: var(--space-3); background: rgba(240, 62, 62, 0.08); border-left: 3px solid var(--error-500); border-radius: var(--radius-sm); font-size: var(--font-xs); color: var(--error-600); text-align: left;">
          <strong>Mensagem de Erro/Alerta da API:</strong> ${escapeHtml(debugMsg)}
        </div>
      `;
      resultEl.style.borderLeftColor = 'var(--error-500)';
      resultEl.style.background = 'rgba(240, 62, 62, 0.02)';
    } else if (warnings) {
      resultEl.style.borderLeftColor = 'var(--warning-500)';
      resultEl.style.background = 'rgba(244, 112, 1, 0.02)';
    } else {
      resultEl.style.borderLeftColor = 'var(--success-500)';
      resultEl.style.background = 'rgba(81, 207, 102, 0.04)';
    }

    resultBody.innerHTML = html;
  }

  // ── Executar Busca ──
  async function executeSearch() {
    const segment = segmentInput.value.trim();
    const state = stateSelect.value;
    const city = citySelect.value;
    const testMode = testModeToggle ? testModeToggle.checked : false;
    const zones = zoneSelect && zoneSelect.value ? [zoneSelect.value] : [];

    if (!segment || !state || !city) {
      showToast('Preencha Segmento, Estado e Cidade para buscar.', 'error');
      return;
    }

    // Validar créditos (se não for modo teste)
    if (!testMode && currentCredits) {
      if (currentCredits.opportunity_used >= currentCredits.opportunity_limit) {
        const resetDate = currentCredits.cycle_reset_at
          ? new Date(currentCredits.cycle_reset_at).toLocaleDateString('pt-BR')
          : 'em breve';
        showToast(`Limite do ciclo atual de oportunidades atingido. Renova em ${resetDate}.`, 'error');
        return;
      }
    }

    // Bloquear botão
    isSearching = true;
    searchBtn.disabled = true;
    const btnText = searchBtn.querySelector('.btn-text');
    const btnLoader = searchBtn.querySelector('.btn-loader');
    if (btnText) btnText.classList.add('hidden');
    if (btnLoader) btnLoader.classList.remove('hidden');

    const statusMsg = testMode 
      ? `[MODO TESTE] Simulando busca em ${city}/${state} — Segmento: ${segment}`
      : `Buscando empresas em ${city}/${state} — Segmento: ${segment}`;
      
    showSearchStatus(statusMsg);
    if (resultEl) resultEl.classList.add('hidden');

    const tenantId = await getTenantId();

    try {
      if (window.isMockMode && !testMode) {
        // ── MOCK MODE: Simular busca ──
        await new Promise(r => setTimeout(r, 2500));

        // Gerar dados simulados
        const mockCompanies = generateMockResults(segment, city, state);
        const found = mockCompanies.length;
        let created = 0;
        let duplicates = 0;
        let errors = 0;

        // Criar source se não existir
        let sourceId = null;
        const { data: existingSources } = await supabase
          .from('sources')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('source_type', 'google_maps')
          .eq('source_name', segment);

        if (existingSources && existingSources.length > 0) {
          sourceId = existingSources[0].id;
        } else {
          const { data: newSource } = await supabase
            .from('sources')
            .insert({
              tenant_id: tenantId,
              source_type: 'google_maps',
              source_name: segment,
              city: city,
              state: state,
              active: true
            });
          if (newSource) sourceId = newSource.id;
        }

        for (const company of mockCompanies) {
          // BLINDAGEM DA FONTE: Só aceita o lead se houver pelo menos uma forma de contato
          const hasContact = company.phone || company.website || company.email;
          if (!hasContact) {
            continue; // Descarta lead sem contato
          }

          // Deduplicação simples (phone, website)
          let isDuplicate = false;

          if (company.phone) {
            const { data: existingByPhone } = await supabase
              .from('opportunities')
              .select('id')
              .eq('tenant_id', tenantId)
              .eq('phone', company.phone)
              .limit(1);
            if (existingByPhone && existingByPhone.length > 0) {
              isDuplicate = true;
              duplicates++;
              continue;
            }
          }

          if (!isDuplicate && company.website) {
            const { data: existingByWebsite } = await supabase
              .from('opportunities')
              .select('id')
              .eq('tenant_id', tenantId)
              .eq('website', company.website)
              .limit(1);
            if (existingByWebsite && existingByWebsite.length > 0) {
              isDuplicate = true;
              duplicates++;
              continue;
            }
          }

          // Calcular score
          const score = calculateScore(company);

          // Criar oportunidade
          const oppPayload = {
            tenant_id: tenantId,
            source_id: sourceId,
            company_name: company.company_name,
            phone: company.phone || null,
            website: company.website || null,
            address: company.address || null,
            city: city,
            state: state,
            rating_value: company.rating_value || null,
            rating_count: company.rating_count || null,
            google_maps_url: company.google_maps_url || null,
            category: company.category || segment,
            origin: 'Google Maps',
            source_service: 'Outscraper',
            status: score >= 60 ? 'scored' : 'discovered',
            score: score
          };

          const { error: insertError } = await supabase
            .from('opportunities')
            .insert(oppPayload);

          if (insertError) {
            errors++;
          } else {
            created++;
          }
        }

        // Atualizar créditos
        const newUsed = (currentCredits?.opportunity_used || 0) + created;
        await supabase
          .from('tenant_credits')
          .update({ opportunity_used: newUsed })
          .eq('tenant_id', tenantId);

        // Registrar log de busca
        await supabase
          .from('outscraper_search_log')
          .insert({
            tenant_id: tenantId,
            segment: segment,
            state: state,
            city: city,
            results_count: found,
            valid_count: created,
            duplicates_count: duplicates,
            errors_count: errors,
            status: 'completed'
          });

        showResult({ found, created, duplicates, errors, credits: created });
        showToast(`Busca concluída! ${created} oportunidades criadas.`, 'success');

      } else {
        // ── MODO REAL / EDGE FUNCTION (seguro — chave nunca vai ao browser) ──
        if (testMode) {
          showSearchStatus(`[TESTE] Conectando ao servidor seguro... Buscando empresas em ${city}/${state} — Segmento: ${segment}`);
        } else {
          showSearchStatus(`Conectando ao servidor seguro... Buscando empresas em ${city}/${state} — Segmento: ${segment}`);
          // Registrar na fila (para rastreabilidade)
          await supabase
            .from('outscraper_search_queue')
            .insert({
              tenant_id: tenantId,
              segment: segment,
              state: state,
              city: city,
              status: 'pending'
            });
        }

        // Chamar a Edge Function com timeout de 3 minutos (180 segundos)
        const timeoutMs = 180000;
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(
            'A busca demorou mais de 3 minutos. Tente um nicho mais específico ou tente novamente.'
          )), timeoutMs)
        );

        // Atualizar status visual com contador regressivo
        let secondsLeft = 180;
        const countdownInterval = setInterval(() => {
          secondsLeft--;
          if (searchStatusText) {
            const modePrefix = testMode ? '[TESTE] ' : '';
            searchStatusText.textContent = `${modePrefix}Buscando empresas em ${city}/${state} (${segment}) — aguardando resposta... ${secondsLeft}s`;
          }
        }, 1000);

        let invokeResult;
        try {
          invokeResult = await Promise.race([
            supabase.functions.invoke('huvi-discovery', {
              body: { segment, state, city, zones, testMode }
            }),
            timeoutPromise
          ]);
        } finally {
          clearInterval(countdownInterval);
        }

        const { data: result, error: fnError } = invokeResult;

        if (fnError) {
          console.error('[HUVI Discovery] Erro na Edge Function:', fnError);
          throw new Error(`Erro ao conectar com o servidor de busca: ${fnError.message || 'Verifique se a Edge Function está publicada no Supabase.'}`);
        }

        if (!result) {
          throw new Error('A Edge Function retornou resposta vazia. Verifique os logs no Supabase Dashboard.');
        }

        if (result.timed_out) {
          showToast(`⏱️ ${result.message}`, 'warning');
          showSearchStatus(result.message);
          throw new Error(result.message);
        }

        if (result.success) {
          showResult({
            found: result.found || 0,
            created: result.created || 0,
            duplicates: result.duplicates || 0,
            errors: result.errors || 0,
            credits: result.credits || 0,
            timeWarning: result.timeWarning || null,
            zonas_processadas: result.zonas_processadas || 0,
            zonas_originais: result.zonas_originais || 0,
            zonas_limitadas: result.zonas_limitadas || false
          }, result.debug_msg);
          
          if (result.timeWarning) {
            showToast(`⚠️ ${result.timeWarning}`, 'warning');
          }
          if (result.debug_msg) {
            showToast(`Busca concluída com erros/alertas. Verifique o painel de resultados.`, 'warning');
          } else if (result.zonas_limitadas) {
            showToast(`Busca concluída! ${result.created || 0} oportunidades criadas (${result.zonas_processadas} de ${result.zonas_originais} regiões processadas).`, 'info');
          } else if (result.testMode) {
            showToast(`[TESTE] Busca concluída! ${result.created || 0} oportunidades teriam sido criadas.`, 'info');
          } else {
            showToast(`Busca concluída! ${result.created || 0} oportunidades criadas.`, 'success');
          }
        } else {
          throw new Error(result.message || 'Erro desconhecido retornado pelo servidor de busca.');
        }
      }
    } catch (err) {
      console.error('[HUVI Discovery] Erro na busca:', err);
      showToast('Erro ao executar busca: ' + (err.message || err), 'error');
    } finally {
      hideSearchStatus();
      if (btnText) btnText.classList.remove('hidden');
      if (btnLoader) btnLoader.classList.add('hidden');
      await loadCredits();
      await loadKPIs();
      await loadHistory();
    }
  }

  // ── Mock: Gerar resultados simulados ──
  function generateMockResults(segment, city, state) {
    const prefixes = ['Centro', 'Espaço', 'Studio', 'Clínica', 'Instituto', 'Casa', 'Ponto', 'Rede'];
    const suffixes = ['Premium', 'Express', 'Plus', 'Master', 'Digital', 'Pro', 'Integral', 'Total'];
    const count = Math.floor(Math.random() * 12) + 8; // 8 a 20 resultados
    const results = [];

    for (let i = 0; i < count; i++) {
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
      const hasPhone = Math.random() > 0.2;
      const hasWebsite = Math.random() > 0.4;
      const hasRating = Math.random() > 0.3;

      results.push({
        company_name: `${prefix} ${segment} ${suffix}`,
        phone: hasPhone ? `${state === 'SP' ? '11' : state === 'RJ' ? '21' : '82'}9${Math.floor(Math.random() * 90000000 + 10000000)}` : null,
        website: hasWebsite ? `www.${segment.toLowerCase().replace(/\s/g, '')}-${i + 1}.com.br` : null,
        address: `Rua ${['das Flores', 'Principal', 'do Comércio', 'Brasil', 'São Paulo'][Math.floor(Math.random() * 5)]}, ${Math.floor(Math.random() * 2000) + 1} - ${city}`,
        rating_value: hasRating ? (Math.random() * 2 + 3).toFixed(1) : null,
        rating_count: hasRating ? Math.floor(Math.random() * 200) + 5 : null,
        google_maps_url: `https://maps.google.com/maps?cid=${Math.floor(Math.random() * 999999999999)}`,
        category: segment
      });
    }

    return results;
  }

  // ── Carregar preferências de descoberta ──
  async function loadPreferences() {
    const tenantId = await getTenantId();
    if (!tenantId) return;

    const { data: settings } = await supabase
      .from('tenant_settings')
      .select('*')
      .eq('tenant_id', tenantId);

    if (settings) {
      const prefs = {};
      settings.forEach(s => { prefs[s.setting_key] = s.setting_value; });

      if (prefs.discovery_segment && segmentInput) segmentInput.value = prefs.discovery_segment;
      if (prefs.discovery_state && stateSelect) {
        stateSelect.value = prefs.discovery_state;
        populateCities();
        if (prefs.discovery_city && citySelect) {
          citySelect.value = prefs.discovery_city;
          populateZones();
        }
      }
    }
  }

  // ── Load ──
  async function load() {
    await loadCredits();
    await loadPreferences();
    await loadKPIs();
    await loadHistory();
    await checkPendingSearch();
  }

  // ── Populate State Dropdown ──
  function populateStates() {
    if (!stateSelect) return;
    const states = [
      'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
      'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
    ];
    const stateNames = {
      'AC':'Acre','AL':'Alagoas','AP':'Amapá','AM':'Amazonas','BA':'Bahia','CE':'Ceará',
      'DF':'Distrito Federal','ES':'Espírito Santo','GO':'Goiás','MA':'Maranhão','MT':'Mato Grosso',
      'MS':'Mato Grosso do Sul','MG':'Minas Gerais','PA':'Pará','PB':'Paraíba','PR':'Paraná',
      'PE':'Pernambuco','PI':'Piauí','RJ':'Rio de Janeiro','RN':'Rio Grande do Norte',
      'RS':'Rio Grande do Sul','RO':'Rondônia','RR':'Roraima','SC':'Santa Catarina',
      'SP':'São Paulo','SE':'Sergipe','TO':'Tocantins'
    };
    stateSelect.innerHTML = '<option value="">Selecione o Estado</option>';
    states.forEach(uf => {
      const opt = document.createElement('option');
      opt.value = uf;
      opt.textContent = `${stateNames[uf]} (${uf})`;
      stateSelect.appendChild(opt);
    });
  }

  // ── Init ──
  function init() {
    populateStates();

    if (stateSelect) {
      stateSelect.addEventListener('change', populateCities);
    }

    if (citySelect) {
      citySelect.addEventListener('change', populateZones);
    }

    if (searchBtn) {
      searchBtn.addEventListener('click', executeSearch);
    }

    const clearBtn = document.getElementById('disc-btn-clear-history');
    if (clearBtn) {
      clearBtn.addEventListener('click', clearAllHistory);
    }

    const deleteSelectedBtn = document.getElementById('disc-btn-delete-selected');
    if (deleteSelectedBtn) {
      deleteSelectedBtn.addEventListener('click', deleteSelected);
    }

    const checkAll = document.getElementById('disc-check-all');
    if (checkAll) {
      checkAll.addEventListener('change', () => {
        historyBody.querySelectorAll('.chk-history').forEach(cb => cb.checked = checkAll.checked);
        toggleDeleteSelectedBtn();
      });
    }
  }

  return { init, load };
})();
