import React from 'react';
import { DocumentTemplateProps, DOCUMENT_HEADER_URL } from '../types';
import { formatCPF, formatCNPJ, formatDate } from '../utils/documentHelpers';

export const AditamentoContratual: React.FC<DocumentTemplateProps> = ({ data }) => {
    const { profissional, unidade, contrato } = data;

    // Função para formatar valor monetário
    const formatCurrency = (value: string | number | null | undefined): string => {
        if (!value) return '0,00';
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(numValue)) return '0,00';
        return numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };


    return (
        <div className="document-template bg-white text-black" style={{
            maxWidth: '210mm',
            margin: '0 auto',
            fontFamily: 'Arial, sans-serif',
            fontSize: '12pt',
            lineHeight: '1.6',
            padding: '20mm'
        }}>
            <style>{`
        @media print {
          body { margin: 0; }
          .document-template { padding: 20mm; }
        }
        .document-template p { margin-bottom: 1em; }
        .document-template strong { font-weight: bold; }
        .document-template ul { margin-left: 20px; }
        .document-template .list-item { margin-left: 20px; }
      `}</style>

            {/* Cabeçalho */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <img
                    src={DOCUMENT_HEADER_URL}
                    alt="Maria Brasileira"
                    style={{ maxWidth: '100%', height: 'auto' }}
                />
            </div>

            {/* Título */}
            <p style={{ textAlign: 'center' }}>
                <strong>ADITAMENTO AO CONTRATO DE AGENCIAMENTO E INTERMEDIAÇÃO DE MÃO DE OBRA</strong>
            </p>

            {/* Partes */}
            <p>
                <strong>AGENCIADOR:</strong> {unidade.razaoSocial}, CNPJ {formatCNPJ(unidade.cnpj)},
                {unidade.endereco && ` ${unidade.endereco}`}, unidade franqueada da Rede Maria Brasileira – {unidade.unitName}.
            </p>

            <p>
                <strong>AGENCIADO:</strong> {profissional.nome}, CPF {formatCPF(profissional.cpf)},
                RG {profissional.rg}, data de nascimento {formatDate(profissional.dataNascimento)},
                {profissional.estadoCivil}, {profissional.endereco}, {profissional.whatsapp}.
            </p>

            <p>
                As partes acima identificadas, doravante denominadas, respectivamente, <strong>AGENCIADOR</strong> e <strong>AGENCIADO</strong>,
                têm entre si justo e acordado o presente <strong>ADITAMENTO AO CONTRATO DE AGENCIAMENTO E INTERMEDIAÇÃO DE MÃO DE OBRA,</strong> mediante
                as cláusulas e condições a seguir expostas:
            </p>

            {/* ARTIGO 1º */}
            <p><strong>ARTIGO 1º – DO OBJETO DO ADITAMENTO</strong></p>
            <p>
                <strong>1.</strong> O presente aditamento tem por objeto formalizar que, a partir desta data, a relação contratual entre as partes
                passa a vigorar, exclusivamente, de acordo com os termos e condições constantes neste aditamento, que substitui integralmente os
                termos e condições do documento anteriormente aceito e assinado pelo <strong>AGENCIADO</strong> na data de <strong>[inserir data do recibo ou contrato anterior].</strong>
            </p>

            {/* ARTIGO 2º */}
            <p><strong>ARTIGO 2º – DA MANUTENÇÃO DA NATUREZA DA RELAÇÃO</strong></p>
            <p>
                <strong>2.</strong> As partes reiteram que a relação ora mantida possui natureza exclusivamente civil e autônoma, afastada qualquer
                hipótese de vínculo empregatício, e que a prestação de serviços se dá sem subordinação jurídica, habitualidade ou pessoalidade, em
                estrita consonância com o disposto no Artigo 3º deste instrumento e nos princípios legais aplicáveis.
            </p>

            {/* ARTIGO 3º */}
            <p><strong>ARTIGO 3º - SOBRE A PARCERIA</strong></p>
            <p>
                <strong>3.</strong> <strong>Este contrato não configura relação de emprego entre as partes</strong>, inexistindo subordinação jurídica,
                pessoalidade, habitualidade, controle de jornada ou qualquer outro elemento caracterizador do vínculo empregatício. <strong>O AGENCIADO</strong> é
                responsável por sua própria organização, atuando com meios próprios e assumindo integral responsabilidade tributária, previdenciária e fiscal
                por suas atividades. A profissional atuará como autônoma, com total liberdade para aceitar ou recusar atendimentos conforme sua disponibilidade
                e interesse.
            </p>

            <p>
                <strong>3.1</strong>. O papel da agenciadora/intermediadora consiste em:<br /><br />
                a) Divulgar os serviços para clientes;<br />
                b) Organizar os agendamentos e pagamentos;<br />
                c) Dar suporte administrativo sem interferir na forma como a profissional executa o serviço;<br />
                d) Disponibilizar conteúdos, cursos e eventos com foco no desenvolvimento pessoal e transmissão do conhecimento prático, técnico e operacional
                da Marca Maria Brasileira, sendo facultativo ao <strong>AGENCIADO</strong> o acesso a tais conteúdos, que têm caráter exclusivamente informativo
                e não obrigatório, não configurando controle ou treinamento subordinado.
            </p>

            <p>
                <strong>3.2</strong>. <strong>O AGENCIADO</strong> pode aceitar ou recusar os atendimentos oferecidos. Caso aceite e não possa comparecer,
                deverá avisar o <strong>AGENCIADOR</strong> o quanto antes para que outro profissional possa ser alocado e dessa forma ser mantido o atendimento
                ao cliente final em respeito ao Código de Defesa do Consumidor.
            </p>

            <p>
                <strong>3.3.</strong> <strong>Os AGENCIADOS</strong> atuam de forma independente e autônoma, sendo responsáveis por suas atividades, obrigações
                fiscais e regulatórias, sem qualquer subordinação à empresa agenciadora/intermediadora.
            </p>

            {/* ARTIGO 4º */}
            <p><strong>ARTIGO 4ª - USO DA MARCA E UNIFORMES</strong></p>
            <p>
                <strong>4.1.</strong> <strong>O AGENCIADO</strong> deverá usar o uniforme da Maria Brasileira <strong>somente durante os atendimentos</strong> agendados
                pela unidade com a finalidade exclusiva de facilitar sua identificação junto aos clientes.
            </p>

            <p>
                <strong>4.2.</strong> O uso do uniforme e da identidade visual da MARIA BRASILEIRA tem caráter meramente identificador e comercial, não sendo indicativo
                de qualquer vínculo empregatício entre a PROFISSIONAL PARCEIRA e a franqueadora, tampouco entre a PROFISSIONAL PARCEIRA e a unidade franqueada, nos
                termos da legislação vigente.
            </p>

            <p>
                <strong>4.3.</strong> As partes reconhecem que a utilização dos elementos de identidade visual <strong>não configura</strong> subordinação jurídica,
                controle de jornada, pessoalidade, habitualidade ou qualquer outro elemento caracterizador de relação de emprego, sendo a atuação do
                <strong>AGENCIADO</strong> de natureza autônoma e eventual.
            </p>

            <p><strong>4.4.</strong> É <strong>proibido</strong> usar o uniforme ou o nome da marca:</p>
            <ul>
                <li>Fora dos atendimentos;</li>
                <li>Em redes sociais ou divulgações pessoais;</li>
                <li>Com clientes próprios ou após o fim da parceria.</li>
            </ul>

            <p>
                <strong>4.5.</strong> <strong>O AGENCIADO</strong> declara estar ciente de que os uniformes utilizados durante os atendimentos intermediados poderão
                ser entregues mediante uma das seguintes modalidades, a critério exclusivo do <strong>AGENCIADOR</strong>:
            </p>

            <p>
                <strong>I.</strong> Mediante caução: o <strong>AGENCIADOR</strong> entregará o uniforme ao <strong>AGENCIADO</strong>, e, a título de caução e será
                retido o valor de R$ {formatCurrency((unidade as any).uniformValue || (unidade as any).uniform_value)}, equivalente ao custo de fabricação do item, diretamente no primeiro repasse financeiro realizado. Caso o
                <strong>AGENCIADO</strong> deixe de realizar atendimentos intermediados, deverá restituir o uniforme em <strong>bom estado de conservação e uso</strong>,
                hipótese em que o valor da caução será integralmente devolvido. Não sendo devolvido o uniforme ao final da parceria, implicará na retenção definitiva
                do valor de caução.<br /><br />
                <strong>II.</strong> Sem caução: caso o <strong>AGENCIADOR</strong> opte por não reter caução, o <strong>AGENCIADO</strong> se compromete a devolver
                o uniforme ao final da parceria. Em caso de <strong>não devolução no prazo de até 5 (cinco) dias úteis</strong> contados da data de encerramento da
                relação contratual, ou devolução em <strong>estado que inviabilize sua reutilização</strong>, o <strong>AGENCIADO</strong> ficará sujeito ao pagamento
                de <strong>multa compensatória no valor de R$ 200,00 (duzentos reais)</strong>, sem prejuízo da apuração de perdas e danos adicionais e demais medidas
                cabíveis.
            </p>

            <p>
                <strong>4.6. O AGENCIADO</strong> deverá usar o uniforme e poderá acessar os conteúdos e eventos da Maria Brasileira somente enquanto perdurar a
                parceria com o <strong>AGENCIADOR</strong>.
            </p>

            <p><strong>4.7</strong>. Não é permitido:</p>
            <ul>
                <li>Usar o nome ou a marca Maria Brasileira em redes sociais ou divulgações pessoais;</li>
                <li>Utilizar o uniforme fora dos atendimentos intermediados;</li>
                <li>Compartilhar materiais da marca com terceiros.</li>
            </ul>

            <p>
                <strong>4.8</strong>. Fica expressamente proibido ao <strong>AGENCIADO</strong> utilizar a marca MARIA BRASILEIRA em divulgações pessoais, redes sociais
                ou em quaisquer outros meios, <strong>inclusive em serviços não intermediados pela unidade franqueada</strong>, sob pena de responsabilização por violação
                dos direitos de propriedade industrial da franqueadora, nos termos dos artigos 189 e 190 da Lei nº 9.279/96 (Lei de Propriedade Industrial), além da
                reparação por eventuais perdas e danos.
            </p>

            <p>
                <strong>4.8.1</strong>. A violação desta cláusula poderá ensejar a rescisão imediata do contrato, sem aviso prévio, além do pagamento de multa
                compensatória no valor de <strong>R$ 200,00 (duzentos reais)</strong>, por infração cometida, sem prejuízo da apuração de perdas e danos e medidas
                judiciais cabíveis por infração a direitos de marca e concorrência desleal.
            </p>

            {/* Continua nos próximos artigos... */}
            <div style={{ pageBreakAfter: 'always' }}></div>

            {/* CLÁUSULA 5ª */}
            <p><strong>CLÁUSULA 5ª - AUTORIZAÇÃO DO USO DE IMAGEM</strong></p>
            <p>
                <strong>5.1.</strong> <strong>O AGENCIADO</strong> autoriza, de forma gratuita, o uso de sua imagem, nome, voz e demais atributos de personalidade,
                em todo e qualquer material de divulgação institucional ou promocional relacionado à marca <strong>MARIA BRASILEIRA</strong>, incluindo, mas não se
                limitando a: redes sociais, site oficial, vídeos institucionais, televisão, folders, panfletos, outdoors, bem como quaisquer outras mídias impressas
                ou digitais.
            </p>

            <p>
                <strong>5.2.</strong> A presente autorização compreende, ainda, o direito de arquivamento e manutenção de eventuais registros visuais ou audiovisuais
                já publicados, inclusive postagens em <em>feed</em>, <em>reels</em>, <em>stories destacados</em> e <em>histórico de publicações</em>, mesmo após o
                término da parceria.
            </p>

            <p>
                <strong>5.3.</strong> Caso o <strong>AGENCIADO</strong> deseje a exclusão de determinada postagem após o encerramento da parceria, deverá formalizar
                o pedido por escrito à Unidade Franqueada com a qual mantinha contato, indicando especificamente os conteúdos que pretende remover. A Unidade analisará
                o pedido e providenciará a retirada do material em prazo razoável, salvo nos casos em que houver impedimento legal ou contratual.
            </p>

            <p>
                <strong>5.4.</strong> O <strong>AGENCIADO</strong> poderá exercer, a qualquer tempo, o seu direito de oposição quanto ao uso futuro de sua imagem,
                mediante comunicação formal à respectiva Unidade Franqueada. A revogação não terá efeitos retroativos sobre os conteúdos já publicados até a data da
                solicitação, os quais poderão permanecer acessíveis ao público.
            </p>

            {/* ARTIGO 6ª */}
            <p><strong>ARTIGO 6ª - CONDUTA E OBRIGAÇÕES DO AGENCIADO</strong></p>
            <p><strong>6.1</strong>. <strong>O AGENCIADO</strong> deve:</p>
            <p>
                <strong>(i)</strong> Agir com honestidade, cuidado e respeito aos clientes;<br />
                <strong>(ii)</strong> Avisar o AGENCIADOR sobre qualquer problema ocorrido durante o atendimento;<br />
                <strong>(iii)</strong> Portar documento pessoal ao chegar ao atendimento;<br />
                <strong>(iv)</strong> Responder integralmente, de forma exclusiva e objetiva, por qualquer dano material, moral ou extrapatrimonial causado a terceiros
                durante ou em razão dos atendimentos/serviços intermediados, isentando o <strong>AGENCIADOR</strong> de qualquer responsabilidade direta, solidária ou
                subsidiária, salvo se comprovada culpa exclusiva da unidade.
            </p>

            <p>
                <strong>6.2</strong>. <strong>O AGENCIADO</strong> reconhece que atua como profissional autônomo, sem qualquer vínculo empregatício com o
                <strong>AGENCIADOR</strong>, e compromete-se a cumprir todas as leis aplicáveis no território nacional durante a prestação dos serviços.
            </p>

            <p>
                <strong>6.3.</strong> O <strong>AGENCIADO</strong> tem plena liberdade para definir sua agenda e aceitar ou recusar as solicitações de atendimento feitas
                pelos clientes por meio da intermediação do <strong>AGENCIADOR</strong>, sem qualquer obrigação de cumprimento de carga horária ou metas de desempenho.
                <strong>Contudo, uma vez aceito o atendimento, deverá cumprir integralmente a carga horária contratada pelo cliente para aquele serviço específico.</strong>
            </p>

            <p>
                <strong>6.4.</strong> O <strong>AGENCIADOR</strong>, como meio de intermediação de oportunidades de atendimento, poderá repassar ao
                <strong>AGENCIADO</strong> as solicitações de serviços realizadas pelos clientes, informando data e horário sugeridos. O <strong>AGENCIADO</strong> tem
                total liberdade para aceitar ou recusar tais oportunidades, sem qualquer obrigação de cumprimento de escalas, metas ou frequência mínima de atendimentos.
            </p>

            {/* ARTIGO 7ª */}
            <p><strong>ARTIGO 7ª - DAS OBRIGAÇÕES DO AGENCIADO</strong></p>
            <p>
                <strong>7.1</strong>. O <strong>AGENCIADO</strong> manterá sempre seus dados atualizados junto ao <strong>AGENCIADOR</strong>, a fim de possibilitar a
                comunicação para ofertas das diárias de limpeza e/ou passadoria.
            </p>

            <p>
                <strong>7.2</strong>. O <strong>AGENCIADO</strong>, após a sua inserção no mercado de trabalho através do agenciamento, autoriza o
                <strong>AGENCIADOR</strong> a intermediar, celebrar e assessorar a contratação final de seus serviços, diretamente com o Cliente final, respeitando a sua
                disponibilidade de dia e horário, e aceitação das diárias que serão ofertadas.
            </p>

            <p>
                <strong>7.3</strong>. O <strong>AGENCIADO</strong> é responsável por todas as atividades realizadas no agenciamento, inclusive as passíveis de sanções
                penais e cíveis, devendo agir sempre com ética e probidade nos locais de prestação de serviços agenciados.
            </p>

            <p>
                <strong>7.4.</strong> O <strong>AGENCIADO</strong> será o único e exclusivo responsável pelo recolhimento de todos os tributos, taxas, contribuições e
                encargos de natureza fiscal, previdenciária, trabalhista ou qualquer outra, decorrentes do exercício de suas atividades profissionais, isentando
                expressamente o <strong>AGENCIADOR</strong> de qualquer responsabilidade solidária ou subsidiária.
            </p>

            {/* ARTIGO 8º */}
            <p><strong>ARTIGO 8º - DO PAGAMENTO</strong></p>
            <p>
                <strong>8.1</strong>. O <strong>AGENCIADO</strong> receberá pelo menos {contrato.percentualProfissional}% (cinquenta e cinco por cento) do valor da
                diária, e a diferença irá para o <strong>AGENCIADOR</strong> como taxa de intermediação.
            </p>

            <p>
                <strong>8.2</strong>. O cliente paga o valor ao <strong>AGENCIADOR</strong>, que fará o repasse à profissional após o atendimento, de forma semanal ou
                após cada diária, sendo vedado o pagamento de forma quinzenal e mensal, reforçando a autonomia do <strong>AGENCIADO</strong> e a inexistência de relação
                empregatícia entre as partes.
            </p>

            <p><strong>8.3</strong>. O pagamento é feito na conta bancária informada pela profissional.</p>

            <p>
                <strong>8.4.</strong> O <strong>AGENCIADO</strong> autoriza o <strong>AGENCIADOR</strong> a receber diretamente os valores pagos pelos tomadores dos
                serviços, com a finalidade exclusiva de facilitar a transação financeira.
            </p>

            <p>
                <strong>8.5.</strong> O <strong>AGENCIADO</strong> declara que teve ciência dos valores que são praticados pelo <strong>AGENCIADOR</strong> a cada diária
                de limpeza, conforme as horas contratadas pelos clientes e que a sua porcentagem de repasse corresponde a pelo menos {contrato.percentualProfissional}%
                (cinquenta e cinco por cento) do valor da diária de limpeza intermediada.
            </p>

            {/* ARTIGO 9º */}
            <p><strong>ARTIGO 9º - SOBRE A EXCLUSIVIDADE E CLIENTES</strong></p>
            <p>
                <strong>9.1.</strong> Por não possuir nenhuma exclusividade com o <strong>AGENCIADOR</strong> o <strong>AGENCIADO</strong> pode atender outros clientes,
                <strong>desde que não sejam clientes do AGENCIADOR.</strong>
            </p>

            <p>
                <strong>9.2.</strong> É proibido atender diretamente clientes conquistados pela intermediação da Maria Brasileira. Se isso acontecer, a profissional pagará
                uma multa de 3 vezes o valor equivalente ao último valor de repasse recebido pelo <strong>AGENCIADO</strong>, por cliente aliciado, mediante a comprovação
                do aliciamento.
            </p>

            <p>
                <strong>9.3.</strong> O descumprimento desta cláusula caracteriza concorrência desleal e o <strong>AGENCIADO</strong> estará sujeito à rescisão do presente
                contrato e ao pagamento de cláusula penal acima estabelecida.
            </p>

            {/* CLÁUSULA 10ª */}
            <p><strong>CLÁUSULA 10ª – DA VIGÊNCIA</strong></p>
            <p>
                <strong>10.1.</strong> O presente contrato entra em vigor na data de sua assinatura e poderá ser rescindido a qualquer tempo mediante comunicação por
                escrito, seja por e-mail ou mensagem via aplicativo de mensagens.
            </p>

            {/* ARTIGO 11ª */}
            <p><strong>ARTIGO 11ª - DO ENCERRAMENTO DA PARCERIA</strong></p>
            <p>
                <strong>11.1.</strong> O <strong>AGENCIADO</strong>, quando não mais tiver interesse na promoção do agenciamento, comunicará ao <strong>AGENCIADOR</strong>
                por escrito a solicitação do fim da intermediação dos seus serviços, sem prejuízo dos valores que tenha a receber por diárias já realizadas, solicitando o
                distrato e dando por revogado os termos deste contrato.
            </p>

            <p>
                <strong>11.2.</strong> A prática de qualquer ação/ato tipificado como crime ou contravenção penal por parte do <strong>AGENCIADO</strong>, durante ou em
                razão de atendimentos intermediados pelo <strong>AGENCIADOR</strong>, ensejará a imediata rescisão deste contrato.
            </p>

            <p>
                <strong>11.3.1.</strong> Nessa hipótese, o <strong>AGENCIADOR</strong> adotará as providências legais cabíveis, inclusive o registro de boletim de
                ocorrência e o fornecimento às autoridades competentes de todos os dados e documentos necessários à identificação e responsabilização do
                <strong>AGENCIADO</strong>, nos termos do art. 7º, II e art. 11, II, "a" da Lei nº 13.709/2018 (LGPD).
            </p>

            <p>
                <strong>11.3.1.2.</strong> O <strong>AGENCIADO</strong> responderá integral e exclusivamente por seus atos ilícitos, isentando o <strong>AGENCIADOR</strong>
                e a franqueadora MARIA BRASILEIRA de qualquer responsabilidade civil, penal ou administrativa decorrente da conduta praticada.
            </p>

            <p>
                <strong>11.4.</strong> A presente parceria poderá ser encerrada, a qualquer tempo, por qualquer das partes, de forma unilateral e imotivada, mediante
                comunicação expressa à outra parte, dispensada qualquer justificativa.
            </p>

            <p>
                <strong>11.5.</strong> Sem prejuízo da prerrogativa prevista na cláusula anterior, ficam expressamente estabelecidas as hipóteses abaixo como causas de
                encerramento imediato deste contrato, sem necessidade de aviso prévio:
            </p>

            <div className="list-item">
                <strong>I.</strong> Descumprimento de qualquer cláusula deste contrato pelo <strong>AGENCIADO</strong>;<br />
                <strong>II.</strong> Prática de condutas que possam comprometer a reputação da marca MARIA BRASILEIRA.<br />
                <strong>III.</strong> Prática de atos ilícitos ou antiéticos no exercício das atividades intermediadas;<br />
                <strong>IV.</strong> Fornecimento de informações falsas ou documentos inidôneos;<br />
                <strong>V.</strong> Prestação de serviços diretamente aos clientes indicados pelo <strong>AGENCIADOR</strong>, sem a sua intermediação;<br />
                <strong>VI.</strong> Não cumprimento das obrigações legais e fiscais associadas à sua atuação como profissional autônomo;<br />
                <strong>VII</strong>. Violação de sigilo ou compartilhamento de informações confidenciais desde que efetivamente comprovadas<br />
                <strong>VIII</strong>. O fornecimento de informações ou documentos falsos pelo <strong>AGENCIADO</strong> ensejará a rescisão imediata do contrato, sem
                necessidade de aviso prévio, além do dever de indenizar eventuais danos causados ao AGENCIADOR ou à rede MARIA BRASILEIRA.<br />
                <strong>IX.</strong> Reiteração de condutas que comprometam a reputação da unidade, devidamente registradas.
            </div>

            <p>
                <strong>11.6.</strong> O encerramento da parceria <strong>não gera qualquer direito a indenização, multa ou pagamento de valores adicionais</strong>, salvo
                aqueles eferentes a atendimentos já realizados e pendentes de repasse.
            </p>

            {/* ARTIGO 12º */}
            <p><strong>ARTIGO 12º - DISPOSIÇÕES GERAIS</strong></p>
            <p>
                <strong>12.</strong> O presente contrato de agenciamento terá validade enquanto existir a DISPONIBILIDADE do <strong>AGENCIADO</strong> e enquanto este
                desejar a <strong>INTERMEDIAÇÃO</strong> dos serviços pelo <strong>AGENCIADOR</strong>.
            </p>

            <p>
                <strong>12.1.</strong> O <strong>AGENCIADO</strong> obriga-se a manter sigilo e confidencialidade sobre todos os dados pessoais e informações sensíveis dos
                clientes aos quais venha a ter acesso durante a execução dos atendimentos, nos termos da Lei nº 13.709/2018 – LGPD.<strong> É vedado qualquer tipo de
                    compartilhamento, divulgação, reprodução, fotos ou uso diverso daqueles estritamente necessários para a execução do serviço.</strong> O descumprimento
                poderá acarretar responsabilização civil, administrativa e penal, conforme a legislação aplicável.
            </p>

            <p>
                <strong>12.1.1</strong> Essa obrigação de confidencialidade subsistirá por prazo indeterminado, inclusive após o encerramento da parceria, sob pena de
                responsabilização cível por eventuais danos causados, sem prejuízo da apuração de sanções administrativas e legais aplicáveis.
            </p>

            {/* ARTIGO 13º */}
            <p><strong>ARTIGO 13º - TRATAMENTO DE DADOS PESSOAIS</strong></p>
            <p>
                <strong>13.1.</strong> O <strong>AGENCIADO</strong> declara estar ciente de que, para a execução deste contrato e para possibilitar a intermediação dos
                serviços pela unidade franqueada da MARIA BRASILEIRA, será necessário o tratamento de seus dados pessoais, conforme definido pela Lei nº 13.709/2018 (Lei
                Geral de Proteção de Dados – LGPD).
            </p>

            <p>
                <strong>13.2.</strong> Os dados pessoais tratados poderão incluir, mas não se limitarão a: nome completo, número de CPF e RG, endereço, telefone, e-mail,
                conta bancária, fotografia, histórico de atendimentos, avaliações de clientes, além de quaisquer outros estritamente necessários para a execução da
                presente parceria.
            </p>

            <p>
                <strong>13.3.</strong> O tratamento dos dados terá como base legal o disposto no art. 7º, inciso V, da LGPD (execução de contrato), e se destina às
                seguintes finalidades:
            </p>
            <ul>
                <li>Organização e intermediação de atendimentos com clientes finais;</li>
                <li>Comunicação entre as partes;</li>
                <li>Repasse de pagamentos e emissão de documentos fiscais;</li>
                <li>Monitoramento de padrões de qualidade da prestação dos serviços;</li>
                <li>Cumprimento de obrigações legais, inclusive de natureza contábil e regulatória.</li>
            </ul>

            <p><strong>13.4.</strong> Os dados do <strong>AGENCIADO</strong> poderão ser compartilhados com:</p>
            <ul>
                <li>A franqueadora MARIA BRASILEIRA FRANCHISING, para fins estatísticos e de desenvolvimento da rede;</li>
                <li>Plataformas parceiras de tecnologia utilizadas para operacionalização dos serviços;</li>
                <li>Prestadores de serviços auxiliares (contábeis, bancários, fiscais), desde que contratualmente obrigados à confidencialidade.</li>
            </ul>

            <p>
                <strong>13.5.</strong> O <strong>AGENCIADO</strong> poderá exercer, a qualquer momento, os direitos previstos no art. 18 da LGPD, mediante solicitação
                formal à unidade franqueada com a qual mantém vínculo, incluindo: acesso aos dados, correção, portabilidade, anonimização, bloqueio ou eliminação, quando
                cabível.
            </p>

            <p>
                <strong>13.6.</strong> A unidade franqueada e a franqueadora se comprometem a adotar medidas técnicas e organizacionais aptas a proteger os dados pessoais
                contra acessos não autorizados, vazamentos e quaisquer formas de tratamento inadequado ou ilícito, conforme preconizado pelo art. 46 da LGPD.
            </p>

            <p>
                <strong>13.7.</strong> O término da parceria implicará a desativação do perfil do <strong>AGENCIADO</strong> nos sistemas internos da MARIA BRASILEIRA,
                sendo os dados armazenados apenas pelo prazo necessário para cumprimento de obrigações legais ou regulatórias.
            </p>

            <p>
                <strong>13.8.</strong> As partes reconhecem que o eventual descumprimento das obrigações previstas nesta cláusula sujeitará o infrator às sanções previstas
                na LGPD, sem prejuízo de eventuais perdas e danos.
            </p>

            {/* ARTIGO 14º */}
            <p><strong>ARTIGO 14º - DA FORMA DE ASSINATURA</strong></p>
            <p>
                <strong>14.1.</strong> O presente Contrato poderá ser assinado pelas partes de forma física (manuscrita) ou eletrônica, sendo válida e eficaz a sua
                formalização por meio de plataformas de assinatura eletrônica que garantam a autenticidade, integridade e autoria do documento, nos termos da Medida
                Provisória nº 2.200-2/2001 e demais legislações aplicáveis.
            </p>

            <p>
                <strong>14.2.</strong> Para todos os efeitos legais, a assinatura eletrônica produz os mesmos efeitos jurídicos da assinatura física, obrigando as partes
                aos seus termos.
            </p>

            <p>
                <strong>14.3.</strong> Cada parte receberá uma via (ou acesso ao documento final) igualmente válida, independentemente do formato em que tenha sido assinado.
            </p>

            {/* ARTIGO 15º */}
            <p><strong>ARTIGO 15º - FORO</strong></p>
            <p>
                14.1. Para resolver quaisquer dúvidas ou conflitos relacionados a este contrato, as partes elegem o foro da comarca de {unidade.unitName}, com renúncia de
                qualquer outro, por mais privilegiado que seja.
            </p>

            <p>Por estarem de acordo, as partes firmam o presente.</p>

            {/* Assinaturas */}
            <div style={{ marginTop: '40px' }}>
                <p>&nbsp;<br />&nbsp;<br />___________________________________________________<br />
                    {unidade.razaoSocial}<br />
                    CNPJ: {formatCNPJ(unidade.cnpj)}</p>

                <p>&nbsp;<br />___________________________________________________<br />
                    {profissional.nome}<br />
                    CPF: {formatCPF(profissional.cpf)}</p>

                <p>&nbsp;<br />
                    _________________________________________ _________________________________________<br />
                    Testemunha &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Testemunha<br />
                    CPF: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; CPF:</p>
            </div>
        </div>
    );
};
