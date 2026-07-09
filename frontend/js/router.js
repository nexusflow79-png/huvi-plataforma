/**
 * HUVI — Router
 * Navegação SPA entre páginas
 */
const Router = (() => {
  const pageTitle = document.getElementById('page-title');
  const sidebar = document.getElementById('sidebar');

  const PAGE_TITLES = {
    offers: 'Ofertas',
    sources: 'Fontes de Pesquisa',
    discovery: 'Descoberta de Oportunidades',
    opportunities: 'Oportunidades',
    campaigns: 'Campanhas',
    conversations: 'Conversas (SDR)',
    conversions: 'Conversões',
    dashboard: 'Dashboard',
    settings: 'Configurações',
  };

  let currentPage = 'dashboard';

  function navigate(pageName) {
    if (!PAGE_TITLES[pageName]) return;

    currentPage = pageName;

    // Atualizar páginas
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`page-${pageName}`);
    if (target) target.classList.add('active');

    // Atualizar nav items (sidebar)
    document.querySelectorAll('.sidebar .nav-item').forEach(n => {
      n.classList.toggle('active', n.dataset.page === pageName);
    });

    // Atualizar bottom nav
    document.querySelectorAll('.bnav-item').forEach(n => {
      n.classList.toggle('active', n.dataset.page === pageName);
    });

    // Atualizar título
    pageTitle.textContent = PAGE_TITLES[pageName];

    // Fechar sidebar mobile
    sidebar.classList.remove('open');

    // Trigger de carregamento da página
    const event = new CustomEvent('huvi:page-change', { detail: { page: pageName } });
    document.dispatchEvent(event);
  }

  function init() {
    // Clicks no sidebar
    document.querySelectorAll('.sidebar .nav-item[data-page]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(item.dataset.page);
      });
    });

    // Clicks no bottom nav
    document.querySelectorAll('.bnav-item[data-page]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(item.dataset.page);
      });
    });

    // Menu toggle (mobile)
    document.getElementById('menu-toggle').addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });

    // Fechar sidebar clicando fora (mobile)
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') &&
          !sidebar.contains(e.target) &&
          e.target.id !== 'menu-toggle' &&
          !e.target.closest('#menu-toggle')) {
        sidebar.classList.remove('open');
      }
    });
  }

  return { init, navigate, getCurrentPage: () => currentPage };
})();
