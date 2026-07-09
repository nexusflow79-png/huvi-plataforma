# Template de Copy - Follow-up HUVI
Versão 1.1

> Integrado ao pipeline via tabela `copy_templates` (migration 016) e nó `TemplateSelector` no workflow n8n.
> Referência: [016_copy_templates.sql](supabase/migrations/016_copy_templates.sql)


# Objetivo

Este documento serve como base para geração automática de mensagens comerciais do HUVI.

As mensagens devem parecer escritas por uma pessoa real.

Nunca devem parecer automáticas.

Sempre falar do resultado que o cliente pode obter, nunca da tecnologia utilizada.

O foco é despertar curiosidade, gerar resposta e iniciar uma conversa.

Jamais tentar vender no primeiro contato.

---

# Estrutura das mensagens

Cada mensagem deve seguir esta lógica:

1. Observação personalizada
2. Identificação de uma oportunidade
3. Benefício
4. Pergunta simples

---

# PRIMEIRO CONTATO

Objetivo:

Iniciar uma conversa.

Nunca tentar fechar.

Nunca enviar apresentação longa.

Nunca falar sobre funcionalidades.

Tom:

Consultivo
Educado
Curioso

---

## Modelo 1

Olá, [Nome].

Vi que vocês trabalham com [segmento].

Fiquei curioso sobre como vocês organizam hoje os agendamentos dos clientes.

Tenho acompanhado empresas parecidas que conseguiram reduzir bastante o tempo gasto com atendimento depois de organizarem esse processo.

Hoje vocês fazem esse controle manualmente?

---

## Modelo 2

Olá.

Enquanto pesquisava empresas da região encontrei o perfil de vocês.

Percebi que atendem um bom volume de clientes.

Posso fazer uma pergunta?

Como vocês controlam os horários e confirmações dos atendimentos?

---

## Modelo 3

Olá, [Nome].

Vi que a empresa de vocês possui excelentes avaliações.

Normalmente empresas que crescem começam a enfrentar um desafio comum:

organizar a agenda sem perder clientes.

Isso acontece por aí também?

---

## Modelo 4

Olá.

Uma curiosidade...

Como vocês fazem quando vários clientes entram em contato ao mesmo tempo querendo agendar?

Pergunto porque tenho visto muitos negócios perdendo tempo justamente nessa etapa.

---

## Modelo 5

Olá.

Vi o perfil da empresa de vocês e uma dúvida me chamou atenção.

Como vocês evitam esquecimentos, cancelamentos e horários vagos na agenda?

---

# SEGUNDO CONTATO (sem resposta)

Objetivo

Gerar curiosidade.

Mostrar benefício.

Sem pressão.

---

## Modelo 1

Oi.

Passei novamente porque essa situação é mais comum do que parece.

Muitas empresas só descobrem quanto tempo perdem com organização da agenda quando começam a medir esse processo.

Vocês já chegaram a analisar isso?

---

## Modelo 2

Olá.

Talvez minha mensagem anterior tenha passado despercebida.

Tenho visto empresas conseguindo reduzir bastante o trabalho operacional apenas organizando melhor os agendamentos.

Fiquei curioso para saber como vocês fazem hoje.

---

## Modelo 3

Uma pergunta rápida.

Quando alguém cancela um horário de última hora, vocês conseguem preencher essa vaga rapidamente?

---

## Modelo 4

Oi.

Vi novamente o perfil de vocês.

Acredito que exista uma boa oportunidade para deixar o atendimento ainda mais organizado.

Vale a pena conversarmos alguns minutos?

---

## Modelo 5

Olá.

Nem sempre percebemos quanto tempo a equipe dedica somente para responder mensagens e organizar horários.

Como isso funciona atualmente na empresa?

---

# TERCEIRO CONTATO (sem resposta)

Objetivo

Última tentativa.

Respeitosa.

Sem insistência.

Deixar a porta aberta.

---

## Modelo 1

Olá.

Essa será minha última mensagem.

Caso organizar os agendamentos ou reduzir o tempo gasto com atendimento faça sentido para vocês em algum momento, fico à disposição.

Desejo muito sucesso.

---

## Modelo 2

Oi.

Imagino que este não seja o melhor momento.

Sem problema.

Se no futuro fizer sentido conversar sobre formas de ganhar mais previsibilidade na agenda, será um prazer ajudar.

---

## Modelo 3

Olá.

Vou encerrar meu contato para não ser inconveniente.

Se algum dia quiser trocar ideias sobre como empresas do seu segmento estão organizando melhor seus atendimentos, basta responder esta mensagem.

---

## Modelo 4

Passando apenas para finalizar nossa conversa.

Se este assunto não faz sentido agora, tudo bem.

Mas, caso em algum momento queira reduzir o trabalho operacional da equipe, estarei por aqui.

---

## Modelo 5

Obrigado pelo seu tempo.

Mesmo sem retorno, espero que a empresa continue crescendo.

Se futuramente fizer sentido conversar sobre organização dos atendimentos, pode contar comigo.

---

# Personalizações Dinâmicas

O HUVI deve utilizar automaticamente as informações encontradas durante a pesquisa.

Exemplos:

Se possui muitas avaliações positivas:

"Vi que vocês possuem mais de [X] avaliações positivas."

---

Se possui poucas avaliações:

"Vi que ainda existe espaço para fortalecer a presença digital da empresa."

---

Se possui atendimento via WhatsApp:

"Vi que vocês recebem agendamentos pelo WhatsApp."

---

Se não possui site:

"Percebi que a maior parte do atendimento parece acontecer pelos canais diretos."

---

Se trabalha com horários marcados:

"Imagino que manter a agenda organizada seja essencial para evitar horários ociosos."

---

Se possui vários funcionários:

"Com uma equipe maior, normalmente organizar os atendimentos se torna ainda mais importante."

---

# Palavras que aumentam resposta

organizar

facilitar

reduzir

ganhar tempo

previsibilidade

crescimento

atendimento

agenda

clientes

confirmação

pontualidade

experiência

resultado

---

# Palavras a evitar

robô

automação

IA

fluxo

integração

API

CRM

chatbot

sistema

software

funil

---

# Regras

Nunca escrever textos longos.

Nunca vender na primeira mensagem.

Sempre terminar com uma pergunta.

Nunca pressionar o lead.

Nunca parecer mensagem automática.

Sempre falar do resultado.

Cada mensagem deve poder ser lida em menos de 20 segundos.

Preferir frases curtas.

Utilizar linguagem simples.

Priorizar curiosidade antes da venda.

Sempre adaptar a mensagem ao segmento pesquisado pelo HUVI.