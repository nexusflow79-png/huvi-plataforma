/**
 * HUVI — Console Superadmin
 * Router (Navegação SPA)
 */
const AdminRouter = (() => {
  const PAGE_TITLES = {
    tenants: 'Clientes Contratantes',
    financial: 'Controle Financeiro',
    logs: 'Logs Operacionais',
    connections: 'Diagnóstico de Conexões',
    security: 'Segurança do Console',
  };

  let currentPage = 'tenants';

  function navigate(pageName) {
    if (!PAGE_TITLES[pageName]) return;
    currentPage = pageName;

    // Update pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`page-${pageName}`);
    if (target) target.classList.add('active');

    // Update nav
    document.querySelectorAll('.sidebar .nav-item').forEach(n => {
      n.classList.toggle('active', n.dataset.page === pageName);
    });

    // Update title
    document.getElementById('admin-page-title').textContent = PAGE_TITLES[pageName];

    // Close mobile sidebar
    document.getElementById('admin-sidebar').classList.remove('open');

    // Trigger load
    const event = new CustomEvent('admin:page-change', { detail: { page: pageName } });
    document.dispatchEvent(event);
  }

  function init() {
    document.querySelectorAll('.sidebar .nav-item[data-page]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(item.dataset.page);
      });
    });

    document.getElementById('admin-menu-toggle').addEventListener('click', () => {
      document.getElementById('admin-sidebar').classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      const sidebar = document.getElementById('admin-sidebar');
      if (sidebar.classList.contains('open') &&
          !sidebar.contains(e.target) &&
          !e.target.closest('#admin-menu-toggle')) {
        sidebar.classList.remove('open');
      }
    });
  }

  return { init, navigate, getCurrentPage: () => currentPage };
})();
