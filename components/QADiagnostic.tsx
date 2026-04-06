
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserSession } from '../types';
import { auth, db } from '../services/firebaseConfig';
import { fetchChatContext } from '../services/databaseService';
import { resetUserData } from '../services/resetService';
import { QATestingService, QATestScenarioResult, QAModuleId } from '../services/QATestingService';
import { 
  ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertCircle, 
  Play, RefreshCw, Activity, Terminal, Zap, Layers, Shield, 
  User, MessageSquare, LayoutDashboard, List, Tag, Wallet, 
  CreditCard, Bell, Target, TrendingDown, BarChart3, Settings, 
  Database, Filter, Trash2
} from 'lucide-react';

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'success';
}

interface SystemHealth {
  firestore: 'OK' | 'ERROR' | 'CHECKING';
  auth: 'OK' | 'ERROR' | 'CHECKING';
  chat: 'OK' | 'ERROR' | 'CHECKING';
  sync: 'OK' | 'ERROR' | 'CHECKING';
}

interface QADiagnosticProps {
  session: UserSession;
}

interface ModuleStatus {
  id: QAModuleId;
  name: string;
  icon: React.ReactNode;
  status: 'pending' | 'running' | 'success' | 'failed';
  result?: QATestScenarioResult;
}

const QADiagnostic: React.FC<QADiagnosticProps> = ({ session }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [modules, setModules] = useState<ModuleStatus[]>([
    { id: 'auth', name: 'Autenticação', icon: <Shield size={18} />, status: 'pending' },
    { id: 'onboarding', name: 'Onboarding / Tour', icon: <Play size={18} />, status: 'pending' },
    { id: 'chat', name: 'Chat', icon: <MessageSquare size={18} />, status: 'pending' },
    { id: 'dashboard', name: 'Dashboard', icon: <LayoutDashboard size={18} />, status: 'pending' },
    { id: 'extrato', name: 'Extrato', icon: <List size={18} />, status: 'pending' },
    { id: 'categories', name: 'Categorias', icon: <Tag size={18} />, status: 'pending' },
    { id: 'wallets', name: 'Carteiras', icon: <Wallet size={18} />, status: 'pending' },
    { id: 'credit_card', name: 'Cartão de Crédito', icon: <CreditCard size={18} />, status: 'pending' },
    { id: 'reminders', name: 'Lembretes', icon: <Bell size={18} />, status: 'pending' },
    { id: 'goals', name: 'Metas', icon: <Target size={18} />, status: 'pending' },
    { id: 'debts', name: 'Estou Endividado', icon: <TrendingDown size={18} />, status: 'pending' },
    { id: 'score', name: 'Score', icon: <BarChart3 size={18} />, status: 'pending' },
    { id: 'profile', name: 'Perfil', icon: <User size={18} />, status: 'pending' },
    { id: 'admin', name: 'Admin / Suporte', icon: <Settings size={18} />, status: 'pending' },
    { id: 'sync', name: 'Sincronização', icon: <Database size={18} />, status: 'pending' },
  ]);
  
  const [selectedModuleId, setSelectedModuleId] = useState<QAModuleId | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [health, setHealth] = useState<SystemHealth>({
    firestore: 'CHECKING',
    auth: 'CHECKING',
    chat: 'CHECKING',
    sync: 'CHECKING'
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, {
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    }].slice(-50));
  };

  const checkHealth = async () => {
    setHealth(prev => ({ ...prev, firestore: 'CHECKING', auth: 'CHECKING', chat: 'CHECKING', sync: 'CHECKING' }));
    const authOk = !!auth.currentUser;
    setHealth(prev => ({ ...prev, auth: authOk ? 'OK' : 'ERROR' }));
    try {
      const context = await fetchChatContext(session.uid);
      setHealth(prev => ({ ...prev, firestore: context ? 'OK' : 'ERROR', sync: context ? 'OK' : 'ERROR', chat: context ? 'OK' : 'ERROR' }));
    } catch (e) {
      setHealth(prev => ({ ...prev, firestore: 'ERROR', sync: 'ERROR', chat: 'ERROR' }));
    }
  };

  const updateModuleStatus = (id: QAModuleId, status: ModuleStatus['status'], result?: QATestScenarioResult) => {
    setModules(prev => prev.map(m => m.id === id ? { ...m, status, result } : m));
  };

  const runModules = async (ids: QAModuleId[]) => {
    if (isRunning || ids.length === 0) return;
    setIsRunning(true);
    
    const qaService = new QATestingService(session.uid, session);
    addLog(`Iniciando execução de ${ids.length} módulos...`);

    // Reset status of modules being run
    setModules(prev => prev.map(m => ids.includes(m.id) ? { ...m, status: 'running', result: undefined } : m));

    try {
      await qaService.runModules(ids, (result) => {
        const moduleId = result.moduleId;
        updateModuleStatus(moduleId, result.success ? 'success' : 'failed', result);
        if (result.success) {
          addLog(`Módulo "${result.name}" finalizado com sucesso.`, 'success');
        } else {
          addLog(`Módulo "${result.name}" falhou.`, 'error');
        }
      });
    } catch (err) {
      addLog(`Erro crítico durante execução: ${err}`, 'error');
    } finally {
      setIsRunning(false);
      addLog("Execução finalizada.");
    }
  };

  const runAll = () => runModules(modules.map(m => m.id));
  const runFailures = () => runModules(modules.filter(m => m.status === 'failed').map(m => m.id));
  const runSingle = (id: QAModuleId) => runModules([id]);

  const handleHardReset = async () => {
    if (!session.uid || isResetting) return;
    
    setIsResetting(true);
    addLog(`Iniciando Hard Reset para o usuário ${session.uid}...`, 'info');
    
    try {
      await resetUserData(db, session.uid);
      addLog("Hard Reset concluído com sucesso! O sistema será reiniciado.", 'success');
      
      // Pequeno delay para o usuário ler o log antes do reload
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      addLog(`Erro durante o Hard Reset: ${err}`, 'error');
      setIsResetting(false);
      setShowResetConfirm(false);
    }
  };

  const generateGeminiFix = (result: QATestScenarioResult) => {
    const failedSteps = result.steps.filter(s => s.status !== 'OK');
    if (failedSteps.length === 0) return;

    const prompt = `
# RELATÓRIO DE ERRO QA - GBFINANCER
O teste funcional "${result.name}" falhou. Preciso de uma correção técnica.

## Detalhes da Falha:
${failedSteps.map(s => `
- Passo: ${s.name}
- Ação: ${s.action}
- Esperado: ${s.expected}
- Encontrado: ${s.actual}
- Prioridade: ${s.priority}
- Impacto: ${s.impact}
- Causa Provável: ${s.probableCause || 'N/A'}
- Módulo/Arquivo: ${s.moduleFile || 'N/A'}
- Timestamp: ${s.timestamp}
`).join('\n')}

## Instrução:
Por favor, analise o módulo mencionado e corrija a lógica para que o resultado esperado seja alcançado. 
Certifique-se de não quebrar outras funcionalidades e mantenha a integridade dos dados no Firestore.
Responda apenas com a explicação da correção e o código necessário.
    `.trim();

    navigator.clipboard.writeText(prompt);
    addLog(`Prompt de correção para "${result.name}" copiado!`, 'success');
  };

  useEffect(() => {
    checkHealth();
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const stats = {
    total: modules.length,
    success: modules.filter(m => m.status === 'success').length,
    failed: modules.filter(m => m.status === 'failed').length,
    pending: modules.filter(m => m.status === 'pending').length,
    running: modules.filter(m => m.status === 'running').length,
  };

  const selectedModule = modules.find(m => m.id === selectedModuleId);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-[var(--bg)] min-h-screen font-sans">
      {/* Header Modular */}
      <header className="bg-[var(--surface)] p-8 rounded-[2.5rem] border border-[var(--border)] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Layers size={150} />
        </div>
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
              <h1 className="text-3xl font-black italic text-[var(--text-primary)] tracking-tighter uppercase">
                QA Diagnostic <span className="text-blue-500">Modular</span>
              </h1>
            </div>
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.4em] opacity-70">
              Professional Grade Testing Framework • v7.0
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button 
              onClick={runAll}
              disabled={isRunning}
              className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl ${
                isRunning 
                  ? 'bg-[var(--border)] text-[var(--text-muted)] cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 active:scale-95'
              }`}
            >
              <Play size={14} fill="currentColor" />
              Rodar Tudo
            </button>
            <button 
              onClick={runFailures}
              disabled={isRunning || stats.failed === 0}
              className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl ${
                isRunning || stats.failed === 0
                  ? 'bg-[var(--border)] text-[var(--text-muted)] cursor-not-allowed' 
                  : 'bg-rose-600 text-white hover:bg-rose-700 hover:scale-105 active:scale-95'
              }`}
            >
              <Filter size={14} />
              Rodar Falhas ({stats.failed})
            </button>
            <button 
              onClick={checkHealth}
              className="flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--border)] transition-all active:scale-95"
            >
              <RefreshCw size={14} className={health.firestore === 'CHECKING' ? 'animate-spin' : ''} />
              Saúde
            </button>
            <button 
              onClick={() => setShowResetConfirm(true)}
              disabled={isRunning || isResetting}
              className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl ${
                isRunning || isResetting
                  ? 'bg-[var(--border)] text-[var(--text-muted)] cursor-not-allowed' 
                  : 'bg-rose-600/10 text-rose-600 border border-rose-600/20 hover:bg-rose-600 hover:text-white active:scale-95'
              }`}
            >
              <Trash2 size={14} />
              Hard Reset
            </button>
          </div>
        </div>

        {/* Modal de Confirmação de Reset */}
        <AnimatePresence>
          {showResetConfirm && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-[var(--surface)] p-8 rounded-[2.5rem] border border-[var(--border)] max-w-md w-full shadow-2xl space-y-6"
              >
                <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 mx-auto">
                  <AlertCircle size={32} />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tighter">Confirmar Hard Reset?</h3>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed font-medium">
                    Esta ação é <span className="text-rose-500 font-bold">IRREVERSÍVEL</span>. 
                    Todos os seus dados (transações, metas, carteiras, mensagens) serão permanentemente apagados e sua conta será reiniciada do zero.
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={handleHardReset}
                    disabled={isResetting}
                    className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isResetting ? 'Resetando...' : 'Sim, Apagar Tudo'}
                  </button>
                  <button 
                    onClick={() => setShowResetConfirm(false)}
                    disabled={isResetting}
                    className="w-full py-4 bg-[var(--border)] text-[var(--text-primary)] rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-[var(--text-muted)] hover:text-white transition-all active:scale-95"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Bar */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-[var(--border)] pt-8">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Sucesso: {stats.success}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Falhas: {stats.failed}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Rodando: {stats.running}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-gray-500" />
            <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Pendente: {stats.pending}</span>
          </div>
        </div>
      </header>

      {/* Grid de Módulos */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {modules.map((module) => (
          <button
            key={module.id}
            onClick={() => setSelectedModuleId(module.id)}
            className={`p-6 rounded-3xl border transition-all text-left group relative overflow-hidden ${
              selectedModuleId === module.id 
                ? 'bg-blue-600 border-blue-600 shadow-2xl shadow-blue-600/20' 
                : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--text-muted)]'
            }`}
          >
            <div className={`mb-4 w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              selectedModuleId === module.id ? 'bg-white/20 text-white' : 'bg-[var(--border)] text-[var(--text-muted)] group-hover:text-[var(--text-primary)]'
            }`}>
              {module.icon}
            </div>
            
            <h3 className={`text-[11px] font-black uppercase tracking-tight mb-1 ${
              selectedModuleId === module.id ? 'text-white' : 'text-[var(--text-primary)]'
            }`}>
              {module.name}
            </h3>
            
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${
                module.status === 'success' ? 'bg-emerald-500' :
                module.status === 'failed' ? 'bg-rose-500' :
                module.status === 'running' ? 'bg-blue-400 animate-pulse' : 'bg-gray-500'
              }`} />
              <span className={`text-[8px] font-black uppercase tracking-widest ${
                selectedModuleId === module.id ? 'text-white/70' : 'text-[var(--text-muted)]'
              }`}>
                {module.status}
              </span>
            </div>

            {module.status !== 'pending' && module.status !== 'running' && (
              <div className="absolute top-4 right-4">
                {module.status === 'success' ? (
                  <CheckCircle2 size={14} className="text-emerald-500" />
                ) : (
                  <XCircle size={14} className="text-rose-500" />
                )}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Detalhes do Módulo Selecionado */}
      <AnimatePresence mode="wait">
        {selectedModuleId && (
          <motion.div
            key={selectedModuleId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-[var(--surface)] rounded-[2.5rem] border border-[var(--border)] overflow-hidden shadow-2xl"
          >
            <div className="p-8 border-b border-[var(--border)] flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                  {selectedModule?.icon}
                </div>
                <div>
                  <h2 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
                    {selectedModule?.name}
                  </h2>
                  <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                    Detalhes do Módulo • {selectedModule?.status}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => runSingle(selectedModuleId)}
                  disabled={isRunning}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Play size={14} fill="currentColor" />
                  Rodar Módulo
                </button>
                {selectedModule?.result && !selectedModule.result.success && (
                  <button
                    onClick={() => generateGeminiFix(selectedModule.result!)}
                    className="flex items-center gap-2 px-6 py-3 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all active:scale-95"
                  >
                    <Zap size={14} fill="currentColor" />
                    Gerar Correção
                  </button>
                )}
                <button
                  onClick={() => setSelectedModuleId(null)}
                  className="p-3 hover:bg-[var(--border)] rounded-xl transition-all"
                >
                  <XCircle size={20} className="text-[var(--text-muted)]" />
                </button>
              </div>
            </div>

            <div className="p-8">
              {!selectedModule?.result ? (
                <div className="py-20 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-[var(--border)] flex items-center justify-center text-[var(--text-muted)] mx-auto">
                    <Activity size={32} />
                  </div>
                  <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">
                    Aguardando execução deste módulo...
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-12 gap-4 text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest px-4">
                    <div className="col-span-4">Passo / Ação</div>
                    <div className="col-span-2">Esperado</div>
                    <div className="col-span-2">Encontrado</div>
                    <div className="col-span-2">Impacto / Causa</div>
                    <div className="col-span-2 text-right">Status</div>
                  </div>
                  
                  <div className="space-y-3">
                    {selectedModule.result.steps.map((step, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-4 p-6 bg-[var(--bg)] rounded-3xl border border-[var(--border)] items-center group hover:border-[var(--text-muted)] transition-all">
                        <div className="col-span-4">
                          <p className="text-[11px] font-black text-[var(--text-primary)] mb-1 uppercase tracking-tight">{step.name}</p>
                          <p className="text-[9px] text-[var(--text-muted)] italic font-medium leading-relaxed">{step.action}</p>
                        </div>
                        <div className="col-span-2 text-[10px] font-bold text-emerald-500/80 leading-relaxed">{step.expected}</div>
                        <div className="col-span-2 text-[10px] font-bold text-[var(--text-primary)] leading-relaxed">{step.actual}</div>
                        <div className="col-span-2 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded-[4px] text-[7px] font-black uppercase ${
                              step.priority === 'CRITICAL' ? 'bg-rose-500 text-white' :
                              step.priority === 'HIGH' ? 'bg-orange-500 text-white' :
                              step.priority === 'MEDIUM' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'
                            }`}>
                              {step.priority}
                            </span>
                          </div>
                          <p className="text-[8px] text-[var(--text-muted)] leading-tight font-medium">{step.impact}</p>
                          {step.status !== 'OK' && (
                            <p className="text-[8px] font-black text-rose-500 uppercase tracking-tighter">{step.probableCause}</p>
                          )}
                        </div>
                        <div className="col-span-2 flex justify-end">
                          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${
                            step.status === 'OK' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                          }`}>
                            {step.status === 'OK' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                            {step.status}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Console e Saúde */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-black rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-white/10 bg-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-blue-400" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-white/70">QA Terminal Output</h3>
            </div>
            <button onClick={() => setLogs([])} className="text-[8px] font-black text-rose-500 uppercase hover:text-rose-400 transition-colors">Clear Buffer</button>
          </div>
          <div className="h-64 overflow-y-auto p-6 font-mono text-[11px] space-y-2 scrollbar-thin scrollbar-thumb-white/10">
            {logs.length === 0 && <p className="text-white/20 italic">Aguardando sinais do sistema...</p>}
            {logs.map((log, i) => (
              <div key={i} className={`flex gap-3 ${
                log.type === 'error' ? 'text-rose-400' : log.type === 'success' ? 'text-emerald-400' : 'text-blue-400'
              }`}>
                <span className="opacity-30 shrink-0">[{log.timestamp}]</span>
                <span className="leading-relaxed">{log.message}</span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>

        <div className="bg-[var(--surface)] p-8 rounded-[2.5rem] border border-[var(--border)] flex flex-col justify-center space-y-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
            <AlertCircle size={24} />
          </div>
          <div>
            <h4 className="text-xs font-black text-[var(--text-primary)] uppercase mb-3 tracking-widest">Aviso de Integridade</h4>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed font-medium">
              Este framework executa <span className="text-[var(--text-primary)]">testes funcionais reais</span>. 
              Toda ação gera dados no Firestore marcados como <code className="bg-[var(--border)] px-1 rounded text-[10px]">isQA: true</code>. 
              O sistema limpa esses dados automaticamente antes de cada execução.
            </p>
          </div>
          <div className="pt-4 border-t border-[var(--border)]">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
              <span>Ambiente</span>
              <span className="text-emerald-500">Sandbox QA</span>
            </div>
          </div>
        </div>
      </div>

      <footer className="py-12 text-center">
        <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.5em] opacity-30">
          GB Financer QA Framework • Professional Modular Diagnostic • {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
};

export default QADiagnostic;
