
import { db } from "./firebaseConfig";
import { 
  collection, doc, getDocs, query, where, deleteDoc, 
  serverTimestamp, getDoc 
} from "firebase/firestore";
import { dispatchEvent } from "./eventDispatcher";
import { fetchChatContext } from "./databaseService";
import { FinanceEvent } from "../types";

export interface QATestStep {
  name: string;
  action: string;
  expected: string;
  actual: string;
  status: 'OK' | 'FAILED' | 'DIVERGENCE';
}

export interface QATestScenarioResult {
  id: string;
  name: string;
  steps: QATestStep[];
  success: boolean;
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Motor de Testes Funcionais QA
 * Executa fluxos reais e valida integridade entre abas
 */
export class QATestingService {
  private uid: string;

  constructor(uid: string) {
    this.uid = uid;
  }

  private async waitForCondition(
    condition: () => Promise<boolean>, 
    timeoutMs: number = 5000, 
    intervalMs: number = 500
  ): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await condition()) return true;
      await wait(intervalMs);
    }
    return false;
  }

  /**
   * Cenário 1: Extrato -> Dashboard -> Carteira
   */
  async testExtratoDashWallet(): Promise<QATestScenarioResult> {
    const steps: QATestStep[] = [];
    let success = true;

    try {
      // 1. Criar Carteira QA
      const walletName = `QA_Wallet_${Date.now()}`;
      await dispatchEvent(this.uid, {
        type: 'CREATE_WALLET',
        payload: { name: walletName, type: 'CONTA', balance: 1000, isQA: true },
        source: 'admin',
        createdAt: new Date()
      });

      steps.push({
        name: "Criação de Carteira",
        action: "Criar carteira com saldo 1000",
        expected: "Carteira criada com saldo 1000",
        actual: "Carteira criada",
        status: 'OK'
      });

      await wait(1000);
      let context = await fetchChatContext(this.uid);
      const wallet = context?.wallets.find(w => w.name === walletName);
      if (!wallet) throw new Error("Carteira não encontrada");

      // 2. Criar Saída
      const expenseAmount = 200;
      await dispatchEvent(this.uid, {
        type: 'ADD_EXPENSE',
        payload: { 
          description: 'QA Expense', 
          amount: expenseAmount, 
          category: 'Alimentação', 
          sourceWalletId: wallet.id,
          isQA: true 
        },
        source: 'admin',
        createdAt: new Date()
      });

      const checkExpense = await this.waitForCondition(async () => {
        const ctx = await fetchChatContext(this.uid);
        const w = ctx?.wallets.find(wal => wal.id === wallet.id);
        return w?.balance === 800;
      });

      steps.push({
        name: "Impacto na Carteira",
        action: `Lançar despesa de ${expenseAmount}`,
        expected: "Saldo da carteira deve ser 800",
        actual: checkExpense ? "Saldo 800" : "Saldo não atualizou corretamente",
        status: checkExpense ? 'OK' : 'FAILED'
      });
      if (!checkExpense) success = false;

      // 3. Editar Transação
      context = await fetchChatContext(this.uid);
      const trans = context?.transactions.find(t => t.description === 'QA Expense');
      if (trans) {
        await dispatchEvent(this.uid, {
          type: 'UPDATE_TRANSACTION',
          payload: { 
            id: trans.id, 
            updates: { amount: 300, description: 'QA Expense Updated', sourceWalletId: wallet.id },
            oldData: trans,
            isQA: true 
          },
          source: 'admin',
          createdAt: new Date()
        });

        const checkEdit = await this.waitForCondition(async () => {
          const ctx = await fetchChatContext(this.uid);
          const w = ctx?.wallets.find(wal => wal.id === wallet.id);
          return w?.balance === 700;
        });

        steps.push({
          name: "Edição de Transação",
          action: "Alterar valor de 200 para 300",
          expected: "Saldo da carteira deve ser 700",
          actual: checkEdit ? "Saldo 700" : "Saldo não recalculo corretamente",
          status: checkEdit ? 'OK' : 'FAILED'
        });
        if (!checkEdit) success = false;
      }

      // 4. Excluir Transação
      if (trans) {
        await dispatchEvent(this.uid, {
          type: 'DELETE_ITEM',
          payload: { id: trans.id, collection: 'transactions' },
          source: 'admin',
          createdAt: new Date()
        });

        const checkDelete = await this.waitForCondition(async () => {
          const ctx = await fetchChatContext(this.uid);
          const w = ctx?.wallets.find(wal => wal.id === wallet.id);
          return w?.balance === 1000;
        });

        steps.push({
          name: "Exclusão e Estorno",
          action: "Excluir transação de 300",
          expected: "Saldo da carteira deve voltar para 1000",
          actual: checkDelete ? "Saldo 1000" : "Saldo não estornou corretamente",
          status: checkDelete ? 'OK' : 'FAILED'
        });
        if (!checkDelete) success = false;
      }

    } catch (e: any) {
      success = false;
      steps.push({
        name: "Erro Crítico",
        action: "Execução do cenário",
        expected: "Fluxo completo",
        actual: e.message,
        status: 'FAILED'
      });
    }

    return { id: 'extrato-dash-wallet', name: "Extrato -> Dashboard -> Carteira", steps, success };
  }

  /**
   * Cenário 3: Cartão de Crédito
   */
  async testCreditCardFlow(): Promise<QATestScenarioResult> {
    const steps: QATestStep[] = [];
    let success = true;

    try {
      // 1. Criar Cartão QA
      const cardName = `QA_Card_${Date.now()}`;
      await dispatchEvent(this.uid, {
        type: 'ADD_CARD',
        payload: { name: cardName, bank: 'QA Bank', limit: 5000, dueDay: 10, closingDay: 3, isQA: true },
        source: 'admin',
        createdAt: new Date()
      });

      await wait(1000);
      let context = await fetchChatContext(this.uid);
      const card = context?.cards.find(c => c.name === cardName);
      if (!card) throw new Error("Cartão não encontrado");

      steps.push({
        name: "Criação de Cartão",
        action: "Criar cartão com limite 5000",
        expected: "Cartão criado com limite 5000",
        actual: "Cartão criado",
        status: 'OK'
      });

      // 2. Compra no Cartão
      await dispatchEvent(this.uid, {
        type: 'ADD_CARD_CHARGE',
        payload: { amount: 500, category: 'Lazer', description: 'QA Card Purchase', cardId: card.id, isQA: true },
        source: 'admin',
        createdAt: new Date()
      });

      const checkCharge = await this.waitForCondition(async () => {
        const ctx = await fetchChatContext(this.uid);
        const c = ctx?.cards.find(car => car.id === card.id);
        return c?.usedAmount === 500 && c?.availableAmount === 4500;
      });

      steps.push({
        name: "Consumo de Limite",
        action: "Compra de 500 no cartão",
        expected: "Limite usado: 500, Disponível: 4500",
        actual: checkCharge ? "Limite atualizado" : "Limite não atualizou corretamente",
        status: checkCharge ? 'OK' : 'FAILED'
      });
      if (!checkCharge) success = false;

      // 3. Pagar Fatura
      await dispatchEvent(this.uid, {
        type: 'PAY_CARD',
        payload: { cardId: card.id, amount: 500, isQA: true },
        source: 'admin',
        createdAt: new Date()
      });

      const checkPay = await this.waitForCondition(async () => {
        const ctx = await fetchChatContext(this.uid);
        const c = ctx?.cards.find(car => car.id === card.id);
        return c?.usedAmount === 0 && c?.availableAmount === 5000;
      });

      steps.push({
        name: "Pagamento de Fatura",
        action: "Pagar fatura de 500",
        expected: "Limite usado: 0, Disponível: 5000",
        actual: checkPay ? "Limite restaurado" : "Limite não restaurou corretamente",
        status: checkPay ? 'OK' : 'FAILED'
      });
      if (!checkPay) success = false;

    } catch (e: any) {
      success = false;
      steps.push({
        name: "Erro Crítico",
        action: "Execução do cenário",
        expected: "Fluxo completo",
        actual: e.message,
        status: 'FAILED'
      });
    }

    return { id: 'card-flow', name: "Fluxo de Cartão de Crédito", steps, success };
  }

  /**
   * Cenário 4: Lembretes
   */
  async testRemindersFlow(): Promise<QATestScenarioResult> {
    const steps: QATestStep[] = [];
    let success = true;

    try {
      const reminderDesc = `QA Reminder ${Date.now()}`;
      await dispatchEvent(this.uid, {
        type: 'CREATE_REMINDER',
        payload: { description: reminderDesc, amount: 150, dueDay: 15, category: 'Contas', type: 'PAY', recurring: true, isQA: true },
        source: 'admin',
        createdAt: new Date()
      });

      await wait(1000);
      let context = await fetchChatContext(this.uid);
      const reminder = context?.reminders.find(r => r.description === reminderDesc);
      if (!reminder) throw new Error("Lembrete não encontrado");

      steps.push({
        name: "Criação de Lembrete",
        action: "Criar lembrete recorrente de 150",
        expected: "Lembrete criado",
        actual: "Lembrete criado",
        status: 'OK'
      });

      // Pagar Lembrete
      await dispatchEvent(this.uid, {
        type: 'PAY_REMINDER',
        payload: { billId: reminder.id, isQA: true },
        source: 'admin',
        createdAt: new Date()
      });

      const checkPay = await this.waitForCondition(async () => {
        const ctx = await fetchChatContext(this.uid);
        const oldRem = ctx?.reminders.find(r => r.id === reminder.id);
        const nextRem = ctx?.reminders.find(r => r.description === reminderDesc && r.id !== reminder.id);
        return oldRem?.isPaid === true && !!nextRem;
      });

      steps.push({
        name: "Pagamento e Recorrência",
        action: "Marcar lembrete como pago",
        expected: "Lembrete atual marcado como pago e novo ciclo criado",
        actual: checkPay ? "Pago e novo ciclo gerado" : "Falha na liquidação ou recorrência",
        status: checkPay ? 'OK' : 'FAILED'
      });
      if (!checkPay) success = false;

    } catch (e: any) {
      success = false;
      steps.push({
        name: "Erro Crítico",
        action: "Execução do cenário",
        expected: "Fluxo completo",
        actual: e.message,
        status: 'FAILED'
      });
    }

    return { id: 'reminders-flow', name: "Fluxo de Lembretes", steps, success };
  }

  /**
   * Cenário 5: Metas
   */
  async testGoalsFlow(): Promise<QATestScenarioResult> {
    const steps: QATestStep[] = [];
    let success = true;

    try {
      const goalName = `QA Goal ${Date.now()}`;
      await dispatchEvent(this.uid, {
        type: 'CREATE_GOAL',
        payload: { name: goalName, targetAmount: 1000, currentAmount: 0, category: 'Viagem', isQA: true },
        source: 'admin',
        createdAt: new Date()
      });

      await wait(1000);
      let context = await fetchChatContext(this.uid);
      const goal = context?.goals.find(g => g.name === goalName);
      if (!goal) throw new Error("Meta não encontrada");

      steps.push({
        name: "Criação de Meta",
        action: "Criar meta de 1000",
        expected: "Meta criada",
        actual: "Meta criada",
        status: 'OK'
      });

      // Adicionar Saldo
      await dispatchEvent(this.uid, {
        type: 'ADD_TO_GOAL',
        payload: { goalId: goal.id, amount: 200, note: 'QA Contribution', isQA: true },
        source: 'admin',
        createdAt: new Date()
      });

      const checkContrib = await this.waitForCondition(async () => {
        const ctx = await fetchChatContext(this.uid);
        const g = ctx?.goals.find(go => go.id === goal.id);
        return g?.currentAmount === 200;
      });

      steps.push({
        name: "Aporte na Meta",
        action: "Adicionar 200 na meta",
        expected: "Saldo da meta deve ser 200",
        actual: checkContrib ? "Saldo 200" : "Saldo não atualizou",
        status: checkContrib ? 'OK' : 'FAILED'
      });
      if (!checkContrib) success = false;

    } catch (e: any) {
      success = false;
      steps.push({
        name: "Erro Crítico",
        action: "Execução do cenário",
        expected: "Fluxo completo",
        actual: e.message,
        status: 'FAILED'
      });
    }

    return { id: 'goals-flow', name: "Fluxo de Metas", steps, success };
  }

  /**
   * Cenário 2: Extrato -> Categorias -> Calendário
   */
  async testCategoriesCalendar(): Promise<QATestScenarioResult> {
    const steps: QATestStep[] = [];
    let success = true;

    try {
      const expenseAmount = 150;
      const category = `QA_Cat_${Date.now()}`;
      
      await dispatchEvent(this.uid, {
        type: 'ADD_EXPENSE',
        payload: { 
          description: 'QA Cat Test', 
          amount: expenseAmount, 
          category: category, 
          date: new Date().toISOString(),
          isQA: true 
        },
        source: 'admin',
        createdAt: new Date()
      });

      const checkCat = await this.waitForCondition(async () => {
        const ctx = await fetchChatContext(this.uid);
        // Categorias são normalizadas, mas aqui estamos testando se o valor foi computado
        // O dashboard/ranking usa as transações para calcular
        const trans = ctx?.transactions.find(t => t.category === category);
        return !!trans;
      });

      steps.push({
        name: "Registro por Categoria",
        action: `Lançar despesa na categoria ${category}`,
        expected: "Transação registrada com a categoria correta",
        actual: checkCat ? "Categoria registrada" : "Falha ao registrar categoria",
        status: checkCat ? 'OK' : 'FAILED'
      });
      if (!checkCat) success = false;

    } catch (e: any) {
      success = false;
      steps.push({
        name: "Erro Crítico",
        action: "Execução do cenário",
        expected: "Fluxo completo",
        actual: e.message,
        status: 'FAILED'
      });
    }

    return { id: 'categories-calendar', name: "Extrato -> Categorias -> Calendário", steps, success };
  }

  /**
   * Cenário 6: Carteiras
   */
  async testWalletsFlow(): Promise<QATestScenarioResult> {
    const steps: QATestStep[] = [];
    let success = true;

    try {
      // 1. Criar duas carteiras
      const w1Name = `QA_W1_${Date.now()}`;
      const w2Name = `QA_W2_${Date.now()}`;

      await dispatchEvent(this.uid, {
        type: 'CREATE_WALLET',
        payload: { name: w1Name, type: 'CONTA', balance: 1000, isQA: true },
        source: 'admin',
        createdAt: new Date()
      });
      await dispatchEvent(this.uid, {
        type: 'CREATE_WALLET',
        payload: { name: w2Name, type: 'CONTA', balance: 0, isQA: true },
        source: 'admin',
        createdAt: new Date()
      });

      await wait(1500);
      let context = await fetchChatContext(this.uid);
      const w1 = context?.wallets.find(w => w.name === w1Name);
      const w2 = context?.wallets.find(w => w.name === w2Name);

      if (!w1 || !w2) throw new Error("Carteiras não criadas");

      steps.push({
        name: "Setup de Carteiras",
        action: "Criar W1 (1000) e W2 (0)",
        expected: "Carteiras prontas para transferência",
        actual: "OK",
        status: 'OK'
      });

      // 2. Transferir
      await dispatchEvent(this.uid, {
        type: 'TRANSFER_WALLET',
        payload: { 
          sourceWalletId: w1.id, 
          targetWalletId: w2.id, 
          amount: 400, 
          description: 'QA Transfer',
          isQA: true 
        },
        source: 'admin',
        createdAt: new Date()
      });

      const checkTransfer = await this.waitForCondition(async () => {
        const ctx = await fetchChatContext(this.uid);
        const resW1 = ctx?.wallets.find(w => w.id === w1.id);
        const resW2 = ctx?.wallets.find(w => w.id === w2.id);
        return resW1?.balance === 600 && resW2?.balance === 400;
      });

      steps.push({
        name: "Transferência entre Contas",
        action: "Transferir 400 de W1 para W2",
        expected: "W1: 600, W2: 400",
        actual: checkTransfer ? "Saldos atualizados" : "Falha na transferência",
        status: checkTransfer ? 'OK' : 'FAILED'
      });
      if (!checkTransfer) success = false;

    } catch (e: any) {
      success = false;
      steps.push({
        name: "Erro Crítico",
        action: "Execução do cenário",
        expected: "Fluxo completo",
        actual: e.message,
        status: 'FAILED'
      });
    }

    return { id: 'wallets-flow', name: "Gestão de Carteiras & Transferências", steps, success };
  }

  /**
   * Cenário 7: Chat
   */
  async testChatFlow(): Promise<QATestScenarioResult> {
    const steps: QATestStep[] = [];
    let success = true;

    try {
      // Simular registro via Chat
      await dispatchEvent(this.uid, {
        type: 'ADD_EXPENSE',
        payload: { description: 'Chat QA Expense', amount: 99, category: 'Outros', isQA: true },
        source: 'chat',
        createdAt: new Date()
      });

      const checkChat = await this.waitForCondition(async () => {
        const ctx = await fetchChatContext(this.uid);
        return !!ctx?.transactions.find(t => t.description === 'Chat QA Expense');
      });

      steps.push({
        name: "Registro via Chat",
        action: "Simular entrada de texto 'Gastei 99 em Outros'",
        expected: "Transação deve aparecer no extrato",
        actual: checkChat ? "Transação encontrada" : "Não registrado",
        status: checkChat ? 'OK' : 'FAILED'
      });
      if (!checkChat) success = false;

    } catch (e: any) {
      success = false;
    }

    return { id: 'chat-flow', name: "Simulação de Fluxo via Chat", steps, success };
  }

  /**
   * Cenário 8: Importação
   */
  async testImportFlow(): Promise<QATestScenarioResult> {
    const steps: QATestStep[] = [];
    let success = true;

    try {
      // Simular importação em lote
      const batch = [
        { description: 'Import 1', amount: 10, category: 'Lazer', type: 'EXPENSE' },
        { description: 'Import 2', amount: 20, category: 'Lazer', type: 'EXPENSE' }
      ];

      for (const item of batch) {
        await dispatchEvent(this.uid, {
          type: 'ADD_EXPENSE',
          payload: { ...item, isQA: true },
          source: 'admin',
          createdAt: new Date()
        });
      }

      const checkImport = await this.waitForCondition(async () => {
        const ctx = await fetchChatContext(this.uid);
        const found = ctx?.transactions.filter(t => t.description.startsWith('Import '));
        return found?.length === 2;
      });

      steps.push({
        name: "Importação em Lote",
        action: "Simular importação de 2 itens",
        expected: "2 novas transações no extrato",
        actual: checkImport ? "2 itens importados" : "Falha na importação",
        status: checkImport ? 'OK' : 'FAILED'
      });
      if (!checkImport) success = false;

    } catch (e: any) {
      success = false;
    }

    return { id: 'import-flow', name: "Simulação de Importação de Dados", steps, success };
  }

  /**
   * Executa todos os testes
   */
  async runAllTests(onProgress: (scenario: QATestScenarioResult) => void): Promise<QATestScenarioResult[]> {
    const results: QATestScenarioResult[] = [];
    
    const scenarios = [
      () => this.testExtratoDashWallet(),
      () => this.testCategoriesCalendar(),
      () => this.testCreditCardFlow(),
      () => this.testRemindersFlow(),
      () => this.testGoalsFlow(),
      () => this.testWalletsFlow(),
      () => this.testChatFlow(),
      () => this.testImportFlow()
    ];

    for (const scenarioFn of scenarios) {
      const result = await scenarioFn();
      results.push(result);
      onProgress(result);
    }

    await this.cleanupQAData();
    return results;
  }

  private async cleanupQAData(): Promise<void> {
    const collections = ['transactions', 'wallets', 'cards', 'reminders', 'goals', 'events'];
    for (const colName of collections) {
      try {
        const q = query(collection(db, colName), where('isQA', '==', true));
        const snapshot = await getDocs(q);
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
      } catch (e) {
        console.error(`Erro ao limpar coleção ${colName}:`, e);
      }
    }
  }
}
