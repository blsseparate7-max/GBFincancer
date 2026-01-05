
import { UserSession, Transaction, SavingGoal } from "../types";

/**
 * Este serviço é a ponte para o seu banco de dados real.
 * Para colocar no ar hoje, ele usa o LocalStorage como 'cache' 
 * e prepara o JSON pronto para seu Firebase.
 */

export const syncUserData = async (userId: string, data: any) => {
  // Simula latência de rede para feedback visual de 'Salvando na Nuvem'
  return new Promise((resolve) => {
    const dataWithTimestamp = { ...data, lastSync: new Date().toISOString() };
    localStorage.setItem(`finai_cloud_backup_${userId}`, JSON.stringify(dataWithTimestamp));
    
    // Aqui você faria o fetch para seu Firebase:
    // fetch('https://seu-projeto.firebaseio.com/users/' + userId, { method: 'POST', body: JSON.stringify(data) })
    
    setTimeout(() => resolve(true), 1200);
  });
};

export const getGlobalAdminStats = () => {
  const users: any[] = [];
  let totalMRR = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('finai_user_')) {
      const user = JSON.parse(localStorage.getItem(key) || '{}');
      users.push(user);
      totalMRR += user.plan === 'MONTHLY' ? 29.90 : 24.90; // Média mensal
    }
  }

  return { users, totalMRR };
};
