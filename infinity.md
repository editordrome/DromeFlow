 Guia de Integração: Checkout Integrado InfinitePay
Este documento detalha o funcionamento da API de Checkout Integrado da InfinitePay, permitindo a geração de links de pagamento, consulta de status e configuração de notificações via Webhook.

1. Conceitos Iniciais e Glossário
Antes de iniciar as requisições, é importante entender os termos utilizados:

Vendedor: O dono do site/loja que está integrando a API.

Comprador: O cliente final que realizará o pagamento.

Handle (InfiniteTag): Seu nome de usuário no App InfinitePay (deve ser usado sem o símbolo $).

order_nsu: O número de identificação do pedido dentro do seu sistema.

2. Criando o Link de Pagamento
Para gerar um checkout para o seu cliente, você deve enviar uma requisição POST para o seguinte endpoint:

Endpoint: https://api.infinitepay.io/invoices/public/checkout/links

Estrutura do Payload (Corpo da Requisição)

O payload é composto por campos obrigatórios e opcionais.

A. Identificação e Itens (Obrigatórios)

Você deve informar sua handle e a lista de items (mínimo 1 item).

JSON
{
  "handle": "sua-tag-aqui",
  "items": [
    {
      "quantity": 1,
      "price": 1000,
      "description": "Nome do Produto"
    }
  ]
}
Nota: O preço costuma ser representado em centavos (ex: 1000 = R$ 10,00).

B. Dados do Cliente (Opcional)

Enviar os dados do comprador agiliza o processo, pois o checkout já aparecerá preenchido.

JSON
"customer": {
  "name": "João Silva",
  "email": "joao@email.com",
  "phone_number": "+5511999887766"
}
C. URLs de Redirecionamento (Opcional)

Define para onde o cliente será enviado após concluir o pagamento.

JSON
"redirect_url": "https://seusite.com/pagamento-concluido"
3. Retorno do Pagamento e Parâmetros
Ao finalizar o pagamento, a InfinitePay redireciona o usuário para a sua redirect_url enviando parâmetros importantes na URL para que seu sistema identifique a transação:

receipt_url: Link do comprovante.

order_nsu: O ID do pedido no seu sistema.

slug: Código da fatura na InfinitePay.

capture_method: Método utilizado (credit_card ou pix).

transaction_nsu: ID único da transação.

4. Consulta de Status do Pagamento
Caso precise verificar manualmente se um pagamento foi baixado, utilize o endpoint de consulta.

Endpoint: POST https://api.infinitepay.io/invoices/public/checkout/payment_check

Exemplo de Corpo:

JSON
{
  "handle": "sua_tag",
  "order_nsu": "123456",
  "transaction_nsu": "UUID-da-transacao",
  "slug": "codigo-da-fatura"
}
Exemplo de Resposta:

JSON
{
  "success": true,
  "paid": true,
  "amount": 1500,
  "paid_amount": 1510,
  "installments": 1,
  "capture_method": "pix"
}
5. Webhook (Notificações em Tempo Real)
O Webhook é a forma mais robusta de integração. Em vez de você consultar a API, a InfinitePay avisa o seu servidor assim que o pagamento for aprovado.

Configuração: Informe uma webhook_url no payload ou nas configurações.

Resposta esperada: Seu servidor deve responder com status 200 OK em menos de 1 segundo. Se responder erro (ex: 400), a InfinitePay tentará enviar novamente.

Formato do JSON enviado pelo Webhook:

JSON
{
  "invoice_slug": "abc123",
  "amount": 1000,
  "paid_amount": 1010,
  "installments": 1,
  "capture_method": "credit_card",
  "transaction_nsu": "UUID",
  "order_nsu": "ID-do-seu-pedido",
  "receipt_url": "https://comprovante.com/123",
  "items": [...]
}
Documentação gerada com base nos guias visuais do Checkout Integrado InfinitePay.