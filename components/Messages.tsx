
import React from 'react';
import { Notification } from '../types';

interface MessagesProps {
  notifications: Notification[];
}

const Messages: React.FC<MessagesProps> = ({ notifications }) => {
  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-6 space-y-6 animate-fade">
      <header className="mb-8">
        <h2 className="text-[10px] font-black text-[#00a884] uppercase tracking-[0.4em] mb-1">Central de Mensagens</h2>
        <h1 className="text-3xl font-black text-[#111b21] uppercase italic tracking-tighter">Notificações</h1>
      </header>

      <div className="space-y-3">
        {notifications.length > 0 ? notifications.map(notif => (
          <div key={notif.id} className="bg-white p-5 rounded-2xl border border-[#d1d7db] flex gap-4 shadow-sm">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${notif.type.includes('LIMIT') ? 'bg-amber-50 text-amber-500' : 'bg-[#d9fdd3] text-[#008069]'}`}>
              {notif.type.includes('LIMIT') ? '⚠️' : '📩'}
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start mb-1">
                <h4 className="text-sm font-bold text-[#111b21]">{notif.title}</h4>
                <span className="text-[10px] text-[#667781] font-bold">{formatTime(notif.createdAt)}</span>
              </div>
              <p className="text-xs text-[#667781] leading-tight">{notif.body}</p>
            </div>
          </div>
        )) : (
          <div className="flex flex-col items-center justify-center py-32 opacity-30">
            <span className="text-5xl mb-4">📭</span>
            <p className="text-xs font-black uppercase tracking-widest text-[#667781]">Tudo em dia!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
