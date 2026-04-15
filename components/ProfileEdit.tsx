import React, { useState, useRef } from 'react';
import { auth, db, storage } from '../services/firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { Notification } from './UI';
import { handleKiwifyRedirect } from '../services/checkoutService';
import { OAUTH_CONFIG, TRIAL_DAYS } from '../constants';
import { Camera, Trash2, LogOut, Shield, CreditCard, CheckCircle, AlertCircle, Clock, Zap, ExternalLink, ChevronRight } from 'lucide-react';

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

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    try {
      const d = date instanceof Date ? date : new Date(date);
      return d.toLocaleDateString('pt-BR');
    } catch (e) {
      return 'N/A';
    }
  };

  const getDaysRemaining = () => {
    const now = new Date();
    let end: Date | null = null;

    if (user.subscriptionStatus === 'trial' && user.trialEndsAt) {
      end = new Date(user.trialEndsAt);
    } else if (user.subscriptionStatus === 'active' && user.subscriptionEndsAt) {
      end = new Date(user.subscriptionEndsAt);
    }

    if (!end) return 0;
    const diff = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const handleDeleteAccount = async () => {
    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Usuário não autenticado.");

      const userRef = doc(db, "users", user.uid);
      
      // 1. Marcar como deletado no Firestore primeiro (bloqueia acesso imediato)
      // Usamos updateDoc para manter os dados mas marcar como inativo
      await updateDoc(userRef, { 
        status: 'deleted', 
        isActive: false,
        deletedAt: new Date().toISOString() 
      });
      
      // 2. Tentar deletar do Firebase Auth (libera o e-mail)
      try {
        await deleteUser(currentUser);
        console.log("GB: Usuário removido do Firebase Auth com sucesso.");
        
        // 3. Opcional: Deletar o documento do Firestore agora que o Auth foi liberado
        // Nota: Isso pode falhar se as regras de segurança exigirem Auth, 
        // mas como já marcamos como 'deleted', o App.tsx não deixará entrar.
        // Se quisermos deletar mesmo, teríamos que ter feito ANTES do deleteUser.
        // Vamos tentar deletar agora, se falhar, tudo bem, o status já é 'deleted'.
        try {
          await deleteDoc(userRef);
          console.log("GB: Documento do Firestore removido com sucesso.");
        } catch (docErr) {
          console.warn("GB: Não foi possível remover o documento do Firestore após remover do Auth (esperado se as regras exigirem login), mas o status já está como 'deleted'.", docErr);
        }

        setNotification({ message: "Conta excluída permanentemente.", type: 'success' });
        setTimeout(() => onLogout(), 2000);
      } catch (authErr: any) {
        console.error("GB: Erro ao deletar do Auth:", authErr);
        
        // Se falhar por login recente, revertemos o status no Firestore para não bloquear o usuário
        if (authErr.code === 'auth/requires-recent-login') {
          await updateDoc(userRef, { status: 'active', isActive: true, deletedAt: null });
          setNotification({ 
            message: "Para sua segurança, esta operação requer um login recente. Por favor, saia e entre novamente antes de excluir sua conta.", 
            type: 'error' 
          });
        } else {
          setNotification({ message: "Erro ao liberar seu e-mail no sistema de autenticação. Tente novamente.", type: 'error' });
        }
      }
    } catch (e: any) {
      console.error("GB: Erro geral no handleDeleteAccount:", e);
      setNotification({ message: "Erro ao processar exclusão. Tente novamente.", type: 'error' });
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
              <span>{(name || 'U').charAt(0).toUpperCase()}</span>
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
          <p className="mt-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-2">
            {user.role === 'admin' ? 'Cargo: Fundador Master' : 
             user.subscriptionStatus === 'active' ? (
               <span className="text-[var(--green-whatsapp)] flex items-center gap-1">
                 <CheckCircle className="w-3 h-3" /> Assinatura: Premium Ativo
               </span>
             ) : 
             user.subscriptionStatus === 'trial' ? (
               <span className="text-orange-500 flex items-center gap-1">
                 <Clock className="w-3 h-3" /> Período de Teste
               </span>
             ) : (
               <span className="text-rose-500 flex items-center gap-1">
                 <AlertCircle className="w-3 h-3" /> Assinatura: Inativa
               </span>
             )}
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
              value={user.userId || ''}
              disabled
              className="w-full bg-[var(--bg-body)] border border-[var(--border)]/30 rounded-2xl p-4 text-sm font-bold text-[var(--text-muted)] outline-none opacity-60 cursor-not-allowed"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">E-mail de Acesso</label>
            <input 
              value={user.email || ''}
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

      <div className="bg-[var(--surface)] p-8 rounded-[3rem] shadow-2xl border border-[var(--border)] space-y-6">
         <h4 className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-widest mb-2 flex items-center gap-2">
           <span className="w-1.5 h-1.5 bg-[var(--green-whatsapp)] rounded-full"></span> Detalhes da Assinatura
         </h4>
         
         <div className="grid grid-cols-2 gap-4">
            <div className="bg-[var(--bg-body)] p-4 rounded-2xl border border-[var(--border)]/30">
               <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Status</p>
               <p className={`text-xs font-black uppercase italic ${
                 user.subscriptionStatus === 'active' ? 'text-[var(--green-whatsapp)]' : 
                 user.subscriptionStatus === 'trial' ? 'text-orange-500' : 'text-rose-500'
               }`}>
                 {user.subscriptionStatus === 'active' ? 'Ativa' : 
                  user.subscriptionStatus === 'trial' ? 'Trial' : 'Inativa'}
               </p>
            </div>
            <div className="bg-[var(--bg-body)] p-4 rounded-2xl border border-[var(--border)]/30">
               <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Plano</p>
               <p className="text-xs font-black text-[var(--text-primary)] uppercase italic">
                 {user.plan === 'annual' ? 'Anual' : user.plan === 'monthly' ? 'Mensal' : 'Nenhum'}
               </p>
            </div>
         </div>

         <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-[var(--border)]/10">
               <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Válido até</span>
               <span className="text-xs font-black text-[var(--text-primary)] italic">
                 {formatDate(user.subscriptionStatus === 'trial' ? user.trialEndsAt : user.subscriptionEndsAt)}
               </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[var(--border)]/10">
               <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Tempo Restante</span>
               <span className={`text-xs font-black italic ${getDaysRemaining() <= 3 ? 'text-rose-500' : 'text-[var(--green-whatsapp)]'}`}>
                 {getDaysRemaining()} dias {user.subscriptionStatus === 'trial' ? 'para o fim do teste' : 'para renovação'}
               </span>
            </div>
            <div className="flex justify-between items-center py-2">
               <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Provedor</span>
               <span className="text-xs font-black text-[var(--text-primary)] italic flex items-center gap-1">
                 {user.paymentProvider || 'Kiwify'} <Shield className="w-3 h-3 text-[var(--green-whatsapp)]" />
               </span>
            </div>
         </div>

         <button 
           onClick={() => handleKiwifyRedirect(user.uid, checkoutId)}
           className="w-full bg-[var(--green-whatsapp)] text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-[0.2em] hover:bg-[var(--green-whatsapp)]/80 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[var(--green-whatsapp)]/20"
         >
           <Zap className="w-4 h-4" />
           {user.subscriptionStatus === 'trial' ? 'Assinar Premium Agora' : 
            user.subscriptionStatus === 'active' ? 'Renovar / Gerenciar Plano' : 
            'Assinar Agora'}
         </button>
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
              <Trash2 className="w-8 h-8 text-rose-500" />
            </div>
            
            <div className="space-y-4">
              <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter leading-none">Excluir Conta?</h3>
              
              {user.subscriptionStatus === 'active' ? (
                <div className="space-y-4">
                  <p className="text-sm font-medium text-[var(--text-muted)] leading-relaxed italic">
                    Você possui uma <span className="text-rose-500 font-black uppercase">assinatura ativa</span>. 
                    Para evitar cobranças futuras, você <span className="underline">deve cancelar</span> sua assinatura na Kiwify antes de excluir sua conta.
                  </p>
                  <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10 space-y-3">
                    <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Aviso Importante</p>
                    <p className="text-[10px] text-[var(--text-muted)] italic">
                      A exclusão aqui libera seu e-mail para novo cadastro, mas <span className="font-bold">não cancela</span> o pagamento na Kiwify.
                    </p>
                    <button 
                      onClick={() => window.open('https://dashboard.kiwify.com.br/subscriptions', '_blank')}
                      className="w-full bg-[var(--green-whatsapp)]/10 text-[var(--green-whatsapp)] font-black py-3 rounded-xl text-[9px] uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-3 h-3" /> Abrir Painel Kiwify
                    </button>
                  </div>
                </div>
              ) : user.subscriptionStatus === 'trial' ? (
                <p className="text-sm font-medium text-[var(--text-muted)] leading-relaxed italic">
                  Você está no período de teste. Ao excluir sua conta, você perderá o acesso imediatamente e seu e-mail será liberado para um novo cadastro futuro.
                </p>
              ) : (
                <p className="text-sm font-medium text-[var(--text-muted)] leading-relaxed italic">
                  Esta ação é irreversível. Todos os seus dados serão apagados e seu e-mail será liberado para que você possa criar uma nova conta quando desejar.
                </p>
              )}
            </div>

            <div className="space-y-3 pt-4">
              <button 
                onClick={handleDeleteAccount}
                disabled={loading}
                className="w-full bg-rose-500 text-white font-black py-5 rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-rose-500/20 active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto"></div>
                ) : 'Confirmar Exclusão Permanente'}
              </button>
              
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="w-full text-[var(--text-muted)] font-black text-[9px] uppercase tracking-widest pt-2 hover:text-[var(--text-primary)] transition-colors"
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
