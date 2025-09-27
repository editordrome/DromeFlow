import React, { useState, useCallback, DragEvent } from 'react';
import * as XLSX from 'xlsx';
import { Unit, UploadMetrics } from '../../types';
import { Icon } from './Icon';
import { uploadXlsxData } from '../../services/ingestion/upload.service';
import type { RawDataRecordForUpload } from '../../services/ingestion/upload.service';

interface UploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUploadSuccess: () => void;
    unit: Unit | null;
}

type Status = 'idle' | 'processing' | 'success' | 'error';

const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onUploadSuccess, unit }) => {
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<Status>('idle');
    const [message, setMessage] = useState('');
    const [isDragOver, setIsDragOver] = useState(false);

    const resetState = () => {
        setFile(null);
        setStatus('idle');
        setMessage('');
        setIsDragOver(false);
    };

    const handleClose = () => {
        if (status === 'processing') return;
        resetState();
        onClose();
    };

    const handleFileSelect = (selectedFile: File | null) => {
        if (status === 'processing' || !selectedFile) return;

        if (!selectedFile.name.endsWith('.xlsx')) {
            setStatus('error');
            setMessage('Formato de arquivo inválido. Por favor, selecione um arquivo .xlsx');
            setFile(null);
            return;
        }
        setFile(selectedFile);
        setStatus('idle');
        setMessage('');
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleFileSelect(e.target.files ? e.target.files[0] : null);
    };

    const handleDragEvents = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
        handleDragEvents(e);
        if (status !== 'processing') setIsDragOver(true);
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        handleDragEvents(e);
        setIsDragOver(false);
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        handleDragEvents(e);
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    };

    const processAndUpload = useCallback(async () => {
        if (!file || !unit) {
            setMessage('Arquivo ou unidade não selecionada.');
            setStatus('error');
            return;
        }

        setStatus('processing');
        setMessage('Lendo arquivo...');

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'array', cellDates: false, cellNF: false, cellStyles: false });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', blankrows: false, raw: true });

                if (jsonData.length < 2) throw new Error("A planilha parece estar vazia ou não contém cabeçalhos e dados.");

                setMessage('Validando colunas...');
                
                let headerRowIndex = -1;
                let headers: string[] = [];
                for (let i = 0; i < Math.min(jsonData.length, 5); i++) {
                    const row = jsonData[i];
                    if (row && row.some(cell => String(cell).trim().toLowerCase() === 'número')) {
                        headerRowIndex = i;
                        headers = row.map(h => String(h).trim());
                        break;
                    }
                }
                
                if (headerRowIndex === -1) {
                    throw new Error("Linha de cabeçalhos não encontrada. Verifique se existe uma coluna 'Número'.");
                }
                
                console.log(`Cabeçalhos encontrados na linha ${headerRowIndex + 1}:`, headers);
                const requiredHeaders = ['Número', 'Data', 'Cliente', 'Valor (R$)', 'Serviço'];
                for (const rh of requiredHeaders) {
                    if (!headers.some(h => h.toLowerCase() === rh.toLowerCase())) throw new Error(`Coluna obrigatória não encontrada: "${rh}"`);
                }

                                const headerMap: { [key: string]: number } = {};
                                const normalizedHeaderMap: { [key: string]: number } = {};
                                const normalize = (s: string) => s
                                    .toLowerCase()
                                    .normalize('NFD')
                                    .replace(/\p{Diacritic}/gu, '') // remove acentos
                                    .replace(/\s+/g, ' ') // espaços múltiplos -> 1
                                    .trim();
                                headers.forEach((h, i) => {
                                        const lower = h.toLowerCase();
                                        headerMap[lower] = i;
                                        normalizedHeaderMap[normalize(h)] = i;
                                });
                                // LOG diagnóstico nomes de cabeçalho
                                console.log('[UPLOAD] Cabeçalhos brutos:', headers);
                                console.log('[UPLOAD] Cabeçalhos lower-case:', Object.keys(headerMap));
                                console.log('[UPLOAD] Cabeçalhos normalizados:', Object.keys(normalizedHeaderMap));

                setMessage('Processando registros...');
                
                const formatarData = (d: string) => {
                    if (!d) return null;
                    const parts = d.split('/');
                    return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : d;
                };
                
                const formatarMoeda = (v: string) => {
                    if (!v) return 0;
                    let valor = String(v).trim().replace(/R\$\s*/g, '');
                    if (valor.includes(',') && valor.includes('.')) {
                        valor = valor.replace(/\./g, '').replace(',', '.');
                    } else {
                        valor = valor.replace(',', '.');
                    }
                    return parseFloat(valor) || 0;
                };

                const phoneRegex = /(?:\(?\d{2}\)?\s?)?(?:\d{4,5}-?\d{4})/;
                const recordsToUpload: RawDataRecordForUpload[] = [];
                const dataRows = jsonData.slice(headerRowIndex + 1);

                for (const row of dataRows) {
                    if (!row || row.every(cell => String(cell).trim() === '')) continue;

                    const numero = String(row[headerMap['número']] || row[headerMap['numero']] || '').trim();
                    const dataOriginal = String(row[headerMap['data']] || '').trim();
                    const valorOriginal = String(row[headerMap['valor (r$)']] || '0').trim();
                    const clienteOriginal = String(row[headerMap['cliente']] || '').trim();
                    const servicoOriginal = String(row[headerMap['serviço']] || row[headerMap['servico']] || '').trim();
                    
                    if (!numero || !dataOriginal || !clienteOriginal || !servicoOriginal) {
                        console.warn(`Linha pulada por falta de dados obrigatórios: Número='${numero}', Data='${dataOriginal}', Cliente='${clienteOriginal}', Serviço='${servicoOriginal}'`);
                        continue;
                    }

                    let clienteNome = clienteOriginal.replace(/\|/g, '').trim();
                    let whatscliente = '';
                    const phoneMatch = clienteNome.match(phoneRegex);
                    if (phoneMatch) {
                        whatscliente = `55${phoneMatch[0].replace(/\D/g, '')}`;
                        clienteNome = clienteNome.replace(phoneRegex, '').trim();
                    }

                    // *** REFEITO: Cria um único registro por linha com dados brutos para processamento no backend ***
                    // Mapeamentos solicitados:
                    //   - Coluna E ("Período") -> campo MOMENTO
                    //   - Coluna H ("Horas")   -> campo 'PERÍODO' (com acento) no banco
                    // Fallbacks para coluna Horas (H): 'horas', 'hora', 'horário', 'horario'
                    const horasIdx = headerMap['horas'] ?? headerMap['hora'] ?? headerMap['horário'] ?? headerMap['horario'];
                    const horasValor = horasIdx !== undefined ? String(row[horasIdx] || '').trim() : '';

                    const record: RawDataRecordForUpload = {
                        orcamento: numero,
                        DATA: formatarData(dataOriginal),
                        HORARIO: String(row[headerMap['horário']] || '').trim(),
                        VALOR: formatarMoeda(valorOriginal),
                        SERVIÇO: servicoOriginal,
                        TIPO: String(row[headerMap['tipo']] || '').trim(),
                        // MOMENTO com fallbacks e normalização: aceita 'Período', 'Periodo', 'Momento' (qualquer acentuação / caixa)
                        MOMENTO: (() => {
                            const directIdx = headerMap['período'] ?? headerMap['periodo'] ?? headerMap['momento'];
                            if (directIdx !== undefined) return String(row[directIdx] || '').trim();
                            const idxNorm = normalizedHeaderMap['periodo'] ?? normalizedHeaderMap['momento'];
                            return idxNorm !== undefined ? String(row[idxNorm] || '').trim() : '';
                        })(),
                        // Novo mapeamento: coluna "Horas" (H) do XLSX -> campo 'PERÍODO'
                        'PERÍODO': horasValor || null,
                        CLIENTE: clienteNome,
                        PROFISSIONAL: String(row[headerMap['profissionais']] || '').trim(),
                        ENDEREÇO: String(row[headerMap['local de atendimento']] || '').trim(),
                        DIA: String(row[headerMap['dia da semana']] || '').trim(),
                        REPASSE: String(row[headerMap['repasse (r$)']] || '0').trim(), // Passa o valor bruto (string)
                        whatscliente,
                        CUPOM: String(row[headerMap['cupom de desconto']] || '').trim(),
                        ORIGEM: String(row[headerMap['origem']] || '').trim(),
                        CADASTRO: formatarData(String(row[headerMap['data de cadastro']] || '').trim()),
                        NÚMERO: numero,
                        // Campos que serão definidos no backend
                        ATENDIMENTO_ID: '',
                        IS_DIVISAO: '',
                        // Campos padrão
                        ACAO: null,
                        confirmacao: null,
                        status: null,
                        unidade: unit.unit_name,
                        observacao: null,
                        'pos vendas': null,
                        comentario: null,
                    };
                    recordsToUpload.push(record);
                    if (recordsToUpload.length === 1) {
                        console.log('[UPLOAD] Primeiro registro mapeado (diagnóstico):', {
                            HORARIO: record.HORARIO,
                            'PERÍODO': (record as any)['PERÍODO'],
                            MOMENTO: record.MOMENTO,
                            headers: Object.keys(headerMap)
                        });
                        if (!record.MOMENTO) {
                            console.warn('[UPLOAD][AVISO] Campo MOMENTO vazio. Verifique se a coluna E possui cabeçalho "Período", "Periodo" ou "Momento".');
                        }
                    }
                }
                
                if (recordsToUpload.length === 0) throw new Error("Nenhum registro válido encontrado para upload.");
                
                console.log(`Total de ${recordsToUpload.length} linhas prontas para envio.`);
                
                setMessage('Sincronizando e enviando dados...');
                const finalMetrics = await uploadXlsxData(unit.unit_code, recordsToUpload);

                const messageParts = [`Importação concluída com sucesso!`];
                if(finalMetrics.deleted > 0) messageParts.push(`${finalMetrics.deleted} registros obsoletos foram removidos.`);
                messageParts.push(`${finalMetrics.inserted} registros novos foram adicionados.`);
                messageParts.push(`${finalMetrics.updated} registros existentes foram atualizados.`);
                messageParts.push(`${finalMetrics.ignored} registros permaneceram inalterados.`);

                setMessage(messageParts.join(' '));
                setStatus('success');
                setTimeout(() => {
                    onUploadSuccess();
                    handleClose();
                }, 2500);

            } catch (err: any) {
                console.error("Erro no processamento:", err);
                setMessage(err.message || 'Ocorreu um erro desconhecido.');
                setStatus('error');
            }
        };
        reader.onerror = () => {
            setMessage('Falha ao ler o arquivo.');
            setStatus('error');
        };
        reader.readAsArrayBuffer(file);
    }, [file, unit, onUploadSuccess]);


    if (!isOpen) return null;

    const isProcessing = status === 'processing';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true" role="dialog">
            <div className="w-full max-w-lg p-6 mx-4 bg-bg-secondary rounded-lg shadow-lg">
                <div className="flex items-center justify-between pb-3 border-b border-border-primary">
                    <h2 className="text-xl font-bold text-text-primary">Importar Dados XLSX</h2>
                    <button onClick={handleClose} className="p-1 rounded-full text-text-secondary hover:bg-bg-tertiary" disabled={isProcessing}>
                        <Icon name="close" />
                    </button>
                </div>
                <div className="mt-6">
                    <p className="text-sm text-text-secondary mb-4">
                        Você está importando dados para a unidade: <strong className="text-text-primary">{unit?.unit_name}</strong>
                    </p>

                    <div
                        onDragEnter={handleDragEnter}
                        onDragOver={handleDragEvents}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`p-6 border-2 border-dashed rounded-lg text-center transition-colors duration-200 ${
                            isDragOver ? 'border-accent-primary bg-accent-primary/10' : 'border-border-secondary'
                        } ${isProcessing ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                        <input
                            type="file"
                            id="file-upload"
                            className="sr-only"
                            onChange={handleFileChange}
                            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            disabled={isProcessing}
                        />
                        <label htmlFor="file-upload" className={isProcessing ? 'cursor-not-allowed' : 'cursor-pointer'}>
                            <Icon name="archive" className="w-12 h-12 mx-auto text-text-secondary" />
                            <p className="mt-2 text-sm font-semibold text-text-primary">
                                {file ? file.name : 'Arraste ou clique para selecionar'}
                            </p>
                            <p className="text-xs text-text-secondary">Somente arquivos .xlsx</p>
                        </label>
                    </div>

                    {message && (
                         <div className={`mt-4 text-sm text-center p-3 rounded-md ${
                            status === 'error' ? 'text-danger bg-danger/10' : 
                            status === 'success' ? 'text-success bg-success/10' :
                            'text-text-secondary'
                        }`}>
                            {message.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                        </div>
                    )}

                    <div className="flex justify-end pt-6 mt-4 space-x-3 border-t border-border-primary">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isProcessing}
                            className="px-4 py-2 text-sm font-medium border rounded-md text-text-secondary border-border-secondary hover:bg-bg-tertiary disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={processAndUpload}
                            disabled={!file || isProcessing}
                            className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md bg-accent-primary hover:bg-accent-secondary disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            {isProcessing ? 'Processando...' : 'Enviar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UploadModal;