
import React, { useState } from 'react';
import { ShieldCheck, ExternalLink, CheckCircle2 } from 'lucide-react';

interface LGPDOnboardingProps {
  onAccept: () => void;
}

const LGPDOnboarding: React.FC<LGPDOnboardingProps> = ({ onAccept }) => {
  const [accepted, setAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState<'none' | 'terms' | 'privacy'>('none');

  const handleAccept = () => {
    if (accepted) {
      onAccept();
    }
  };

  const renderModal = () => {
    if (showTerms === 'none') return null;

    const title = showTerms === 'terms' ? 'Termos de Uso' : 'Política de Privacidade';
    const content = showTerms === 'terms' ? (
      <div className="space-y-4 text-sm text-[#8696A0] leading-relaxed">
        <p><strong>1. Aceitação dos Termos</strong></p>
        <p>Ao acessar o GBFinancer, você concorda em cumprir estes termos de serviço, todas as leis e regulamentos aplicáveis.</p>
        <p><strong>2. Uso do Sistema</strong></p>
        <p>O sistema é uma ferramenta de auxílio financeiro. As decisões tomadas com base nas análises do sistema são de inteira responsabilidade do usuário.</p>
        <p><strong>3. Responsabilidade</strong></p>
        <p>O GBFinancer não se responsabiliza por perdas financeiras decorrentes do uso inadequado da ferramenta ou falhas de conexão.</p>
      </div>
    ) : (
      <div className="space-y-4 text-sm text-[#8696A0] leading-relaxed">
        <p><strong>1. Coleta de Dados</strong></p>
        <p>Coletamos dados financeiros (transações, metas, contas) fornecidos voluntariamente por você para gerar análises personalizadas.</p>
        <p><strong>2. Segurança</strong></p>
        <p>Seus dados são criptografados e armazenados em servidores seguros. Não vendemos seus dados para terceiros.</p>
        <p><strong>3. Seus Direitos</strong></p>
        <p>Você tem o direito de acessar, corrigir ou excluir seus dados a qualquer momento através das configurações do perfil.</p>
      </div>
    );

    return (
      <div className="fixed inset-0 z-[6000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
        <div className="bg-[#111B21] w-full max-w-md rounded-[2.5rem] p-8 border border-[#2A3942] shadow-2xl flex flex-col max-h-[80vh]">
          <h3 className="text-xl font-black text-[#E9EDEF] uppercase tracking-tighter mb-6">{title}</h3>
          <div className="flex-1 overflow-y-auto no-scrollbar pr-2 mb-6">
            {content}
          </div>
          <button 
            onClick={() => setShowTerms('none')}
            className="w-full bg-[#202C33] text-[#E9EDEF] font-black py-4 rounded-2xl uppercase tracking-widest text-[10px]"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-[#0B141A] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      <div className="absolute inset-0 whatsapp-pattern opacity-[0.03] pointer-events-none"></div>
      
      <div className="relative z-10 w-full max-w-md bg-[#111B21] rounded-[3rem] shadow-2xl p-10 border border-[#2A3942]/60 flex flex-col animate-in fade-in zoom-in-95 duration-500">
        <div className="w-20 h-20 bg-[#00A884]/10 text-[#00A884] rounded-[2rem] flex items-center justify-center mx-auto mb-8 border border-[#00A884]/20 shadow-2xl shadow-[#00A884]/10">
          <ShieldCheck size={40} />
        </div>

        <div className="text-center space-y-4 mb-10">
          <h2 className="text-2xl font-black text-[#E9EDEF] uppercase tracking-tighter leading-tight">Segurança e Privacidade dos seus dados</h2>
          <div className="space-y-4 text-sm text-[#8696A0] leading-relaxed">
            <p>
              O <span className="text-[#00A884] font-black">GBFinancer</span> utiliza suas informações financeiras apenas para organizar seus dados, gerar análises e melhorar sua experiência dentro do aplicativo.
            </p>
            <p>
              Seus dados são protegidos e não são vendidos ou compartilhados com terceiros.
            </p>
            <p>
              Você pode solicitar a exclusão da sua conta e dados a qualquer momento.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <label className="flex items-start gap-4 cursor-pointer group">
            <div className="relative flex items-center mt-1">
              <input 
                type="checkbox" 
                className="sr-only" 
                checked={accepted} 
                onChange={() => setAccepted(!accepted)} 
              />
              <div className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center ${accepted ? 'bg-[#00A884] border-[#00A884]' : 'bg-[#202C33] border-[#2A3942] group-hover:border-[#00A884]'}`}>
                {accepted && <CheckCircle2 size={16} className="text-white" />}
              </div>
            </div>
            <span className="text-xs text-[#8696A0] font-bold leading-relaxed">
              Li e concordo com os{' '}
              <button onClick={() => setShowTerms('terms')} className="text-[#00A884] hover:underline inline-flex items-center gap-1">Termos de Uso <ExternalLink size={10} /></button>
              {' '}e{' '}
              <button onClick={() => setShowTerms('privacy')} className="text-[#00A884] hover:underline inline-flex items-center gap-1">Política de Privacidade <ExternalLink size={10} /></button>.
            </span>
          </label>

          <button 
            disabled={!accepted}
            onClick={handleAccept}
            className={`w-full font-black py-6 rounded-2xl shadow-xl transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-3 ${
              accepted 
                ? 'bg-[#00A884] text-white active:scale-95' 
                : 'bg-[#202C33] text-[#8696A0] cursor-not-allowed opacity-50'
            }`}
          >
            Continuar para o app
          </button>
        </div>
      </div>

      {renderModal()}
    </div>
  );
};

export default LGPDOnboarding;
