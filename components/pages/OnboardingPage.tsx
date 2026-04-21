import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Rocket, 
  Zap, 
  Shield, 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  Building2, 
  User, 
  Mail, 
  Phone, 
  Globe, 
  CreditCard,
  ArrowRight,
  Search,
  Loader2,
  Lock,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

const PLANS = [
  {
    id: 'start',
    name: 'Drome Start',
    price: '497',
    features: [
      'Atendimento Digital',
      'Gestão de Agendas',
      'Dashboard Operacional',
      'Suporte via Chat',
      'Até 3 usuários'
    ],
    color: 'from-blue-600/20 to-cyan-600/20',
    borderColor: 'border-blue-500/30',
    hoverBorder: 'hover:border-blue-500/50',
    icon: Rocket
  },
  {
    id: 'pro',
    name: 'Drome Pro',
    price: '997',
    popular: true,
    features: [
      'Todos do Start',
      'Integração n8n Ilimitada',
      'Múltiplas Unidades',
      'Relatórios Avançados',
      'IA para Atendimento',
      'Suporte Prioritário'
    ],
    color: 'from-purple-600/20 to-pink-600/20',
    borderColor: 'border-purple-500/30',
    hoverBorder: 'hover:border-purple-500/50',
    icon: Zap
  },
  {
    id: 'enterprise',
    name: 'Drome Enterprise',
    price: '1.997',
    features: [
      'Todos do Pro',
      'Infraestrutura Dedicada',
      'Gerente de Conta',
      'API Personalizada',
      'SLA de 99.9%',
      'Treinamento VIP'
    ],
    color: 'from-amber-600/20 to-orange-600/20',
    borderColor: 'border-orange-500/30',
    hoverBorder: 'hover:border-orange-500/50',
    icon: Shield
  }
];

const STAGES = ['plan', 'unit', 'user', 'config'] as const;
type Stage = typeof STAGES[number];

