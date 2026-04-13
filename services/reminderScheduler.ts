
import { db } from './firebaseConfig';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { Bill, UserSession } from '../types';
import { formatCurrency } from './summaryService';
import { sendMessageToFirestore } from './chatService';

export const checkAndSendReminderNotifications = async (user: UserSession, reminders: Bill[]) => {
  if (!user || !user.uid || !reminders.length || !user.onboardingStatus?.completed) return;

  const now = new Date();
  // Normalizar hoje para o início do dia para comparação precisa
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  for (const bill of reminders) {
    // Pular se já pago, recebido ou sem data
    if (bill.isPaid || bill.status === 'paid' || bill.status === 'received' || !bill.dueDate) continue;

    const dueDate = new Date(bill.dueDate);
    // Normalizar dueDate para o início do dia
    const normalizedDueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    
    const diffTime = normalizedDueDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    // 7 dias antes
    if (diffDays === 7 && !bill.notified7d) {
      const dedupeKey = `reminder-7d-${bill.id}-${today.getTime()}`;
      await sendReminderMessage(user.uid, bill, `Você tem uma conta chegando em breve:\n**${bill.description}** - ${formatCurrency(bill.amount)}\nVence em ${normalizedDueDate.toLocaleDateString('pt-BR')}.`, dedupeKey);
      await updateDoc(doc(db, "users", user.uid, "reminders", bill.id), { notified7d: true, updatedAt: serverTimestamp() });
    }

    // 1 dia antes
    if (diffDays === 1 && !bill.notified1d) {
      const dedupeKey = `reminder-1d-${bill.id}-${today.getTime()}`;
      await sendReminderMessage(user.uid, bill, `Sua conta vence amanhã:\n**${bill.description}** - ${formatCurrency(bill.amount)}\nJá está tudo certo para pagar?`, dedupeKey);
      await updateDoc(doc(db, "users", user.uid, "reminders", bill.id), { notified1d: true, updatedAt: serverTimestamp() });
    }

    // No dia do vencimento
    if (diffDays === 0 && !bill.notifiedOnDay) {
      const dedupeKey = `reminder-0d-${bill.id}-${today.getTime()}`;
      await sendReminderMessage(
        user.uid, 
        bill, 
        `Hoje vence:\n**${bill.description}** - ${formatCurrency(bill.amount)}\n\nVocê já pagou essa conta?`, 
        dedupeKey, 
        'BILL_REMINDER', 
        { billId: bill.id, description: bill.description, amount: bill.amount }
      );
      await updateDoc(doc(db, "users", user.uid, "reminders", bill.id), { notifiedOnDay: true, updatedAt: serverTimestamp() });
    }
  }
};

const sendReminderMessage = async (uid: string, bill: Bill, text: string, dedupeKey: string, actionType?: string, actionPayload?: any) => {
  // Verificar se já existe essa mensagem para evitar duplicidade visual se o componente remontar
  const q = query(
    collection(db, "users", uid, "chat_messages"),
    where("dedupeKey", "==", dedupeKey)
  );
  const snap = await getDocs(q);
  
  if (snap.empty) {
    await sendMessageToFirestore(uid, text, 'ai', dedupeKey, actionType, actionPayload);
  }
};
