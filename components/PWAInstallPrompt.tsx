import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Share } from 'lucide-react';

interface PWAInstallPromptProps {
  onClose: () => void;
}

const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({ onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if it's iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    
    // Check if user has dismissed it recently (last 7 days)
    const lastDismissed = localStorage.getItem('pwa_prompt_dismissed');
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    
    const shouldShow = !isStandalone && (!lastDismissed || (now - parseInt(lastDismissed)) > sevenDays);

    if (shouldShow) {
      const handleBeforeInstallPrompt = (e: any) => {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault();
        // Stash the event so it can be triggered later.
        setDeferredPrompt(e);
        setIsVisible(true);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

      // For iOS, we show it anyway if it's not standalone
      if (isIOSDevice) {
        setIsVisible(true);
      }

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      setDeferredPrompt(null);
      setIsVisible(false);
      onClose();
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa_prompt_dismissed', Date.now().toString());
    setIsVisible(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="fixed bottom-6 left-4 right-4 z-[100] md:left-auto md:right-6 md:w-96"
        >
          <div className="bg-[#111B21] border border-[#2A3942] rounded-2xl shadow-2xl p-5 overflow-hidden relative">
            <button 
              onClick={handleDismiss}
              className="absolute top-3 right-3 text-[#8696A0] hover:text-[#E9EDEF] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-[#00A884]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Download className="w-6 h-6 text-[#00A884]" />
              </div>
              
              <div className="flex-1 pr-6">
                <h3 className="text-[#E9EDEF] font-bold text-sm mb-1">Instalar GBFinancer</h3>
                <p className="text-[#8696A0] text-xs leading-relaxed">
                  Adicione o GBFinancer à sua tela inicial e acesse como um app para uma experiência mais rápida e fluida.
                </p>
              </div>
            </div>

            {isIOS ? (
              <div className="mt-4 bg-[#202C33] rounded-xl p-3 border border-[#2A3942]/50">
                <p className="text-[#E9EDEF] text-[11px] flex items-center gap-2">
                  <Share className="w-3 h-3 text-[#00A884]" />
                  Para instalar no iPhone:
                </p>
                <p className="text-[#8696A0] text-[10px] mt-1 ml-5">
                  Clique em <span className="text-[#E9EDEF] font-bold">Compartilhar</span> e depois em <span className="text-[#E9EDEF] font-bold">Adicionar à Tela de Início</span>.
                </p>
              </div>
            ) : (
              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={handleInstall}
                  className="flex-1 bg-[#00A884] hover:bg-[#00C99D] text-white text-xs font-bold py-2.5 rounded-xl transition-all active:scale-95"
                >
                  Adicionar agora
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-4 py-2.5 text-[#8696A0] hover:text-[#E9EDEF] text-xs font-bold transition-colors"
                >
                  Depois
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PWAInstallPrompt;
