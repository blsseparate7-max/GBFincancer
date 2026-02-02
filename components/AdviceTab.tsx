
import React, { useMemo } from 'react';
import { Transaction, SavingGoal } from '../types';

interface AdviceTabProps {
  transactions: Transaction[];
  goals: SavingGoal[];
}

interface AdviceMessage {
  tipo: 'motivacao' | 'alerta' | 'acao' | 'educacao' | 'reflexao';
  texto: string;
}

const AdviceTab: React.FC<AdviceTabProps> = ({ transactions, goals }) => {
  
  const generateScoreMessages = (input: {
    score: number;
    sobraPct: number;
    entradasMes: number;
    saidasMes: number;
    maiorCat: { nome: string; pct: number };
    metaAtiva: boolean;
    metaNome: string;
  }): AdviceMessage[] => {
    const { score, sobraPct, maiorCat, metaAtiva, metaNome } = input;
    const format = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    if (input.entradasMes <= 0) {
      return [
        { tipo: 'motivacao', texto: "Oi, vamos começar? O primeiro passo para a paz financeira é a clareza. Registre sua primeira entrada (salário ou saldo) no chat." },
        { tipo: 'reflexao', texto: "O dinheiro é uma ferramenta, não um fim. Como você se sente hoje em relação às suas finanças?" },
        { tipo: 'acao', texto: "Ação: Liste mentalmente seus 3 maiores gastos fixos. Saber onde o dinheiro 'mora' reduz a ansiedade." },
        { tipo: 'educacao', texto: "O Score GB mede sua eficiência do mês: o quanto sobra do que entra. É um termômetro da sua liberdade." },
        { tipo: 'acao', texto: "Ação: Digite 'Resumo' no chat para eu te mostrar como está seu cenário inicial." }
      ];
    }

    // A) CRÍTICO (0-39)
    if (score < 40) {
      return [
        { tipo: 'motivacao', texto: "Respira. Esse score é só o termômetro deste mês, não define quem você é. Vamos ajustar o básico juntos?" },
        { tipo: 'motivacao', texto: "Ninguém constrói segurança na culpa. O objetivo aqui é te dar leveza, um passo de cada vez." },
        { tipo: 'acao', texto: `Ação: Pelos próximos 7 dias, anote cada real gasto. Ver para onde o dinheiro foge é o primeiro degrau para o controle.` },
        { tipo: 'acao', texto: `Ação: Vamos tentar reduzir 15% da categoria "${maiorCat.nome}" esta semana? Isso já muda o jogo do seu saldo.` },
        { tipo: 'reflexao', texto: "Muitas vezes o gasto impulsivo é uma resposta ao cansaço ou estresse. Como você estava se sentindo antes do último gasto?" }
      ];
    }

    // B) ATENÇÃO (40-59)
    if (score < 60) {
      return [
        { tipo: 'motivacao', texto: "Você já está acompanhando e registrando. Isso é 50% da vitória! O controle real já começou." },
        { tipo: 'acao', texto: `Ação: Para subir sua sobra de ${sobraPct.toFixed(1)}%, tente o desafio do 'Dia Zero Gastos' duas vezes na semana.` },
        { tipo: 'acao', texto: `Ação: Ajustar o limite de "${maiorCat.nome}" em R$ 50 já aumenta sua nota e sua paz no fim do mês.` },
        { tipo: 'educacao', texto: "Sobra financeira é tempo comprado. Cada real que fica com você é um minuto a mais de liberdade no seu futuro." },
        { tipo: 'motivacao', texto: "O hábito de olhar os números todo dia reduz a ansiedade. É como acender a luz em um quarto que estava escuro." }
      ];
    }

    // C) BOM (60-79)
    if (score < 80) {
      return [
        { tipo: 'motivacao', texto: "Boa! Seu sistema está equilibrado. Você está gastando menos do que ganha com consistência." },
        { tipo: 'acao', texto: metaAtiva ? `Ação: Que tal um extra na meta "${metaNome}"? Pequenos aportes aceleram muito sua rota de patrimônio.` : "Ação: Que tal definir uma meta de economia? Ter um 'para quê' guarda mais dinheiro que 'ter por ter'." },
        { tipo: 'acao', texto: `Ação: "${maiorCat.nome}" representa ${maiorCat.pct.toFixed(0)}% do seu gasto. Se baixar 5%, sua sobra vai para outro patamar.` },
        { tipo: 'acao', texto: "Estratégia: Se sobrar um valor extra, destine metade para o seu lazer e metade para sua reserva. Equilíbrio é a chave da constância." },
        { tipo: 'reflexao', texto: "Progresso é melhor que perfeição. Comemore a jornada: você já faz parte do grupo que planeja o futuro." }
      ];
    }

    // D) EXCELENTE (80-100)
    return [
      { tipo: 'motivacao', texto: `Parabéns! Sua eficiência está em ${score} pontos. Uma sobra de ${sobraPct.toFixed(1)}% é sinal de um hábito muito maduro.` },
      { tipo: 'alerta', texto: "Cuidado com a 'inflação de estilo de vida'. Conforme sua saúde financeira melhora, a tentação de gastar mais também sobe." },
      { tipo: 'acao', texto: "Manutenção: Mantenha sua rotina de registros. O autocontrole é um músculo que precisa de treino contínuo, mesmo no topo." },
      { tipo: 'educacao', texto: "Com essa saúde, você pode focar em metas de longo prazo com mais agressividade. O tempo agora joga a seu favor." },
      { tipo: 'reflexao', texto: "Identidade Financeira: Você não é mais alguém que 'tenta' se organizar. Você É alguém organizado. Honre essa nova versão." }
    ];
  };

  const processedData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyT = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const entradas = monthlyT.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
    const saidas = monthlyT.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
    const sobraMes = entradas - saidas;
    const sobraPct = entradas > 0 ? (sobraMes / entradas) * 100 : 0;

    let score = 0;
    if (entradas > 0) {
      if (sobraPct >= 30) score = 100;
      else if (sobraPct >= 20) score = 90;
      else if (sobraPct >= 10) score = 75;
      else if (sobraPct >= 5) score = 60;
      else if (sobraPct >= 0) score = 45;
      else if (sobraPct > -10) score = 25;
      else score = 10;
    }

    const catMap: Record<string, number> = {};
    monthlyT.filter(t => t.type === 'EXPENSE').forEach(t => {
      catMap[t.category] = (catMap[t.category] || 0) + t.amount;
    });
    const sortedCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
    const maiorCat = { 
      nome: sortedCats[0]?.[0] || 'Outros', 
      pct: (sortedCats[0]?.[1] || 0) / (saidas || 1) * 100 
    };

    const activeGoal = goals[0];

    return {
      score,
      sobraPct,
      entradasMes: entradas,
      saidasMes: saidas,
      maiorCat,
      metaAtiva: !!activeGoal,
      metaNome: activeGoal?.name || ''
    };
  }, [transactions, goals]);

  const messages = useMemo(() => generateScoreMessages(processedData), [processedData]);

  const getIcon = (tipo: AdviceMessage['tipo']) => {
    switch (tipo) {
      case 'motivacao': return '🌱';
      case 'alerta': return '⚠️';
      case 'acao': return '⚡';
      case 'educacao': return '📚';
      case 'reflexao': return '🧠';
      default: return '💬';
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto bg-[#f8fafc] no-scrollbar pb-32 flex flex-col items-center">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-black text-gray-900 tracking-tighter italic uppercase">Mensagens</h2>
          <p className="text-[10px] text-emerald-600 font-black uppercase tracking-[0.2em] mt-1">Estratégia & Hábito</p>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2 px-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-950 flex items-center justify-center border-2 border-emerald-500/50 shadow-xl">
              <span className="text-xs font-black text-emerald-500 italic">GB</span>
            </div>
            <div>
              <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Consultoria Humanizada</h4>
              <p className="text-[8px] font-bold text-emerald-600 uppercase">Saúde Financeira: {processedData.score} pts</p>
            </div>
          </div>

          <div className="whatsapp-bg p-5 rounded-[3rem] shadow-inner border border-black/5 space-y-4">
            {messages.map((msg, i) => (
              <div 
                key={i} 
                className="bg-white p-5 rounded-3xl rounded-tl-none shadow-md relative animate-in slide-in-from-left duration-500 border border-slate-50"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl shrink-0 mt-0.5">{getIcon(msg.tipo)}</span>
                  <div className="flex-1">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{msg.tipo}</p>
                    <p className="text-sm font-bold text-slate-700 leading-relaxed">
                      {msg.texto}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1 mt-3">
                  <span className="text-[8px] text-gray-300 font-black uppercase">GB AUDITORIA</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
              </div>
            ))}
          </div>
          
          <div className="bg-white p-6 rounded-[2.5rem] border border-dashed border-gray-200 shadow-sm mt-4">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest text-center leading-relaxed">
              Conselhos gerados por inteligência comportamental.<br/>O foco é o seu bem-estar, não apenas os números.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdviceTab;
