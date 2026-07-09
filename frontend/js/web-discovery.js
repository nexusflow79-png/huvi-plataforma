/**
 * HUVI — Web Discovery Module
 * Descoberta de Oportunidades via Firecrawl Search (websites, blogs, páginas web)
 * Conforme: gemini3.md v2.0 (Modo Descoberta Web)
 */
const WebDiscovery = (() => {
  function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

  // ── Referências do DOM ──
  const creditsUsedEl = document.getElementById('webdisc-credits-used');
  const creditsLimitEl = document.getElementById('webdisc-credits-limit');
  const creditsResetEl = document.getElementById('webdisc-credits-reset');
  const creditsBarEl = document.getElementById('webdisc-credits-bar');
  const creditsAnalysisUsedEl = document.getElementById('webdisc-analysis-used');
  const creditsAnalysisLimitEl = document.getElementById('webdisc-analysis-limit');
  const keywordsInput = document.getElementById('webdisc-keywords');
  const sourceSelect = document.getElementById('webdisc-source');
  const includeDomainsInput = document.getElementById('webdisc-include-domains');
  const excludeDomainsInput = document.getElementById('webdisc-exclude-domains');
  const searchBtn = document.getElementById('webdisc-btn-search');
  const testModeToggle = document.getElementById('webdisc-test-mode');
  const searchStatusEl = document.getElementById('webdisc-search-status');
  const searchStatusText = document.getElementById('webdisc-search-status-text');
  const resultEl = document.getElementById('webdisc-result');
  const resultBody = document.getElementById('webdisc-result-body');
  const historyBody = document.getElementById('webdisc-history-body');

  // KPIs
  const kpiFound = document.getElementById('webdisc-kpi-found');
  const kpiValid = document.getElementById('webdisc-kpi-valid');
  const kpiDuplicates = document.getElementById('webdisc-kpi-duplicates');
  const kpiRate = document.getElementById('webdisc-kpi-rate');

  let isSearching = false;

  // ── Scoring (gemini3.md) ──
  function calculateScore(opp) {
    let score = 0;
    if (opp.phone) score += 15;
    if (opp.website) score += 20;
    if (opp.email) score += 15;
    if (opp.description && opp.description.length > 100) score += 10;
    if (opp.company_name) score += 10;
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

    if (error || !data) return;

    const analysisUsed = data.analysis_used || 0;
    const analysisLimit = data.analysis_limit || 20;
    const oppUsed = data.opportunity_used || 0;
    const oppLimit = data.opportunity_limit || 80;
    const analysisPct = analysisLimit > 0 ? Math.min((analysisUsed / analysisLimit) * 100, 100) : 0;

    if (creditsUsedEl) creditsUsedEl.textContent = analysisUsed;
    if (creditsLimitEl) creditsLimitEl.textContent = analysisLimit;
    if (creditsBarEl) {
      creditsBarEl.style.width = `${analysisPct}%`;
      creditsBarEl.style.background = analysisPct >= 90 ? 'var(--error-500)' :
                                      analysisPct >= 70 ? 'var(--warning-500)' : 'var(--primary-500)';
    }
    if (creditsResetEl && data.cycle_reset_at) {
      creditsResetEl.textContent = new Date(data.cycle_reset_at).toLocaleDateString('pt-BR');
    }
    if (creditsAnalysisUsedEl) creditsAnalysisUsedEl.textContent = oppUsed;
    if (creditsAnalysisLimitEl) creditsAnalysisLimitEl.textContent = oppLimit;
  }

  // ── Carregar Fontes Web ──
  async function loadSources() {
    const tenantId = await getTenantId();
    if (!tenantId || !sourceSelect) return;

    const { data } = await supabase
      .from('sources')
      .select('id, source_name, keywords')
      .eq('tenant_id', tenantId)
      .eq('source_type', 'web_search')
      .eq('active', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    sourceSelect.innerHTML = '<option value="">Sem fonte vinculada (busca avulsa)</option>';
    if (data) {
      data.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.source_name;
        sourceSelect.appendChild(opt);
      });
    }
  }

  // ── Carregar KPIs ──
  async function loadKPIs() {
    const tenantId = await getTenantId();
    if (!tenantId) return;

    const { data: logs } = await supabase
      .from('web_search_log')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (!logs || logs.length === 0) {
      if (kpiFound) kpiFound.textContent = '0';
      if (kpiValid) kpiValid.textContent = '0';
      if (kpiDuplicates) kpiDuplicates.textContent = '0';
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
    if (kpiRate) kpiRate.textContent = `${rate}%`;
  }

  // ── Excluir selecionados ──
  async function deleteSelected() {
    const ids = [...historyBody.querySelectorAll('.chk-history:checked')].map(cb => cb.value);
    if (!ids.length) { showToast('Nenhum item selecionado.', 'info'); return; }
    if (!confirm(`Excluir ${ids.length} entrada(s) do histórico?`)) return;
    const tenantId = await getTenantId();
    const { error } = await supabase
      .from('web_search_log')
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
    if (!confirm('Tem certeza? Todo o histórico de buscas web será excluído permanentemente.')) return;
    const tenantId = await getTenantId();
    const { error } = await supabase
      .from('web_search_log')
      .update({ deleted_at: new Date().toISOString() })
      .eq('tenant_id', tenantId);
    if (error) { showToast('Erro ao limpar histórico', 'error'); return; }
    await loadHistory();
    await loadKPIs();
    showToast('Histórico limpo!', 'success');
  }

  // ── Alternar estado do botão Excluir Selecionados ──
  function toggleDeleteSelectedBtn() {
    const btn = document.getElementById('webdisc-btn-delete-selected');
    if (!btn) return;
    const checked = historyBody.querySelectorAll('.chk-history:checked').length;
    btn.disabled = checked === 0;
  }

  // ── Carregar Histórico ──
  async function loadHistory() {
    const tenantId = await getTenantId();
    if (!tenantId || !historyBody) return;

    const { data: logs } = await supabase
      .from('web_search_log')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!logs || logs.length === 0) {
      historyBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:var(--space-6); color:var(--text-muted);">Nenhuma busca web realizada ainda.</td></tr>`;
      toggleDeleteSelectedBtn();
      return;
    }

    historyBody.innerHTML = logs.map(log => {
      const date = new Date(log.created_at).toLocaleDateString('pt-BR');
      const kw = Array.isArray(log.keywords) ? escapeHtml(log.keywords.join(', ')) : '—';
      return `
        <tr>
          <td style="padding:var(--space-3) var(--space-4); text-align:center;">
            <input type="checkbox" class="chk-history" value="${escapeHtml(log.id)}" title="Selecionar">
          </td>
          <td style="padding:var(--space-3) var(--space-4); max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${kw}">${kw}</td>
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

    if (debugMsg) {
      html += `
        <div style="margin-top: var(--space-4); padding: var(--space-3); background: rgba(240, 62, 62, 0.08); border-left: 3px solid var(--error-500); border-radius: var(--radius-sm); font-size: var(--font-xs); color: var(--error-600); text-align: left;">
          <strong>Mensagem:</strong> ${escapeHtml(debugMsg)}
        </div>
      `;
      resultEl.style.borderLeftColor = 'var(--error-500)';
      resultEl.style.background = 'rgba(240, 62, 62, 0.02)';
    } else {
      resultEl.style.borderLeftColor = 'var(--success-500)';
      resultEl.style.background = 'rgba(81, 207, 102, 0.04)';
    }

    if (summary.created > 0) {
      html += `
        <div style="margin-top: var(--space-5); text-align: center;">
          <button class="btn btn-primary" onclick="Router.navigate('opportunities');setTimeout(()=>Opportunities.load(),100)" style="min-width: 220px;">
            Ver Oportunidades Criadas →
          </button>
        </div>`;
    }

    resultBody.innerHTML = html;
  }

  // ── Executar Busca ──
  async function executeSearch() {
    const rawKeywords = keywordsInput.value.trim();
    const sourceId = sourceSelect ? sourceSelect.value : '';
    const includeDomains = includeDomainsInput ? includeDomainsInput.value.trim() : '';
    const excludeDomains = excludeDomainsInput ? excludeDomainsInput.value.trim() : '';
    const testMode = testModeToggle ? testModeToggle.checked : false;

    if (testMode) {
      showToast('⚠️ MODO TESTE ATIVO — Nenhum dado será salvo no banco!', 'warning');
    }

    if (!rawKeywords) {
      showToast('Informe pelo menos uma palavra-chave para buscar.', 'error');
      return;
    }

    const keywords = rawKeywords.split('\n').map(k => k.trim()).filter(k => k.length > 0);

    // Bloquear botão
    isSearching = true;
    searchBtn.disabled = true;
    const btnText = searchBtn.querySelector('.btn-text');
    const btnLoader = searchBtn.querySelector('.btn-loader');
    if (btnText) btnText.classList.add('hidden');
    if (btnLoader) btnLoader.classList.remove('hidden');

    const statusMsg = testMode
      ? `[MODO TESTE] Simulando busca por: ${keywords.join(', ')}`
      : `Buscando oportunidades em páginas web: ${keywords.join(', ')}`;

    showSearchStatus(statusMsg);
    if (resultEl) resultEl.classList.add('hidden');

    const tenantId = await getTenantId();

    try {
      if (window.isMockMode && !testMode) {
        // ── MOCK MODE ──
        await new Promise(r => setTimeout(r, 2000));
        const mockResults = generateMockResults(keywords);
        const found = mockResults.length;
        let created = 0;
        let duplicates = 0;
        let errors = 0;

        for (const item of mockResults) {
          let isDuplicate = false;

          if (item.website) {
            const { data: existing } = await supabase
              .from('opportunities')
              .select('id')
              .eq('tenant_id', tenantId)
              .eq('website', item.website)
              .limit(1);
            if (existing && existing.length > 0) {
              isDuplicate = true;
              duplicates++;
              continue;
            }
          }

          const score = calculateScore(item);
          const oppPayload = {
            tenant_id: tenantId,
            source_id: sourceId || null,
            company_name: item.company_name,
            website: item.website || null,
            email: item.email || null,
            phone: item.phone || null,
            description: item.description || null,
            origin: 'Web Discovery',
            source_service: 'Firecrawl',
            status: score >= 60 ? 'scored' : 'discovered',
            score,
          };

          const { error: insertError } = await supabase.from('opportunities').insert(oppPayload);
          if (insertError) {
            errors++;
          } else {
            created++;
          }
        }

        const newUsed = created;
        await supabase
          .from('tenant_credits')
          .update({ opportunity_used: newUsed })
          .eq('tenant_id', tenantId);

        await supabase.from('web_search_log').insert({
          tenant_id: tenantId,
          keywords,
          results_count: found,
          valid_count: created,
          duplicates_count: duplicates,
          errors_count: errors,
          status: 'completed',
        });

        showResult({ found, created, duplicates, errors, credits: created });
        showToast(`Busca concluída! ${created} oportunidades criadas.`, 'success');

      } else {
        // ── MODO REAL / EDGE FUNCTION ──
        if (testMode) {
          showSearchStatus(`[TESTE] Conectando ao servidor seguro... Buscando: ${keywords.join(', ')}`);
        } else {
          showSearchStatus(`Conectando ao servidor seguro... Buscando: ${keywords.join(', ')}`);
        }

        const timeoutMs = 120000;
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('A busca demorou mais de 2 minutos. Tente termos mais específicos.')), timeoutMs)
        );

        let secondsLeft = 120;
        const countdownInterval = setInterval(() => {
          secondsLeft--;
          if (searchStatusText) {
            const modePrefix = testMode ? '[TESTE] ' : '';
            searchStatusText.textContent = `${modePrefix}Buscando "${keywords.join(', ')}" — aguardando... ${secondsLeft}s`;
          }
        }, 1000);

        let invokeResult;
        try {
          const session = (await supabase.auth.getSession()).data.session;
          console.log('[HUVI WebDiscovery] Session:', !!session);
          const token = session?.access_token;

          if (!token) {
            throw new Error('Sessão expirada. Faça login novamente.');
          }

          // Limpar domínios: remover protocolo, path, espaços
          const cleanDomains = (raw) => raw.split(',')
            .map(d => d.trim()
              .replace(/^https?:\/\//, '')
              .replace(/\/.*$/, '')
              .replace(/^www\./, ''))
            .filter(Boolean);

          invokeResult = await Promise.race([
            fetch(`${HUVI_CONFIG.SUPABASE_URL}/functions/v1/huvi-web-discovery`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                keywords,
                include_domains: includeDomains ? cleanDomains(includeDomains) : [],
                exclude_domains: excludeDomains ? cleanDomains(excludeDomains) : [],
                source_id: sourceId || null,
                testMode,
              }),
            }).then(async r => {
              const text = await r.text();
              console.log('[HUVI WebDiscovery] Status:', r.status);
              let data;
              try { data = JSON.parse(text); } catch { data = null; }
              if (!r.ok) return { data: null, error: { message: data?.message || `HTTP ${r.status}` } };
              return { data, error: null };
            }),
            timeoutPromise,
          ]);
        } finally {
          clearInterval(countdownInterval);
        }

        const { data: result, error: fnError } = invokeResult;

        if (fnError) {
          console.error('[HUVI WebDiscovery] Erro na Edge Function:', fnError);
          throw new Error(`Erro ao conectar com o servidor de busca: ${fnError.message}`);
        }

        if (!result) {
          throw new Error('A Edge Function retornou resposta vazia.');
        }

        if (result.success) {
          showResult({
            found: result.found || 0,
            created: result.created || 0,
            duplicates: result.duplicates || 0,
            errors: result.errors || 0,
            credits: result.credits || 0,
          }, result.debug_msg);

          if (result.debug_msg) {
            showToast('Busca concluída com alertas. Verifique o painel.', 'warning');
          } else if (result.testMode) {
            showToast(`[TESTE] ${result.created || 0} oportunidades seriam criadas.`, 'info');
          } else {
            showToast(`Busca concluída! ${result.created || 0} oportunidades criadas.`, 'success');
          }
        } else {
          throw new Error(result.message || 'Erro retornado pelo servidor.');
        }
      }
    } catch (err) {
      console.error('[HUVI WebDiscovery] Erro:', err);
      showToast('Erro: ' + (err.message || err), 'error');
    } finally {
      hideSearchStatus();
      if (btnText) btnText.classList.remove('hidden');
      if (btnLoader) btnLoader.classList.add('hidden');
      await loadCredits();
      await loadKPIs();
      await loadHistory();
    }
  }

  // ── Mock ──
  function generateMockResults(keywords) {
    const baseTerm = keywords[0] || 'empresa';
    const suffixes = ['Ltda', 'ME', 'Serviços', 'Digital', 'Online', 'Pro', 'Plus', 'Premium'];
    const count = Math.floor(Math.random() * 8) + 5;
    const results = [];

    for (let i = 0; i < count; i++) {
      const name = `${baseTerm} ${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
      results.push({
        company_name: name,
        website: `www.${name.toLowerCase().replace(/\s/g, '')}.com.br`,
        email: `contato@${name.toLowerCase().replace(/\s/g, '')}.com.br`,
        phone: Math.random() > 0.5 ? `119${Math.floor(Math.random() * 90000000 + 10000000)}` : null,
        description: `Empresa especializada em ${baseTerm}. Atendimento personalizado com qualidade.`,
      });
    }

    return results;
  }

  // ── Load ──
  async function load() {
    await loadCredits();
    await loadSources();
    await loadKPIs();
    await loadHistory();
  }

  // ── Init ──
  function init() {
    if (searchBtn) {
      searchBtn.addEventListener('click', executeSearch);
    }

    const clearBtn = document.getElementById('webdisc-btn-clear-history');
    if (clearBtn) {
      clearBtn.addEventListener('click', clearAllHistory);
    }

    const deleteSelectedBtn = document.getElementById('webdisc-btn-delete-selected');
    if (deleteSelectedBtn) {
      deleteSelectedBtn.addEventListener('click', deleteSelected);
    }

    const checkAll = document.getElementById('webdisc-check-all');
    if (checkAll) {
      checkAll.addEventListener('change', () => {
        historyBody.querySelectorAll('.chk-history').forEach(cb => cb.checked = checkAll.checked);
        toggleDeleteSelectedBtn();
      });
    }
  }

  return { init, load };
})();
