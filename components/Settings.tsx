
import React from 'react';
import { UserSession } from '../types';
import { handleKiwifyRedirect } from '../services/checkoutService';
import { OAUTH_CONFIG } from '../constants';

interface SettingsProps {
  user: UserSession;
  onLogout: () => void;
}

const Settings: React.FC<SettingsProps> = ({ user, onLogout }) => {
  const checkoutId = OAUTH_CONFIG.KIWIFY_CHECKOUT_ID;

  return (
    <div className="p-6 space-y-6 animate-fade min-h-full">
      <header className="mb-8">
        <h2 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.4em] mb-1">Preferências de Sistema</h2>
        <h1 className="text-3xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter">Configurações</h1>
      </header>

      <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] overflow-hidden shadow-sm">
        <div className="p-5 border-b border-[var(--border)]">
          <h4 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-tighter">Sua Assinatura</h4>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-[var(--text-muted)] uppercase font-black tracking-widest">Status Atual</p>
              <p className={`text-xs font-black uppercase ${user.subscriptionStatus === 'active' ? 'text-[var(--green-whatsapp)]' : 'text-rose-500'}`}>
                {user.subscriptionStatus === 'active' ? 'Ativa' : user.subscriptionStatus === 'trial' ? 'Teste Grátis' : 'Inativa'}
              </p>
            </div>
            {user.subscriptionStatus !== 'active' && (
              <button 
                onClick={() => handleKiwifyRedirect(user.uid, checkoutId)}
                className="bg-[var(--green-whatsapp)] text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl shadow-lg shadow-[var(--green-whatsapp)]/20 active:scale-95 transition-all"
              >
                Assinar Agora
              </button>
            )}
          </div>
        </div>

        <div className="p-5 border-b border-[var(--border)] flex justify-between items-center">
          <div>
            <h4 className="text-sm font-bold text-[var(--text-primary)]">Notificações de Alerta</h4>
            <p className="text-[10px] text-[var(--text-muted)]">Avisar quando atingir 80% do limite</p>
          </div>
          <div className="w-10 h-5 bg-[var(--green-whatsapp)] rounded-full relative"><div className="w-4 h-4 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div></div>
        </div>

        <div className="p-5 border-b border-[var(--border)] flex justify-between items-center">
          <div>
            <h4 className="text-sm font-bold text-[var(--text-primary)]">Backup em Nuvem</h4>
            <p className="text-[10px] text-[var(--text-muted)]">Sincronização automática com Firebase</p>
          </div>
          <div className="w-10 h-5 bg-[var(--green-whatsapp)] rounded-full relative"><div className="w-4 h-4 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div></div>
        </div>

        <div className="p-5 border-b border-[var(--border)] flex justify-between items-center">
          <div>
            <h4 className="text-sm font-bold text-[var(--text-primary)]">Modo Escuro</h4>
            <p className="text-[10px] text-[var(--text-muted)]">O sistema está fixado no modo Premium Dark</p>
          </div>
          <div className="w-10 h-5 bg-[var(--green-whatsapp)] rounded-full relative"><div className="w-4 h-4 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div></div>
        </div>

        <div className="p-5 border-b border-[var(--border)]">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-sm font-bold text-[var(--text-primary)]">Moeda do Sistema</h4>
              <p className="text-[10px] text-[var(--text-muted)]">Selecione sua moeda preferida</p>
            </div>
            <select 
              className="bg-[var(--bg-body)] text-[var(--text-primary)] text-xs font-bold p-2 rounded-lg border border-[var(--border)] outline-none"
              defaultValue={user.currency || 'BRL'}
              onChange={async (e) => {
                const newCurrency = e.target.value;
                if (window.confirm("⚠️ ATENÇÃO: Mudar a moeda não converte os valores existentes. Todos os seus registros atuais permanecerão com os mesmos números, mas serão exibidos com o novo símbolo. Deseja continuar?")) {
                  const { syncUserData } = await import('../services/databaseService');
                  await syncUserData(user.uid, { currency: newCurrency });
                } else {
                  e.target.value = user.currency || 'BRL';
                }
              }}
            >
              <option value="BRL">R$ (Real)</option>
              <option value="USD">$ (Dólar)</option>
              <option value="EUR">€ (Euro)</option>
              <option value="GBP">£ (Libra)</option>
            </select>
          </div>
          <p className="mt-2 text-[9px] text-rose-500 font-bold uppercase tracking-tighter animate-pulse">
            * A mudança de moeda não realiza conversão de câmbio automática.
          </p>
        </div>
      </div>

      <button 
        onClick={onLogout}
        className="w-full bg-[var(--surface)] text-rose-500 font-black py-5 rounded-2xl border border-rose-500/20 shadow-sm uppercase tracking-widest text-xs"
      >
        Sair da Conta
      </button>

      <p className="text-center text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest italic opacity-40">GBFinancer Version 3.1.0-PRO</p>
    </div>
  );
};

export default Settings;
