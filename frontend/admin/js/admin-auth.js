/**
 * HUVI — Console Superadmin
 * Auth (Login por senha mestra)
 */
const AdminAuth = (() => {
  function isLoggedIn() {
    return AdminSafeStorage.get('huvi_admin_session') === 'active' && !!AdminSafeStorage.get('huvi_admin_session_token');
  }

  async function login(username, password) {
    try {
      const res = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.status === 503) {
        return { success: false, message: 'Configuração administrativa indisponível no servidor. Entre em contato com o suporte.' };
      }

      const result = await res.json();
      if (result.success && result.token) {
        AdminSafeStorage.purgeLegacy();
        AdminSafeStorage.set('huvi_admin_session', 'active');
        AdminSafeStorage.set('huvi_admin_session_token', result.token);
        return { success: true };
      }
      return result; // Retorna mensagem de erro do backend (ex: Credenciais inválidas)
    } catch (err) {
      return { success: false, message: 'Erro de conexão com o servidor' };
    }
  }

  function logout() {
    AdminSafeStorage.del('huvi_admin_session');
    AdminSafeStorage.del('huvi_admin_session_token');
    
    // Limpar formulário de login por segurança
    const userField = document.getElementById('admin-login-user');
    const passField = document.getElementById('admin-login-pass');
    if (userField) userField.value = '';
    if (passField) passField.value = '';
    
    showScreen('auth');
  }

  function getUsername() {
    return 'Superadmin';
  }

  async function updateCredentials() {
    alert('As credenciais do Superadmin são gerenciadas exclusivamente pelas Environment Variables na Vercel.');
  }

  function init() {
    // Purgar resíduos antigos de sessões em localStorage
    AdminSafeStorage.purgeLegacy();

    const form = document.getElementById('admin-login-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const user = document.getElementById('admin-login-user').value.trim();
          const pass = document.getElementById('admin-login-pass').value;

          const result = await login(user, pass);
          if (result.success) {
            showScreen('app');
            if (typeof AdminApp !== 'undefined' && AdminApp.onLogin) {
              AdminApp.onLogin();
            }
          } else {
            showToast(result.message, 'error');
          }
        } catch (err) {
          showToast('Erro ao autenticar: ' + err.message, 'error');
        }
      });
    }

    const logoutBtn = document.getElementById('admin-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', logout);
    }

    // Check session
    if (isLoggedIn()) {
      showScreen('app');
    } else {
      showScreen('auth');
    }
  }

  return { init, isLoggedIn, logout, getUsername, updateCredentials };
})();
