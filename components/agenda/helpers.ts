export const formatLocalISO = (date: Date): string => {
   const year = date.getFullYear();
   const month = (date.getMonth() + 1).toString().padStart(2, '0');
   const day = date.getDate().toString().padStart(2, '0');
   return `${year}-${month}-${day}`;
};

export const matchDate = (d1: any, d2: any): boolean => {
   if (!d1 || !d2) return false;
   const s1 = typeof d1 === 'string' ? d1.split('T')[0] : formatLocalISO(d1);
   const s2 = typeof d2 === 'string' ? d2.split('T')[0] : formatLocalISO(d2);
   return s1 === s2;
};

export const matchName = (n1: string | null, n2: string | null): boolean => {
   if (!n1 || !n2) return false;
   return n1.trim().toLowerCase() === n2.trim().toLowerCase();
};

export const getWeekDates = (baseDate: Date) => {
   const dates = [];
   const startOfWeek = new Date(baseDate);
   const day = baseDate.getDay();
   // Ajusta para Segunda-feira sendo o início da semana (1)
   const diff = baseDate.getDate() - day + (day === 0 ? -6 : 1);
   startOfWeek.setDate(diff);

   for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      dates.push({
         date: d,
         iso: formatLocalISO(d)
      });
   }
   return dates;
};

export const checkPeriodCompatibility = (periodoAtendimento: number, periodosDisponiveis: string[]) => {
   if (!periodosDisponiveis || periodosDisponiveis.length === 0) return { compativel: true, motivo: '' };
   
   const is6h = periodosDisponiveis.some(p => p.toLowerCase().includes('6 horas'));
   const is4hManha = periodosDisponiveis.some(p => p.toLowerCase().includes('4h manhã'));
   const is4hTarde = periodosDisponiveis.some(p => p.toLowerCase().includes('4h tarde'));
   const is8h = periodosDisponiveis.some(p => p.toLowerCase().includes('8 horas'));

   if (periodoAtendimento === 8) {
      if (is8h) return { compativel: true, motivo: '' };
      return { compativel: false, motivo: 'Profissional não possui disponibilidade de 8 horas cadastrada.' };
   }

   if (periodoAtendimento === 6) {
      if (is6h || is8h) return { compativel: true, motivo: '' };
      return { compativel: false, motivo: 'Profissional possui apenas 4h ou nenhuma disponibilidade compatível com 6 horas.' };
   }

   if (periodoAtendimento === 4) {
      if (is4hManha || is4hTarde || is6h || is8h) return { compativel: true, motivo: '' };
      return { compativel: false, motivo: 'Profissional não possui disponibilidade de 4 horas ou superior.' };
   }

   return { compativel: true, motivo: '' };
};
