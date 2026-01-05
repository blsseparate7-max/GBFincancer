
import React, { useState, useMemo } from 'react';
import { CustomerData, SubscriptionPlan } from '../types';

interface AdminPanelProps {
  customers: CustomerData[];
}

const AdminPanel: React.FC<AdminPanelProps> = ({ customers }) => {
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'launch'>('users');
  const [selectedUser, setSelectedUser] = useState<CustomerData | null>(null);
  const [paymentLink, setPaymentLink] = useState('https://link.mercadopago.com.br/seu-saas');

  const stats = useMemo(() => {
    const totalRevenue = customers.reduce((acc, curr) => {
      return acc + (curr.plan === 'MONTHLY' ? 29.90 : 299.00);
    }, 0);
    return { totalRevenue, totalCustomers: customers.length };
  }, [customers]);

  return (
    <div className="h-full flex flex-col bg-[#f0f2f5] overflow-hidden">
      {/* Premium Header */}
      <div className="p-6 bg-white border-b shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-gray-800 tracking-tighter uppercase italic">CEO Console</h2>
          <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-widest">GBFinancer Business Unit</p>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
          <button 
            onClick={() => setActiveSubTab('users')}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeSubTab === 'users' ? 'bg-white shadow-md text-gray-800' : 'text-gray-400'}`}
          >
            Clientes
          </button>
          <button 
            onClick={() => setActiveSubTab('launch')}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeSubTab === 'launch' ? 'bg-white shadow-md text-emerald-600' : 'text-gray-400'}`}
          >
            🚀 Lançar App
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeSubTab === 'users' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Faturamento Bruto</p>
                <p className="text-xl font-black text-gray-800">R$ {stats.totalRevenue.toFixed(2)}</p>
              </div>
              <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Taxa de Conversão</p>
                <p className="text-xl font-black text-gray-800">100%</p>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b bg-gray-50/50">
                <h3 className="text-xs font-black text-gray-800 uppercase">Base de Clientes Cadastrados</h3>
              </div>
              <div className="divide-y">
                {customers.map(c => (
                  <div key={c.userId} className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedUser(c)}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-black text-xs">
                        {c.userName[0]}
                      </div>
                      <div>
                        <p className="font-bold text-sm">{c.userName}</p>
                        <p className="text-[10px] text-gray-400">{c.userId}</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-black px-2 py-1 bg-gray-100 rounded-md text-gray-500 uppercase">{c.plan}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in slide-in-from-right duration-300">
            <div className="bg-white p-6 rounded-[2.5rem] border border-emerald-100 shadow-xl">
              <h3 className="text-sm font-black text-gray-800 mb-6 flex items-center gap-2">
                <span className="p-2 bg-emerald-500 rounded-lg text-white">💰</span>
                CONFIGURAR RECEBIMENTOS
              </h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Seu Link de Pagamento (Mercado Pago/Stripe/Pix)</label>
                  <input 
                    type="text" 
                    value={paymentLink}
                    onChange={(e) => setPaymentLink(e.target.value)}
                    className="w-full bg-gray-50 border rounded-2xl px-5 py-4 text-sm font-bold text-emerald-600 focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="https://suapagina.com.br/checkout"
                  />
                  <p className="text-[9px] text-gray-400 italic mt-1">Este link será aberto quando o cliente clicar em "Confirmar Assinatura".</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 p-8 rounded-[2.5rem] text-white shadow-2xl">
              <h3 className="text-xl font-black mb-2 italic">GUIA DE PUBLICAÇÃO</h3>
              <div className="space-y-4 mt-6">
                <div className="flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] font-black shrink-0">1</div>
                  <p className="text-xs opacity-80">Acesse <b>vercel.com</b> e crie uma conta gratuita.</p>
                </div>
                <div className="flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] font-black shrink-0">2</div>
                  <p className="text-xs opacity-80">Conecte seu GitHub ou arraste a pasta do projeto para o painel.</p>
                </div>
                <div className="flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] font-black shrink-0">3</div>
                  <p className="text-xs opacity-80">Em <b>Environment Variables</b>, adicione a chave: <br/> <code className="bg-white/10 p-1 rounded text-emerald-400">API_KEY</code> com sua chave do Gemini.</p>
                </div>
              </div>
              <button className="w-full bg-emerald-500 text-white font-black py-4 rounded-2xl mt-8 shadow-lg active:scale-95 transition-all">
                GERAR BUILD DE PRODUÇÃO
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedUser && (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-6 relative">
            <button onClick={() => setSelectedUser(null)} className="absolute top-4 right-4 p-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <h3 className="text-lg font-black mb-4">Dados de {selectedUser.userName}</h3>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase">Total Gastos Registrados</p>
                <p className="text-xl font-black">R$ {selectedUser.transactions.reduce((acc, t) => acc + t.amount, 0).toFixed(2)}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase">Metas Ativas</p>
                <p className="text-xl font-black">{selectedUser.goals.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
