/**
 * HUVI — Console Superadmin
 * Security Module (Segurança do Console)
 */
const AdminSecurity = (() => {
  const modal = document.getElementById('modal-security');

  function openModal() {
    document.getElementById('security-username').value = AdminAuth.getUsername();
    document.getElementById('security-password').value = '';
    document.getElementById('security-password-confirm').value = '';
    modal.classList.remove('hidden');
  }

  function closeModal() {
    modal.classList.add('hidden');
  }

  async function save(e) {
    e.preventDefault();
    const newUser = document.getElementById('security-username').value.trim();
    const newPass = document.getElementById('security-password').value;
    const confirmPass = document.getElementById('security-password-confirm').value;

    if (!newUser) {
      showToast('Informe o nome de usuário', 'error');
      return;
    }

    if (newPass && newPass !== confirmPass) {
      showToast('As senhas não conferem', 'error');
      return;
    }

    await AdminAuth.updateCredentials(newUser, newPass || null);
    showToast('Credenciais atualizadas com sucesso!', 'success');
    closeModal();
  }

  function init() {
    document.getElementById('btn-security-config').addEventListener('click', openModal);
    document.getElementById('close-security-modal').addEventListener('click', closeModal);
    document.getElementById('cancel-security').addEventListener('click', closeModal);
    modal.querySelector('.modal-overlay').addEventListener('click', closeModal);
    document.getElementById('security-form').addEventListener('submit', save);
  }

  return { init };
})();
