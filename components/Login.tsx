
import React, { useState } from 'react';

interface LoginProps {
  onLogin: (userId: string, userName: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [id, setId] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (id && name) onLogin(id, name);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-gradient-to-b from-[#075e54] to-[#128c7e] p-8 text-white">
      <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-2xl animate-bounce">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#075e54" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      </div>
      <h1 className="text-3xl font-black mb-2 tracking-tighter">GBFinancer</h1>
      <p className="text-sm opacity-80 mb-10 text-center">Gestão Financeira Inteligente para Clientes Exclusivos</p>
      
      <form onSubmit={handleSubmit} className="w-full space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest opacity-70">Seu Nome</label>
          <input 
            type="text" value={name} onChange={(e) => setName(e.target.value)} required
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:bg-white/20 focus:outline-none transition-all"
            placeholder="Como quer ser chamado?"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest opacity-70">ID de Acesso</label>
          <input 
            type="text" value={id} onChange={(e) => setId(e.target.value)} required
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:bg-white/20 focus:outline-none transition-all"
            placeholder="Ex: CLIENTE-001"
          />
        </div>
        <button 
          type="submit"
          className="w-full bg-white text-[#075e54] font-black py-4 rounded-xl shadow-xl active:scale-95 transition-transform mt-4"
        >
          ACESSAR MINHA CONTA
        </button>
      </form>
      <p className="mt-12 text-[10px] opacity-50 uppercase tracking-widest">Powered by Gemini AI 3.0</p>
    </div>
  );
};

export default Login;
