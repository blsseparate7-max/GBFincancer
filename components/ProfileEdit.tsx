import React, { useState, useRef } from 'react';
import { db, storage } from '../services/firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { Notification } from './UI';
import { handleKiwifyRedirect } from '../services/checkoutService';
import { OAUTH_CONFIG } from '../constants';

interface ProfileEditProps {
  user: any;
  onUpdate: (data: any) => void;
  onLogout: () => void;
  setActiveTab: (tab: string) => void;
}

const ProfileEdit: React.FC<ProfileEditProps> = ({ user, onUpdate, onLogout, setActiveTab }) => {
  const [name, setName] = useState(user.name || '');
  const [loading, setLoading] = useState(false);
  const [photoURL, setPhotoURL] = useState(user.photoURL || '');
  const [uploading, setUploading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const checkoutId = OAUTH_CONFIG.KIWIFY_CHECKOUT_ID || 'j0VhQzs';

  const handleDeleteAccount = async () => {
    setLoading(true);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { 
        status: 'deleted',
        isActive: false,
        deletedAt: new Date().toISOString()
      });
      setNotification({ message: "Conta excluída com sucesso.", type: 'success' });
      setTimeout(() => onLogout(), 2000);
    } catch (e) {
      console.error(e);
      setNotification({ message: "Erro ao excluir conta.", type: 'error' });
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setNotification({ message: "Nome é obrigatório.", type: 'error' });
      return;
    }
    setLoading(true);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { 
        name: name.trim(),
        photoURL: photoURL 
      });
      onUpdate({ name: name.trim(), photoURL });
      setNotification({ message: "Perfil atualizado com sucesso!", type: 'success' });
    } catch (e) {
      console.error(e);
      setNotification({ message: "Erro ao salvar alterações.", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setNotification({ message: "Por favor, selecione uma imagem.", type: 'error' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setNotification({ message: "A imagem deve ter no máximo 2MB.", type: 'error' });
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
      setNotification({ message: "Erro ao enviar imagem para o servidor.", type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="p-6 max-w-2xl mx-auto w-full space-y-8 animate-fade pb-32 relative z-10 min-h-full">
      <header className="text-center">
        <h2 className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-[0.4em] mb-1">Privacidade & Perfil</h2>
        <h1 className="text-3xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter">Meus Dados</h1>
      </header>

      <div className="bg-[var(--surface)] p-8 rounded-[3rem] shadow-2xl border border-[var(--border)] space-y-8">
        <div className="flex flex-col items-center">
          <div 
            onClick={triggerFileInput}
            className="w-32 h-32 rounded-[2.5rem] bg-[var(--surface-hover)] border-4 border-[var(--green-whatsapp)]/20 flex items-center justify-center text-5xl font-black text-[var(--green-whatsapp)] shadow-xl relative group italic cursor-pointer overflow-hidden transition-all hover:border-[var(--green-whatsapp)]/40"
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
              <div className="absolute inset-0 bg-[var(--bg-body)]/80 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-[var(--green-whatsapp)]/20 border-t-[var(--green-whatsapp)] rounded-full animate-spin"></div>
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
          <p className="mt-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
            {user.role === 'ADMIN' ? 'Cargo: Fundador Master' : 
             user.subscriptionStatus === 'active' ? 'Assinatura: Premium Ativo' : 
             user.subscriptionStatus === 'trial' ? 'Período de Teste' : 'Assinatura: Inativa'}
          </p>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Nome Completo</label>
            <input 
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-[var(--surface-hover)] border border-transparent rounded-2xl p-4 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--green-whatsapp)] transition-all placeholder-[var(--text-muted)]/30"
              placeholder="Seu nome"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">ID da Auditoria</label>
            <input 
              value={user.userId}
              disabled
              className="w-full bg-[var(--bg-body)] border border-[var(--border)]/30 rounded-2xl p-4 text-sm font-bold text-[var(--text-muted)] outline-none opacity-60 cursor-not-allowed"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">E-mail de Acesso</label>
            <input 
              value={user.email}
              disabled
              className="w-full bg-[var(--bg-body)] border border-[var(--border)]/30 rounded-2xl p-4 text-sm font-bold text-[var(--text-muted)] outline-none opacity-60 cursor-not-allowed"
            />
          </div>
        </div>

        <button 
          onClick={handleSave} 
          disabled={loading || uploading}
          className="w-full bg-[var(--green-whatsapp)] text-white font-black py-5 rounded-2xl text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-[var(--green-whatsapp)]/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
          ) : 'Gravar Alterações'}
        </button>
      </div>

      <div className="bg-[var(--surface)] p-8 rounded-[3rem] shadow-2xl border border-[var(--border)] space-y-4">
         <h4 className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-widest mb-2 flex items-center gap-2">
           <span className="w-1.5 h-1.5 bg-[var(--green-whatsapp)] rounded-full"></span> Gerenciar Assinatura
         </h4>
         {user.subscriptionStatus !== 'active' ? (
           <button 
             onClick={() => handleKiwifyRedirect(user.uid, checkoutId)}
             className="w-full bg-[var(--green-whatsapp)] text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-[var(--green-whatsapp)]/80 transition-all flex items-center justify-center gap-2 border border-[var(--green-whatsapp)]/20"
           >
             💳 Assinar Plano Premium
           </button>
         ) : (
           <div className="w-full bg-[var(--green-whatsapp)]/10 text-[var(--green-whatsapp)] font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 border border-[var(--green-whatsapp)]/20">
             ✅ Assinatura Ativa
           </div>
         )}
      </div>

      <div className="bg-[var(--surface)] p-8 rounded-[3rem] shadow-2xl border border-[var(--border)] space-y-4">
         <h4 className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-widest mb-2 flex items-center gap-2">
           <span className="w-1.5 h-1.5 bg-[var(--green-whatsapp)] rounded-full"></span> Suporte e Ajuda
         </h4>
         <button 
           onClick={() => setActiveTab('support')}
           className="w-full bg-[var(--green-whatsapp)]/10 text-[var(--green-whatsapp)] font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-[var(--green-whatsapp)]/20 transition-all flex items-center justify-center gap-2 border border-[var(--green-whatsapp)]/20"
         >
           💬 Chat de Suporte Interno
         </button>
      </div>

      <div className="bg-[var(--surface)] p-8 rounded-[3rem] shadow-2xl border border-rose-500/20">
         <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-6 flex items-center gap-2">
           <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span> Gerenciar Sessão
         </h4>
         <div className="space-y-4">
           <button 
             onClick={onLogout}
             className="w-full bg-rose-500/10 text-rose-500 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-rose-500/20 transition-all flex items-center justify-center gap-2 border border-rose-500/20"
           >
             Desconectar Aparelho
           </button>
           
           <button 
             onClick={() => setShowDeleteModal(true)}
             className="w-full text-rose-500/60 font-black py-2 text-[9px] uppercase tracking-widest hover:text-rose-500 transition-colors"
           >
             Excluir minha conta
           </button>
         </div>
      </div>

      {/* Modal de Exclusão de Conta */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[3000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-[var(--surface)] w-full max-w-md rounded-[3rem] p-10 shadow-2xl border border-rose-500/30 space-y-8 text-center animate-in zoom-in">
            <div className="w-20 h-20 bg-rose-500/10 rounded-[2rem] flex items-center justify-center mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-rose-500"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter leading-none">Excluir Conta?</h3>
              <p className="text-sm font-medium text-[var(--text-muted)] leading-relaxed italic">
                Atenção: Excluir sua conta no app <span className="font-black text-rose-500">NÃO cancela automaticamente</span> sua assinatura na Kiwify.
                <br /><br />
                Antes de prosseguir, cancele sua assinatura na Kiwify para evitar novas cobranças indesejadas.
              </p>
            </div>

            <div className="space-y-3 pt-4">
              <button 
                onClick={() => window.open('https://dashboard.kiwify.com.br/subscriptions', '_blank')}
                className="w-full bg-[var(--green-whatsapp)] text-white font-black py-5 rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-[var(--green-whatsapp)]/20"
              >
                1. Cancelar Assinatura na Kiwify
              </button>
              
              <button 
                onClick={handleDeleteAccount}
                disabled={loading}
                className="w-full bg-rose-500/10 text-rose-500 border border-rose-500/20 font-black py-5 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-rose-500/20 transition-all"
              >
                {loading ? 'Processando...' : '2. Confirmar Exclusão da Conta'}
              </button>
              
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="w-full text-[var(--text-muted)] font-black text-[9px] uppercase tracking-widest pt-2"
              >
                Manter minha conta
              </button>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
};

export default ProfileEdit;
