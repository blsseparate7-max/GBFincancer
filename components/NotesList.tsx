
import React from 'react';
import { Note } from '../types';

interface NotesListProps {
  notes: Note[];
  onDeleteNote: (id: string) => void;
}

const NotesList: React.FC<NotesListProps> = ({ notes, onDeleteNote }) => {
  return (
    <div className="p-8 h-full overflow-y-auto bg-[#f8fafc] no-scrollbar pb-32">
      <div className="mb-10">
        <h2 className="text-3xl font-black text-gray-900 tracking-tighter italic">Anotações</h2>
        <p className="text-[10px] text-emerald-600 font-black uppercase tracking-[0.2em] mt-1">Sua base de conhecimento IA</p>
      </div>

      <div className="space-y-4">
        {notes.length > 0 ? notes.map((note) => (
          <div 
            key={note.id} 
            className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 group relative animate-in slide-in-from-bottom duration-300"
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full">
                {note.category || 'Geral'}
              </span>
              <span className="text-[8px] font-bold text-gray-300">
                {new Date(note.timestamp).toLocaleDateString('pt-BR')} {new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            
            <p className="text-sm font-medium text-gray-800 leading-relaxed whitespace-pre-wrap">
              {note.content}
            </p>

            <button 
              onClick={() => onDeleteNote(note.id)}
              className="absolute bottom-6 right-6 p-2 bg-rose-50 text-rose-300 opacity-0 group-hover:opacity-100 hover:text-rose-600 hover:bg-rose-100 rounded-xl transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        )) : (
          <div className="text-center py-32 bg-white rounded-[4rem] border-4 border-dashed border-gray-50">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" strokeWidth="3"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </div>
            <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">Nenhuma anotação por aqui ainda.</p>
            <p className="text-[9px] text-gray-300 mt-2 font-bold uppercase italic">"GB, anota aí que..."</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotesList;
