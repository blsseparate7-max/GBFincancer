
import React, { useState, useMemo } from 'react';
import { Transaction, SavingGoal } from '../types';

interface ImpactSimulatorProps {
  transactions: Transaction[];
  goals: SavingGoal[];
}

const ImpactSimulator: React.FC<ImpactSimulatorProps> = ({ transactions, goals }) => {
  const [purchaseValue, setPurchaseValue] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  
  const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  const analysis = useMemo(() => {
    const val = parseFloat(purchaseValue) || 0;
    if (val <= 0) return null;

    const now = new Date();
    const curMonthT = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    
    const income = curMonthT.filter(t => t.type === 'INCOME').reduce((s,t) => s + t.amount, 0);
    const expense = curMonthT.filter(t => t.type === 'EXPENSE').reduce((s,t) => s + t.amount, 0);
    const availableNow = income - expense;
    
    // Capacidade média (últimos 3 meses)
    const historyMonths = [1, 2, 3].map(offset => {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const monthT = transactions.filter(td => {
        const tDate = new Date(td.date);
        return tDate.getMonth() === m && tDate.getFullYear() === y;
      });
      return monthT.filter(t => t.type === 'INCOME').reduce((s,t) => s + t.amount, 0) - 
             monthT.filter(t => t.type === 'EXPENSE').reduce((s,t) => s + t.amount, 0);
    }).filter(s => s !== 0);
    
    const capacidadeMedia = historyMonths.length > 0 ? historyMonths.reduce((a,b) => a+b, 0) / historyMonths.length : availableNow;
    const finalCapacidade = Math.max(0, capacidadeMedia);

    // Impacto nas Metas
    const activeGoals = goals.filter(g => g.ativa);
    const goalsImpact = activeGoals.map(g => {
      const faltanteOriginal = Math.max(0, g.targetAmount - g.currentAmount);
      const mesesOriginal = finalCapacidade > 0 ? Math.ceil(faltanteOriginal / finalCapacidade) : Infinity;
      
      // Simula o atraso: o valor gasto é "retirado" da capacidade de aporte deste mês ou rateado
      // Aqui consideramos que o valor gasto retarda o acúmulo total
      const mesesNovo = finalCapacidade > 0 ? Math.ceil((faltanteOriginal + val) / finalCapacidade) : Infinity;
      const atraso = mesesNovo - mesesOriginal;

      return { name: g.name, atraso, mesesTotal: mesesNovo };
    });

    const isRisky = val > availableNow;
    const isVeryRisky = val > (income * 0.5); // Mais de 50% do salário em uma compra

    return { availableNow, goalsImpact, isRisky, isVeryRisky, val };
  }, [purchaseValue, transactions, goals]);

  return (
    <div className="p-6 h-full overflow-y-auto bg-[#f8fafc] no-scrollbar pb-32">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-gray-900 tracking-tighter italic uppercase">Stress Test</h2>
        <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mt-1">Simulador de Impacto de Compra</p>
      </div>

      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 mb-6">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">O que você pretende comprar?</h3>
        <div className="space-y-4">
          <input 
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-emerald-500"
            placeholder="Ex: Novo iPhone, Viagem, Notebook..."
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
          <div className="relative">
            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 font-black">R$</span>
            <input 
              type="number"
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-12 py-4 text-xl font-black outline-none focus:border-emerald-500"
              placeholder="0,00"
              value={purchaseValue}
              onChange={e => setPurchaseValue(e.target.value)}
            />
          </div>
        </div>
      </div>

      {analysis ? (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
           {/* Veredito */}
           <div className={`p-8 rounded-[3rem] shadow-xl border-4 ${analysis.isVeryRisky ? 'bg-rose-50 border-rose-500 text-rose-900' : analysis.isRisky ? 'bg-amber-50 border-amber-500 text-amber-900' : 'bg-emerald-50 border-emerald-500 text-emerald-900'}`}>
              <h4 className="text-[10px] font-black uppercase tracking-widest mb-2">Veredito do GB</h4>
              <p className="text-2xl font-black italic tracking-tighter mb-4">
                {analysis.isVeryRisky ? '⚠️ Risco Altíssimo!' : analysis.isRisky ? '⚡ Atenção Necessária' : '✅ Compra Segura'}
              </p>
              <p className="text-sm font-bold leading-relaxed">
                {analysis.isVeryRisky 
                  ? `Esta compra de ${currency.format(analysis.val)} representa mais da metade da sua receita. Isso pode comprometer sua solvência.`
                  : analysis.isRisky 
                  ? `O valor excede sua sobra disponível hoje (${currency.format(analysis.availableNow)}). Você precisará usar reservas ou parcelar.`
                  : `Seu fluxo de caixa suporta esta compra sem comprometer o dia a dia.`}
              </p>
           </div>

           {/* Impacto nas Metas */}
           <div className="bg-slate-900 text-white p-8 rounded-[3rem] shadow-2xl">
              <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-6">Efeito Cascata nas Metas</h4>
              <div className="space-y-6">
                {analysis.goalsImpact.length > 0 ? analysis.goalsImpact.map(g => (
                  <div key={g.name} className="flex justify-between items-center border-b border-white/10 pb-4 last:border-0">
                    <div>
                      <p className="text-[9px] font-black uppercase text-gray-500">{g.name}</p>
                      <p className="text-sm font-bold">Atraso estimado:</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-black ${g.atraso > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {g.atraso > 0 ? `+${g.atraso} meses` : 'Sem impacto'}
                      </p>
                      <p className="text-[8px] font-black text-gray-500 uppercase">Conclusão em: {g.mesesTotal} meses</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-[10px] text-gray-400 italic text-center">Nenhuma meta ativa para análise.</p>
                )}
              </div>
           </div>
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-[3rem] border-4 border-dashed border-gray-50">
           <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest italic leading-relaxed">
             Insira um valor para ver como esta compra<br/>afeta sua Escada Patrimonial.
           </p>
        </div>
      )}
    </div>
  );
};

export default ImpactSimulator;
