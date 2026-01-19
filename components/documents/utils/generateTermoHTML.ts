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

// Função para gerar HTML do Termo de Confidencialidade
export function generateTermoHTML(data: any): string {
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
  <title>TERMO DE DECLARAÇÃO DE CIÊNCIA E COMPROMISSO DE NÃO ALICIAMENTO DE CLIENTES</title>
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
    .date-location {
      margin-top: 40px;
      text-align: center;
    }
    .signatures {
      margin-top: 60px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
    }
    .signature-block {
      text-align: center;
      margin-top: 20px;
      width: 45%;
    }
    .signature-line {
      border-top: 1px solid #000;
      margin-bottom: 5px;
      padding-top: 30px;
    }
  </style>
</head>
<body>
<div class="container"><div class="page">
  <!-- Cabeçalho -->
  <img src="${HEADER_URL}" alt="Maria Brasileira" />

  <div class="title-box">
    <strong>TERMO DE DECLARAÇÃO DE CIÊNCIA E COMPROMISSO DE NÃO ALICIAMENTO DE CLIENTES</strong>
  </div>

  <p>Eu, <strong>${profissional.nome || '[NOME COMPLETO]'}</strong>, inscrita no CPF sob o nº <strong>${formatCPF(profissional.cpf)}</strong>, residente e domiciliada na <strong>${profissional.endereco || '[endereço completo]'}</strong>, declaro, para os devidos fins, que tomei pleno conhecimento das cláusulas e condições do Contrato de Agenciamento e Intermediação de Mão de Obra celebrado com a unidade franqueada da rede MARIA BRASILEIRA, e assumo o seguinte compromisso:</p>

  <p><strong>1.</strong> Estou ciente de que os atendimentos realizados por meio da intermediação da unidade franqueada são exclusivamente viabilizados pela estrutura da MARIA BRASILEIRA, incluindo a prospecção de clientes, organização dos serviços e suporte operacional, razão pela qual não poderei oferecer, prestar ou divulgar, de forma direta ou indireta, serviços de limpeza e/ou passadoria aos clientes conquistados ou atendidos por meio da referida unidade franqueada, fora do sistema de agenciamento.</p>

  <p><strong>2.</strong> Reconheço que o contato com os clientes é viabilizado exclusivamente pela unidade franqueada, sendo esta responsável pela relação comercial com os mesmos. Portanto, o oferecimento de serviços por fora, enquanto perdurar a parceria, poderá ser caracterizado como aliciamento de clientela e concorrência desleal, além de violação contratual expressa, sujeitando-me às sanções previstas no contrato de agenciamento, incluindo o pagamento de multa, a rescisão imediata da parceria e eventual responsabilização civil.</p>

  <p><strong>3.</strong> Declaro ainda que compreendo que essa conduta poderá causar prejuízo direto à operação da unidade franqueada, comprometendo os princípios de ética, confiança e profissionalismo que regem a rede MARIA BRASILEIRA.</p>

  <p><strong>4.</strong> Por fim, declaro que esta ciência e compromisso foram prestados de forma livre, informada e consciente, sem qualquer vício de vontade, sendo devidamente orientada pela unidade franqueada sobre as condições da nossa parceria através do agenciamento e quanto a impossibilidade de oferecer serviços de limpeza por fora para os clientes da unidade enquanto permanecer a parceria.</p>

  <div class="date-location">
    ${cidade || '[Local]'}. ${formatCurrentDateExtended()}
  </div>

  <div class="signatures">
    <div class="signature-block">
      <div class="signature-line"></div>
      <strong>${displayOrPlaceholder(unidade.razaoSocial, 'UNIDADE FRANQUEADA')}</strong><br>
      CNPJ: ${unidade.cnpj ? formatCNPJ(unidade.cnpj) : '[CNPJ]'}
    </div>

    <div class="signature-block">
      <div class="signature-line"></div>
      <strong>${profissional.nome || '[NOME DA AGENCIADA]'}</strong><br>
      CPF: ${formatCPF(profissional.cpf)}
    </div>
  </div>

</div></div>
</body>
</html>`;
}
