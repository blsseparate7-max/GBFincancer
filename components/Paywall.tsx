
import React, { useState } from 'react';
import { UserSession } from '../types';
import { subscribeWithAsaas } from '../services/checkoutService';
import { OAUTH_CONFIG } from '../constants';

interface PaywallProps {
  user: UserSession;
  onLogout: () => void;
}

const Paywall: React.FC<PaywallProps> = ({ user, onLogout }) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [showCpfInput, setShowCpfInput] = useState(false);
  const [cpf, setCpf] = useState(user.cpfCnpj || '');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const cleanCpfCnpj = (val: string) => val.replace(/\D/g, '');

  const validateCpf = (val: string) => {
    const clean = cleanCpfCnpj(val);
    return clean.length === 11 || clean.length === 14;
  };

  const handleSubscribe = async () => {
    setIsLoading(true);
    setError('');

    try {
      await subscribeWithAsaas(
        { ...user, cpfCnpj: cleanCpfCnpj(cpf || user.cpfCnpj || '') }, 
        'mensal',
        () => setShowCpfInput(true)
      );
    } catch (err: any) {
      setError(err.message || 'Erro ao processar checkout');
    } finally {
      setIsLoading(false);
    }
  };

  if (showCpfInput) {
    return (
      <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-[var(--bg-body)]/90 backdrop-blur-md">
        <div className="w-full max-w-[420px] bg-[var(--surface)] p-8 rounded-[2.5rem] shadow-2xl border border-[var(--border)] text-center animate-in zoom-in">
          <h2 className="text-xl font-black text-[var(--text-primary)] uppercase mb-4">Dados Necessários</h2>
          <p className="text-sm text-[var(--text-muted)] mb-6">Pelo Banco Central do Brasil, o Asaas exige o seu CPF ou CNPJ para gerar a cobrança segura.</p>
          
          <input 
            type="text" 
            placeholder="CPF ou CNPJ"
            value={cpf}
            onChange={(e) => {
              setCpf(e.target.value);
              setError('');
            }}
            className={`w-full bg-[var(--bg-body)] border ${error ? 'border-rose-500' : 'border-[var(--border)]'} rounded-2xl p-4 text-center font-bold text-lg mb-2 focus:border-[var(--green-whatsapp)] outline-none transition-all`}
          />
          {error && <p className="text-rose-500 text-xs font-bold mb-4">{error}</p>}
          
          <div className="space-y-3 mt-6">
            <button 
              onClick={handleSubscribe}
              disabled={isLoading}
              className={`w-full bg-[var(--green-whatsapp)] text-white font-black py-4 rounded-2xl text-[12px] uppercase tracking-[0.2em] shadow-xl ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isLoading ? 'Processando...' : 'Continuar para Pagamento'}
            </button>
            <button 
              onClick={() => setShowCpfInput(false)}
              disabled={isLoading}
              className="w-full text-[var(--text-muted)] font-bold py-2 text-[10px] uppercase tracking-[0.1em] disabled:opacity-30"
            >
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isDismissed) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-[1000] p-4 animate-slide-up">
        <div className="bg-rose-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 border border-white/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-black italic">!</div>
            <p className="text-[10px] font-black uppercase tracking-widest">Acesso Expirado - Assine para liberar todas as funções</p>
          </div>
          <button 
            onClick={handleSubscribe}
            className="bg-white text-rose-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg"
          >
            Assinar Agora
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-[var(--bg-body)]/90 backdrop-blur-md overflow-hidden">
      <div className="absolute inset-0 whatsapp-pattern opacity-[0.03] pointer-events-none"></div>

      <div className="w-full max-w-[420px] relative z-10 animate-fade text-center">
        <div className="w-20 h-20 bg-rose-500 rounded-[2.2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-rose-500/20 text-white text-4xl font-black italic transform -rotate-3 border-4 border-white/10">
          !
        </div>
        
        <div className="bg-[var(--surface)] p-8 rounded-[2.5rem] shadow-2xl border border-[var(--border)] backdrop-blur-sm">
          <header className="mb-8">
            <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-tight uppercase">Seu acesso expirou</h2>
            <p className="text-sm text-[var(--text-muted)] font-medium mt-3 leading-relaxed">
              Seu período de teste terminou ou sua assinatura não está ativa. 
              Assine agora para continuar usando o sistema e manter sua vida financeira organizada.
            </p>
          </header>

          <div className="space-y-4">
            <button 
              onClick={handleSubscribe}
              disabled={isLoading}
              className="w-full bg-[var(--green-whatsapp)] text-white font-black py-4 rounded-2xl text-[12px] uppercase tracking-[0.2em] shadow-xl shadow-[var(--green-whatsapp)]/10 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isLoading ? 'Carregando...' : 'Assinar agora'}
            </button>
            {error && <p className="text-rose-500 text-[10px] font-black uppercase mt-2">{error}</p>}

            <button 
              onClick={() => setIsDismissed(true)}
              className="w-full bg-[var(--bg-body)] text-[var(--text-primary)] font-bold py-3 rounded-2xl text-[10px] uppercase tracking-[0.1em] hover:bg-[var(--surface-hover)] transition-all border border-[var(--border)]"
            >
              Apenas visualizar (Limitado)
            </button>

            <button 
              onClick={onLogout}
              className="w-full bg-transparent text-[var(--text-muted)] font-bold py-2 rounded-2xl text-[10px] uppercase tracking-[0.1em] hover:text-[var(--text-primary)] transition-all"
            >
              Sair da conta
            </button>
          </div>
        </div>

        <p className="mt-8 text-[10px] font-black text-[var(--text-muted)]/40 uppercase tracking-widest">
          Dúvidas? Entre em contato com nosso suporte.
        </p>
      </div>
    </div>
  );
};

export default Paywall;