export default function OnboardingPage() {
  const [stage, setStage] = useState<Stage>('plan');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<typeof PLANS[0] | null>(null);
  
  const [unitData, setUnitData] = useState({
    cnpj: '',
    name: '',
    address: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    cep: ''
  });

  const [userData, setUserData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: ''
  });

  // Função auxiliar para capitalizar texto vindo da API
  const formatToCapitalized = (text: string) => {
    if (!text) return '';
    return text
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const handleFetchCNPJ = async (cnpjValue: string) => {
    if (cnpjValue.replace(/\D/g, '').length !== 14) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjValue.replace(/\D/g, '')}`);
      if (!response.ok) throw new Error('Cnpj não encontrado');
      const data = await response.json();
      
      setUnitData(prev => ({
        ...prev,
        name: `MB ${formatToCapitalized(data.municipio)}`,
        cnpj: data.cnpj,
        address: formatToCapitalized(data.logradouro),
        number: data.numero,
        complement: formatToCapitalized(data.complemento),
        neighborhood: formatToCapitalized(data.bairro),
        city: formatToCapitalized(data.municipio),
        state: data.uf,
        cep: data.cep
      }));
      toast.success('Dados da empresa recuperados!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao buscar CNPJ. Verifique o número e tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalize = async () => {
    setIsLoading(true);
    try {
      // 1. Criar o lead na tabela comercial_admin
      const { data: lead, error: leadError } = await supabase
        .from('comercial_admin')
        .insert([
          {
            full_name: userData.fullName,
            email: userData.email,
            phone: userData.phone,
            unit_name: unitData.name,
            cnpj: unitData.cnpj,
            plan: selectedPlan?.id,
            status: 'aguardando',
            endereco: `${unitData.address} ${unitData.number} ${unitData.complement || ''} ${unitData.neighborhood} ${unitData.city} ${unitData.state} ${unitData.cep}`.replace(/\s+/g, ' ').trim(),
            metadata: {
              raw_unit: unitData,
              raw_user: { ...userData, password: '[PROTECTED]' }
            }
          }
        ])
        .select()
        .single();

      if (leadError) throw leadError;

      // 2. Chamar Webhook de Notificação n8n
      try {
        await fetch('https://n8n.webhook.dromeflow.com/webhook/onboarding-wizard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'onboarding_completed',
            lead_id: lead.id,
            plan: selectedPlan?.name,
            unit: unitData.name,
            customer: userData.fullName
          })
        });
      } catch (e) {
        console.warn('Webhook notification failed, but lead was saved.');
      }

      // 3. Redirecionar para Pagamento (InfinitePay Web SDK ou Checkout Link)
      toast.success('Cadastro realizado! Redirecionando para pagamento...');
      
      setTimeout(() => {
        const checkoutUrl = selectedPlan?.id === 'enterprise'
          ? 'https://wa.me/5511999999999'
          : `https://pay.infinitepay.io/dromeflow/${selectedPlan?.price}`;
        
        window.location.href = checkoutUrl;
      }, 2000);

    } catch (error: any) {
      toast.error('Erro ao finalizar cadastro: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white flex flex-col font-sans selection:bg-blue-500/30">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Rocket className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">Drome<span className="text-blue-500">Flow</span></span>
        </div>
        
        <div className="flex items-center gap-2">
          {STAGES.map((s, idx) => (
            <React.Fragment key={s}>
              <div 
                className={`w-2 h-2 rounded-full transition-all duration-500 ${
                  STAGES.indexOf(stage) >= idx ? 'bg-blue-500 scale-125 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-white/10'
                }`}
              />
              {idx < STAGES.length - 1 && (
                <div className={`w-8 h-[1px] ${STAGES.indexOf(stage) > idx ? 'bg-blue-500/50' : 'bg-white/10'}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center p-6 pb-20">
        <AnimatePresence mode="wait">
          {stage === 'plan' && (
            <motion.div
              key="plan"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-6xl w-full"
            >
              <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/50">
                  Escolha o plano ideal
                </h1>
                <p className="text-white/40 text-lg max-w-2xl mx-auto">
                  Soluções pensadas para escalar o seu negócio de estética e bem-estar.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {PLANS.map((plan) => (
                  <Card 
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan)}
                    className={`relative group cursor-pointer overflow-hidden bg-white/5 border-white/10 transition-all duration-300 hover:bg-white/[0.08] ${
                      selectedPlan?.id === plan.id ? 'ring-2 ring-blue-500 bg-white/[0.1]' : ''
                    }`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${plan.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                    
                    <div className="relative p-8 flex flex-col h-full">
                      {plan.popular && (
                        <div className="absolute top-4 right-4 bg-blue-500 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg shadow-blue-500/20">
                          Mais Popular
                        </div>
                      )}

                      <plan.icon className="w-12 h-12 text-blue-500 mb-6" />
                      
                      <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                      <div className="flex items-baseline gap-1 mb-8">
                        <span className="text-4xl font-bold">R$ {plan.price}</span>
                        <span className="text-white/40">/mês</span>
                      </div>

                      <div className="space-y-4 mb-8 flex-1">
                        {plan.features.map((feature) => (
                          <div key={feature} className="flex items-start gap-3 text-sm text-white/60">
                            <CheckCircle2 className="w-5 h-5 text-blue-500/50 shrink-0" />
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>

                      <Button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPlan(plan);
                          setStage('unit');
                        }}
                        className={`w-full group/btn ${
                          selectedPlan?.id === plan.id 
                            ? 'bg-blue-600 hover:bg-blue-700' 
                            : 'bg-white/10 hover:bg-white/20'
                        }`}
                      >
                        Selecionar Plano
                        <ChevronRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {stage === 'unit' && (
            <motion.div
              key="unit"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-md w-full"
            >
              <Card className="p-8 bg-white/5 border-white/10 backdrop-blur-xl">
                <div className="mb-8">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4">
                    <Building2 className="w-6 h-6 text-blue-500" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Dados da Unidade</h2>
                  <p className="text-white/40">Precisamos de algumas informações da sua empresa.</p>
                </div>

                <div className="space-y-6">
                  <div>
                    <Label htmlFor="cnpj" className="text-white/70 italic mb-2 block">CNPJ</Label>
                    <div className="relative">
                      <Input
                        id="cnpj"
                        placeholder="00.000.000/0000-00"
                        value={unitData.cnpj}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setUnitData({ ...unitData, cnpj: val });
                          if (val.length === 14) handleFetchCNPJ(val);
                        }}
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30 pr-10"
                      />
                      {isLoading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="unit_name" className="text-white/70 italic mb-2 block">Nome da Unidade (Como aparecerá no sistema)</Label>
                    <Input
                      id="unit_name"
                      placeholder="MB nome cidade"
                      value={unitData.name}
                      onChange={(e) => setUnitData({ ...unitData, name: e.target.value })}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>

                  <div className="pt-4 flex gap-3">
                    <Button 
                      variant="ghost" 
                      onClick={() => setStage('plan')}
                      className="flex-1 hover:bg-white/5"
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Voltar
                    </Button>
                    <Button 
                      disabled={!unitData.cnpj || !unitData.name || isLoading}
                      onClick={() => setStage('user')}
                      className="flex-[2] bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20"
                    >
                      Próximo Step
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {stage === 'user' && (
            <motion.div
              key="user"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-md w-full"
            >
              <Card className="p-8 bg-white/5 border-white/10 backdrop-blur-xl">
                <div className="mb-8">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4">
                    <User className="w-6 h-6 text-purple-500" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Seu Perfil</h2>
                  <p className="text-white/40">Você será o administrador principal desta unidade.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-white/70 italic mb-2 block">Nome Completo</Label>
                    <Input
                      value={userData.fullName}
                      onChange={(e) => setUserData({ ...userData, fullName: e.target.value })}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                      placeholder="Como deseja ser chamado"
                    />
                  </div>

                  <div>
                    <Label className="text-white/70 italic mb-2 block">Email Comercial</Label>
                    <Input
                      type="email"
                      value={userData.email}
                      onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                      placeholder="seu@email.com"
                    />
                  </div>

                  <div>
                    <Label className="text-white/70 italic mb-2 block">WhatsApp de Contato</Label>
                    <Input
                      value={userData.phone}
                      onChange={(e) => setUserData({ ...userData, phone: e.target.value })}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                      placeholder="(00) 00000-0000"
                    />
                  </div>

                  <div className="pt-4 flex gap-3">
                    <Button 
                      variant="ghost" 
                      onClick={() => setStage('unit')}
                      className="flex-1 hover:bg-white/5"
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Voltar
                    </Button>
                    <Button 
                      disabled={!userData.email || !userData.fullName}
                      onClick={() => setStage('config')}
                      className="flex-[2] bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20"
                    >
                      Revisar Dados
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {stage === 'config' && (
            <motion.div
              key="config"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl w-full"
            >
              <Card className="p-8 bg-white/5 border-white/10 backdrop-blur-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  <CheckCircle2 className="w-48 h-48 text-blue-500" />
                </div>

                <div className="mb-8">
                  <h2 className="text-3xl font-bold mb-2">Tudo pronto!</h2>
                  <p className="text-white/40">Revise os detalhes antes de assinar.</p>
                </div>

                <div className="space-y-8 relative z-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div>
                        <Label className="text-blue-500 text-[10px] font-bold uppercase tracking-wider mb-2 block">Plano Selecionado</Label>
                        <div className="flex items-center gap-3">
                          <selectedPlan.icon className="w-5 h-5 text-white/60" />
                          <span className="text-lg font-semibold">{selectedPlan?.name}</span>
                          <span className="text-blue-500 font-bold">R$ {selectedPlan?.price}/mês</span>
                        </div>
                      </div>

                      <div>
                        <Label className="text-blue-500 text-[10px] font-bold uppercase tracking-wider mb-2 block">Unidade</Label>
                        <p className="text-lg font-semibold">{unitData.name}</p>
                        <p className="text-white/40 text-sm">{unitData.cnpj}</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <Label className="text-blue-500 text-[10px] font-bold uppercase tracking-wider mb-2 block">Administrador</Label>
                        <p className="text-lg font-semibold">{userData.fullName}</p>
                        <p className="text-white/40 text-sm">{userData.email}</p>
                      </div>

                      <div>
                        <Label className="text-blue-500 text-[10px] font-bold uppercase tracking-wider mb-2 block">Localização</Label>
                        <p className="text-sm text-white/60">
                          {unitData.address}, {unitData.number}<br />
                          {unitData.neighborhood} - {unitData.city}/{unitData.state}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 flex flex-col gap-4">
                    <Button 
                      disabled={isLoading}
                      onClick={handleFinalize}
                      className="w-full h-14 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-xl shadow-blue-500/20"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                          Finalizando...
                        </>
                      ) : (
                        <>
                          Ativar Agora e Pagar
                          <ArrowRight className="w-5 h-5 ml-2" />
                        </>
                      )}
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={() => setStage('user')}
                      className="hover:bg-white/5"
                    >
                      Alterar informações
                    </Button>
                  </div>

                  <p className="text-center text-[10px] text-white/20 uppercase tracking-[0.2em]">
                    Pagamento seguro via InfinitePay • Cancelamento a qualquer momento
                  </p>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="relative z-10 p-8 border-t border-white/5 bg-black/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-white/30">
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-white transition-colors">Termos de Uso</a>
            <a href="#" className="hover:text-white transition-colors">Privacidade</a>
            <a href="#" className="hover:text-white transition-colors">Suporte</a>
          </div>
          <p>© 2024 DromeFlow by Dromedário Group. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
