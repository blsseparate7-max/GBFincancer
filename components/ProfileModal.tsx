
import React, { useState } from 'react';
import { UserSession } from '../types';

interface ProfileModalProps {
  user: UserSession;
  onClose: () => void;
  onUpdate: (data: Partial<UserSession>) => void;
  onLogout: () => void;
  onManageCategories?: () => void;
  onImportBackup?: (data: any) => void;
  onExportBackup?: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ 
  user, onClose, onUpdate, onLogout, onManageCategories, onExportBackup, onImportBackup 
}) => {
  const [name, setName] = useState(user.name);
  const [password, setPassword] = useState(user.password || '');
  const [photoURL, setPhotoURL] = useState(user.photoURL || '');
  const [isEditing, setIsEditing] = useState(false);
  const [showBackup, setShowBackup] = useState(false);

  const handleSave = () => {
    onUpdate({ name, password, photoURL });
    setIsEditing(false);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        if (onImportBackup) onImportBackup(json);
        alert("Backup restaurado com sucesso!");
        onClose();
      } catch (err) {
        alert("Arquivo de backup inválido.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl relative animate-in zoom-in overflow-hidden border border-gray-100 max-h-[90vh] overflow-y-auto no-scrollbar">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors z-10">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        <div className="text-center mb-8 pt-4">
          <div className="relative inline-block group">
            <div className="w-24 h-24 bg-slate-950 rounded-[2.5rem] mx-auto mb-4 flex items-center justify-center overflow-hidden border-2 border-emerald-500/30 shadow-xl">
              {photoURL ? (
                <img src={photoURL} alt="Foto" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-black text-emerald-500">{name.charAt(0).toUpperCase()}</span>
              )}
            </div>
          </div>
          <h3 className="text-xl font-black tracking-tighter uppercase italic text-slate-900">{name}</h3>
          <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mt-1">Perfil Auditado</p>
        </div>

        <div className="space-y-3">
          {isEditing ? (
            <div className="space-y-3">
              <input className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold" value={name} onChange={e => setName(e.target.value)} placeholder="Nome" />
              <input className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold" value={photoURL} onChange={e => setPhotoURL(e.target.value)} placeholder="URL da Foto" />
              <button onClick={handleSave} className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl text-[10px] uppercase">Salvar</button>
              <button onClick={() => setIsEditing(false)} className="w-full text-slate-400 font-black text-[9px] uppercase">Cancelar</button>
            </div>
          ) : showBackup ? (
            <div className="space-y-4 animate-in slide-in-from-bottom">
              <h4 className="text-[10px] font-black text-slate-400 uppercase text-center">Gestão de Backup</h4>
              <button onClick={() => alert("Função de exportação")} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl text-[10px] uppercase flex items-center justify-center gap-2">
                📥 Exportar Dados (JSON)
              </button>
              <label className="w-full bg-emerald-50 text-emerald-600 border border-emerald-100 font-black py-4 rounded-2xl text-[10px] uppercase flex items-center justify-center gap-2 cursor-pointer">
                📤 Importar Backup
                {/* Fixed: Use handleFileImport instead of handleFileFileImport to match the defined function name */}
                <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
              </label>
              <button onClick={() => setShowBackup(false)} className="w-full text-slate-400 font-black text-[9px] uppercase">Voltar</button>
            </div>
          ) : (
            <>
              <button onClick={onManageCategories} className="w-full bg-white text-slate-900 border-2 border-slate-100 font-black py-4 rounded-2xl text-[10px] uppercase flex items-center justify-center gap-2">
                🏷️ Categorias
              </button>
              
              <button onClick={() => setShowBackup(true)} className="w-full bg-white text-slate-900 border-2 border-slate-100 font-black py-4 rounded-2xl text-[10px] uppercase flex items-center justify-center gap-2">
                💾 Backup de Dados
              </button>
              
              <button onClick={() => setIsEditing(true)} className="w-full bg-slate-950 text-white font-black py-4 rounded-2xl text-[10px] uppercase">
                Editar Perfil
              </button>
              
              <button onClick={onLogout} className="w-full text-rose-500 font-black py-4 text-[10px] uppercase tracking-widest">
                Sair
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
