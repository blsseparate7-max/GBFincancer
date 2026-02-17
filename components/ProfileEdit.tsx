import React, { useState, useRef } from 'react';
import { db, storage } from '../services/firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';

interface ProfileEditProps {
  user: any;
  onUpdate: (data: any) => void;
  onLogout: () => void;
}

const ProfileEdit: React.FC<ProfileEditProps> = ({ user, onUpdate, onLogout }) => {
  const [name, setName] = useState(user.name);
  const [loading, setLoading] = useState(false);
  const [photoURL, setPhotoURL] = useState(user.photoURL || '');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    if (!name.trim()) return alert("Nome é obrigatório.");
    setLoading(true);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { 
        name: name.trim(),
        photoURL: photoURL 
      });
      onUpdate({ name: name.trim(), photoURL });
      alert("Perfil atualizado com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar alterações.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert("Por favor, selecione uma imagem.");
      return;
    }

    // Limite de 2MB para evitar custos/lentidão excessiva
    if (file.size > 2 * 1024 * 1024) {
      alert("A imagem deve ter no máximo 2MB.");
      return;
    }

    setUploading(true);
    try {
      const storageRef = ref(storage, `profiles/${user.uid}/${Date.now()}_avatar`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      setPhotoURL(url);
    } catch (error) {
      console.error("Erro no upload:", error);
      alert("Erro ao enviar imagem para o servidor.");
    } finally {
      setUploading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="p-6 max-w-2xl mx-auto w-full space-y-8 animate-fade pb-32 relative z-10">
      <header className="text-center">
        <h2 className="text-[10px] font-black text-[#00a884] uppercase tracking-[0.4em] mb-1">Privacidade & Perfil</h2>
        <h1 className="text-3xl font-black text-[#e9edef] uppercase italic tracking-tighter">Meus Dados</h1>
      </header>

      <div className="bg-[#111b21] p-8 rounded-[3rem] shadow-2xl border border-[#2a3942] space-y-8">
        {/* Seção de Avatar com Upload */}
        <div className="flex flex-col items-center">
          <div 
            onClick={triggerFileInput}
            className="w-32 h-32 rounded-[2.5rem] bg-[#202c33] border-4 border-[#00a884]/20 flex items-center justify-center text-5xl font-black text-[#00a884] shadow-xl relative group italic cursor-pointer overflow-hidden transition-all hover:border-[#00a884]/40"
          >
            {photoURL ? (
              <img src={photoURL} alt="Foto de Perfil" className="w-full h-full object-cover" />
            ) : (
              <span>{name.charAt(0).toUpperCase()}</span>
            )}
            
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
               <span className="text-white text-[9px] font-black uppercase tracking-widest text-center px-2">Trocar Foto</span>
            </div>

            {uploading && (
              <div className="absolute inset-0 bg-[#0b141a]/80 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-[#00a884]/20 border-t-[#00a884] rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept="image/*"
          />
          <p className="mt-4 text-[10px] font-black text-[#8696a0] uppercase tracking-widest">
            {user.role === 'ADMIN' ? 'Cargo: Fundador Master' : 'Assinatura: Premium Ativo'}
          </p>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#8696a0] uppercase tracking-widest ml-1">Nome Completo</label>
            <input 
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-[#202c33] border border-transparent rounded-2xl p-4 text-sm font-bold text-[#e9edef] outline-none focus:border-[#00a884] transition-all placeholder-[#8696a0]/30"
              placeholder="Seu nome"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#8696a0] uppercase tracking-widest ml-1">ID da Auditoria</label>
            <input 
              value={user.userId}
              disabled
              className="w-full bg-[#0b141a] border border-[#2a3942]/30 rounded-2xl p-4 text-sm font-bold text-[#8696a0] outline-none opacity-60 cursor-not-allowed"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#8696a0] uppercase tracking-widest ml-1">E-mail de Acesso</label>
            <input 
              value={user.email}
              disabled
              className="w-full bg-[#0b141a] border border-[#2a3942]/30 rounded-2xl p-4 text-sm font-bold text-[#8696a0] outline-none opacity-60 cursor-not-allowed"
            />
          </div>
        </div>

        <button 
          onClick={handleSave} 
          disabled={loading || uploading}
          className="w-full bg-[#00a884] text-white font-black py-5 rounded-2xl text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-[#00a884]/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
          ) : 'Gravar Alterações'}
        </button>
      </div>

      <div className="bg-[#111b21] p-8 rounded-[3rem] shadow-2xl border border-rose-500/20">
         <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-6 flex items-center gap-2">
           <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span> Gerenciar Sessão
         </h4>
         <button 
           onClick={onLogout}
           className="w-full bg-rose-500/10 text-rose-500 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-rose-500/20 transition-all flex items-center justify-center gap-2 border border-rose-500/20"
         >
           Desconectar Aparelho
         </button>
      </div>
    </div>
  );
};

export default ProfileEdit;