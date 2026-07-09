/**
 * HUVI — Onboarding Module
 * Gerencia o fluxo inicial guiado de novos tenants
 */
const Onboarding = (() => {
  const screenEl = document.getElementById('onboarding-screen');
  const formEl = document.getElementById('onboarding-form');
  const dots = document.querySelectorAll('.onboarding-step-dot');
  const steps = document.querySelectorAll('.onboarding-step-content');
  const planCards = document.querySelectorAll('.onboarding-plan-card');
  
  let currentStep = 1;
  let selectedPlan = 'starter';

  async function getTenantId() {
    return window.getTenantId ? await window.getTenantId() : null;
  }

  function showStep(stepNum) {
    currentStep = stepNum;
    
    // Atualizar indicador visual de passos (dots)
    dots.forEach(dot => {
      const step = parseInt(dot.dataset.step);
      dot.className = 'onboarding-step-dot';
      if (step === currentStep) {
        dot.classList.add('active');
      } else if (step < currentStep) {
        dot.classList.add('completed');
        dot.textContent = '✓';
      } else {
        dot.textContent = step;
      }
    });

    // Alternar visibilidade das etapas
    steps.forEach(stepContent => {
      const step = parseInt(stepContent.dataset.step);
      if (step === currentStep) {
        stepContent.classList.add('active');
      } else {
        stepContent.classList.remove('active');
      }
    });
  }

  // Avançar uma etapa
  function nextStep() {
    if (currentStep < 2) {
      showStep(currentStep + 1);
    }
  }

  // Finalizar Onboarding e Salvar Oferta
  function initOfferCreation() {
    const btnFinish = document.getElementById('btn-onb-finish');
    
    if (formEl) {
      formEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (currentStep !== 2) return;

        const offerName = document.getElementById('onb-offer-name').value.trim();
        const offerDesc = document.getElementById('onb-offer-description').value.trim();
        const offerPriceStr = document.getElementById('onb-offer-price').value.trim();

        if (!offerName || !offerDesc) {
          showToast('Preencha os campos obrigatórios da oferta', 'error');
          return;
        }

        const price = offerPriceStr ? parseFloat(offerPriceStr.replace(',', '.')) : 0;
        if (offerPriceStr && isNaN(price)) {
          showToast('Preço inválido', 'error');
          return;
        }

        const btnText = btnFinish.querySelector('.btn-text');
        const btnLoader = btnFinish.querySelector('.btn-loader');
        btnFinish.disabled = true;
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');

        const tenantId = await getTenantId();
        if (!tenantId) return;

        try {
          // Cadastrar a primeira oferta
          const { error } = await supabase
            .from('offers')
            .insert({
              tenant_id: tenantId,
              name: offerName,
              description: offerDesc,
              price: price || null,
              active: true
            });

          if (error) throw error;

          showToast('Onboarding concluído com sucesso! Bem-vindo.', 'success');
          
          // Fechar a tela de onboarding e abrir o app normal
          screenEl.classList.remove('active');
          document.getElementById('app-screen').classList.add('active');
          
          // Inicializar e carregar todos os módulos do app
          App.init();

        } catch (err) {
          console.error('[HUVI] Erro ao cadastrar oferta onboarding:', err);
          showToast('Erro ao cadastrar primeira oferta: ' + err.message, 'error');
        } finally {
          btnFinish.disabled = false;
          btnText.classList.remove('hidden');
          btnLoader.classList.add('hidden');
        }
      });
    }
  }

  // Interceptar cliques em next-step-btn genéricos (Ex: etapa 1)
  function initStepNavigation() {
    document.querySelectorAll('.next-step-btn').forEach(btn => {
      btn.addEventListener('click', nextStep);
    });
  }

  function start() {
    screenEl.classList.add('active');
    document.getElementById('app-screen').classList.remove('active');
    showStep(1);
  }

  function init() {
    initStepNavigation();
    initOfferCreation();
  }

  return { init, start };
})();
