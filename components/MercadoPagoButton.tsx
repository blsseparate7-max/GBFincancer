
import React, { useEffect, useRef } from 'react';

const MercadoPagoButton: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      const script = document.createElement('script');
      // Link solicitado pelo usuário
      script.src = "https://www.mercadopago.com.br/integrations/v1/web-payment-checkout.js";
      script.setAttribute('data-preference-id', "313512785-f663778b-689c-43cf-be24-d6b6698b1fd5");
      script.setAttribute('data-source', "button");
      script.async = true;
      
      // Limpar o container antes de adicionar para evitar duplicatas em re-renders
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(script);
    }
  }, []);

  return (
    <div className="flex justify-center w-full py-4 min-h-[50px]" ref={containerRef}>
      <div className="flex items-center gap-2">
         <div className="w-3 h-3 bg-emerald-500 rounded-full animate-bounce"></div>
         <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Iniciando Checkout...</p>
      </div>
    </div>
  );
};

export default MercadoPagoButton;
