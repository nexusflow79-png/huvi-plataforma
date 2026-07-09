/**
 * HUVI — Auth Module
 * Login, Registro, Recuperação de Senha
 */
const Auth = (() => {
  // Elementos DOM
  const authScreen   = document.getElementById('auth-screen');
  const appScreen    = document.getElementById('app-screen');
  const loginForm    = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const recoveryForm = document.getElementById('recovery-form');
  const authToast    = document.getElementById('auth-toast');

  // Obter o cliente Supabase de forma segura
  function getClient() {
    return window.supabase || (typeof supabase !== 'undefined' ? supabase : null);
  }

  // Navegação entre formulários
  function showForm(formId) {
    [loginForm, registerForm, recoveryForm].forEach(f => f.classList.remove('active'));
    document.getElementById(formId).classList.add('active');
  }

  // Toast
  function showAuthToast(message, type = 'info') {
    authToast.textContent = message;
    authToast.className = `toast ${type}`;
    authToast.classList.remove('hidden');
    setTimeout(() => authToast.classList.add('hidden'), 4000);
  }

  // Loader no botão
  function setLoading(btn, loading) {
    const text = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.btn-loader');
    if (loading) {
      text.classList.add('hidden');
      loader.classList.remove('hidden');
      btn.disabled = true;
    } else {
      text.classList.remove('hidden');
      loader.classList.add('hidden');
      btn.disabled = false;
    }
  }

  // Validação de formato de e-mail
  function isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  // Tradução de Erros Supabase
  function translateAuthError(message) {
    if (!message) return '';
    const msg = message.toLowerCase();
    if (msg.includes('user already registered')) return 'Este e-mail já está cadastrado.';
    if (msg.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
    if (msg.includes('email not confirmed')) return 'E-mail não confirmado. Verifique sua caixa de entrada.';
    if (msg.includes('password should be at least')) return 'A senha deve ter pelo menos 8 caracteres.';
    if (msg.includes('rate limit')) return 'Muitas tentativas. Tente novamente mais tarde.';
    return message;
  }

  // Login
  async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-submit');

    if (!email || !password) {
      showAuthToast('Preencha todos os campos', 'error');
      return;
    }

    if (!isValidEmail(email)) {
      showAuthToast('Digite um e-mail válido', 'error');
      return;
    }

    setLoading(btn, true);

    try {
      const client = getClient();
      if (!client || !client.auth) {
        throw new Error('Supabase Client não inicializado');
      }

      const { data, error } = await client.auth.signInWithPassword({ email, password });
      
      setLoading(btn, false);

      if (error) {
        showAuthToast(translateAuthError(error.message) || 'E-mail ou senha incorretos', 'error');
        console.error('[HUVI] Login error:', error);
        return;
      }

      showAuthToast('Login realizado com sucesso!', 'success');
      onAuthStateChange(data.session);
    } catch (err) {
      setLoading(btn, false);
      showAuthToast('Falha na autenticação. Sistema ou rede indisponível.', 'error');
      console.error('[HUVI] Login exception:', err);
    }
  }

  // Registro
  async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const passwordConfirm = document.getElementById('register-password-confirm').value;
    const btn = document.getElementById('register-submit');

    if (!name || !email || !password || !passwordConfirm) {
      showAuthToast('Preencha todos os campos', 'error');
      return;
    }

    if (!isValidEmail(email)) {
      showAuthToast('Digite um e-mail válido', 'error');
      return;
    }

    if (password.length < 8) {
      showAuthToast('A senha deve ter pelo menos 8 caracteres', 'error');
      return;
    }

    if (password !== passwordConfirm) {
      showAuthToast('As senhas não coincidem.', 'error');
      return;
    }

    setLoading(btn, true);

    try {
      const client = getClient();
      if (!client || !client.auth) {
        throw new Error('Supabase Client não inicializado');
      }

      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: window.location.origin
        }
      });

      setLoading(btn, false);

      if (error) {
        showAuthToast(translateAuthError(error.message) || 'Erro ao criar conta', 'error');
        console.error('[HUVI] Register error:', error);
        return;
      }

      if (data.user && !data.session) {
        showAuthToast('Conta criada! Verifique seu e-mail para confirmar.', 'success');
        showForm('login-form');
      } else if (data.session) {
        showAuthToast('Conta criada com sucesso!', 'success');
        onAuthStateChange(data.session);
      }
    } catch (err) {
      setLoading(btn, false);
      showAuthToast('Erro ao criar conta. Tente novamente.', 'error');
      console.error('[HUVI] Register exception:', err);
    }
  }

  // Recuperação
  async function handleRecovery(e) {
    e.preventDefault();
    const email = document.getElementById('recovery-email').value.trim();
    const btn = document.getElementById('recovery-submit');

    if (!email) {
      showAuthToast('Informe seu e-mail', 'error');
      return;
    }

    if (!isValidEmail(email)) {
      showAuthToast('Digite um e-mail válido', 'error');
      return;
    }

    setLoading(btn, true);

    try {
      const client = getClient();
      if (!client || !client.auth) {
        throw new Error('Supabase Client não inicializado');
      }

      const { error } = await client.auth.resetPasswordForEmail(email);

      setLoading(btn, false);

      if (error) {
        showAuthToast('Erro ao enviar link', 'error');
        return;
      }

      showAuthToast('Link enviado! Verifique seu e-mail.', 'success');
      showForm('login-form');
    } catch (err) {
      setLoading(btn, false);
      showAuthToast('Erro ao enviar link de recuperação.', 'error');
      console.error('[HUVI] Recovery exception:', err);
    }
  }

  // Logout
  async function logout() {
    try {
      const client = getClient();
      if (client && client.auth) {
        await client.auth.signOut();
      }
    } catch (err) {
      console.error('[HUVI] Signout exception:', err);
    } finally {
      authScreen.classList.add('active');
      appScreen.classList.remove('active');
      showForm('login-form');
    }
  }

  // Mudança de estado de autenticação
  function onAuthStateChange(session) {
    if (session) {
      authScreen.classList.remove('active');
      appScreen.classList.add('active');
      App.init();
    } else {
      authScreen.classList.add('active');
      appScreen.classList.remove('active');
    }
  }

  // Inicialização
  function init() {
    // Event listeners dos formulários
    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
    recoveryForm.addEventListener('submit', handleRecovery);

    // Navegação entre forms
    document.getElementById('show-register').addEventListener('click', () => showForm('register-form'));
    document.getElementById('show-login').addEventListener('click', () => showForm('login-form'));
    document.getElementById('show-recovery').addEventListener('click', () => showForm('recovery-form'));
    document.getElementById('show-login-from-recovery').addEventListener('click', () => showForm('login-form'));

    // Logout
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Evitar erros caso o Supabase não esteja totalmente carregado ainda
    try {
      const client = getClient();
      if (client && client.auth) {
        // Listener de mudança de auth (já dispara com a sessão atual ao se inscrever)
        client.auth.onAuthStateChange((event, session) => {
          onAuthStateChange(session);
        });
      } else {
        console.warn('[HUVI] Supabase Auth não disponível no bootstrap.');
      }
    } catch (err) {
      console.error('[HUVI] Erro ao obter sessão inicial do Supabase:', err);
    }
  }

  return { init, logout };
})();
