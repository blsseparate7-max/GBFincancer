
import React from 'react';
import { Note } from '../types';

interface NotesListProps {
  notes: Note[];
  onDeleteNote: (id: string) => void;
}

const NotesList: React.FC<NotesListProps> = ({ notes, onDeleteNote }) => {
  return (
    <div className="p-8 min-h-full bg-[var(--bg-body)] pb-32">
      <div className="mb-10">
        <h2 className="text-3xl font-black text-[var(--text-primary)] tracking-tighter italic">Anotações</h2>
        <p className="text-[10px] text-[var(--green-whatsapp)] font-black uppercase tracking-[0.2em] mt-1">Sua base de conhecimento IA</p>
      </div>

      <div className="space-y-4">
        {notes.length > 0 ? notes.map((note) => (
          <div 
            key={note.id} 
            className="bg-[var(--surface)] p-6 rounded-[2.5rem] shadow-sm border border-[var(--border)] group relative animate-in slide-in-from-bottom duration-300"
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-[9px] font-black text-[var(--green-whatsapp)] uppercase tracking-widest bg-[var(--green-whatsapp)]/10 px-3 py-1 rounded-full">
                {note.category || 'Geral'}
              </span>
              <span className="text-[8px] font-bold text-[var(--text-muted)]">
                {new Date(note.timestamp).toLocaleDateString('pt-BR')} {new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            
            <p className="text-sm font-medium text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap opacity-90">
              {note.content}
            </p>

            <button 
              onClick={() => onDeleteNote(note.id)}
              className="absolute bottom-6 right-6 p-2 bg-rose-500/10 text-rose-400 opacity-0 group-hover:opacity-100 hover:text-rose-300 hover:bg-rose-500/20 rounded-xl transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        )) : (
          <div className="text-center py-32 bg-[var(--surface)] rounded-[4rem] border-4 border-dashed border-[var(--border)]">
            <div className="w-16 h-16 bg-[var(--bg-body)] rounded-full flex items-center justify-center mx-auto mb-4">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="3"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </div>
            <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em]">Nenhuma anotação por aqui ainda.</p>
            <p className="text-[9px] text-[var(--text-muted)] opacity-60 mt-2 font-bold uppercase italic">"GB, anota aí que..."</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotesList;
