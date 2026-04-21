import React, { useState, useEffect } from 'react';
import { Icon } from '../ui/Icon';
import { createUnit } from '../../services/units/units.service';
import { createUser } from '../../services/auth/users.service';
import { fetchAllPlans } from '../../services/plans/plans.service';
import { Plan, UserRole } from '../../types';
import { v4 as uuidv4 } from 'uuid';

interface UnitFormData {
    id: string;
    unit_name: string;
    unit_code: string;
    razao_social: string;
    cnpj: string;
    endereco: string;
    cep: string;
    cidade: string;
    estado: string;
    bairro: string;
    rua: string;
    numero: string;
    complemento: string;
    responsavel: string;
    email: string;
    whatsapp_responsavel: string;
    whatsapp_clientes: string;
    whatsapp_profissionais: string;
}

const RegistrationPage: React.FC = () => {
    const [step, setStep] = useState(1);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
    const [numUnits, setNumUnits] = useState(1);
    
    // Lista de unidades sendo cadastradas
    const [unitsData, setUnitsData] = useState<UnitFormData[]>([]);
    const [currentUnitIndex, setCurrentUnitIndex] = useState(0);
    
    // Estados auxiliares
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [cnpjLoading, setCnpjLoading] = useState(false);
    const [showEditFields, setShowEditFields] = useState(false);
    const [isDataSameAsPrevious, setIsDataSameAsPrevious] = useState<boolean | null>(null);
    const [isWhatsSameAsPrevious, setIsWhatsSameAsPrevious] = useState<boolean | null>(null);

    useEffect(() => {
        const loadPlans = async () => {
            try {
                const data = await fetchAllPlans();
                setPlans(data);
            } catch (error) {
                console.error('Erro ao carregar planos:', error);
            }
        };
        loadPlans();
    }, []);

    const planOptions = [
        { label: '1 Unidade', value: 1, planName: 'Dromeflow Full' },
        { label: '2 Unidades', value: 2, planName: 'DromeTwooUnits' },
        { label: '3 Unidades', value: 3, planName: 'DromeTreeUnits' },
        { label: '4 Unidades', value: 4, planName: 'DromeFourUnits' },
        { label: '5 Unidades', value: 5, planName: 'DromeFiveUnits' },
    ];

    const handleSelectPlan = (units: number, planName: string) => {
        const plan = plans.find(p => p.name === planName);
        setSelectedPlan(plan || null);
        setNumUnits(units);
        
        // Inicializa o array de dados das unidades
        const initialUnit: UnitFormData = {
            id: uuidv4(),
            unit_name: '',
            unit_code: '',
            razao_social: '',
            cnpj: '',
            endereco: '',
            cep: '',
            cidade: '',
            estado: '',
            bairro: '',
            rua: '',
            numero: '',
            complemento: '',
            responsavel: '',
            email: '',
            whatsapp_responsavel: '',
            whatsapp_clientes: '',
            whatsapp_profissionais: '',
        };
        setUnitsData([initialUnit]);
        setStep(2);
    };

    const handleCnpjLookup = async (cnpj: string) => {
        const cleanCnpj = cnpj.replace(/\D/g, '');
        if (cleanCnpj.length !== 14) return;

        setCnpjLoading(true);
        try {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
            if (!response.ok) throw new Error('CNPJ não encontrado');

            const data = await response.json();
            
            const updatedUnits = [...unitsData];
            const current = updatedUnits[currentUnitIndex];
            
            // Função interna para formatar texto vindo da API (Proper Case)
            const formatText = (text: string) => {
                if (!text) return '';
                return text.toLowerCase()
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
            };
            
            current.razao_social = formatText(data.razao_social || '');
            current.cep = data.cep || '';
            current.cidade = formatText(data.municipio || '');
            current.estado = data.uf || '';
            current.bairro = formatText(data.bairro || '');
            current.rua = formatText(data.logradouro || '');
            current.numero = data.numero || '';
            current.complemento = formatText(data.complemento || '');
            
            // Sequência solicitada: Rua Numero Complemento Bairro Cidade Estado CEP
            current.endereco = `${current.rua} ${current.numero} ${current.complemento} ${current.bairro} ${current.cidade} ${current.estado} ${current.cep}`.replace(/\s+/g, ' ').trim();
            
            // Sugestão automática de nome da unidade se estiver vazio
            if (!current.unit_name) {
                current.unit_name = `MB ${current.cidade}`;
            }

            setUnitsData(updatedUnits);
            setShowEditFields(false); // Mostra confirmação
        } catch (err) {
            console.error('Erro ao buscar CNPJ:', err);
            alert('Não foi possível buscar os dados do CNPJ.');
        } finally {
            setCnpjLoading(false);
        }
    };

    const handleConfirmData = (correct: boolean) => {
        if (correct) {
            setStep(3); // Vai para dados do responsável
        } else {
            setShowEditFields(true); // Abre campos para edição
        }
    };

    const handleNextFromResponsible = () => {
        if (numUnits > unitsData.length) {
            // Prepara para próxima unidade
            setStep(4);
        } else {
            // Finaliza
            handleSubmitFinal();
        }
    };

    const handleNextUnitConfig = (sameData: boolean) => {
        setIsDataSameAsPrevious(sameData);
        if (sameData) {
            // Pergunta sobre os Whatsapps
            setStep(5);
        } else {
            // Novo cadastro completo para a próxima unidade
            startNewUnit(false, false);
        }
    };

    const handleWhatsConfig = (sameWhats: boolean) => {
        setIsWhatsSameAsPrevious(sameWhats);
        startNewUnit(true, sameWhats);
    };

    const startNewUnit = (sameBase: boolean, sameWhats: boolean) => {
        const previous = unitsData[currentUnitIndex];
        const newUnit: UnitFormData = {
            id: uuidv4(),
            unit_name: '',
            unit_code: '', // Deixa vazio para o usuário preencher ou gera um novo
            razao_social: sameBase ? previous.razao_social : '',
            cnpj: sameBase ? previous.cnpj : '',
            endereco: sameBase ? previous.endereco : '',
            cep: sameBase ? previous.cep : '',
            cidade: sameBase ? previous.cidade : '',
            estado: sameBase ? previous.estado : '',
            bairro: sameBase ? previous.bairro : '',
            rua: sameBase ? previous.rua : '',
            numero: sameBase ? previous.numero : '',
            complemento: sameBase ? previous.complemento : '',
            responsavel: previous.responsavel, // Responsável é sempre o mesmo? No pedido diz: "conectar o usuario as demais unidades"
            email: previous.email,
            whatsapp_responsavel: previous.whatsapp_responsavel,
            whatsapp_clientes: sameWhats ? previous.whatsapp_clientes : '',
            whatsapp_profissionais: sameWhats ? previous.whatsapp_profissionais : '',
        };
        
        setUnitsData([...unitsData, newUnit]);
        setCurrentUnitIndex(prev => prev + 1);
        
        if (sameBase && sameWhats) {
            // Se tudo é igual, só precisa do Nome/Código da Unidade
            setStep(6); 
        } else if (sameBase && !sameWhats) {
            // Só precisa dos Whats
            setStep(7);
        } else {
            // Cadastro completo de novo
            setStep(2);
        }
    };

    const handleSubmitFinal = async () => {
        setIsSubmitting(true);
        try {
            // 1. Criar unidades
            const createdUnitIds: string[] = [];
            for (const unit of unitsData) {
                const unitId = unit.id;
                await createUnit({
                    id: unitId,
                    unit_name: unit.unit_name,
                    unit_code: unit.unit_code || unit.unit_name.toLowerCase().replace(/\s+/g, '-'),
                    razao_social: unit.razao_social,
                    cnpj: unit.cnpj,
                    endereco: unit.endereco,
                    responsavel: unit.responsavel,
                    contato: unit.whatsapp_responsavel,
                    email: unit.email
                } as any);
                createdUnitIds.push(unitId);
            }

            // 2. Criar Usuário Admin
            const firstUnit = unitsData[0];
            await createUser({
                full_name: firstUnit.responsavel,
                email: firstUnit.email,
                password: 'mudar1234',
                role: 'admin' as UserRole,
                unit_ids: createdUnitIds,
                module_ids: [] // Módulos serão atribuídos depois ou por padrão
            } as any);

            // 3. Enviar para n8n para automações
            try {
                await fetch('https://app.paineldromedario.top/webhook/infinity-mb', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event: 'new_registration',
                        units: unitsData,
                        admin: {
                            name: firstUnit.responsavel,
                            email: firstUnit.email,
                            temp_password: 'mudar1234'
                        },
                        plan: selectedPlan?.name,
                        payment_link: selectedPlan?.payment_link,
                        timestamp: new Date().toISOString()
                    })
                });
            } catch (n8nError) {
                console.error('Erro ao notificar n8n:', n8nError);
                // Não bloqueia o sucesso do usuário se o n8n falhar
            }

            setStep(8); // Success Step
        } catch (error: any) {
            console.error('Erro ao finalizar cadastro:', error);
            alert(`Falha ao finalizar cadastro: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0B0F19] text-white font-sans relative overflow-hidden flex items-center justify-center p-4">
            {/* Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-brand-cyan/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-brand-purple/20 rounded-full blur-[120px] pointer-events-none" />
            
            <div className="max-w-xl w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-6">
                        <img src="/logo-dromedario.png" alt="Dromedário Logo" className="w-24 h-24 object-contain" />
                    </div>
                    {step < 8 && <p className="text-gray-400 font-medium tracking-wide">Configuração de Nova Unidade</p>}
                </div>

                {/* Card Envelope */}
                <div className="bg-[#151B2C]/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
                    
                    {/* Step 1: Plano */}
                    {step === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-xl font-bold text-center">Qual o plano de unidades escolhido?</h2>
                            <div className="grid grid-cols-1 gap-3">
                                {planOptions.map(opt => (
                                    <button 
                                        key={opt.value}
                                        onClick={() => handleSelectPlan(opt.value, opt.planName)}
                                        className="w-full py-4 px-6 rounded-xl border border-white/10 bg-white/5 hover:bg-accent-primary/20 hover:border-accent-primary/50 transition-all text-left flex items-center justify-between group"
                                    >
                                        <span className="font-semibold text-lg">{opt.label}</span>
                                        <Icon name="ArrowRight" className="w-5 h-5 text-accent-primary opacity-0 group-hover:opacity-100 transition-all" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Cadastro Unidade (CNPJ) */}
                    {step === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Icon name="Store" className="w-5 h-5 text-accent-primary" />
                                Dados da {numUnits > 1 ? `${currentUnitIndex + 1}ª ` : ''}Unidade
                            </h2>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Nome da Unidade</label>
                                    <input 
                                        type="text" 
                                        value={unitsData[currentUnitIndex].unit_name}
                                        onChange={e => {
                                            const copy = [...unitsData];
                                            copy[currentUnitIndex].unit_name = e.target.value;
                                            setUnitsData(copy);
                                        }}
                                        placeholder="MB nome cidade" 
                                        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 focus:border-accent-primary focus:outline-none transition-all" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">CNPJ</label>
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            value={unitsData[currentUnitIndex].cnpj}
                                            onChange={e => {
                                                const val = e.target.value;
                                                const copy = [...unitsData];
                                                copy[currentUnitIndex].cnpj = val;
                                                setUnitsData(copy);
                                                if (val.replace(/\D/g, '').length === 14) handleCnpjLookup(val);
                                            }}
                                            placeholder="00.000.000/0000-00" 
                                            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 focus:border-accent-primary focus:outline-none transition-all" 
                                        />
                                        {cnpjLoading && <div className="absolute right-3 top-3.5"><Icon name="Loader2" className="w-5 h-5 animate-spin text-accent-primary" /></div>}
                                    </div>
                                </div>

                                {(unitsData[currentUnitIndex].razao_social && !showEditFields) && (
                                    <div className="bg-accent-primary/5 border border-accent-primary/20 rounded-xl p-4 space-y-3 animate-in fade-in zoom-in-95">
                                        <p className="text-sm text-gray-300">Confirme se os dados abaixo estão corretos:</p>
                                        <div className="text-xs space-y-1">
                                            <p><span className="text-gray-500 uppercase font-bold">Razão:</span> {unitsData[currentUnitIndex].razao_social}</p>
                                            <p><span className="text-gray-500 uppercase font-bold">Endereço:</span> {unitsData[currentUnitIndex].endereco}</p>
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                            <button onClick={() => handleConfirmData(true)} className="flex-1 bg-accent-primary text-sm font-bold py-2 rounded-lg">Estão Corretos</button>
                                            <button onClick={() => handleConfirmData(false)} className="flex-1 border border-white/10 text-sm font-bold py-2 rounded-lg">Não, Editar</button>
                                        </div>
                                    </div>
                                )}

                                {showEditFields && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                        <div className="sm:col-span-2">
                                            <label className="block text-xs text-gray-500 mb-1 uppercase font-bold">Razão Social</label>
                                            <input type="text" value={unitsData[currentUnitIndex].razao_social} onChange={e => {
                                                const c = [...unitsData]; c[currentUnitIndex].razao_social = e.target.value; setUnitsData(c);
                                            }} className="w-full rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1 uppercase font-bold">CEP</label>
                                            <input type="text" value={unitsData[currentUnitIndex].cep} onChange={e => {
                                                const c = [...unitsData]; c[currentUnitIndex].cep = e.target.value; setUnitsData(c);
                                            }} className="w-full rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1 uppercase font-bold">Cidade/UF</label>
                                            <input type="text" value={`${unitsData[currentUnitIndex].cidade} - ${unitsData[currentUnitIndex].estado}`} readOnly className="w-full rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-sm opacity-50" />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="block text-xs text-gray-500 mb-1 uppercase font-bold">Logradouro</label>
                                            <input type="text" value={unitsData[currentUnitIndex].rua} onChange={e => {
                                                const c = [...unitsData]; c[currentUnitIndex].rua = e.target.value; setUnitsData(c);
                                            }} className="w-full rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-sm" />
                                        </div>
                                        <button onClick={() => setStep(3)} className="sm:col-span-2 bg-accent-primary py-3 rounded-lg font-bold mt-2 shadow-lg shadow-accent-primary/20">Salvar e Prosseguir</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Dados Responsável e Contatos */}
                    {step === 3 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Icon name="User" className="w-5 h-5 text-accent-primary" />
                                Responsável e WhatsApps
                            </h2>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="sm:col-span-2">
                                        <label className="block text-sm font-medium text-gray-400 mb-1">Nome do Responsável</label>
                                        <input type="text" value={unitsData[currentUnitIndex].responsavel} onChange={e => {
                                            const c = [...unitsData]; c[currentUnitIndex].responsavel = e.target.value; setUnitsData(c);
                                        }} placeholder="Ex: João Silva" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">E-mail</label>
                                        <input type="email" value={unitsData[currentUnitIndex].email} onChange={e => {
                                            const c = [...unitsData]; c[currentUnitIndex].email = e.target.value.trim(); setUnitsData(c);
                                        }} placeholder="joao@dromeflow" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">Whats Responsável</label>
                                        <input type="text" value={unitsData[currentUnitIndex].whatsapp_responsavel} onChange={e => {
                                            const c = [...unitsData]; c[currentUnitIndex].whatsapp_responsavel = e.target.value; setUnitsData(c);
                                        }} placeholder="(00) 00000-0000" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm" />
                                    </div>
                                </div>
                                
                                <div className="bg-white/5 rounded-xl p-4 space-y-4 border border-white/5">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Whatsapps da Unidade</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Whats Clientes</label>
                                            <input type="text" value={unitsData[currentUnitIndex].whatsapp_clientes} onChange={e => {
                                                const c = [...unitsData]; c[currentUnitIndex].whatsapp_clientes = e.target.value; setUnitsData(c);
                                            }} placeholder="(00) 00000-0000" className="w-full rounded-lg border border-white/10 bg-[#0B0F19] px-3 py-2 text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Whats Profissionais</label>
                                            <input type="text" value={unitsData[currentUnitIndex].whatsapp_profissionais} onChange={e => {
                                                const c = [...unitsData]; c[currentUnitIndex].whatsapp_profissionais = e.target.value; setUnitsData(c);
                                            }} placeholder="(00) 00000-0000" className="w-full rounded-lg border border-white/10 bg-[#0B0F19] px-3 py-2 text-sm" />
                                        </div>
                                    </div>
                                </div>

                                <button onClick={handleNextFromResponsible} className="w-full bg-accent-primary py-3.5 rounded-xl font-bold shadow-lg shadow-accent-primary/20 flex items-center justify-center gap-2">
                                    {numUnits > unitsData.length ? 'Configurar Próxima Unidade' : 'Finalizar Cadastro'}
                                    <Icon name="ArrowRight" className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Pergunta sobre Próxima Unidade (Dados) */}
                    {step === 4 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
                            <Icon name="Copy" className="w-12 h-12 text-accent-primary mx-auto opacity-50" />
                            <h2 className="text-xl font-bold">Configuração da {unitsData.length + 1}ª Unidade</h2>
                            <p className="text-gray-400">Os dados cadastrais (Razão Social, CNPJ, Endereço) são os mesmos da unidade anterior?</p>
                            <div className="flex gap-3">
                                <button onClick={() => handleNextUnitConfig(true)} className="flex-1 bg-white/10 hover:bg-white/20 py-4 rounded-xl font-bold border border-white/10">Sim, são os mesmos</button>
                                <button onClick={() => handleNextUnitConfig(false)} className="flex-1 bg-white/10 hover:bg-white/20 py-4 rounded-xl font-bold border border-white/10">Não, informar novos</button>
                            </div>
                        </div>
                    )}

                    {/* Step 5: Pergunta sobre Whatsapps */}
                    {step === 5 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
                            <Icon name="MessageSquare" className="w-12 h-12 text-accent-primary mx-auto opacity-50" />
                            <h2 className="text-xl font-bold">Whatsapps da {unitsData.length + 1}ª Unidade</h2>
                            <p className="text-gray-400">Os números de WhatsApp (Clientes e Profissionais) são os mesmos já informados?</p>
                            <div className="flex gap-3">
                                <button onClick={() => handleWhatsConfig(true)} className="flex-1 bg-white/10 hover:bg-white/20 py-4 rounded-xl font-bold border border-white/10">Sim, os mesmos</button>
                                <button onClick={() => handleWhatsConfig(false)} className="flex-1 bg-white/10 hover:bg-white/20 py-4 rounded-xl font-bold border border-white/10">Não, informar novos</button>
                            </div>
                        </div>
                    )}

                    {/* Step 6: Apenas Nome/Código (Tudo igual) */}
                    {step === 6 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-xl font-bold">Identificação da {currentUnitIndex + 1}ª Unidade</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Nome da Unidade</label>
                                    <input type="text" value={unitsData[currentUnitIndex].unit_name} onChange={e => {
                                        const c = [...unitsData]; c[currentUnitIndex].unit_name = e.target.value; setUnitsData(c);
                                    }} placeholder="Ex: DromeFlow Filial" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3" />
                                </div>
                                <button onClick={handleNextFromResponsible} className="w-full bg-accent-primary py-3.5 rounded-xl font-bold">Avançar</button>
                            </div>
                        </div>
                    )}

                    {/* Step 7: Apenas Whats (Base igual) */}
                    {step === 7 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-xl font-bold">Whatsapps da {currentUnitIndex + 1}ª Unidade</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Nome da Unidade</label>
                                    <input type="text" value={unitsData[currentUnitIndex].unit_name} onChange={e => {
                                        const c = [...unitsData]; c[currentUnitIndex].unit_name = e.target.value; setUnitsData(c);
                                    }} placeholder="Ex: DromeFlow Filial" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 mb-4" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Whats Clientes</label>
                                        <input type="text" value={unitsData[currentUnitIndex].whatsapp_clientes} onChange={e => {
                                            const c = [...unitsData]; c[currentUnitIndex].whatsapp_clientes = e.target.value; setUnitsData(c);
                                        }} placeholder="(00) 00000-0000" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Whats Profissionais</label>
                                        <input type="text" value={unitsData[currentUnitIndex].whatsapp_profissionais} onChange={e => {
                                            const c = [...unitsData]; c[currentUnitIndex].whatsapp_profissionais = e.target.value; setUnitsData(c);
                                        }} placeholder="(00) 00000-0000" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm" />
                                    </div>
                                </div>
                                <button onClick={handleNextFromResponsible} className="w-full bg-accent-primary py-3.5 rounded-xl font-bold">Avançar</button>
                            </div>
                        </div>
                    )}

                    {/* Step 8: Success & Payment */}
                    {step === 8 && (
                        <div className="space-y-6 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-500 py-6">
                            <div className="w-20 h-20 bg-success/20 text-success rounded-full flex items-center justify-center mb-2">
                                <Icon name="Check" className="w-10 h-10" />
                            </div>
                            <h2 className="text-2xl font-bold">Cadastro Realizado!</h2>
                            <p className="text-gray-400 max-w-sm">
                                Suas unidades foram configuradas com sucesso. Agora, finalize sua assinatura para liberar o acesso total ao sistema.
                            </p>
                            
                            <button 
                                onClick={async () => {
                                    if (selectedPlan?.payment_link) {
                                        // Notifica n8n que o usuário clicou para pagar
                                        try {
                                            fetch('https://app.paineldromedario.top/webhook/infinity-mb', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    event: 'access_payment',
                                                    unit_id: unitsData[0].id,
                                                    email: unitsData[0].email,
                                                    plan: selectedPlan?.name,
                                                    link: selectedPlan?.payment_link,
                                                    timestamp: new Date().toISOString()
                                                })
                                            });
                                        } catch(e) {}
                                        
                                        window.open(selectedPlan.payment_link, '_blank');
                                    } else {
                                        alert('Link de pagamento não encontrado. Entre em contato com o suporte.');
                                    }
                                }} 
                                className="mt-8 bg-accent-primary text-white px-10 py-5 rounded-xl font-bold text-xl shadow-xl shadow-accent-primary/25 hover:scale-105 transition-all flex items-center gap-3 border border-white/10"
                            >
                                Assinar Plano Agora <Icon name="ExternalLink" className="w-5 h-5" />
                            </button>
                            
                            <p className="mt-6 text-xs text-gray-500 max-w-xs">
                                Ao clicar, você será redirecionado para o ambiente seguro da InfinitePay.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RegistrationPage;
