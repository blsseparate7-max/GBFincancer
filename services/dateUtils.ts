
export const parseSafeDate = (dateStr?: string | null): Date => {
  if (!dateStr || dateStr === 'null' || dateStr === 'undefined') return new Date();
  
  let formattedDate = dateStr;
  
  // Se for YYYY-MM-DD (comum no banco), injeta meio-dia para evitar problemas de fuso
  // Isso garante que permaneça no dia correto mesmo em UTC-3 por exemplo
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    formattedDate = `${dateStr}T12:00:00`;
  }
  
  const d = new Date(formattedDate);
  return isNaN(d.getTime()) ? new Date() : d;
};

export const isSameDay = (d1: Date, d2: Date): boolean => {
  return d1.getDate() === d2.getDate() && 
         d1.getMonth() === d2.getMonth() && 
         d1.getFullYear() === d2.getFullYear();
};

export const getMonthName = (date: Date): string => {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(date);
};
