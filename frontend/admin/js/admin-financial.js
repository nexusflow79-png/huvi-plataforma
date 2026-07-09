/**
 * HUVI — Console Superadmin
 * Financial Module (Controle Financeiro)
 */
const AdminFinancial = (() => {
  const getExpenses = () => {
    try {
      const stored = localStorage.getItem('huvi_admin_expenses');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error('[HUVI] Erro ao carregar despesas:', e);
    }
    // Valores iniciais padrão
    return {
      llm_workflow: 15.50,
      llm_plataforma: 22.40,
      outras_despesas: 18.00
    };
  };

  const saveExpenses = (expenses) => {
    try {
      localStorage.setItem('huvi_admin_expenses', JSON.stringify(expenses));
    } catch (e) {
      console.error('[HUVI] Erro ao salvar despesas:', e);
    }
  };

  async function load() {
    const { data: tenants } = await adminSupabase.from('tenants').select().order('created_at', { ascending: false });
    const list = tenants || [];

    // Lógica de Receitas
    const activeTenants = list.filter(t => t.status === 'active');
    const emDiaTenants = list.filter(t => t.financial_status === 'em_dia' && t.status === 'active');
    const emAtrasoTenants = list.filter(t => t.financial_status === 'em_atraso');
    
    const emDia = emDiaTenants.length;
    const emAtraso = emAtrasoTenants.length;
    const total = list.length;

    const emDiaValue = emDiaTenants.reduce((sum, t) => sum + (parseFloat(t.monthly_value) || 0), 0);
    const emAtrasoValue = emAtrasoTenants.reduce((sum, t) => sum + (parseFloat(t.monthly_value) || 0), 0);
    const totalReceber = activeTenants.reduce((sum, t) => sum + (parseFloat(t.monthly_value) || 0), 0);

    // Lógica de Despesas
    const expenses = getExpenses();
    const totalDespesas = (parseFloat(expenses.llm_workflow) || 0) + 
                          (parseFloat(expenses.llm_plataforma) || 0) + 
                          (parseFloat(expenses.outras_despesas) || 0);

    const resultadoLiquido = totalReceber - totalDespesas;

    // Atualizar HTML de Receitas
    document.getElementById('fin-em-dia').textContent = emDia;
    document.getElementById('fin-em-dia-value').textContent = `R$ ${emDiaValue.toFixed(2).replace('.', ',')}`;
    
    document.getElementById('fin-em-atraso').textContent = emAtraso;
    document.getElementById('fin-em-atraso-value').textContent = `R$ ${emAtrasoValue.toFixed(2).replace('.', ',')}`;
    
    document.getElementById('fin-total').textContent = total;
    document.getElementById('fin-total-receber').textContent = `R$ ${totalReceber.toFixed(2).replace('.', ',')}`;
    document.getElementById('fin-active-tenants-desc').textContent = `${activeTenants.length} contratos ativos`;

    // Atualizar HTML de Despesas
    document.getElementById('fin-total-despesas').textContent = `R$ ${totalDespesas.toFixed(2).replace('.', ',')}`;
    document.getElementById('fin-llm-workflow').textContent = `R$ ${(parseFloat(expenses.llm_workflow) || 0).toFixed(2).replace('.', ',')}`;
    document.getElementById('fin-llm-plataforma').textContent = `R$ ${(parseFloat(expenses.llm_plataforma) || 0).toFixed(2).replace('.', ',')}`;
    document.getElementById('fin-outras-despesas').textContent = `R$ ${(parseFloat(expenses.outras_despesas) || 0).toFixed(2).replace('.', ',')}`;
    
    const profitDescEl = document.getElementById('fin-profit-desc');
    if (resultadoLiquido >= 0) {
      profitDescEl.textContent = `Resultado Líquido: R$ ${resultadoLiquido.toFixed(2).replace('.', ',')}`;
      profitDescEl.style.color = '#51cf66';
    } else {
      profitDescEl.textContent = `Resultado Líquido (Déficit): R$ ${Math.abs(resultadoLiquido).toFixed(2).replace('.', ',')}`;
      profitDescEl.style.color = '#ff6b6b';
    }

    // Renderizar tabela de valores mensais recebidos por tenant
    const tenantsListEl = document.getElementById('financial-tenants-list');
    if (tenantsListEl) {
      if (list.length === 0) {
        tenantsListEl.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">
              Nenhum cliente cadastrado.
            </td>
          </tr>`;
      } else {
        tenantsListEl.innerHTML = list.map(t => {
          const val = parseFloat(t.monthly_value) || 0;
          const valDisplay = `R$ ${val.toFixed(2).replace('.', ',')}`;
          const dueDisplay = t.due_date || '-';
          
          let badgeClass = 'badge-inactive';
          let statusLabel = 'Inativo';
          if (t.status === 'active') {
            if (t.financial_status === 'em_dia') {
              badgeClass = 'badge-em-dia';
              statusLabel = 'Em Dia';
            } else {
              badgeClass = 'badge-em-atraso';
              statusLabel = 'Em Atraso';
            }
          } else if (t.status === 'suspended') {
            badgeClass = 'badge-suspended';
            statusLabel = 'Suspenso';
          }

          return `
            <tr style="border-bottom: 1px solid var(--surface-300);">
              <td style="padding: var(--space-3) var(--space-4); font-weight: 600; color: var(--text-primary);">${t.name}</td>
              <td style="padding: var(--space-3) var(--space-4); text-transform: uppercase; font-size: var(--font-xs); font-weight: 600; color: var(--text-secondary);">${t.plan}</td>
              <td style="padding: var(--space-3) var(--space-4); font-weight: 600; color: var(--text-primary);">${valDisplay}</td>
              <td style="padding: var(--space-3) var(--space-4); color: var(--text-muted);">${dueDisplay}</td>
              <td style="padding: var(--space-3) var(--space-4);"><span class="badge ${badgeClass}">${statusLabel}</span></td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  function init() {
    // Disparo rápido Asaas
    function showFeedback(msg, isError = false) {
      const feedback = document.getElementById('quick-link-feedback');
      if (feedback) {
        feedback.textContent = msg;
        feedback.style.color = isError ? 'var(--error)' : 'var(--success)';
        setTimeout(() => { feedback.textContent = ''; }, 4000);
      }
    }

    function handleQuickSend(link) {
      const email = document.getElementById('quick-link-email')?.value.trim();
      let whatsapp = document.getElementById('quick-link-whatsapp')?.value.trim();
      
      if (whatsapp) {
        whatsapp = whatsapp.replace(/\D/g, ''); // Limpa formatações
        const msg = encodeURIComponent(`Olá! Segue o link para assinatura do seu plano HUVI: ${link}`);
        window.open(`https://wa.me/${whatsapp}?text=${msg}`, '_blank');
        showFeedback('✓ WhatsApp aberto com sucesso!');
      } else if (email) {
        const subject = encodeURIComponent('Assinatura HUVI - Link de Pagamento');
        const body = encodeURIComponent(`Olá!\n\nSegue o link para você iniciar sua assinatura do HUVI:\n${link}`);
        
        // Se mailto não funciona, a melhor alternativa para web é abrir a tela de escrita do Gmail
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`;
        window.open(gmailUrl, '_blank');
        
        showFeedback('✓ Janela do Gmail aberta com sucesso!');
      } else {
        window.open(link, '_blank');
        showFeedback('✓ Link de pagamento aberto!', false);
      }
    }

    document.getElementById('btn-send-start')?.addEventListener('click', () => handleQuickSend(ADMIN_CONFIG.ASAAS_LINK_START));
    document.getElementById('btn-send-pro')?.addEventListener('click', () => handleQuickSend(ADMIN_CONFIG.ASAAS_LINK_PRO));

    // Configuração de Despesas
    const btnEditExpenses = document.getElementById('btn-edit-expenses');
    const modalExpenses = document.getElementById('modal-expenses');
    const formExpenses = document.getElementById('expenses-form');
    
    const closeExpenses = () => modalExpenses.classList.add('hidden');

    if (btnEditExpenses && modalExpenses) {
      btnEditExpenses.addEventListener('click', () => {
        const expenses = getExpenses();
        document.getElementById('expense-llm-workflow').value = parseFloat(expenses.llm_workflow) || 0;
        document.getElementById('expense-llm-platform').value = parseFloat(expenses.llm_plataforma) || 0;
        document.getElementById('expense-other-operational').value = parseFloat(expenses.outras_despesas) || 0;
        modalExpenses.classList.remove('hidden');
      });

      document.getElementById('close-expenses-modal').addEventListener('click', closeExpenses);
      document.getElementById('cancel-expenses').addEventListener('click', closeExpenses);
      modalExpenses.querySelector('.modal-overlay').addEventListener('click', closeExpenses);

      formExpenses.addEventListener('submit', (e) => {
        e.preventDefault();
        const expenses = {
          llm_workflow: parseFloat(document.getElementById('expense-llm-workflow').value) || 0,
          llm_plataforma: parseFloat(document.getElementById('expense-llm-platform').value) || 0,
          outras_despesas: parseFloat(document.getElementById('expense-other-operational').value) || 0
        };
        saveExpenses(expenses);
        closeExpenses();
        load();
        if (typeof showToast === 'function') {
          showToast('Despesas salvas com sucesso!', 'success');
        } else {
          alert('Despesas salvas com sucesso!');
        }
      });
    }
  }

  return { init, load };
})();
