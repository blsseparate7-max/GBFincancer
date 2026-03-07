
import React from 'react';

interface LegalModalProps {
  type: 'terms' | 'privacy' | 'none';
  onClose: () => void;
}

const LegalModal: React.FC<LegalModalProps> = ({ type, onClose }) => {
  if (type === 'none') return null;

  const title = type === 'terms' ? 'Termos de Uso' : 'Política de Privacidade';
  const content = type === 'terms' ? (
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
        <div className="flex-1 overflow-y-auto pr-2 mb-6">
          {content}
        </div>
        <button 
          onClick={onClose}
          className="w-full bg-[#202C33] text-[#E9EDEF] font-black py-4 rounded-2xl uppercase tracking-widest text-[10px]"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};

export default LegalModal;
