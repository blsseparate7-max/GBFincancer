import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Info, Check } from 'lucide-react';
import { db } from '../services/firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { UserOnboarding } from '../types';

interface ContextualOnboardingProps {
  uid: string;
  activeTab: string;
  onboarding: UserOnboarding;
  setOnboarding: React.Dispatch<React.SetStateAction<UserOnboarding>>;
}

const ONBOARDING_CONTENT: Record<string, { title: string; description: string }> = {
  chat: {
    title: "Chat do Mentor",
    description: "Este é seu assistente financeiro. Você pode registrar gastos, entradas, mover categorias, consultar resumos e organizar sua vida financeira conversando."
  },
  dash: {
    title: "Dashboard",
    description: "Aqui você vê o resumo da sua vida financeira: entradas, saídas, sobra do mês e categorias de gastos."
  },
  goals: {
    title: "Metas",
    description: "Nesta área você cria objetivos financeiros, como guardar dinheiro para uma viagem ou reserva de emergência."
  },
  cc: {
    title: "Cartão de Crédito",
    description: "Aqui você controla seus gastos no cartão de crédito. As compras aparecem no extrato e viram despesa apenas quando você paga a fatura."
  },
  reminders: {
    title: "Lembretes",
    description: "Use os lembretes para não esquecer contas importantes. O sistema avisa antes do vencimento."
  },
  wallets: {
    title: "Carteira",
    description: "A carteira mostra onde seu dinheiro está guardado, como contas bancárias ou dinheiro físico."
  },
  insights: {
    title: "Insights",
    description: "Aqui você vê uma leitura da sua vida financeira e entende qual caminho seguir para melhorar."
  },
  stress: {
    title: "Simulador de Impacto",
    description: "Essa área mostra indicadores da sua vida financeira baseados no seu comportamento de gastos e permite simular cenários."
  },
  messages: {
    title: "Mensagens",
    description: "Aqui aparecem avisos importantes do sistema, alertas e lembretes."
  },
  resumo: {
    title: "Resumo Anual",
    description: "Nesta área você pode acompanhar o desempenho financeiro ao longo do ano."
  },
  extrato: {
    title: "Extrato",
    description: "Veja todas as suas transações detalhadas e filtre por período ou categoria."
  },
  categories: {
    title: "Categorias",
    description: "Gerencie suas categorias de gastos e ganhos para uma organização personalizada."
  },
  profile: {
    title: "Perfil",
    description: "Gerencie suas informações pessoais, altere sua foto e mantenha seus dados atualizados."
  },
  config: {
    title: "Configurações",
    description: "Ajuste as preferências do sistema e gerencie sua conta."
  }
};

const ContextualOnboarding: React.FC<ContextualOnboardingProps> = ({ uid, activeTab, onboarding, setOnboarding }) => {
  const content = ONBOARDING_CONTENT[activeTab];
  const hasSeen = onboarding[activeTab];

  if (!content || hasSeen) return null;

  const handleDismiss = async () => {
    try {
      const onboardingRef = doc(db, "users", uid, "onboarding", "flags");
      await setDoc(onboardingRef, { [activeTab]: true }, { merge: true });
      setOnboarding(prev => ({ ...prev, [activeTab]: true }));
    } catch (error) {
      console.error("Erro ao salvar onboarding:", error);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="fixed bottom-20 left-4 right-4 lg:left-auto lg:right-8 lg:w-80 z-[100] bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl p-5 overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-1 h-full bg-[var(--green-whatsapp)]" />
        
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-[var(--green-whatsapp)]/10 flex items-center justify-center shrink-0">
            <Info className="text-[var(--green-whatsapp)]" size={20} />
          </div>
          
          <div className="flex-1">
            <h4 className="text-sm font-black uppercase tracking-widest text-[var(--text-primary)] mb-1">
              {content.title}
            </h4>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-4">
              {content.description}
            </p>
            
            <button
              onClick={handleDismiss}
              className="w-full bg-[var(--green-whatsapp)] hover:bg-[var(--green-whatsapp-dark)] text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Check size={14} />
              Entendi
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ContextualOnboarding;
