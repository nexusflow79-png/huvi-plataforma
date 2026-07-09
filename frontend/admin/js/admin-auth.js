/**
 * HUVI — Console Superadmin
 * Auth (Login por senha mestra)
 */
const AdminAuth = (() => {
  function isLoggedIn() {
    return AdminSafeStorage.get('huvi_admin_session') === 'active';
  }

  function sha256(str) {
    const encoder = new TextEncoder();
    return crypto.subtle.digest('SHA-256', encoder.encode(str))
      .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join(''));
  }

  async function login(username, password) {
    try {
      const res = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const result = await res.json();
      if (result.success) {
        AdminSafeStorage.set('huvi_admin_session', 'active');
        AdminSafeStorage.set('huvi_admin_session_token', result.token);
        return { success: true };
      }
      return result; // Retorna mensagem de erro do backend
    } catch (err) {
      return { success: false, message: 'Erro de conexão com o servidor' };
    }
  }

  function logout() {
    AdminSafeStorage.del('huvi_admin_session');
    AdminSafeStorage.del('huvi_admin_session_token');
    showScreen('auth');
  }

  function getUsername() {
    return 'Superadmin';
  }

  async function updateCredentials(newUser, newPass) {
    alert('As credenciais do Superadmin agora são gerenciadas pelas Environment Variables na Vercel.');
  }

  function init() {
    const form = document.getElementById('admin-login-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const user = document.getElementById('admin-login-user').value.trim();
        const pass = document.getElementById('admin-login-pass').value;

        const result = await login(user, pass);
        if (result.success) {
          showScreen('app');
          AdminApp.onLogin();
        } else {
          showToast(result.message, 'error');
        }
      } catch (err) {
        showToast('Erro ao autenticar: ' + err.message, 'error');
      }
    });

    document.getElementById('admin-logout-btn').addEventListener('click', logout);

    // Check session
    if (isLoggedIn()) {
      showScreen('app');
    } else {
      showScreen('auth');
    }
  }

  return { init, isLoggedIn, logout, getUsername, updateCredentials };
})();
