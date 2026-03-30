import React, { useState } from 'react';
import Papa from 'papaparse';
import { FileUp, Clipboard, X, Check, AlertCircle, Upload } from 'lucide-react';
import { dispatchEvent } from '../services/eventDispatcher';
import { Notification } from './UI';

interface ImportDataProps {
  uid: string;
  onClose: () => void;
}

const ImportData: React.FC<ImportDataProps> = ({ uid, onClose }) => {
  const [activeTab, setActiveTab] = useState<'CSV' | 'TEXT'>('CSV');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState('');

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          let successCount = 0;
          const rows = results.data as any[];

          for (const row of rows) {
            // Mapeamento básico de campos comuns em CSVs de bancos
            const amount = parseFloat(row.valor || row.amount || row.Valor || row.Amount || '0');
            const description = row.descricao || row.description || row.Descricao || row.Description || 'Importado';
            const date = row.data || row.date || row.Data || row.Date || new Date().toISOString();
            const type = amount > 0 ? 'ADD_INCOME' : 'ADD_EXPENSE';

            if (amount !== 0) {
              const res = await dispatchEvent(uid, {
                type: type as any,
                payload: {
                  amount: Math.abs(amount),
                  description,
                  date: new Date(date).toISOString(),
                  category: 'Importado',
                  paymentMethod: 'PIX'
                },
                source: 'ui',
                createdAt: new Date()
              });
              if (res.success) successCount++;
            }
          }

          setImportResult({ success: successCount, total: rows.length });
        } catch (err) {
          setError("Erro ao processar o arquivo CSV. Verifique o formato.");
        } finally {
          setIsProcessing(false);
        }
      },
      error: (err) => {
        setError("Erro ao ler o arquivo.");
        setIsProcessing(false);
      }
    });
  };

  const handleTextImport = async () => {
    if (!pastedText.trim() || isProcessing) return;
    
    setIsProcessing(true);
    setError(null);

    try {
      // Aqui poderíamos chamar o Gemini para processar o texto em massa
      // Por enquanto, vamos simular que o usuário enviou uma mensagem normal
      // mas instruindo o sistema a processar como importação
      const lines = pastedText.split('\n').filter(l => l.trim().length > 5);
      let successCount = 0;

      for (const line of lines) {
        // Simplesmente enviamos cada linha como se fosse uma mensagem de chat
        // mas via dispatchEvent se conseguirmos extrair algo básico ou apenas logamos
        // Para um MVP de lançamento, vamos focar no CSV e deixar o texto para o Chat principal
        // que já funciona bem. Mas vamos dar uma dica ao usuário.
      }
      
      setError("A importação por texto direto está em fase beta. Use o Chat do GB para processar mensagens de extrato individuais com mais precisão.");
    } catch (err) {
      setError("Erro ao processar o texto.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade">
      <div className="bg-[var(--surface)] w-full max-w-md rounded-[3rem] p-8 border border-[var(--border)] shadow-2xl flex flex-col relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-[var(--green-whatsapp)] opacity-50"></div>
        
        <button onClick={onClose} className="absolute top-8 right-8 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">
          <X size={24} />
        </button>

        <h3 className="text-xl font-black text-[var(--text-primary)] uppercase italic mb-8 tracking-tighter flex items-center gap-3">
          <Upload className="text-[var(--green-whatsapp)]" size={24} />
          Importar Dados
        </h3>

        <div className="flex gap-2 mb-8 bg-[var(--bg-body)] p-1.5 rounded-2xl">
          <button 
            onClick={() => setActiveTab('CSV')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'CSV' ? 'bg-[var(--green-whatsapp)] text-white' : 'text-[var(--text-muted)]'}`}
          >
            <FileUp size={14} /> CSV / Excel
          </button>
          <button 
            onClick={() => setActiveTab('TEXT')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'TEXT' ? 'bg-[var(--green-whatsapp)] text-white' : 'text-[var(--text-muted)]'}`}
          >
            <Clipboard size={14} /> Colar Texto
          </button>
        </div>

        <div className="flex-1 space-y-6">
          {activeTab === 'CSV' ? (
            <div className="space-y-4">
              <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed">
                Suba o arquivo CSV exportado do seu banco. O sistema tentará identificar automaticamente os valores, datas e descrições.
              </p>
              
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-[var(--border)] rounded-[2rem] cursor-pointer hover:bg-white/5 transition-all group">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <FileUp className="w-10 h-10 mb-3 text-[var(--text-muted)] group-hover:text-[var(--green-whatsapp)] transition-all" />
                  <p className="mb-2 text-sm text-[var(--text-primary)] font-bold">Clique para selecionar</p>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase font-black">CSV ou TXT</p>
                </div>
                <input type="file" className="hidden" accept=".csv,.txt" onChange={handleCSVUpload} disabled={isProcessing} />
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed">
                Cole aqui o texto da notificação do banco ou do extrato. O GB processará as informações para você.
              </p>
              <textarea 
                className="w-full h-40 bg-[var(--bg-body)] border border-[var(--border)] rounded-[2rem] p-5 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--green-whatsapp)] transition-all resize-none"
                placeholder="Ex: Compra aprovada no valor de R$ 50,00 no Supermercado..."
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
              />
              <button 
                onClick={handleTextImport}
                disabled={isProcessing || !pastedText.trim()}
                className="w-full bg-[var(--green-whatsapp)] text-white py-4 rounded-2xl font-black text-[11px] uppercase shadow-lg active:scale-95 transition-all disabled:opacity-50"
              >
                {isProcessing ? 'Processando...' : 'Processar Texto'}
              </button>
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center justify-center py-4 gap-3 text-[var(--green-whatsapp)]">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
              <span className="text-[10px] font-black uppercase tracking-widest">Sincronizando com o Dashboard...</span>
            </div>
          )}

          {importResult && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-500">
                <Check size={20} />
              </div>
              <div>
                <p className="text-xs font-black text-emerald-400 uppercase">Sucesso!</p>
                <p className="text-[10px] text-emerald-500/70 font-bold">Importamos {importResult.success} de {importResult.total} registros.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center text-red-500">
                <AlertCircle size={20} />
              </div>
              <p className="text-[10px] text-red-400 font-bold flex-1">{error}</p>
            </div>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-[var(--border)]">
          <p className="text-[9px] text-[var(--text-muted)] font-bold uppercase text-center tracking-widest">
            Dica: Você também pode enviar prints de extratos diretamente no Chat do GB!
          </p>
        </div>
      </div>
    </div>
  );
};

export default ImportData;
