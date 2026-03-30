
import React, { useMemo, useState } from 'react';
import { Transaction, SavingGoal } from '../types';
import { jsPDF } from 'jspdf';
import { FileDown, Loader2 } from 'lucide-react';

interface ReportsProps {
  transactions: Transaction[];
  goals: SavingGoal[];
}

const Reports: React.FC<ReportsProps> = ({ transactions }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const format = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const reportData = useMemo(() => {
    // Cálculo de balanço real a partir do zero
    const totalIncome = transactions
      .filter(t => t.type === 'INCOME')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
      
    const totalExpense = transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    
    const monthlyGroups: Record<string, { income: number; expense: number }> = {};
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    
    transactions.forEach(t => {
      const date = new Date(t.date);
      const key = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      if (!monthlyGroups[key]) monthlyGroups[key] = { income: 0, expense: 0 };
      
      if (t.type === 'INCOME') monthlyGroups[key].income += (Number(t.amount) || 0);
      else if (t.type === 'EXPENSE') monthlyGroups[key].expense += (Number(t.amount) || 0);
    });

    return { totalIncome, totalExpense, balance: totalIncome - totalExpense, monthlyGroups };
  }, [transactions]);

  const generatePDF = async () => {
    if (isGenerating) return;
    setIsGenerating(true);

    try {
      const doc = new jsPDF();
      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR');

      // Background Header
      doc.setFillColor(11, 20, 26);
      doc.rect(0, 0, 210, 45, 'F');

      // Logo/Title
      doc.setFontSize(24);
      doc.setTextColor(0, 168, 132); // WhatsApp Green
      doc.setFont('helvetica', 'bold');
      doc.text('GB FINANCER', 20, 25);
      
      doc.setFontSize(10);
      doc.setTextColor(134, 150, 160);
      doc.setFont('helvetica', 'normal');
      doc.text('RELATÓRIO DE AUDITORIA FINANCEIRA', 20, 35);
      doc.text(`Gerado em: ${dateStr}`, 150, 35);

      // Summary Section
      doc.setFontSize(16);
      doc.setTextColor(17, 27, 33);
      doc.setFont('helvetica', 'bold');
      doc.text('RESUMO GERAL', 20, 60);

      // Cards
      doc.setDrawColor(225, 225, 225);
      doc.roundedRect(20, 65, 170, 45, 5, 5, 'D');

      doc.setFontSize(11);
      doc.setTextColor(100, 100, 100);
      doc.text('Saldo Acumulado:', 30, 78);
      doc.setFontSize(14);
      doc.setTextColor(reportData.balance >= 0 ? 0 : 244, reportData.balance >= 0 ? 168 : 63, reportData.balance >= 0 ? 132 : 94);
      doc.text(format(reportData.balance), 100, 78);

      doc.setFontSize(11);
      doc.setTextColor(100, 100, 100);
      doc.text('Total de Entradas:', 30, 88);
      doc.setTextColor(0, 168, 132);
      doc.text(format(reportData.totalIncome), 100, 88);

      doc.setFontSize(11);
      doc.setTextColor(100, 100, 100);
      doc.text('Total de Saídas:', 30, 98);
      doc.setTextColor(244, 63, 94);
      doc.text(format(reportData.totalExpense), 100, 98);

      // Monthly Table
      doc.setFontSize(16);
      doc.setTextColor(17, 27, 33);
      doc.setFont('helvetica', 'bold');
      doc.text('HISTÓRICO MENSAL', 20, 125);

      let y = 140;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('Mês/Ano', 25, y);
      doc.text('Entradas', 80, y);
      doc.text('Saídas', 120, y);
      doc.text('Saldo', 160, y);
      
      doc.setDrawColor(200, 200, 200);
      doc.line(20, y + 2, 190, y + 2);
      
      y += 12;

      Object.entries(reportData.monthlyGroups)
        .sort((a, b) => {
           const [monthA, yearA] = a[0].split(' ');
           const [monthB, yearB] = b[0].split(' ');
           return new Date(`${monthB} 1, ${yearB}`).getTime() - new Date(`${monthA} 1, ${yearA}`).getTime();
        })
        .forEach(([month, val]) => {
          const data = val as { income: number; expense: number };
          doc.setTextColor(50, 50, 50);
          doc.setFont('helvetica', 'bold');
          doc.text(month, 25, y);
          
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 168, 132);
          doc.text(format(data.income), 80, y);
          
          doc.setTextColor(244, 63, 94);
          doc.text(format(data.expense), 120, y);
          
          const mBalance = data.income - data.expense;
          doc.setTextColor(mBalance >= 0 ? 0 : 244, mBalance >= 0 ? 168 : 63, mBalance >= 0 ? 132 : 94);
          doc.setFont('helvetica', 'bold');
          doc.text(format(mBalance), 160, y);
          
          y += 10;
          if (y > 270) {
            doc.addPage();
            y = 30;
          }
        });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('Este relatório é gerado automaticamente pelo GB Financer e tem fins informativos.', 105, 285, { align: 'center' });
        doc.text(`Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
      }

      doc.save(`Relatorio_GBFinancer_${now.getFullYear()}_${now.getMonth() + 1}.pdf`);
    } catch (err) {
      console.error("PDF Error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-6 min-h-full space-y-6 bg-[var(--bg-body)] animate-fade pb-32">
      <header className="flex justify-between items-end mb-2">
        <div>
          <h2 className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-[0.4em] mb-1">Auditoria Histórica</h2>
          <h1 className="text-3xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter">Relatórios</h1>
        </div>
        <button 
          onClick={generatePDF}
          disabled={isGenerating}
          className="flex items-center gap-2 bg-[var(--green-whatsapp)] text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50"
        >
          {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
          {isGenerating ? 'Gerando...' : 'Baixar PDF'}
        </button>
      </header>

      <div className="bg-[var(--surface)] p-8 rounded-[3rem] shadow-xl text-[var(--text-primary)] relative overflow-hidden border border-[var(--border)]">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--green-whatsapp)]/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
        <p className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-widest mb-1">Balanço Acumulado Real</p>
        <h3 className="text-4xl font-black tracking-tighter">{format(reportData.balance)}</h3>
        
        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-[var(--border)] pt-6">
          <div>
            <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">Ganhos Reais</p>
            <p className="text-sm font-black text-emerald-400">+{format(reportData.totalIncome)}</p>
          </div>
          <div>
            <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">Gastos Reais</p>
            <p className="text-sm font-black text-rose-400">-{format(reportData.totalExpense)}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1 mt-6">Histórico Mensal</h3>
        {Object.keys(reportData.monthlyGroups).length > 0 ? (
          Object.entries(reportData.monthlyGroups)
            .sort((a, b) => {
               const [monthA, yearA] = a[0].split(' ');
               const [monthB, yearB] = b[0].split(' ');
               return new Date(`${monthB} 1, ${yearB}`).getTime() - new Date(`${monthA} 1, ${yearA}`).getTime();
            })
            .map(([month, val]) => {
              const data = val as { income: number; expense: number };
              const mBalance = data.income - data.expense;
              
              return (
                <div key={month} className="bg-[var(--surface)] p-6 rounded-[2.5rem] shadow-sm border border-[var(--border)] flex justify-between items-center group hover:border-[var(--green-whatsapp)] transition-all">
                  <div>
                    <span className="text-xs font-black uppercase italic text-[var(--text-primary)]">{month}</span>
                    <div className="flex gap-3 mt-1">
                       <span className="text-[9px] font-bold text-emerald-500">+{format(data.income)}</span>
                       <span className="text-[9px] font-bold text-rose-400">-{format(data.expense)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-black block tracking-tighter ${mBalance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {format(mBalance)}
                    </span>
                    <span className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Saldo Mensal</span>
                  </div>
                </div>
              );
            })
        ) : (
          <div className="text-center py-24 bg-[var(--surface)] rounded-[3rem] border border-[var(--border)] px-12">
             <div className="w-16 h-16 bg-[var(--bg-body)] rounded-full flex items-center justify-center mx-auto mb-4 text-2xl opacity-30">📋</div>
             <p className="text-[10px] font-black text-[var(--text-muted)] uppercase italic tracking-widest leading-relaxed">
               Nenhuma transação encontrada. Registre sua primeira movimentação no Mentor IA para gerar relatórios.
             </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
