/**
 * HUVI — Import Leads Module
 * Parsing de CSV/XLSX, preview, mapeamento de colunas e importação em lote
 */
const ImportLeads = (() => {
  // Campos mapeáveis da tabela opportunities
  const MAPPABLE_FIELDS = [
    { key: '', label: '— Ignorar —' },
    { key: 'company_name', label: 'Empresa' },
    { key: 'contact_name', label: 'Contato' },
    { key: 'email', label: 'E-mail' },
    { key: 'phone', label: 'Telefone' },
    { key: 'website', label: 'Website' },
    { key: 'instagram', label: 'Instagram' },
    { key: 'city', label: 'Cidade' },
    { key: 'state', label: 'UF' },
    { key: 'rating', label: 'Estrelas' },
    { key: 'segment', label: 'Segmento' }
  ];

  // Auto-mapping: tenta mapear automaticamente por nome da coluna
  const AUTO_MAP = {
    'empresa': 'company_name',
    'company': 'company_name',
    'razao social': 'company_name',
    'razão social': 'company_name',
    'nome da empresa': 'company_name',
    'company_name': 'company_name',
    'contato': 'contact_name',
    'contact': 'contact_name',
    'nome': 'contact_name',
    'name': 'contact_name',
    'nome completo': 'contact_name',
    'responsavel': 'contact_name',
    'responsável': 'contact_name',
    'contact_name': 'contact_name',
    'email': 'email',
    'e-mail': 'email',
    'e_mail': 'email',
    'mail': 'email',
    'telefone': 'phone',
    'phone': 'phone',
    'tel': 'phone',
    'celular': 'phone',
    'whatsapp': 'phone',
    'fone': 'phone',
    'website': 'website',
    'site': 'website',
    'url': 'website',
    'página': 'website',
    'pagina': 'website',
    'instagram': 'instagram',
    'insta': 'instagram',
    '@instagram': 'instagram',
    'cidade': 'city',
    'city': 'city',
    'municipio': 'city',
    'município': 'city',
    'estado': 'state',
    'uf': 'state',
    'state': 'state',
    'estrelas': 'rating',
    'rating': 'rating',
    'segmento': 'segment',
    'nicho': 'segment',
    'categoria': 'segment',
    'tipo': 'segment'
  };

  let parsedData = { headers: [], rows: [] };
  let selectedFile = null;

  // ── Parsing ──────────────────────────────────────────────

  function parseFile(file) {
    return new Promise((resolve, reject) => {
      const ext = file.name.split('.').pop().toLowerCase();

      if (ext === 'csv') {
        parseCSV(file).then(resolve).catch(reject);
      } else if (ext === 'xlsx' || ext === 'xls') {
        parseXLSX(file).then(resolve).catch(reject);
      } else {
        reject(new Error('Formato não suportado. Use CSV ou XLSX.'));
      }
    });
  }

  function parseCSV(file) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: 'UTF-8',
        complete: (results) => {
          if (!results.data || results.data.length === 0) {
            reject(new Error('Arquivo vazio ou sem dados válidos.'));
            return;
          }
          const headers = results.meta.fields || [];
          resolve({ headers, rows: results.data });
        },
        error: (err) => {
          reject(new Error('Erro ao ler CSV: ' + err.message));
        },
      });
    });
  }

  function parseXLSX(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(e.target.result, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

          if (!jsonData || jsonData.length === 0) {
            reject(new Error('Planilha vazia ou sem dados válidos.'));
            return;
          }

          const headers = Object.keys(jsonData[0]);
          resolve({ headers, rows: jsonData });
        } catch (err) {
          reject(new Error('Erro ao ler XLSX: ' + err.message));
        }
      };
      reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
      reader.readAsArrayBuffer(file);
    });
  }

  // ── Preview ──────────────────────────────────────────────

  function renderPreview(headers, rows) {
    const thead = document.getElementById('import-preview-head');
    const tbody = document.getElementById('import-preview-body');

    // Header com estilo (linhas e colunas)
    thead.innerHTML = `<tr>${headers.map(h => `<th style="border: 1px solid var(--surface-300); padding: 8px var(--space-3); background: var(--surface-200); font-weight: 600; text-align: left; white-space: nowrap;">${escapeHtml(h)}</th>`).join('')}</tr>`;

    // Body com estilo (linhas, colunas, padding e reticências para textos muito longos)
    const previewRows = rows.slice(0, 5);
    tbody.innerHTML = previewRows.map(row =>
      `<tr>${headers.map(h => `<td style="border: 1px solid var(--surface-300); padding: 8px var(--space-3); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left;" title="${escapeHtml(String(row[h] || ''))}">${escapeHtml(String(row[h] || ''))}</td>`).join('')}</tr>`
    ).join('');
  }

  // ── Mapeamento ──────────────────────────────────────────

  function renderMapping(headers) {
    const container = document.getElementById('import-mapping');

    container.innerHTML = `
      <h4 class="import-mapping-title">Mapeamento de Colunas</h4>
      ${headers.map((h, i) => {
        const autoKey = guessField(h);
        return `
          <div class="import-mapping-row">
            <span class="import-mapping-col">${escapeHtml(h)}</span>
            <span class="import-mapping-arrow">→</span>
            <select class="form-select import-mapping-select" data-col-index="${i}" data-col-name="${escapeHtml(h)}">
              ${MAPPABLE_FIELDS.map(f =>
                `<option value="${f.key}" ${f.key === autoKey ? 'selected' : ''}>${f.label}</option>`
              ).join('')}
            </select>
          </div>
        `;
      }).join('')}
    `;

    // Listener para atualizar o botão de importar
    container.querySelectorAll('.import-mapping-select').forEach(sel => {
      sel.addEventListener('change', updateImportButton);
    });

    updateImportButton();
  }

  function guessField(header) {
    const normalized = header.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos para match
      .replace(/[\u0300-\u036f]/g, '');

    // Tenta match exato primeiro
    if (AUTO_MAP[header.trim().toLowerCase()]) {
      return AUTO_MAP[header.trim().toLowerCase()];
    }
    // Tenta match normalizado
    if (AUTO_MAP[normalized]) {
      return AUTO_MAP[normalized];
    }
    // Tenta match parcial
    for (const [key, value] of Object.entries(AUTO_MAP)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return value;
      }
    }
    return '';
  }

  function getMapping() {
    const selects = document.querySelectorAll('.import-mapping-select');
    const mapping = {};
    selects.forEach(sel => {
      const colName = sel.dataset.colName;
      const fieldKey = sel.value;
      if (fieldKey) {
        mapping[colName] = fieldKey;
      }
    });
    return mapping;
  }

  function getMappedFieldCount() {
    const mapping = getMapping();
    return Object.keys(mapping).length;
  }

  function updateImportButton() {
    const btn = document.getElementById('confirm-import');
    const text = document.getElementById('confirm-import-text');
    const count = parsedData.rows.length;
    const mappedCount = getMappedFieldCount();

    if (mappedCount > 0) {
      btn.disabled = false;
      text.textContent = `Importar ${count} lead${count !== 1 ? 's' : ''}`;
    } else {
      btn.disabled = true;
      text.textContent = 'Importar';
    }
  }

  // ── Importação ──────────────────────────────────────────

  async function importLeads(sourceId) {
    const mapping = getMapping();
    const rows = parsedData.rows;
    const total = rows.length;
    const tenantId = await getTenantId();

    // Elementos de progresso
    const progressEl = document.getElementById('import-progress');
    const progressFill = document.getElementById('import-progress-fill');
    const progressText = document.getElementById('import-progress-text');
    const progressCount = document.getElementById('import-progress-count');
    const resultEl = document.getElementById('import-result');
    const footerEl = document.getElementById('import-modal-footer');

    // Mostrar progresso, ocultar footer
    progressEl.classList.remove('hidden');
    resultEl.classList.add('hidden');
    footerEl.style.display = 'none';

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    // Inserir em lotes de 20
    const BATCH_SIZE = 20;

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const payloads = batch.map(row => {
        const opp = {
          tenant_id: tenantId,
          source_id: sourceId,
          status: 'discovered',
        };

        for (const [colName, fieldKey] of Object.entries(mapping)) {
          const val = String(row[colName] || '').trim();
          if (val) {
            opp[fieldKey] = val;
          }
        }

        // --- REGRA #5: INTELIGÊNCIA PROGRESSIVA DE MAPEAMENTO EMPRESA VS CONTATO ---
        // Sanitização de nomes de estabelecimento vs contatos de pessoas humanas
        let contact = opp.contact_name ? opp.contact_name.trim() : '';
        let company = opp.company_name ? opp.company_name.trim() : '';

        // Termos comuns para detectar que o nome pertence a uma empresa e não a um humano
        const enterpriseKeywords = [
          'lava', 'jato', 'wash', 'car', 'auto', 'ltda', 'me', 'eireli', 'clinica', 'consultorio',
          'academia', 'studio', 'restaurante', 'bar', 'pizzaria', 'loja', 'mercado', 'hotel',
          'buffet', 'salao', 'oficina', 'servico', 'comercio', 'industria', 'distribuidora',
          'associacao', 'cooperativa', 'odontologia', 'medica', 'advocacia', 'escola', 'colegio',
          'brilho', 'centro', 'mecanica', 'posto', 'farmacia', 'drogaria', 'roupa', 'calcado'
        ];

        const isEnterpriseName = (name) => {
          if (!name) return false;
          const lower = name.toLowerCase();
          return enterpriseKeywords.some(keyword => lower.includes(keyword));
        };

        // Cenário A: Só veio "Contato" preenchido, mas o valor é claramente o nome comercial da empresa
        if (contact && !company && isEnterpriseName(contact)) {
          opp.company_name = contact;
          opp.contact_name = null;
        } 
        // Cenário B: Vieram ambos preenchidos, mas invertidos (Contato tem o nome da empresa)
        else if (contact && company && isEnterpriseName(contact) && !isEnterpriseName(company)) {
          opp.company_name = contact;
          opp.contact_name = company;
        }
        // Cenário C: Só veio "Contato" preenchido com algo que parece empresa de forma geral, garante que a empresa nunca fique vazia
        else if (contact && !company) {
          // Se contiver mais do que um nome humano comum ou termos, ou se o usuário importou
          if (isEnterpriseName(contact) || contact.length > 25) {
            opp.company_name = contact;
            opp.contact_name = null;
          } else {
            // Se parecer com nome humano simples (ex: "Larry Page"), mas "Empresa" ficou nula,
            // por precaução como é uma importação de Google Maps/Estabelecimento, colocamos no campo Empresa também
            // ou deixamos o contato como nome e a empresa como "Empresa Sem Nome". 
            // O ideal é que se for lead de estabelecimento comercial, o nome principal vá sempre para Empresa.
            // Para não deixar a empresa nula ("Empresa Sem Nome"):
            opp.company_name = contact;
          }
        }

        // Se o nome do contato ficou igual ao nome da empresa, limpamos o contato (já que não temos o nome da pessoa humana)
        if (opp.contact_name && opp.company_name && opp.contact_name === opp.company_name) {
          opp.contact_name = null;
        }

        return opp;
      }).filter(opp => {
        // Pelo menos 1 campo de contato deve estar preenchido
        return opp.company_name || opp.contact_name || opp.email || opp.phone;
      });

      if (payloads.length === 0) {
        skipped += batch.length;
      } else {
        const { data, error } = await supabase
          .from('opportunities')
          .insert(payloads)
          .select('id');

        if (error) {
          // Pode ser conflito de unicidade — tentar um a um
          if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
            for (const payload of payloads) {
              const { error: singleError } = await supabase
                .from('opportunities')
                .insert(payload);

              if (singleError) {
                if (singleError.code === '23505' || singleError.message?.includes('duplicate') || singleError.message?.includes('unique')) {
                  skipped++;
                } else {
                  errors++;
                  console.error('[HUVI] Erro importação individual:', singleError);
                }
              } else {
                imported++;
              }
            }
          } else {
            errors += payloads.length;
            console.error('[HUVI] Erro importação batch:', error);
          }
        } else {
          imported += (data ? data.length : payloads.length);
          skipped += (batch.length - payloads.length);
        }
      }

      // Atualizar progresso
      const progress = Math.min(100, Math.round(((i + batch.length) / total) * 100));
      progressFill.style.width = `${progress}%`;
      progressText.textContent = 'Importando...';
      progressCount.textContent = `${Math.min(i + batch.length, total)} / ${total}`;
    }

    // Resultado final
    progressEl.classList.add('hidden');
    resultEl.classList.remove('hidden');

    let resultHTML = '<div class="import-result-items">';
    resultHTML += `<div class="import-result-item import-result-success">
      <span class="import-result-icon">✅</span>
      <span>${imported} lead${imported !== 1 ? 's' : ''} importado${imported !== 1 ? 's' : ''}</span>
    </div>`;

    if (skipped > 0) {
      resultHTML += `<div class="import-result-item import-result-warning">
        <span class="import-result-icon">⚠️</span>
        <span>${skipped} ignorado${skipped !== 1 ? 's' : ''} (duplicados ou sem dados)</span>
      </div>`;
    }

    if (errors > 0) {
      resultHTML += `<div class="import-result-item import-result-error">
        <span class="import-result-icon">❌</span>
        <span>${errors} erro${errors !== 1 ? 's' : ''}</span>
      </div>`;
    }

    resultHTML += '</div>';
    resultEl.innerHTML = resultHTML;

    // Mostrar botão de fechar
    footerEl.style.display = 'flex';
    footerEl.innerHTML = `
      <button type="button" class="btn btn-primary" id="close-import-done">Concluir</button>
    `;
    document.getElementById('close-import-done').addEventListener('click', () => {
      closeImportModal();
      // Recarregar fontes e oportunidades
      if (typeof Sources !== 'undefined') Sources.load();
      if (typeof Opportunities !== 'undefined') Opportunities.load();
    });

    return { imported, skipped, errors };
  }

  // ── Modal Control ──────────────────────────────────────

  function openImportModal(data) {
    parsedData = data;

    // Reset UI
    document.getElementById('import-progress').classList.add('hidden');
    document.getElementById('import-result').classList.add('hidden');
    const footer = document.getElementById('import-modal-footer');
    footer.style.display = 'flex';
    footer.innerHTML = `
      <button type="button" class="btn btn-ghost" id="cancel-import">Cancelar</button>
      <button type="button" class="btn btn-primary" id="confirm-import" disabled>
        <span id="confirm-import-text">Importar</span>
      </button>
    `;

    renderPreview(data.headers, data.rows);
    renderMapping(data.headers);

    document.getElementById('modal-import').classList.remove('hidden');

    // Re-bind listeners
    document.getElementById('cancel-import').addEventListener('click', closeImportModal);
    document.getElementById('close-import-modal').addEventListener('click', closeImportModal);
    document.getElementById('modal-import').querySelector('.modal-overlay')
      .addEventListener('click', closeImportModal);
  }

  function closeImportModal() {
    document.getElementById('modal-import').classList.add('hidden');
    parsedData = { headers: [], rows: [] };
  }

  // ── Init ──────────────────────────────────────────────

  function init() {
    // O confirm-import listener é adicionado dinamicamente em openImportModal
  }

  // ── Helpers ──────────────────────────────────────────────

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    init,
    parseFile,
    openImportModal,
    closeImportModal,
    importLeads,
    getMapping,
    getMappedFieldCount,
  };
})();
