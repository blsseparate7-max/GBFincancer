import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useAnimation } from 'motion/react';
import { Mic, Send, X, Lock, Trash2, ChevronUp, Smile, Paperclip, Check } from 'lucide-react';

interface ChatComposerProps {
  onSendText: (text: string) => void;
  isLoading: boolean;
  placeholder?: string;
}

const ChatComposer: React.FC<ChatComposerProps> = ({ onSendText, isLoading, placeholder = "Mensagem" }) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isCancelled, setIsCancelled] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const textBeforeRecordingRef = useRef<string>('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<number>(0);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [text]);

  const startRecording = async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Seu navegador não suporta reconhecimento de voz. Tente usar o Chrome ou Safari.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = true;
      recognition.interimResults = true;

      textBeforeRecordingRef.current = text;
      recognitionRef.current = recognition;

      recognition.onstart = () => {
        setIsRecording(true);
        setIsCancelled(false);
        recordingStartTimeRef.current = Date.now();
        timerRef.current = setInterval(() => {
          setRecordingTime(Math.floor((Date.now() - recordingStartTimeRef.current) / 1000));
        }, 1000);
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        const base = textBeforeRecordingRef.current;
        const newText = base + (base && !base.endsWith(' ') ? ' ' : '') + finalTranscript;
        
        if (finalTranscript) {
          textBeforeRecordingRef.current = newText;
        }
        
        setText(newText + interimTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error("Erro no reconhecimento de voz:", event.error);
        if (event.error === 'not-allowed') {
          alert("Permissão de microfone negada.");
        }
        stopRecording(true);
      };

      recognition.onend = () => {
        if (isRecording) {
          stopRecording();
        }
      };

      recognition.start();
    } catch (err) {
      console.error("Erro ao iniciar reconhecimento:", err);
      stopRecording(true);
    }
  };

  const stopRecording = (cancel = false) => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // Prevent recursion
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    if (cancel) {
      setText(textBeforeRecordingRef.current);
    }

    setIsRecording(false);
    setIsLocked(false);
    setRecordingTime(0);
    setDragX(0);
    setDragY(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleSendText = () => {
    if (text.trim() && !isLoading) {
      onSendText(text.trim());
      setText('');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 1024) {
      e.preventDefault();
      handleSendText();
    }
  };

  // Drag handlers for WhatsApp style recording
  const onDrag = (_: any, info: any) => {
    setDragX(info.offset.x);
    setDragY(info.offset.y);

    // Cancel gesture (slide left)
    if (info.offset.x < -100) {
      stopRecording(true);
    }

    // Lock gesture (slide up)
    if (info.offset.y < -80 && !isLocked) {
      setIsLocked(true);
      setDragY(0);
      setDragX(0);
    }
  };

  return (
    <div className="flex flex-col w-full bg-[var(--surface)] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] z-50 border-t border-[var(--border)]">
      <div className="flex items-end gap-2 relative min-h-[48px]">
        
        {/* Left side icons (Emoji, Attachment) - Hidden when recording unless locked */}
        {!isRecording || isLocked ? (
          <div className="flex items-center h-12">
            <button className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <Smile size={24} />
            </button>
            <button className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <Paperclip size={24} className="rotate-45" />
            </button>
          </div>
        ) : null}

        {/* Main Input Area */}
        <div className="flex-1 relative flex items-center bg-[var(--bg-body)] rounded-[24px] min-h-[48px] overflow-hidden border border-[var(--border)]">
          {isRecording ? (
            <div className="flex items-center w-full px-4 h-12 animate-in fade-in duration-300">
              <motion.div 
                animate={{ opacity: [1, 0.5, 1] }} 
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="w-2 h-2 bg-red-500 rounded-full mr-3"
              />
              <span className="text-[var(--text-primary)] font-black text-[10px] uppercase tracking-widest mr-3 animate-pulse">
                🎤 Gravando...
              </span>
              <span className="text-[var(--text-primary)] font-medium text-base min-w-[45px]">
                {formatTime(recordingTime)}
              </span>
              
              {!isLocked ? (
                <div className="flex-1 flex justify-center items-center overflow-hidden">
                  <motion.div 
                    style={{ x: dragX }}
                    className="text-[var(--text-muted)] text-sm whitespace-nowrap flex items-center gap-2"
                  >
                    <span>Deslize para cancelar</span>
                    <ChevronUp className="-rotate-90" size={16} />
                  </motion.div>
                </div>
              ) : (
                <div className="flex-1 flex justify-end items-center">
                  <button 
                    onClick={() => stopRecording(true)}
                    className="text-rose-500 font-bold text-xs uppercase tracking-widest mr-4"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-full bg-transparent text-[var(--text-primary)] text-[16px] py-3 px-4 focus:outline-none resize-none max-h-[150px] placeholder-[var(--text-muted)]"
            />
          )}
        </div>

        {/* Right side button (Mic or Send) */}
        <div className="flex items-center justify-center h-12 w-12 shrink-0">
          <AnimatePresence mode="wait">
            {text.trim() && !isRecording ? (
              <motion.button
                key="send"
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 45 }}
                onClick={handleSendText}
                className="w-12 h-12 bg-[#00a884] text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
              >
                <Send size={20} fill="currentColor" className="ml-1" />
              </motion.button>
            ) : (
              <div className="relative">
                {/* Lock indicator when recording */}
                {isRecording && !isLocked && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: -60 }}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 flex flex-col items-center gap-2 text-[#8696a0]"
                  >
                    <Lock size={16} />
                    <ChevronUp size={16} className="animate-bounce" />
                  </motion.div>
                )}

                <motion.button
                  key="mic"
                  drag={isRecording && !isLocked ? "both" : false}
                  dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                  dragElastic={0.1}
                  onDrag={onDrag}
                  onDragEnd={() => {
                    if (!isLocked && isRecording) {
                      stopRecording();
                    }
                  }}
                  onPointerDown={() => {
                    if (!text.trim() && !isRecording) {
                      startRecording();
                    }
                  }}
                  onPointerUp={() => {
                    if (!isLocked && isRecording) {
                      stopRecording();
                    }
                  }}
                  className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all ${
                    isRecording ? 'bg-red-500 text-white scale-125 z-50' : 'bg-[#00a884] text-white'
                  }`}
                >
                  {isRecording && isLocked ? (
                    <Check size={20} onClick={() => stopRecording()} />
                  ) : (
                    <Mic size={20} fill={isRecording ? "currentColor" : "none"} />
                  )}
                </motion.button>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {/* Locked recording controls */}
      {isLocked && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between px-4 py-2 mt-2 bg-[var(--surface)] rounded-xl border border-[var(--border)]"
        >
          <button 
            onClick={() => stopRecording(true)}
            className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-full transition-colors"
          >
            <Trash2 size={20} />
          </button>
          
          <div className="flex items-center gap-3">
            <motion.div 
              animate={{ opacity: [1, 0.5, 1] }} 
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-2 h-2 bg-red-500 rounded-full"
            />
            <span className="text-[var(--text-primary)] font-mono text-sm">{formatTime(recordingTime)}</span>
          </div>

          <button 
            onClick={() => stopRecording()}
            className="w-10 h-10 bg-[#00a884] text-white rounded-full flex items-center justify-center shadow-md"
          >
            <Check size={18} className="text-white" />
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default ChatComposer;
