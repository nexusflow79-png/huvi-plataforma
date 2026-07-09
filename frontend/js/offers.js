/**
 * HUVI — Offers Module
 * CRUD de Ofertas, Controle de priorização exclusiva (apenas uma ativa) e Soft Delete
 */
const Offers = (() => {
  function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
  const listEl = document.getElementById('offers-list');
  const modal = document.getElementById('modal-offer');
  const form = document.getElementById('offer-form');
  const modalTitle = document.getElementById('modal-offer-title');

  // Elementos do Upload de Imagem da Oferta
  const dropzone = document.getElementById('offer-image-dropzone');
  const fileInput = document.getElementById('offer-image-input');
  const filePlaceholder = document.getElementById('offer-image-placeholder');
  const previewContainer = document.getElementById('offer-image-preview-container');
  const previewImg = document.getElementById('offer-image-preview');
  const filenameEl = document.getElementById('offer-image-filename');
  const removeBtn = document.getElementById('offer-image-remove');
  const imageUrlInput = document.getElementById('offer-image-url');
  let selectedImageFile = null;

  function clearImage() {
    selectedImageFile = null;
    fileInput.value = '';
    imageUrlInput.value = '';
    filePlaceholder.classList.remove('hidden');
    previewContainer.classList.add('hidden');
    previewImg.src = '';
    filenameEl.textContent = '';
  }

  async function handleImageSelect(file) {
    if (!file) return;

    // Validar tamanho (3MB de acordo com o pedido do usuário)
    if (file.size > 3 * 1024 * 1024) {
      showToast('Imagem muito grande. Máximo: 3 MB', 'error');
      return;
    }

    // Validar formato
    if (!file.type.startsWith('image/')) {
      showToast('Por favor, selecione apenas arquivos de imagem.', 'error');
      return;
    }

    selectedImageFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target.result;
      imageUrlInput.value = base64Data;
      previewImg.src = base64Data;
      filenameEl.textContent = file.name;
      
      filePlaceholder.classList.add('hidden');
      previewContainer.classList.remove('hidden');
    };
    reader.onerror = () => {
      showToast('Erro ao ler a imagem', 'error');
    };
    reader.readAsDataURL(file);
  }

  function openModal(offer = null) {
    form.reset();
    clearImage();
    document.getElementById('offer-id').value = '';
    document.getElementById('offer-active').checked = true;

    if (offer) {
      modalTitle.textContent = 'Editar Oferta';
      document.getElementById('offer-id').value = offer.id;
      document.getElementById('offer-name').value = offer.name || '';
      document.getElementById('offer-description').value = offer.description || '';
      document.getElementById('offer-price').value = offer.price || '';
      document.getElementById('offer-video-url').value = offer.video_url || '';
      document.getElementById('offer-landing-page').value = offer.landing_page_url || '';
      document.getElementById('offer-checkout').value = offer.checkout_url || '';
      document.getElementById('offer-calendar').value = offer.calendar_url || '';
      document.getElementById('offer-active').checked = offer.active;

      // Carregar preview se tiver imagem salva
      if (offer.image_url) {
        imageUrlInput.value = offer.image_url;
        previewImg.src = offer.image_url;
        filenameEl.textContent = offer.image_url.startsWith('data:image') ? 'Imagem Cadastrada' : 'Imagem URL';
        filePlaceholder.classList.add('hidden');
        previewContainer.classList.remove('hidden');
      }
    } else {
      modalTitle.textContent = 'Criar Oferta';
    }

    modal.classList.remove('hidden');
  }

  function closeModal() {
    modal.classList.add('hidden');
    clearImage();
  }

  function compressImage(file, maxWidth, maxHeight, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  }

  async function save(e) {
    e.preventDefault();
    const id = document.getElementById('offer-id').value;
    const tenantId = await getTenantId();
    const name = document.getElementById('offer-name').value.trim();
    const description = document.getElementById('offer-description').value.trim();
    const priceRaw = document.getElementById('offer-price').value.trim();
    const priceCleaned = priceRaw.replace(/\s/g, '').replace(',', '.');
    const price = parseFloat(priceCleaned) || null;
    const image_url = imageUrlInput.value.trim() || null;
    const video_url = document.getElementById('offer-video-url').value.trim() || null;
    const landing_page_url = document.getElementById('offer-landing-page').value.trim() || null;
    const checkout_url = document.getElementById('offer-checkout').value.trim() || null;
    const calendar_url = document.getElementById('offer-calendar').value.trim() || null;
    const active = document.getElementById('offer-active').checked;

    if (!name) {
      showToast('O nome da oferta é obrigatório', 'error');
      return;
    }

    function isValidURL(str) {
      if (!str) return true;
      try {
        const url = new URL(str);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch { return false; }
    }

    if (!isValidURL(landing_page_url)) {
      showToast('URL da Landing Page inválida. Deve começar com http:// ou https://', 'error');
      return;
    }
    if (!isValidURL(video_url)) {
      showToast('URL do Vídeo inválida. Deve começar com http:// ou https://', 'error');
      return;
    }
    if (!isValidURL(checkout_url)) {
      showToast('URL do Checkout inválida. Deve começar com http:// ou https://', 'error');
      return;
    }
    if (!isValidURL(calendar_url)) {
      showToast('URL do Calendário inválida. Deve começar com http:// ou https://', 'error');
      return;
    }

    let finalImageUrl = image_url;

    // Se temos um arquivo de imagem selecionado e ele mudou/foi adicionado, fazemos o upload ou compressão
    if (selectedImageFile) {
      if (window.isMockMode) {
        // Modo Simulação/Offline: Comprimir para não estourar LocalStorage
        try {
          finalImageUrl = await compressImage(selectedImageFile, 300, 300, 0.7);
        } catch (err) {
          console.warn('[HUVI] Erro ao comprimir imagem para mock, usando original:', err);
        }
      } else {
        // Supabase Real: Enviar o arquivo binário para o bucket publico no Supabase Storage
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Enviando imagem...';

        try {
          const fileExt = selectedImageFile.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
          const filePath = `${tenantId}/${fileName}`;

          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('offer-images')
            .upload(filePath, selectedImageFile, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadErr) {
            console.error('[HUVI] Erro upload arquivo storage:', uploadErr);
            showToast('Erro ao enviar imagem no Storage. Certifique-se de que o bucket "offer-images" público esteja criado no Supabase.', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            return;
          }

          // Obter a URL pública do arquivo enviado
          const { data: { publicUrl } } = supabase.storage
            .from('offer-images')
            .getPublicUrl(filePath);

          finalImageUrl = publicUrl;
        } catch (err) {
          console.error('[HUVI] Exceção no upload para o Supabase Storage:', err);
          showToast('Erro inesperado ao enviar a imagem.', 'error');
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
          return;
        }

        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    }

    const payload = {
      tenant_id: tenantId,
      name,
      description,
      price,
      image_url: finalImageUrl,
      video_url,
      landing_page_url,
      checkout_url,
      calendar_url,
      active
    };

    let res;
    if (id) {
      res = await supabase.from('offers').update(payload).eq('id', id);
    } else {
      res = await supabase.from('offers').insert(payload);
    }

    if (res.error) {
      showToast('Erro do Banco: ' + (res.error.message || res.error.details || 'Falha ao salvar'), 'error');
      console.error('[HUVI] Erro ao salvar oferta:', res.error);
      return;
    }

    if (active) {
      // Regra de Exclusividade: Desativar todas as outras ofertas do tenant (só após salvar com sucesso)
      await supabase
        .from('offers')
        .update({ active: false })
        .eq('tenant_id', tenantId)
        .neq('id', id || res.data?.id);
    }

    showToast(id ? 'Oferta atualizada!' : 'Oferta criada com sucesso!', 'success');
    closeModal();
    load();
  }

  async function toggleActive(id, currentActive) {
    const tenantId = await getTenantId();
    if (!tenantId) return;

    const newActive = !currentActive;

    if (newActive) {
      // Prioridade Exclusiva: Desativar todas as outras primeiro
      const { error: deactivateErr } = await supabase
        .from('offers')
        .update({ active: false })
        .eq('tenant_id', tenantId)
        .neq('id', id);

      if (deactivateErr) {
        showToast('Erro ao desativar ofertas concorrentes', 'error');
        console.error(deactivateErr);
        return;
      }
    }

    const { error } = await supabase
      .from('offers')
      .update({ active: newActive })
      .eq('id', id);

    if (error) {
      showToast('Erro ao alterar status', 'error');
      console.error(error);
      return;
    }

    showToast(newActive ? 'Oferta ativada e priorizada!' : 'Oferta desativada', 'success');
    load();
  }

  // Correção da Constituição: Usando Soft Delete no lugar de remoção física
  async function deleteOffer(id) {
    if (!confirm('Deseja realmente excluir esta oferta comercial?')) return;

    const { error } = await supabase
      .from('offers')
      .update({ deleted_at: new Date().toISOString(), active: false })
      .eq('id', id);

    if (error) {
      showToast('Erro ao excluir oferta', 'error');
      console.error('[HUVI] Erro excluir oferta:', error);
      return;
    }

    showToast('Oferta excluída com sucesso!', 'success');
    load();
  }

  function renderList(offers) {
    if (!offers || offers.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🏷️</span>
          <p>Nenhuma oferta cadastrada</p>
          <p class="empty-hint">Cadastre seus serviços/produtos para viabilizar as campanhas da IA</p>
        </div>`;
      return;
    }

    listEl.innerHTML = offers.map((o, i) => `
      <div class="data-item" style="animation-delay: ${i * 40}ms">
        <div style="display: flex; align-items: center; gap: var(--space-4); flex: 1; min-width: 0;">
          ${o.image_url 
            ? `<img src="${escapeHtml(o.image_url)}" class="offer-thumbnail" alt="${escapeHtml(o.name)}">` 
            : `<div class="offer-thumbnail-placeholder">📦</div>`
          }
          <div class="data-item-info">
            <div class="data-item-title">${escapeHtml(o.name)}</div>
            <div class="data-item-subtitle">
              ${o.price ? `R$ ${parseFloat(o.price).toFixed(2).replace('.', ',')}` : 'Sob consulta'} · 
              <span class="badge ${o.active ? 'badge-active' : 'badge-draft'}">${o.active ? 'Ativa (Prioritária)' : 'Inativa'}</span>
            </div>
          </div>
        </div>
        <div class="data-item-actions">
          <button class="btn btn-ghost btn-sm btn-edit-offer" data-id="${o.id}">Editar</button>
          <button class="btn btn-ghost btn-sm btn-toggle-offer" data-id="${o.id}" data-active="${o.active}">
            ${o.active ? 'Desativar' : 'Ativar/Priorizar'}
          </button>
          <button class="btn btn-ghost btn-sm btn-delete-offer" data-id="${o.id}" style="color: var(--danger-color);">Excluir</button>
          <a class="btn btn-ghost btn-sm" href="${o.landing_page_url ? escapeHtml(o.landing_page_url) : 'offer.html?id=' + escapeHtml(o.id)}" target="_blank" rel="noopener">Ver LP</a>
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('.btn-edit-offer').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const offer = offers.find(o => o.id === btn.dataset.id);
        if (offer) openModal(offer);
      });
    });

    listEl.querySelectorAll('.btn-toggle-offer').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleActive(btn.dataset.id, btn.dataset.active === 'true');
      });
    });

    listEl.querySelectorAll('.btn-delete-offer').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteOffer(btn.dataset.id);
      });
    });
  }

  async function load() {
    const tenantId = await getTenantId();
    if (!tenantId) return;

    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[HUVI] Erro ao carregar ofertas:', error);
      return;
    }

    renderList(data);
  }

  let _initialized = false;
  function init() {
    if (_initialized) return;
    _initialized = true;

    document.getElementById('btn-new-offer').addEventListener('click', () => openModal());
    document.getElementById('close-offer-modal').addEventListener('click', closeModal);
    document.getElementById('cancel-offer').addEventListener('click', closeModal);
    modal.querySelector('.modal-overlay').addEventListener('click', closeModal);
    form.addEventListener('submit', save);

    // Eventos de Upload de Imagem da Oferta
    dropzone.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) {
        handleImageSelect(e.target.files[0]);
      }
    });

    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearImage();
    });

    // Drag and Drop
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
        handleImageSelect(e.dataTransfer.files[0]);
      }
    });
  }

  return { init, load };
})();
