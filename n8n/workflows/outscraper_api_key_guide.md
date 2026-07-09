# Guia: Como Obter uma API Key Gratuita do Outscraper

Este guia descreve o passo a passo para criar uma conta no Outscraper, obter sua API Key e usufruir do nível gratuito (Free Tier) oferecido pela plataforma para alimentar a Descoberta de Oportunidades do HUVI.

---

## O que é o Outscraper?
O Outscraper é uma plataforma de extração de dados públicos (scraping) que permite obter informações do Google Maps, incluindo telefones, e-mails, websites, redes sociais, avaliações e categorias de empresas a partir de buscas por segmento e região.

---

## Passo a Passo para Obtenção Gratuita

### Passo 1: Cadastro na Plataforma
1. Acesse o site oficial do Outscraper em: [https://outscraper.com/](https://outscraper.com/) ou vá direto para o console de cadastro: [https://app.outscraper.com/register](https://app.outscraper.com/register).
2. Insira suas informações de cadastro (E-mail e Senha) ou utilize a autenticação direta com sua conta Google.
3. Confirme seu endereço de e-mail clicando no link enviado para a sua caixa de entrada.

### Passo 2: Nível Gratuito (Free Tier)
* O Outscraper oferece um **crédito gratuito recorrente todos os meses**.
* No plano Free Tier, você recebe **até 500 registros de buscas no Google Maps gratuitos por mês**. Isso é mais do que suficiente para validar o MVP do HUVI e realizar buscas de teste.
* *Nota*: Para ativar a conta e ter acesso total à API, o Outscraper pode solicitar que você insira uma forma de pagamento (como um cartão de crédito) para fins de verificação de identidade. **Nenhuma cobrança será realizada** se o seu uso mensal permanecer abaixo do limite de 500 registros gratuitos.

### Passo 3: Localizando a API Key
1. Após fazer login, acesse o painel principal (Dashboard) do console do Outscraper.
2. No menu lateral esquerdo, vá para a seção **"Integrations"** ou acesse a aba **"API Key"** diretamente em suas configurações de perfil.
3. Você verá um campo com sua chave de API gerada automaticamente (geralmente uma string longa de caracteres alfanuméricos).
4. Clique no botão de copiar (Copy) para salvar a chave na sua área de transferência.

---

## Como Configurar no HUVI (n8n)

A API Key do Outscraper não deve ser exposta no frontend do HUVI por questões de segurança. Ela deve ser armazenada como uma credencial ou variável de ambiente no seu servidor do n8n.

1. Abra o painel do seu **n8n**.
2. Vá em **Credentials** > **Add Credential**.
3. Selecione **Header Auth** (ou configure diretamente como variável de ambiente no contêiner/ambiente do seu n8n como `OUTSCRAPER_API_KEY`).
4. Se usar Header Auth, preencha:
   - **Name**: `X-API-KEY`
   - **Value**: *Insira a chave do Outscraper copiada no Passo 3*
5. No nó HTTP Request do workflow que realiza a chamada para o Outscraper, associe esta credencial de Header Auth à requisição.

Pronto! Seu sistema de Descoberta de Oportunidades no HUVI está conectado e pronto para funcionar de forma automatizada e segura.
