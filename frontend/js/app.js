/**
 * HUVI — App Principal
 * Inicialização e orquestração de módulos
 */

// Toast global
function showToast(message, type = 'info') {
  const toast = document.getElementById('global-toast');
  toast.textContent = message;
  toast.className = `toast toast-${type}`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 4000);
}

const App = (() => {
  let initialized = false;

  // Mapa de página → módulo de carregamento
  const pageLoaders = {
    offers: () => Offers.load(),
    sources: () => Sources.load(),
    discovery: () => { Discovery.load(); WebDiscovery.load(); },
    opportunities: () => Opportunities.load(),
    campaigns: () => Campaigns.load(),
    conversations: () => Conversations.load(),
    conversions: () => Conversions.load(),
    dashboard: () => Dashboard.load(),
    settings: () => Settings.load(),
  };

  async function init() {
    try {
      if (initialized) {
        // Recarregar dados da página atual
        const currentPage = Router.getCurrentPage();
        if (pageLoaders[currentPage]) {
          await pageLoaders[currentPage]();
        }
        return;
      }

      initialized = true;

      // Verificar necessidade de Onboarding (se não há ofertas cadastradas)
      const tenantId = await getTenantId();
      if (tenantId) {
        const { count, error } = await supabase
          .from('offers')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .is('deleted_at', null);
        
        if (!error && count === 0) {
          // Inicializar e rodar Onboarding
          Onboarding.init();
          Onboarding.start();
          return;
        }
      }

      // Carregar nome do usuário
      const profile = await getCurrentProfile();
      if (profile) {
        document.getElementById('user-name').textContent = profile.full_name || profile.email;
      }

      // Inicializar módulos
      Router.init();
      Offers.init();
      Sources.init();
      Discovery.init();
      WebDiscovery.init();
      Opportunities.init();
      Campaigns.init();
      Conversations.init();
      Conversions.init();
      Settings.init();

      // Listener para mudança de página
      document.addEventListener('huvi:page-change', async (e) => {
        const page = e.detail.page;
        if (pageLoaders[page]) {
          await pageLoaders[page]();
        }
      });

      // Carregar dashboard inicial
      await Dashboard.load();


    } catch (e) {
      console.error('[HUVI] ERRO NA INICIALIZAÇÃO:', e);
    }
  }

  return { init };
})();

// Boot
document.addEventListener('DOMContentLoaded', () => {
  Auth.init();
});
