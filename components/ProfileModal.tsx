
import React, { useState } from 'react';
import { UserSession } from '../types';
import { Notification } from './UI';

interface ProfileModalProps {
  user: UserSession;
  onClose: () => void;
  onUpdate: (data: Partial<UserSession>) => void;
  onLogout: () => void;
  onSyncForce?: () => void;
  onManageCategories?: () => void;
  onImportBackup?: (data: any) => void;
  onExportBackup?: () => void;
  setActiveTab: (tab: string) => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ 
  user, onClose, onUpdate, onLogout, onSyncForce, onManageCategories, onExportBackup, onImportBackup, setActiveTab 
}) => {
  const [name, setName] = useState(user.name || '');
  const [password, setPassword] = useState(user.password || '');
  const [photoURL, setPhotoURL] = useState(user.photoURL || '');
  const [isEditing, setIsEditing] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleSave = () => {
    onUpdate({ name, password, photoURL });
    setIsEditing(false);
  };

  const handleSync = async () => {
    if (onSyncForce) {
      setIsSyncing(true);
      await onSyncForce();
      setIsSyncing(false);
      setNotification({ message: "Dados restaurados da nuvem!", type: 'success' });
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        if (onImportBackup) onImportBackup(json);
        setNotification({ message: "Backup restaurado com sucesso!", type: 'success' });
        setTimeout(() => onClose(), 1500);
      } catch (err) {
        setNotification({ message: "Arquivo de backup inválido.", type: 'error' });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[var(--surface)] w-full max-w-sm rounded-[3rem] p-8 shadow-2xl relative animate-in zoom-in overflow-hidden border border-[var(--border)] max-h-[90vh] overflow-y-auto pr-1">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-[var(--bg-body)] rounded-full hover:bg-[var(--border)] transition-colors z-10 text-[var(--text-primary)]">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        <div className="text-center mb-8 pt-4">
          <div className="relative inline-block group">
            <div className="w-24 h-24 bg-[var(--bg-body)] rounded-[2.5rem] mx-auto mb-4 flex items-center justify-center overflow-hidden border-2 border-[var(--green-whatsapp)]/30 shadow-xl">
              {photoURL ? (
                <img src={photoURL} alt="Foto" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-black text-[var(--green-whatsapp)]">{(name || 'U').charAt(0).toUpperCase()}</span>
              )}
            </div>
          </div>
          <h3 className="text-xl font-black tracking-tighter uppercase italic text-[var(--text-primary)]">{name}</h3>
          <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest mt-1">ID: {user.userId || user.id}</p>
          
          {/* Status da Assinatura */}
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-[var(--bg-body)] rounded-full border border-[var(--border)]">
            <div className={`w-2 h-2 rounded-full ${user.subscriptionStatus === 'ACTIVE' ? 'bg-[var(--green-whatsapp)] shadow-[0_0_8px_var(--green-whatsapp)]' : 'bg-rose-500 shadow-[0_0_8px_red]'}`} />
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-primary)]">
              Assinatura: {user.subscriptionStatus === 'ACTIVE' ? 'Ativa' : 'Expirada'}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {isEditing ? (
            <div className="space-y-3">
              <input className="w-full bg-[var(--bg-body)] border border-[var(--border)] text-[var(--text-primary)] rounded-2xl p-4 text-sm font-bold" value={name} onChange={e => setName(e.target.value)} placeholder="Nome" />
              <input className="w-full bg-[var(--bg-body)] border border-[var(--border)] text-[var(--text-primary)] rounded-2xl p-4 text-sm font-bold" value={photoURL} onChange={e => setPhotoURL(e.target.value)} placeholder="URL da Foto" />
              <button onClick={handleSave} className="w-full bg-[var(--green-whatsapp)] text-white font-black py-4 rounded-2xl text-[10px] uppercase shadow-lg shadow-[var(--green-whatsapp)]/20">Salvar Alterações</button>
              <button onClick={() => setIsEditing(false)} className="w-full text-[var(--text-muted)] font-black text-[9px] uppercase">Cancelar</button>
            </div>
          ) : showBackup ? (
            <div className="space-y-4 animate-in slide-in-from-bottom">
              <h4 className="text-[10px] font-black text-[var(--text-muted)] uppercase text-center">Gestão de Backup</h4>
              <button onClick={() => setNotification({ message: "Função de exportação em breve!", type: 'info' })} className="w-full bg-[var(--bg-body)] text-[var(--text-primary)] border border-[var(--border)] font-black py-4 rounded-2xl text-[10px] uppercase flex items-center justify-center gap-2">
                📥 Exportar Dados (JSON)
              </button>
              <label className="w-full bg-[var(--green-whatsapp)]/10 text-[var(--green-whatsapp)] border border-[var(--green-whatsapp)]/20 font-black py-4 rounded-2xl text-[10px] uppercase flex items-center justify-center gap-2 cursor-pointer">
                📤 Importar Backup
                <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
              </label>
              <button onClick={() => setShowBackup(false)} className="w-full text-[var(--text-muted)] font-black text-[9px] uppercase">Voltar</button>
            </div>
          ) : (
            <>
              <div className="p-4 bg-[var(--bg-body)] rounded-3xl border border-[var(--border)] mb-4">
                <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2">Suporte e Ajuda</p>
                <button 
                  onClick={() => { setActiveTab('support'); onClose(); }}
                  className="w-full bg-[var(--green-whatsapp)] text-white font-black py-3 rounded-xl text-[10px] uppercase flex items-center justify-center gap-2"
                >
                  💬 Chat de Suporte Interno
                </button>
              </div>

              <button 
                onClick={handleSync} 
                disabled={isSyncing}
                className="w-full bg-[var(--bg-body)] text-[var(--text-primary)] border border-[var(--border)] font-black py-4 rounded-2xl text-[10px] uppercase flex items-center justify-center gap-2"
              >
                {isSyncing ? 'Recuperando...' : '🔄 Restaurar da Nuvem'}
              </button>

              <button onClick={onManageCategories} className="w-full bg-[var(--bg-body)] text-[var(--text-primary)] border border-[var(--border)] font-black py-4 rounded-2xl text-[10px] uppercase flex items-center justify-center gap-2">
                🏷️ Categorias
              </button>
              
              <button onClick={() => setShowBackup(true)} className="w-full bg-[var(--bg-body)] text-[var(--text-primary)] border border-[var(--border)] font-black py-4 rounded-2xl text-[10px] uppercase flex items-center justify-center gap-2">
                💾 Backup de Dados
              </button>
              
              <button onClick={() => setIsEditing(true)} className="w-full bg-[var(--green-whatsapp)] text-white font-black py-4 rounded-2xl text-[10px] uppercase shadow-lg shadow-[var(--green-whatsapp)]/20">
                Editar Perfil
              </button>
              
              <button onClick={onLogout} className="w-full text-rose-500 font-black py-4 text-[10px] uppercase tracking-widest hover:bg-rose-500/5 rounded-2xl transition-colors">
                Sair da Conta
              </button>
            </>
          )}
        </div>
      </div>

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

export default ProfileModal;
