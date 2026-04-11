
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Controle de Versão para invalidar cache agressivo
const APP_VERSION = '1.0.2'; // Incrementar a cada deploy crítico

const bootstrap = () => {
  try {
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      throw new Error("Could not find root element to mount to");
    }

    // Lógica de invalidação de cache por versão
    const savedVersion = localStorage.getItem('app_version');
    if (savedVersion !== APP_VERSION) {
      console.log(`Nova versão detectada: ${APP_VERSION}. Limpando caches...`);
      
      // Limpa caches do navegador
      if (window.caches) {
        caches.keys().then(names => {
          for (let name of names) caches.delete(name);
        });
      }
      
      // Salva nova versão
      localStorage.setItem('app_version', APP_VERSION);
      
      // Força recarregamento do servidor ignorando cache
      window.location.reload();
      return;
    }

    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("Erro crítico no bootstrap:", error);
    
    // Fallback visual para evitar tela branca
    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0b141a; color: #e9edef; font-family: sans-serif; padding: 20px; text-align: center;">
          <h2 style="color: #00a884;">GBFinancer</h2>
          <p>Estamos atualizando o sistema para você...</p>
          <button onclick="localStorage.clear(); window.location.reload();" style="background: #00a884; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; margin-top: 20px; cursor: pointer;">
            Recarregar Agora
          </button>
        </div>
      `;
    }
    
    // Tenta limpar localStorage se for erro de estado corrompido
    if (error instanceof Error && (error.message.includes('quota') || error.message.includes('storage'))) {
      localStorage.clear();
    }
  }
};

bootstrap();
