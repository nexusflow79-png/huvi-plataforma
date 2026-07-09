# Plano de Implementação — Matriz de Comunicação e Follow-ups no Agente Campaign

Este plano estabelece as etapas para evoluir o agente Campaign, permitindo a geração e envio automatizado de uma matriz de mensagens de prospecção (Mensagem Inicial no Dia 0, Follow-up no Dia 3 e Follow-up no Dia 7).

---

## 1. Modelagem de Dados (Supabase)

Para persistir os múltiplos passos da campanha e controlar a cadência sem quebrar a retrocompatibilidade com campanhas existentes, propomos adicionar as seguintes colunas na tabela `campaigns`:

* **`messages_matrix`** (`jsonb`, opcional): Lista estruturada contendo os passos da prospecção.
  * Formato do JSON:
    ```json
    [
      { "step": 1, "delay_days": 0, "subject": "Assunto 1", "message": "Mensagem da abordagem..." },
      { "step": 2, "delay_days": 3, "subject": "Assunto 2", "message": "Mensagem de follow-up 1..." },
      { "step": 3, "delay_days": 7, "subject": "Assunto 3", "message": "Mensagem de follow-up 2..." }
    ]
    ```
* **`current_step`** (`integer`, default `1`): Indica qual passo da matriz está ativo ou pendente de envio.
* **`last_sent_at`** (`timestamp with time zone`, opcional): Registra a data/hora do envio do último passo, servindo de base para calcular a cadência dos próximos dias.

---

## 2. Workflows do n8n

### A. Pipeline de Oportunidades (`HUVI_Opportunity_Pipeline`)
* **Nó `CampaignHuviBrain`**: 
  * Atualizar o prompt enviado ao HUVI Brain (LLM) para instruí-lo a gerar uma sequência completa de prospecção B2B (3 mensagens: Abordagem, Follow-up 3 dias depois e Follow-up 7 dias depois do contato inicial).
  * Exigir que o retorno JSON do LLM seja estruturado no formato da matriz especificada acima.
* **Nó `ParseCampaign`**:
  * Modificar o bloco de código JavaScript para processar a matriz de mensagens e retornar o objeto pronto para inserção no banco de dados.
* **Nós `SupabaseInsertCampaign` e `SupabaseUpdateCampaign`**:
  * Adicionar o mapeamento do campo `messages_matrix` para salvar a cadência estruturada no banco.

### B. Dispatcher (`HUVI_Dispatcher`)
* **Fluxo de Disparo**:
  * Atualizar a lógica do Dispatcher para verificar se a campanha possui `messages_matrix` e qual é o seu `current_step`.
  * Se for uma matriz, extrair a mensagem correspondente ao passo atual.
  * **Atualização de Cadência**: Após realizar o envio da mensagem:
    * Registrar a data atual em `last_sent_at`.
    * Incrementar o valor de `current_step` em 1.
    * Caso o passo enviado tenha sido o último (ex: passo 3 de 3), definir o status da campanha para `sent`. Caso contrário, manter a campanha como ativa para que o agendador de follow-up processe o próximo passo no dia correto.

---

## 3. Frontend do HUVI

### A. Listagem e Edição de Campanhas ([campaigns.js](file:///c:/PROJETOS_ANTIGRAVITY/huvi_hub-de-vendas-inteligente/frontend/js/campaigns.js))
* **Visualização da Matriz**:
  * Reestruturar o modal de edição de campanhas para exibir Abas Dinâmicas baseadas nos passos presentes na `messages_matrix`.
  * Se a campanha não tiver a coluna preenchida (campanhas antigas), exibir a aba única convencional com o corpo original.
* **Edição dos Passos**:
  * Permitir que o usuário edite o assunto (se e-mail) e o corpo de cada passo individualmente no modal.
  * Ao salvar como rascunho ou aprovar, atualizar o JSON do campo `messages_matrix` e persistir no Supabase.
* **Indicador de Status**:
  * Mostrar na tabela principal e no painel a qual passo o lead se encontra (ex: "Passo 2/3 - Aguardando envio").

---

## 4. Plano de Verificação

### Verificação do Banco
* Executar script SQL no Supabase Editor para adicionar as novas colunas e validar a consistência das tabelas.

### Verificação do Pipeline no n8n
* Disparar o pipeline de uma oportunidade de teste e validar se o campo `messages_matrix` é preenchido com as 3 mensagens personalizadas.

### Verificação do Frontend
* Abrir a tela de campanhas e conferir o layout de abas no modal de edição.
* Alterar o texto do Passo 2, salvar como rascunho e verificar se os dados persistem corretos no Supabase.
