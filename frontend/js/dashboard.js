/**
 * HUVI — Dashboard Module
 * Carrega KPIs de prospecção, conversão e receita e renderiza gráficos
 */
const Dashboard = (() => {
  let chartInstance = null;

  async function load() {
    const tenantId = await getTenantId();
    if (!tenantId) return;

    try {
      // 1. Carregar Oportunidades Totais (deleted_at IS NULL)
      const { count: oppsCount, error: err1 } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .is('deleted_at', null);

      if (err1) throw err1;
      document.getElementById('db-opportunities').textContent = oppsCount || 0;

      // 2. Carregar Oportunidades Qualificadas (score >= 70)
      const { count: qualCount, error: err2 } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .gte('score', 70);

      if (err2) throw err2;
      document.getElementById('db-qualified').textContent = qualCount || 0;

      // 3. Carregar Campanhas Ativas (status IN approved, sending, sent)
      const { count: campCount, error: err3 } = await supabase
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .in('status', ['approved', 'sending', 'sent']);

      if (err3) throw err3;
      document.getElementById('db-campaigns').textContent = campCount || 0;

      // 4. Carregar Conversões
      const { data: conversions, error: err4 } = await supabase
        .from('conversions')
        .select('closed_value, conversion_date')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null);

      if (err4) throw err4;
      
      const convCount = conversions ? conversions.length : 0;
      document.getElementById('db-conversions').textContent = convCount;

      // 5. Somar Receita
      let totalRevenue = 0;
      if (conversions) {
        totalRevenue = conversions.reduce((sum, c) => sum + parseFloat(c.closed_value || 0), 0);
      }
      document.getElementById('db-revenue').textContent = `R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      // 6. Carregar Oportunidades por dia para o gráfico
      const { data: opportunities, error: err5 } = await supabase
        .from('opportunities')
        .select('created_at')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null);

      if (err5) throw err5;

      renderFunnelChart(opportunities || [], conversions || []);

    } catch (e) {
      console.error('[HUVI] Erro ao carregar KPIs do dashboard:', e);
    }
  }

  function renderFunnelChart(opps, convs) {
    const ctx = document.getElementById('chart-funnel').getContext('2d');
    
    // Obter datas dos últimos 7 dias
    const labels = [];
    const oppsByDay = [];
    const convsByDay = [];

    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      labels.push(dateStr);

      // Contar oportunidades neste dia
      const dayOpps = opps.filter(o => {
        const createdDate = new Date(o.created_at);
        return createdDate.toDateString() === d.toDateString();
      }).length;
      oppsByDay.push(dayOpps);

      // Contar conversões neste dia
      const dayConvs = convs.filter(c => {
        const convDate = new Date(c.conversion_date);
        return convDate.toDateString() === d.toDateString();
      }).length;
      convsByDay.push(dayConvs);
    }

    if (chartInstance) {
      chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Novas Oportunidades',
            data: oppsByDay,
            borderColor: '#f47001',
            backgroundColor: 'rgba(244, 112, 1, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            fill: true
          },
          {
            label: 'Vendas Convertidas',
            data: convsByDay,
            borderColor: '#40c057',
            backgroundColor: 'rgba(64, 192, 87, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: '#5c4333',
              font: {
                family: 'Inter',
                size: 11
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#8f7464',
              font: { family: 'Inter', size: 10 }
            }
          },
          y: {
            grid: { color: 'rgba(252, 196, 25, 0.1)' },
            ticks: {
              color: '#8f7464',
              font: { family: 'Inter', size: 10 },
              stepSize: 1
            }
          }
        }
      }
    });
  }

  return { load };
})();
