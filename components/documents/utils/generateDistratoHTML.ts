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

// Função para formatar data atual por extenso (ex: "18 de Janeiro de 2026")
const formatCurrentDateExtended = (): string => {
  const now = new Date();
  const day = now.getDate();
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const month = months[now.getMonth()];
  const year = now.getFullYear();
  return `${day} de ${month} de ${year}`;
};

// Função para gerar HTML do Distrato de Contrato
export function generateDistratoHTML(data: any): string {
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
  <title>DISTRATO DE CONTRATO DE AGENCIAMENTO E INTERMEDIAÇÃO DE MÃO DE OBRA</title>
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
    .article-title {
      background-color: #d3d3d3;
      padding: 8px 12px;
      margin: 16px 0 10px;
      text-align: center;
      font-weight: bold;
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
    .qualification {
      margin-bottom: 20px;
    }
    .center-text {
      text-align: center;
    }
    .signatures {
      margin-top: 50px;
    }
    .signature-line {
      border-top: 1px solid #000;
      width: 60%;
      margin: 30px auto 5px;
      padding-top: 5px;
    }
  </style>
</head>
<body>
<div class="container"><div class="page">
  <!-- Cabeçalho -->
  <img src="${HEADER_URL}" alt="Maria Brasileira" />

  <div class="title-box">
    <strong>DISTRATO DE CONTRATO DE AGENCIAMENTO E INTERMEDIAÇÃO DE MÃO DE OBRA</strong>
  </div>

  <div class="qualification">
    <p><strong>AGENCIADOR:</strong> ${displayOrPlaceholder(unidade.razaoSocial, '[Razão Social]')}, CNPJ ${unidade.cnpj ? formatCNPJ(unidade.cnpj) : '[CNPJ]'}, ${displayOrPlaceholder(unidade.endereco, '[Endereço]')}, unidade franqueada da Rede Maria Brasileira – ${unidade.unitName || '[Unidade]'}.</p>

    <p><strong>AGENCIADO:</strong> ${profissional.nome || '[Nome]'}, CPF ${formatCPF(profissional.cpf)}, RG ${profissional.rg || '[RG]'}, data de nascimento ${formatDate(profissional.dataNascimento)}, ${profissional.estadoCivil || '[Estado Civil]'}, ${profissional.endereco || '[Endereço]'}, ${profissional.whatsapp || '[WhatsApp]'}.</p>
  </div>

  <p>As partes acima identificadas, com fundamento no CONTRATO DE AGENCIAMENTO E INTERMEDIAÇÃO DE MÃO DE OBRA firmado em [data], resolvem, de comum acordo, RESCINDIR A PARCERIA, mediante as cláusulas e condições seguintes:</p>

  <div class="article-title">ARTIGO 1º- DO ENCERRAMENTO DA PARCERIA</div>

  <p><strong>1.</strong> O presente distrato formaliza o encerramento da parceria existente entre as partes, de maneira amigável e definitiva, não restando quaisquer pendências, obrigações ou compromissos entre AGENCIADOR e AGENCIADO.</p>

  <div class="article-title">ARTIGO 2º - DA NATUREZA DA RELAÇÃO</div>

  <p><strong>2.</strong> As partes reconhecem e reiteram que a relação contratual sempre foi de natureza civil, caracterizada pelo agenciamento e intermediação de serviços autônomos, inexistindo qualquer vínculo empregatício, e ausente de subordinação, habitualidade, pessoalidade ou controle de jornada.</p>

  <div class="article-title">ARTIGO 3º - DA QUITAÇÃO</div>

  <p><strong>3.1.</strong> Por este instrumento, o AGENCIADO declara, de forma expressa, que nada tem a reclamar a qualquer título, dando plena, rasa, geral e irrevogável quitação da relação ora encerrada, inclusive, não havendo valores de repasse pendentes.</p>

  <div class="article-title">ARTIGO 4° - DA DEVOLUÇÃO DE UNIFORMES</div>

  <p><strong>4.</strong> O AGENCIADO se compromete a devolver o uniforme cedido pelo AGENCIADOR, no prazo máximo de 5 (cinco) dias úteis a contar da assinatura deste distrato, conforme previsto no contrato original.</p>

  <p><strong>4.1.</strong> Caso uniforme tenha sido entregue mediante caução, o valor retido será devolvido ao AGENCIADO no ato da devolução do uniforme para o AGENCIADOR.</p>

  <p><strong>4.2.</strong> Quando o uniforme não tenha sido recebido mediante caução, na hipótese de não devolução ou devolução em estado que inviabilize a reutilização, será devida a multa compensatória no valor de R$ 200,00 (duzentos reais), sem prejuízo da apuração de eventuais perdas e danos.</p>

  <div class="article-title">ARTIGO 5° - DA UTILIZAÇÃO DA MARCA E UNIFORME</div>

  <p><strong>5.</strong> A partir da assinatura deste distrato, o AGENCIADO não poderá mais utilizar a marca, nome, logotipo, uniforme ou quaisquer elementos de identidade visual da Maria Brasileira, sob pena de caracterização de uso indevido e aplicação das sanções legais previstas, inclusive conforme a Lei de Propriedade Industrial (Lei nº 9.279/96).</p>

  <div class="article-title">ARTIGO 6° - DO USO DE IMAGEM</div>

  <p><strong>6.1.</strong> O AGENCIADO poderá, a qualquer tempo, solicitar mediante comunicação por escrito, seja por mensagem de texto via aplicativo de mensagens ou e-mail, a retirada de conteúdos institucionais ou promocionais que utilizem sua imagem, nome ou voz, conforme previsto no contrato e na Lei Geral de Proteção de Dados (LGPD).</p>

  <div class="article-title">ARTIGO 7° - DA CONFIDENCIALIDADE</div>

  <p><strong>7.1.</strong> O AGENCIADO compromete-se a manter a confidencialidade e o sigilo sobre todas as informações, dados de clientes e demais elementos aos quais teve acesso durante a vigência da parceria, nos termos da LGPD e do contrato, obrigação que subsistirá mesmo após o encerramento da relação.</p>

  <div class="article-title">ARTIGO 8° - DA FORMA DE ASSINATURA</div>

  <p><strong>8.1.</strong> O presente Distrato poderá ser assinado pelas partes de forma física (manuscrita) ou eletrônica, sendo válida e eficaz a sua formalização por meio de plataformas de assinatura eletrônica que garantam a autenticidade, integridade e autoria do documento, nos termos da Medida Provisória nº 2.200-2/2001 e demais legislações aplicáveis.</p>

  <p><strong>8.2.</strong> Para todos os efeitos legais, a assinatura eletrônica produz os mesmos efeitos jurídicos da assinatura física, obrigando as partes aos seus termos.</p>

  <p><strong>8.3.</strong> Cada parte receberá uma via (ou acesso ao documento final) igualmente válida, independentemente do formato em que tenha sido assinado.</p>

  <div class="article-title">ARTIGO 9° - DISPOSIÇÕES FINAIS</div>

  <p><strong>9.1.</strong> Este distrato é celebrado de comum acordo, não cabendo entre as partes qualquer indenização, multa ou acerto rescisório.</p>

  <p><strong>9.2</strong> As partes elegem o foro da Comarca de ${cidade || '[cidade da unidade franqueada]'}, para dirimir eventuais controvérsias decorrentes deste distrato, com renúncia a qualquer outro, por mais privilegiado que seja.</p>

  <p>E por estarem assim justos e acordados, firmam o presente em duas vias de igual teor e forma, na presença das testemunhas abaixo.</p>

  <p>Por estarem de acordo, as partes firmam o presente.</p>

  <p class="center-text">${formatCurrentDateExtended()}.</p>

  <div class="signatures">
    <div class="center-text">
      <div class="signature-line"></div>
      <p><strong>${displayOrPlaceholder(unidade.razaoSocial, 'EMPRESA DO FRANQUEADO')}${cidade ? ' - ' + cidade : ''}</strong><br>
      CNPJ: ${unidade.cnpj ? formatCNPJ(unidade.cnpj) : '[CNPJ]'}</p>
    </div>

    <div class="center-text">
      <div class="signature-line"></div>
      <p><strong>${profissional.nome || 'Nome do Agenciado'}</strong><br>
      CPF: ${formatCPF(profissional.cpf)}</p>
    </div>

    <div class="center-text">
      <div class="signature-line"></div>
      <p><strong>Testemunha</strong><br>
      CPF:</p>
    </div>

    <div class="center-text">
      <div class="signature-line"></div>
      <p><strong>Testemunha</strong><br>
      CPF:</p>
    </div>
  </div>

</div></div>
</body>
</html>`;
}
