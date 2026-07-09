/**
 * HUVI — Console Superadmin
 * App (Inicialização e Orquestração)
 */

// ── Global Helpers ──
function esc(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`admin-${name}-screen`);
  if (target) target.classList.add('active');
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('admin-toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3500);
}

// ── AdminApp ──
const AdminApp = (() => {
  function onLogin() {
    document.getElementById('admin-user-label').textContent = AdminAuth.getUsername();
    loadCurrentPage();
  }

  function loadCurrentPage() {
    const page = AdminRouter.getCurrentPage();
    switch (page) {
      case 'tenants':     AdminTenants.load(); break;
      case 'financial':   AdminFinancial.load(); break;
      case 'logs':        AdminLogs.load(); break;
      case 'connections': AdminConnections.load(); break;
      case 'security':    break; // No load needed
    }
  }

  function init() {
    // Init all modules
    AdminRouter.init();
    AdminTenants.init();
    AdminFinancial.init();
    AdminLogs.init();
    AdminConnections.init();
    AdminSecurity.init();
    AdminAuth.init();

    // Listen to page changes
    document.addEventListener('admin:page-change', () => loadCurrentPage());

    // If already logged in
    if (AdminAuth.isLoggedIn()) {
      onLogin();
    }

    // Mock mode badge
    if (isAdminMockMode) {
      const badge = document.createElement('div');
      badge.style.cssText = 'position:fixed;bottom:16px;right:16px;background:linear-gradient(135deg,#f47001,#f68c33);color:#fff;padding:8px 14px;border-radius:20px;font-size:12px;font-weight:700;z-index:9999;box-shadow:0 4px 12px rgba(244,112,1,0.3);';
      badge.textContent = '⚡ Modo Simulação';
      document.body.appendChild(badge);
    }
  }

  return { init, onLogin };
})();

// ── Bootstrap ──
document.addEventListener('DOMContentLoaded', AdminApp.init);
