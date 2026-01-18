// Função auxiliar para formatar CPF
const formatCPF = (cpf: string): string => {
    if (!cpf) return '';
    const numbers = cpf.replace(/\D/g, '');
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

// Função auxiliar para formatar CNPJ
const formatCNPJ = (cnpj: string): string => {
    if (!cnpj) return '';
    const numbers = cnpj.replace(/\D/g, '');
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

// Função auxiliar para formatar data
const formatDate = (date: string): string => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('pt-BR');
};

// Função para gerar HTML da Notificação de Rescisão
export function generateNotificacaoHTML(data: any): string {
    const { profissional, unidade } = data;
    const HEADER_URL = 'https://uframhbsgtxckdxttofo.supabase.co/storage/v1/object/public/mb-docs/cabe-mb-doc.png';

    // Extrair cidade do unit_name (texto após "MB")
    const extractCity = (unitName: string): string => {
        if (!unitName) return '';
        const parts = unitName.split('MB');
        return parts.length > 1 ? parts[1].trim() : '';
    };

    const cidade = extractCity(unidade.unitName);

    // Helper para exibir dados ou placeholder
    const displayOrPlaceholder = (value: string | undefined | null, placeholder: string): string => {
        return value && value.trim() !== '' ? value : placeholder;
    };

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>NOTIFICAÇÃO EXTRAJUDICIAL DE RESCISÃO</title>
  <style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Liberation Sans', sans-serif;
      color: #111827;
      background: #f7f9fb;
      line-height: 1.6;
      font-size: 11pt;
    }
    .container { width: 100%; }
    .page { padding: 8mm 16mm; }
    .title-box {
      border: 2px solid #000;
      padding: 10px;
      margin-bottom: 20px;
      text-align: center;
    }
    strong {
      font-weight: bold;
    }
    p {
      margin-bottom: 1em;
      text-align: justify;
    }
    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 0 auto 40px;
    }
    .recipient-info {
      margin-bottom: 20px;
    }
    .subject-line {
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 20px;
    }
    .date-location {
      margin-top: 40px;
      margin-bottom: 40px;
    }
    .signature-block {
      margin-top: 30px;
    }
    .footer-note {
      font-size: 10pt;
      text-align: center;
      margin-top: 50px;
      border-top: 1px solid #ccc;
      padding-top: 10px;
    }
  </style>
</head>
<body>
<div class="container"><div class="page">
  <!-- Cabeçalho -->
  <img src="${HEADER_URL}" alt="Maria Brasileira" />

  <div class="title-box">
    <strong>NOTIFICAÇÃO EXTRAJUDICIAL</strong>
  </div>

  <div class="recipient-info">
    <p><strong>À Sra. ${profissional.nome || '[Nome da Profissional Parceira]'}</strong><br>
    CPF nº ${formatCPF(profissional.cpf)}<br>
    Endereço: ${profissional.endereco || '[Endereço]'}</p>
  </div>

  <p class="subject-line">ASSUNTO: RESCISÃO DE CONTRATO DE AGENCIAMENTO E INTERMEDIAÇÃO DE MÃO DE OBRA</p>

  <p>Prezada Sra. ${profissional.nome || '[Nome]'}</p>

  <p>Na qualidade de AGENCIADOR, nos termos do CONTRATO DE AGENCIAMENTO E INTERMEDIAÇÃO DE MÃO DE OBRA firmado entre as partes em [data], comunicamos, por meio desta, que a parceria está rescindida de forma unilateral, nos termos do contrato de agenciamento que foi celebrado entre as partes, que autoriza expressamente a extinção da relação por qualquer das partes, a qualquer tempo, mediante comunicação expressa, independentemente de justificativa.</p>

  <p>Assim, a partir da presente notificação, considera-se encerrada a parceria, com efeitos imediatos.</p>

  <p><strong>Reiteramos que:</strong></p>

  <p>A relação contratual sempre foi e permanece de natureza civil e autônoma, não existindo qualquer vínculo empregatício, subordinação ou obrigação trabalhista entre as partes.</p>

  <p>Não há que se falar em pagamento de aviso prévio, verbas rescisórias ou qualquer acerto trabalhista, sendo devidas apenas eventuais quantias correspondentes aos atendimentos já realizados e ainda não repassados, as quais serão quitadas conforme as regras e prazos estipulados contratualmente.</p>

  <p>Solicitamos, nos termos da cláusula 2.5, que proceda à devolução do uniforme entregue pela unidade, no prazo máximo de 5 (cinco) dias úteis a contar do recebimento desta notificação.</p>

  <p>Na hipótese de não devolução do uniforme ou devolução em estado que inviabilize o uso, ficará sujeita ao pagamento da multa compensatória de R$ 200,00 (duzentos reais) ou retenção do valor entregue à título de caução, conforme previsão expressa contratual.</p>

  <p>Por fim, lembramos que, conforme previsto no contrato de agenciamento, após o encerramento da parceria, é PROIBIDA A UTILIZAÇÃO DA MARCA, do uniforme ou de quaisquer elementos de identidade visual da Maria Brasileira, inclusive em redes sociais, bem como a prestação de serviços diretamente aos clientes que tenham sido captados pela intermediação do AGENCIADOR, sob pena das sanções contratuais cabíveis.</p>

  <p>Colocamo-nos à disposição para esclarecer quaisquer dúvidas e, se necessário, formalizar o distrato, dando plena e irrevogável quitação da relação ora encerrada.</p>

  <p>Atenciosamente,</p>

  <div class="date-location">
    ${cidade || '[Local]'}, _____ de _________________ de _______.
  </div>

  <div class="signature-block">
    <p><strong>${displayOrPlaceholder(unidade.razaoSocial, '[Nome da Unidade Franqueada]')}</strong><br>
    CNPJ: ${unidade.cnpj ? formatCNPJ(unidade.cnpj) : '[CNPJ]'}<br>
    Endereço: ${unidade.endereco || '[Endereço]'}<br>
    Telefone: ${unidade.telefone || '[Telefone]'}<br>
    E-mail: ${unidade.email || '[E-mail]'}</p>
  </div>

  <div class="footer-note">
    UNIDADE FRANQUEADA
  </div>

</div></div>
</body>
</html>`;
}
