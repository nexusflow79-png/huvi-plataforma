/**
 * HUVI — Sources Module
 * CRUD de Fontes de Descoberta + Integração com ImportLeads
 */
const Sources = (() => {
  const listEl = document.getElementById('sources-list');
  const modal = document.getElementById('modal-source');
  const form = document.getElementById('source-form');
  const modalTitle = document.getElementById('modal-source-title');

  // Keywords (web_search)
  const keywordsGroup = document.getElementById('source-keywords-group');
  const keywordsInput = document.getElementById('source-keywords');

  // Upload elements
  const uploadArea = document.getElementById('source-upload-area');
  const dropzone = document.getElementById('source-file-dropzone');
  const fileInput = document.getElementById('source-file-input');
  const filePlaceholder = document.getElementById('source-file-placeholder');
  const fileInfo = document.getElementById('source-file-info');
  const fileNameEl = document.getElementById('source-file-name');
  const fileRemoveBtn = document.getElementById('source-file-remove');

  let pendingFile = null;
  let pendingParsedData = null;

  // Helper: pega os tipos selecionados nos checkboxes
  function getSelectedTypes() {
    const checkboxes = document.querySelectorAll('input[name="source-type"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
  }

  // Helper: desmarca todos os checkboxes
  function clearCheckboxes() {
    document.querySelectorAll('input[name="source-type"]').forEach(cb => {
      cb.checked = false;
    });
  }

  // Helper: marca um único checkbox por valor
  function setCheckboxValue(value) {
    clearCheckboxes();
    const cb = document.querySelector(`input[name="source-type"][value="${value}"]`);
    if (cb) cb.checked = true;
  }

  // ── Upload visibility ──────────────────────────────────

  function toggleUploadVisibility() {
    const types = getSelectedTypes();
    const hasDirectory = types.includes('directory');

    if (hasDirectory) {
      uploadArea.classList.remove('hidden');
    } else {
      uploadArea.classList.add('hidden');
      clearFile();
    }
  }

  // ── Keywords visibility ───────────────────────────────

  function toggleKeywordsVisibility() {
    const types = getSelectedTypes();
    const hasWebSearch = types.includes('web_search');

    if (hasWebSearch) {
      keywordsGroup.classList.remove('hidden');
    } else {
      keywordsGroup.classList.add('hidden');
    }
  }

  function clearFile() {
    pendingFile = null;
    pendingParsedData = null;
    fileInput.value = '';
    filePlaceholder.classList.remove('hidden');
    fileInfo.classList.add('hidden');
    fileNameEl.textContent = '';
  }

  async function handleFileSelect(file) {
    if (!file) return;

    // Validar tamanho (5 MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('Arquivo muito grande. Máximo: 5 MB', 'error');
      return;
    }

    // Validar extensão
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      showToast('Formato não suportado. Use CSV ou XLSX.', 'error');
      return;
    }

    try {
      const data = await ImportLeads.parseFile(file);

      if (data.rows.length === 0) {
        showToast('Arquivo sem dados válidos.', 'error');
        return;
      }

      pendingFile = file;
      pendingParsedData = data;

      // Atualizar UI
      filePlaceholder.classList.add('hidden');
      fileInfo.classList.remove('hidden');
      fileNameEl.textContent = `${file.name} (${data.rows.length} leads)`;

      showToast(`${data.rows.length} leads encontrados no arquivo`, 'success');
    } catch (err) {
      showToast(err.message || 'Erro ao ler arquivo', 'error');
      console.error('[HUVI] Erro parse:', err);
    }
  }

  // ── Modal ──────────────────────────────────────────────

  function openModal(source = null) {
    form.reset();
    clearCheckboxes();
    clearFile();
    document.getElementById('source-id').value = '';
    uploadArea.classList.add('hidden');
    keywordsGroup.classList.add('hidden');

    if (source) {
      modalTitle.textContent = 'Editar Fonte';
      document.getElementById('source-id').value = source.id;
      setCheckboxValue(source.source_type || '');
      document.getElementById('source-name').value = source.source_name || '';
      
      updateHelpText();
      
      if (source.source_type === 'web_search' && source.keywords) {
        const kwArray = Array.isArray(source.keywords) ? source.keywords : JSON.parse(source.keywords || '[]');
        keywordsInput.value = kwArray.join('\n');
      }
    } else {
      modalTitle.textContent = 'Nova Fonte';
      updateHelpText();
    }

    modal.classList.remove('hidden');
  }

  function closeModal() {
    modal.classList.add('hidden');
    clearFile();
  }

  // ── Save ──────────────────────────────────────────────

  async function save(e) {
    e.preventDefault();
    const id = document.getElementById('source-id').value;
    const tenantId = await getTenantId();
    const selectedTypes = getSelectedTypes();
    const sourceName = document.getElementById('source-name').value.trim();

    if (selectedTypes.length === 0 || !sourceName) {
      showToast('Preencha todos os campos obrigatórios', 'error');
      return;
    }

    // Validação de keywords para Busca Web
    let parsedKeywords = null;
    if (selectedTypes.includes('web_search')) {
      const raw = keywordsInput.value.trim();
      if (!raw) {
        showToast('Informe pelo menos uma palavra-chave para a Busca Web', 'error');
        return;
      }
      parsedKeywords = raw.split('\n').map(k => k.trim()).filter(k => k.length > 0);
      if (parsedKeywords.length === 0) {
        showToast('Informe pelo menos uma palavra-chave válida para a Busca Web', 'error');
        return;
      }
    }

    // Se tem diretório selecionado e arquivo pendente, fluxo especial
    const hasDirectory = selectedTypes.includes('directory');
    const hasFile = hasDirectory && pendingParsedData && pendingParsedData.rows.length > 0;

    let hasError = false;
    let errorMessage = '';
    let createdSourceIds = {};

    if (id) {
      // Edição
      const payload = {
        tenant_id: tenantId,
        source_type: selectedTypes[0],
        source_name: sourceName,
        keywords: selectedTypes[0] === 'web_search' ? parsedKeywords : null,
      };

      const { error } = await supabase.from('sources').update(payload).eq('id', id);
      if (error) {
        hasError = true;
        errorMessage = error.message || error.details || 'Erro desconhecido no banco';
        console.error('[HUVI] Erro source update:', error);
      } else if (hasDirectory) {
        createdSourceIds['directory'] = id;
      }
    } else {
      // Criação: uma fonte para cada tipo
      for (const type of selectedTypes) {
        const payload = {
          tenant_id: tenantId,
          source_type: type,
          source_name: sourceName,
          keywords: type === 'web_search' ? parsedKeywords : null,
        };

        const { data, error } = await supabase
          .from('sources')
          .insert(payload)
          .select('id')
          .single();

        if (error) {
          hasError = true;
          errorMessage = error.message || error.details || 'Erro desconhecido no banco';
          console.error('[HUVI] Erro source insert:', error);
        } else if (data) {
          createdSourceIds[type] = data.id;
        }
      }
    }

    if (hasError) {
      showToast(errorMessage || 'Erro ao salvar fonte', 'error');
      return;
    }

    // Se tem arquivo de diretório, abrir modal de mapeamento
    if (hasFile && createdSourceIds['directory']) {
      const count = selectedTypes.length;
      if (count > 1) {
        showToast(`${count} fontes criadas! Agora mapeie as colunas do arquivo.`, 'success');
      }

      // Guardar os dados antes que closeModal limpe a variável
      const dataToImport = pendingParsedData;
      const directorySourceId = createdSourceIds['directory'];

      closeModal();

      // Abrir modal de mapeamento
      ImportLeads.openImportModal(dataToImport);

      // Quando o usuário confirmar, importar
      const confirmBtn = document.getElementById('confirm-import');
      const newConfirmBtn = confirmBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

      newConfirmBtn.addEventListener('click', async () => {
        newConfirmBtn.disabled = true;
        await ImportLeads.importLeads(directorySourceId);
      });
    } else {
      const count = id ? 1 : selectedTypes.length;
      const msg = id
        ? 'Fonte atualizada!'
        : count > 1
          ? `${count} fontes criadas!`
          : 'Fonte criada!';

      showToast(msg, 'success');
      closeModal();
      load();
    }
  }

  // ── Toggle Active ──────────────────────────────────────

  async function toggleActive(id, currentActive) {
    const { error } = await supabase
      .from('sources')
      .update({ active: !currentActive })
      .eq('id', id);

    if (error) {
      showToast('Erro ao alterar status', 'error');
      return;
    }

    showToast(currentActive ? 'Fonte desativada' : 'Fonte ativada', 'success');
    load();
  }

  // ── Hard Delete ──────────────────────────────────────────────

  async function deleteSource(id) {
    if (!confirm('Deseja realmente excluir esta fonte de pesquisa?')) return;

    let { error } = await supabase
      .from('sources')
      .update({ deleted_at: new Date().toISOString(), active: false })
      .eq('id', id);

    if (error) {
      // Se a coluna deleted_at não existir no banco, realiza a exclusão física como fallback
      if (error.message?.includes('deleted_at') || error.hint?.includes('deleted_at') || error.code === 'PGRST100') {
        console.warn('[HUVI] Coluna deleted_at ausente na tabela sources. Realizando exclusão física de fallback.');
        const retry = await supabase
          .from('sources')
          .delete()
          .eq('id', id);
        error = retry.error;
      }
    }

    if (error) {
      showToast('Erro ao excluir fonte', 'error');
      console.error('[HUVI] Erro excluir source:', error);
      return;
    }

    showToast('Fonte excluída com sucesso', 'success');
    load();
  }

  // ── Render ──────────────────────────────────────────────

  function renderList(sources) {
    if (!sources || sources.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🔗</span>
          <p>Nenhuma fonte cadastrada</p>
          <p class="empty-hint">Adicione fontes para descobrir oportunidades</p>
        </div>`;
      return;
    }

    listEl.innerHTML = sources.map((s, i) => {
      let locationText = '';
      if (s.source_type === 'web_search' && s.keywords) {
        const kw = Array.isArray(s.keywords) ? s.keywords : JSON.parse(s.keywords || '[]');
        if (kw.length > 0) {
          locationText = ` · 🔎 ${kw.slice(0, 3).join(', ')}${kw.length > 3 ? '...' : ''}`;
        }
      }
      return `
      <div class="data-item" style="animation-delay: ${i * 40}ms">
        <div class="data-item-info">
          <div class="data-item-title">${s.source_name}</div>
          <div class="data-item-subtitle">
            ${HUVI_CONFIG.SOURCE_TYPES[s.source_type] || s.source_type}${locationText} · 
            <span class="badge ${s.active ? 'badge-active' : 'badge-draft'}">${s.active ? 'Ativa' : 'Inativa'}</span>
          </div>
        </div>
        <div class="data-item-actions">
          <button class="btn btn-ghost btn-sm btn-edit-source" data-id="${s.id}">Editar</button>
          <button class="btn btn-ghost btn-sm btn-toggle-source" data-id="${s.id}" data-active="${s.active}">
            ${s.active ? 'Desativar' : 'Ativar'}
          </button>
          <button class="btn btn-ghost btn-sm btn-delete-source" data-id="${s.id}" style="color: var(--danger-color);">Excluir</button>
        </div>
      </div>`;
    }).join('');

    listEl.querySelectorAll('.btn-edit-source').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const source = sources.find(s => s.id === btn.dataset.id);
        if (source) openModal(source);
      });
    });

    listEl.querySelectorAll('.btn-toggle-source').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleActive(btn.dataset.id, btn.dataset.active === 'true');
      });
    });

    listEl.querySelectorAll('.btn-delete-source').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSource(btn.dataset.id);
      });
    });
  }

  async function load() {
    const tenantId = await getTenantId();
    if (!tenantId) return;

    let { data, error } = await supabase
      .from('sources')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      // Se a coluna deleted_at não existe no banco, tentamos carregar sem ela
      if (error.message?.includes('deleted_at') || error.hint?.includes('deleted_at') || error.code === 'PGRST100') {
        console.warn('[HUVI] Coluna deleted_at ausente na tabela sources. Tentando carregar sem o filtro.');
        const retry = await supabase
          .from('sources')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });
        
        if (retry.error) {
          console.error('[HUVI] Erro ao carregar fontes no retry:', retry.error);
          return;
        }
        data = retry.data;
      } else {
        console.error('[HUVI] Erro ao carregar fontes:', error);
        return;
      }
    }

    renderList(data);
  }

  // ── Help text ──────────────────────────────────────────

  function updateHelpText() {
    const nameInput = document.getElementById('source-name');
    const helpText = document.getElementById('source-name-help');
    const selectedTypes = getSelectedTypes();
    const lastType = selectedTypes.length > 0 ? selectedTypes[selectedTypes.length - 1] : '';

    if (selectedTypes.length > 1) {
      nameInput.placeholder = 'Ex: Leads do Segmento X, Prospecção Região Y';
      helpText.textContent = `${selectedTypes.length} tipos selecionados. Será criada uma fonte para cada tipo com este nome.`;
    } else if (lastType === 'google_maps') {
      nameInput.placeholder = 'Ex: Academias de Musculação, Clínicas Médicas';
      helpText.textContent = 'Indique o termo ou nicho de busca do Google Maps.';
    } else if (lastType === 'instagram') {
      nameInput.placeholder = 'Ex: @perfil_concorrente, seguidores_da_marca';
      helpText.textContent = 'Indique o perfil do Instagram ou segmento que está rastreando.';
    } else if (lastType === 'website') {
      nameInput.placeholder = 'Ex: Formulário de Contato Site, Landing Page de Vendas';
      helpText.textContent = 'Indique a página web da qual as oportunidades virão.';
    } else if (lastType === 'web_search') {
      nameInput.placeholder = 'Ex: Clínicas Médicas, Restaurantes, Salões de Beleza';
      helpText.textContent = 'Busca oportunidades em websites, blogs e páginas web por palavra-chave.';
    } else if (lastType === 'directory') {
      nameInput.placeholder = 'Ex: Planilha Evento 2023, Base CRM Antigo';
      helpText.textContent = 'Dê um nome descritivo para esta lista de leads importada.';
    } else {
      nameInput.placeholder = 'Ex: Clínicas Médicas SP, @concorrente_insta, Lead Form';
      helpText.textContent = 'Dê um nome descritivo para identificar a origem das oportunidades.';
    }

    toggleKeywordsVisibility();
    toggleUploadVisibility();
  }

  // ── Init ──────────────────────────────────────────────

  function init() {
    document.getElementById('btn-new-source').addEventListener('click', () => openModal());
    document.getElementById('close-source-modal').addEventListener('click', closeModal);
    document.getElementById('cancel-source').addEventListener('click', closeModal);
    modal.querySelector('.modal-overlay').addEventListener('click', closeModal);
    form.addEventListener('submit', save);

    // Checkboxes → help text + upload visibility
    document.querySelectorAll('input[name="source-type"]').forEach(cb => {
      cb.addEventListener('change', updateHelpText);
    });

    // ── File upload listeners ──
    dropzone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) {
        handleFileSelect(e.target.files[0]);
      }
    });

    fileRemoveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearFile();
    });

    // Drag & Drop
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files[0]) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });

    // ImportLeads init
    ImportLeads.init();
  }

  return { init, load };
})();
