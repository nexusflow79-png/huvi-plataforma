/**
 * HUVI — Offer Landing Page Logic
 * Fetch data publicamente do Supabase baseado no ID da URL.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Configuração do Supabase local (apenas leitura anônima)
  const supabaseUrl = window.HUVI_CONFIG.SUPABASE_URL;
  const supabaseKey = window.HUVI_CONFIG.SUPABASE_ANON_KEY;
  const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

  const loadingState = document.getElementById('loading-state');
  const errorState = document.getElementById('error-state');
  const lpContainer = document.getElementById('lp-container');

  const getUrlParam = (param) => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
  };

  const offerId = getUrlParam('id');
  const leadId = getUrlParam('lead');

  if (!offerId) {
    showError();
    return;
  }

  try {
    // Busca a oferta no Supabase (depende da policy offers_public_select)
    const { data: offer, error } = await supabase
      .from('offers')
      .select('id, name, description, price, image_url, video_url, checkout_url, tenant_id')
      .eq('id', offerId)
      .eq('active', true)
      .is('deleted_at', null)
      .single();

    if (error || !offer) {
      console.error('[HUVI] Erro ao carregar oferta:', error);
      showError();
      return;
    }

    // Tenta descobrir o WhatsApp do tenant
    let tenantPhone = null;
    if (offer.tenant_id) {
      const { data: settings } = await supabase
        .from('tenant_settings')
        .select('setting_value')
        .eq('tenant_id', offer.tenant_id)
        .eq('setting_key', 'evolution_phone')
        .maybeSingle();
      if (settings) tenantPhone = settings.setting_value;
    }

    renderOffer(offer, tenantPhone);

  } catch (err) {
    console.error('[HUVI] Erro inesperado:', err);
    showError();
  }

  function showError() {
    loadingState.style.display = 'none';
    lpContainer.style.display = 'none';
    errorState.style.display = 'block';
  }

  function renderOffer(offer, tenantPhone) {
    // Atualizar título da página e meta tags
    document.title = offer.name || 'Oferta Especial — HUVI';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (offer.description && metaDesc) metaDesc.content = offer.description.substring(0, 160);
    // Titulo e Descrição
    document.getElementById('lp-title').textContent = offer.name || 'Oferta Exclusiva';
    
    if (offer.description) {
      document.getElementById('lp-description').textContent = offer.description;
    } else {
      document.getElementById('lp-description').style.display = 'none';
    }

    // Mídia (Vídeo tem prioridade sobre imagem)
    const mediaWrapper = document.getElementById('media-wrapper');
    if (offer.video_url) {
      mediaWrapper.innerHTML = `
        <div class="video-wrapper">
          <iframe src="${getEmbedUrl(offer.video_url)}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>
        </div>
      `;
      mediaWrapper.classList.remove('hidden');
    } else if (offer.image_url) {
      mediaWrapper.innerHTML = `<img src="${offer.image_url}" alt="${offer.name}">`;
      mediaWrapper.classList.remove('hidden');
    }

    // Preço
    if (offer.price !== null && offer.price !== undefined) {
      document.getElementById('lp-price').textContent = `R$ ${parseFloat(offer.price).toFixed(2).replace('.', ',')}`;
      document.getElementById('price-wrapper').classList.remove('hidden');
    }

    // Botão de Checkout
    const btn = document.getElementById('lp-checkout-btn');
    if (offer.checkout_url) {
      btn.href = offer.checkout_url;
    } else if (tenantPhone) {
      btn.textContent = 'Tenho Interesse';
      btn.href = `https://wa.me/${tenantPhone}?text=${encodeURIComponent('Olá, tenho interesse na oferta: ' + offer.name)}`;
    } else {
      btn.textContent = 'Tenho Interesse';
      btn.href = `https://wa.me/?text=${encodeURIComponent('Olá, tenho interesse na oferta: ' + offer.name)}`;
    }

    // Interceptar clique para registrar conversão automática se houver leadId
    // Usa o proxy seguro via Edge Function — nunca expõe a URL do n8n ao browser
    btn.addEventListener('click', () => {
      if (leadId) {
        try {
          fetch(`${supabaseUrl}/functions/v1/huvi-n8n-proxy`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
            },
            body: JSON.stringify({
              target: 'CONVERSION',
              payload: {
                tenant_id: offer.tenant_id,
                opportunity_id: leadId,
                conversion_type: offer.checkout_url ? 'direct_checkout' : 'manual',
                value: offer.price || 0
              }
            })
          }).catch(err => console.error('[HUVI] Erro ao registrar conversão via proxy:', err));
        } catch (err) {
          console.error('[HUVI] Falha no disparo fetch conversão:', err);
        }
      }
    });

    // Mostrar UI
    loadingState.style.display = 'none';
    lpContainer.style.display = 'block';
  }

  // Helper para converter YouTube watch em embed
  function getEmbedUrl(url) {
    if (!url) return '';
    if (url.includes('youtube.com/watch?v=')) {
      return url.replace('watch?v=', 'embed/');
    }
    if (url.includes('youtu.be/')) {
      return url.replace('youtu.be/', 'youtube.com/embed/');
    }
    // Pode expandir para Vimeo e outros...
    return url;
  }

});
