
import React, { useState } from 'react';
import { Card, Button } from './UI';
import { deleteUserData } from '../services/databaseService';

interface ProfileEditProps {
  user: any;
  onUpdate: (data: any) => void;
  onLogout: () => void;
}

const ProfileEdit: React.FC<ProfileEditProps> = ({ user, onUpdate, onLogout }) => {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.id);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    onUpdate({ name, id: email });
    setLoading(false);
    alert("Perfil atualizado com sucesso!");
  };

  const handleDeleteAccount = async () => {
    const confirm = window.confirm("ATENÇÃO: Isso excluirá permanentemente todos os seus dados e não poderá ser desfeito. Deseja continuar?");
    if (confirm) {
      setLoading(true);
      const success = await deleteUserData(user.id);
      if (success) {
        alert("Sua conta foi excluída com sucesso.");
        onLogout();
      } else {
        alert("Erro ao excluir conta. Tente novamente.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto w-full space-y-8 animate-fade pb-32 relative z-10">
      <header>
        <h2 className="text-[10px] font-black text-[#008069] uppercase tracking-[0.4em] mb-1">Privacidade</h2>
        <h1 className="text-3xl font-black text-[#111b21] uppercase italic tracking-tighter">Minha Conta</h1>
      </header>

      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 space-y-6">
        <div className="flex flex-col items-center mb-8">
           <div className="w-24 h-24 rounded-[2.5rem] bg-gray-50 border-4 border-[#008069]/10 flex items-center justify-center text-4xl font-black text-[#008069] shadow-inner relative group italic">
              {name.charAt(0).toUpperCase()}
           </div>
           <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Plano Ativo: Premium VIP</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#667781] uppercase tracking-widest ml-1">Nome Completo</label>
            <input 
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-[#f8fafc] border border-gray-100 rounded-2xl p-4 text-sm font-bold text-[#111b21] outline-none focus:border-[#008069] transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#667781] uppercase tracking-widest ml-1">ID de Acesso</label>
            <input 
              value={email}
              disabled
              className="w-full bg-gray-100 border border-gray-100 rounded-2xl p-4 text-sm font-bold text-[#667781] outline-none opacity-60"
            />
          </div>
        </div>

        <button 
          onClick={handleSave} 
          disabled={loading}
          className="w-full bg-[#008069] text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all"
        >
          {loading ? 'Salvando...' : 'Atualizar Dados'}
        </button>
      </div>

      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100">
         <h4 className="text-xs font-black text-red-500 uppercase tracking-widest mb-4">Área Crítica</h4>
         <div className="space-y-3">
           <button 
             onClick={onLogout}
             className="w-full bg-slate-50 text-slate-500 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-all"
           >
             Sair da Conta
           </button>
           <button 
             onClick={handleDeleteAccount}
             disabled={loading}
             className="w-full text-[9px] font-black text-slate-300 uppercase tracking-widest mt-2 hover:text-red-500 transition-colors"
           >
             Excluir todos os meus dados permanentemente
           </button>
         </div>
      </div>
    </div>
  );
};

export default ProfileEdit;
