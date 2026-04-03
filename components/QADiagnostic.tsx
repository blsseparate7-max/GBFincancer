import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { dispatchEvent } from '../services/eventDispatcher';
import { fetchChatContext } from '../services/databaseService';
import { UserSession } from '../types';
import { serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebaseConfig';
import { QATestingService, QATestScenarioResult } from '../services/QATestingService';
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertCircle, Play, RefreshCw, Activity, Terminal, Zap } from 'lucide-react';

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

const QADiagnostic: React.FC<QADiagnosticProps> = ({ session }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [scenarioResults, setScenarioResults] = useState<QATestScenarioResult[]>([]);
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);
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
      setHealth(prev => ({ ...prev, firestore: context ? 'OK' : 'ERROR', sync: context ? 'OK' : 'ERROR' }));
      setHealth(prev => ({ ...prev, chat: context ? 'OK' : 'ERROR' }));
    } catch (e) {
      setHealth(prev => ({ ...prev, firestore: 'ERROR', sync: 'ERROR', chat: 'ERROR' }));
    }
  };

  const runFunctionalTests = async (cleanStart: boolean = false) => {
    if (isRunning) return;
    setIsRunning(true);
    setScenarioResults([]);
    
    const qaService = new QATestingService(session.uid);

    if (cleanStart) {
      addLog("Limpando ambiente para execução do zero...", 'info');
      await qaService.cleanupQAData();
    }

    addLog("Iniciando bateria de testes funcionais automáticos...");
    
    try {
      await qaService.runAllTests((result) => {
        setScenarioResults(prev => [...prev, result]);
        if (result.success) {
          addLog(`Cenário "${result.name}" finalizado com sucesso.`, 'success');
        } else {
          addLog(`Cenário "${result.name}" falhou. Verifique o relatório.`, 'error');
        }
      });
    } catch (err) {
      addLog(`Erro crítico durante execução dos testes: ${err}`, 'error');
    } finally {
      setIsRunning(false);
      addLog("Bateria de testes finalizada.");
    }
  };

  const generateGeminiFix = (scenario: QATestScenarioResult) => {
    const failedSteps = scenario.steps.filter(s => s.status !== 'OK');
    if (failedSteps.length === 0) return;

    const prompt = `
# RELATÓRIO DE ERRO QA - GBFINANCER
O teste funcional "${scenario.name}" falhou no perfil ${scenario.profile}. Preciso de uma correção técnica.

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
    addLog(`Prompt de correção para "${scenario.name}" copiado para o clipboard!`, 'success');
  };

  useEffect(() => {
    checkHealth();
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const stats = {
    total: scenarioResults.length,
    success: scenarioResults.filter(r => r.success).length,
    failed: scenarioResults.filter(r => !r.success).length
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-[var(--bg)] min-h-screen font-sans">
      {/* Header Profissional */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-[var(--surface)] p-8 rounded-[2rem] border border-[var(--border)] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Activity size={120} />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            <h1 className="text-3xl font-black italic text-[var(--text-primary)] tracking-tighter uppercase">
              QA Engine <span className="text-[var(--green-whatsapp)]">v4.0</span>
            </h1>
          </div>
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-[0.3em] opacity-70">
            Functional E2E Testing & System Integrity
          </p>
        </div>

        <div className="flex flex-wrap gap-4 relative z-10">
          <button 
            onClick={checkHealth}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-[10px] uppercase tracking-widest bg-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--border)]/80 transition-all active:scale-95"
          >
            <RefreshCw size={14} />
            Saúde do Sistema
          </button>
          <button 
            onClick={() => runFunctionalTests(true)}
            disabled={isRunning}
            className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-2xl ${
              isRunning 
                ? 'bg-[var(--border)] text-[var(--text-muted)] cursor-not-allowed' 
                : 'bg-rose-500 text-white shadow-rose-500/30 hover:scale-105 active:scale-95'
            }`}
          >
            <RefreshCw size={16} className={isRunning ? 'animate-spin' : ''} />
            Rodar do Zero (Limpar Tudo)
          </button>
          <button 
            onClick={() => runFunctionalTests(false)}
            disabled={isRunning}
            className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-2xl ${
              isRunning 
                ? 'bg-[var(--border)] text-[var(--text-muted)] cursor-not-allowed' 
                : 'bg-[var(--green-whatsapp)] text-white shadow-[var(--green-whatsapp)]/30 hover:scale-105 active:scale-95'
            }`}
          >
            {isRunning ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <Play size={16} fill="currentColor" />
                Executar Testes
              </>
            )}
          </button>
        </div>
      </header>

      {/* Grid de Saúde e Status */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* System Health */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest px-2">Integridade de Serviços</h3>
          <div className="grid grid-cols-1 gap-3">
            {Object.entries(health).map(([key, value]) => (
              <div key={key} className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] flex items-center justify-between group hover:border-[var(--text-muted)]/30 transition-all">
                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase group-hover:text-[var(--text-primary)] transition-colors">{key}</span>
                <div className="flex items-center gap-3">
                  <span className={`text-[11px] font-black ${
                    value === 'OK' ? 'text-emerald-500' : value === 'ERROR' ? 'text-rose-500' : 'text-amber-500'
                  }`}>
                    {value}
                  </span>
                  <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${
                    value === 'OK' ? 'bg-emerald-500' : value === 'ERROR' ? 'bg-rose-500' : 'bg-amber-500 animate-pulse'
                  }`} />
                </div>
              </div>
            ))}
          </div>

          {/* Mini Report */}
          {scenarioResults.length > 0 && (
            <div className="bg-[var(--surface)] p-6 rounded-3xl border border-[var(--border)] space-y-4">
              <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Resumo da Bateria</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-bold text-[var(--text-muted)]">Sucesso</span>
                  <span className="text-2xl font-black text-emerald-500">{stats.success}</span>
                </div>
                <div className="w-full bg-[var(--border)] h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-1000" 
                    style={{ width: `${(stats.success / stats.total) * 100}%` }} 
                  />
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-xs font-bold text-[var(--text-muted)]">Falhas</span>
                  <span className="text-2xl font-black text-rose-500">{stats.failed}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Test Scenarios Report */}
        <div className="lg:col-span-3 space-y-4">
          <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest px-2">Relatório de Cenários Funcionais</h3>
          
          {scenarioResults.length === 0 && !isRunning && (
            <div className="bg-[var(--surface)] p-20 rounded-[2.5rem] border border-dashed border-[var(--border)] flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-[var(--border)] flex items-center justify-center text-[var(--text-muted)]">
                <Activity size={32} />
              </div>
              <div>
                <h4 className="text-lg font-black text-[var(--text-primary)]">Nenhum teste executado</h4>
                <p className="text-xs text-[var(--text-muted)] max-w-xs mx-auto">Clique no botão acima para iniciar a validação de ponta a ponta do sistema.</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {scenarioResults.map((scenario) => (
              <div 
                key={scenario.id} 
                className={`bg-[var(--surface)] rounded-3xl border transition-all overflow-hidden ${
                  expandedScenario === scenario.id ? 'border-[var(--text-primary)] shadow-2xl' : 'border-[var(--border)] hover:border-[var(--text-muted)]'
                }`}
              >
                <div className="w-full p-6 flex items-center justify-between text-left">
                  <button 
                    onClick={() => setExpandedScenario(expandedScenario === scenario.id ? null : scenario.id)}
                    className="flex flex-1 items-center gap-4"
                  >
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                      scenario.success ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                    }`}>
                      {scenario.success ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">{scenario.name}</h4>
                        <span className="px-1.5 py-0.5 rounded bg-[var(--border)] text-[var(--text-muted)] text-[8px] font-black uppercase">
                          {scenario.profile}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase opacity-60">
                        {scenario.steps.length} Passos Executados • {scenario.success ? 'Integridade Confirmada' : 'Divergência Detectada'}
                      </p>
                    </div>
                  </button>
                  
                  <div className="flex items-center gap-3">
                    {!scenario.success && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); generateGeminiFix(scenario); }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20"
                      >
                        <Zap size={12} fill="currentColor" />
                        Gerar Correção Gemini
                      </button>
                    )}
                    <button 
                      onClick={() => setExpandedScenario(expandedScenario === scenario.id ? null : scenario.id)}
                      className="p-2 hover:bg-[var(--border)] rounded-xl transition-all"
                    >
                      {expandedScenario === scenario.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedScenario === scenario.id && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-[var(--border)] bg-black/5"
                    >
                      <div className="p-6 space-y-4">
                        <div className="grid grid-cols-12 gap-4 text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest px-4">
                          <div className="col-span-3">Passo / Ação</div>
                          <div className="col-span-2">Esperado</div>
                          <div className="col-span-2">Encontrado</div>
                          <div className="col-span-2">Prioridade / Impacto</div>
                          <div className="col-span-2">Causa / Módulo</div>
                          <div className="col-span-1 text-right">Status</div>
                        </div>
                        
                        <div className="space-y-2">
                          {scenario.steps.map((step, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-4 p-4 bg-[var(--surface)] rounded-2xl border border-[var(--border)] items-center">
                              <div className="col-span-3">
                                <p className="text-[10px] font-black text-[var(--text-primary)]">{step.name}</p>
                                <p className="text-[9px] text-[var(--text-muted)] italic">{step.action}</p>
                              </div>
                              <div className="col-span-2 text-[10px] font-bold text-emerald-500/80">{step.expected}</div>
                              <div className="col-span-2 text-[10px] font-bold text-[var(--text-primary)]">{step.actual}</div>
                              <div className="col-span-2 space-y-1">
                                <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase ${
                                  step.priority === 'CRITICAL' ? 'bg-rose-500 text-white' :
                                  step.priority === 'HIGH' ? 'bg-orange-500 text-white' :
                                  step.priority === 'MEDIUM' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'
                                }`}>
                                  {step.priority}
                                </span>
                                <p className="text-[8px] text-[var(--text-muted)] leading-tight">{step.impact}</p>
                              </div>
                              <div className="col-span-2">
                                {step.status !== 'OK' && (
                                  <div className="space-y-1">
                                    <p className="text-[9px] font-bold text-rose-500 uppercase tracking-tighter">{step.probableCause}</p>
                                    <p className="text-[8px] text-[var(--text-muted)] font-mono truncate" title={step.moduleFile}>{step.moduleFile}</p>
                                  </div>
                                )}
                              </div>
                              <div className="col-span-1 flex justify-end">
                                <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase ${
                                  step.status === 'OK' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                                }`}>
                                  {step.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Logs e Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-black rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-emerald-500" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-white/70">Console de Diagnóstico</h3>
            </div>
            <button onClick={() => setLogs([])} className="text-[8px] font-black text-rose-500 uppercase hover:text-rose-400 transition-colors">Limpar Buffer</button>
          </div>
          <div className="h-64 overflow-y-auto p-6 font-mono text-[11px] space-y-2 scrollbar-thin scrollbar-thumb-white/10">
            {logs.length === 0 && <p className="text-white/20 italic">Aguardando execução...</p>}
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

        <div className="bg-[var(--surface)] p-8 rounded-[2rem] border border-[var(--border)] flex flex-col justify-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
            <AlertCircle size={24} />
          </div>
          <div>
            <h4 className="text-xs font-black text-[var(--text-primary)] uppercase mb-2">Sobre o Motor QA</h4>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed font-medium">
              Este motor executa <span className="text-[var(--text-primary)]">transações reais</span> no Firestore com a flag <code className="bg-[var(--border)] px-1 rounded">isQA: true</code>. 
              Ao final de cada bateria, o sistema realiza o <span className="text-rose-500">Auto-Cleanup</span> para garantir que seus dados reais não sejam afetados.
            </p>
          </div>
        </div>
      </div>

      <footer className="py-8 text-center">
        <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.4em] opacity-40">
          GB Financer QA Framework • Professional Grade Diagnostic • {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
};

export default QADiagnostic;

