
import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => {
  const v1 = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  const v2 = process.env.GEMINI_API_KEY;
  const v3 = process.env.API_KEY;

  console.log("GB Debug - Verificando chaves:");
  console.log("- VITE_GEMINI_API_KEY:", v1 ? "Presente (começa com " + v1.substring(0, 4) + ")" : "Ausente");
  console.log("- process.env.GEMINI_API_KEY:", v2 ? "Presente" : "Ausente");
  console.log("- process.env.API_KEY:", v3 ? "Presente" : "Ausente");

  const apiKey = v1 || v2 || v3;
  
  if (!apiKey || apiKey === 'undefined' || apiKey === '' || apiKey === 'null') {
    return null;
  }
  
  return new GoogleGenAI({ apiKey });
};

const FINANCE_PARSER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    event: {
      type: Type.OBJECT,
      properties: {
        type: { 
          type: Type.STRING, 
          enum: ['ADD_EXPENSE', 'ADD_INCOME', 'CREATE_GOAL', 'ADD_TO_GOAL', 'UPDATE_LIMIT', 'CREATE_REMINDER', 'ADD_CARD_CHARGE', 'PAY_CARD'] 
        },
        payload: { 
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER },
            category: { type: Type.STRING },
            description: { type: Type.STRING },
            paymentMethod: { type: Type.STRING, enum: ['CASH', 'PIX', 'CARD'] },
            cardId: { type: Type.STRING },
            dueDay: { type: Type.NUMBER },
            name: { type: Type.STRING },
            targetAmount: { type: Type.NUMBER },
            location: { type: Type.STRING },
            goalId: { type: Type.STRING }
          }
        }
      },
      required: ["type", "payload"]
    },
    reply: { type: Type.STRING }
  },
  required: ["reply"]
};

export const parseMessage = async (text: string, userName: string, context?: { reminders?: any[] }) => {
  try {
    const ai = getAI();
    if (!ai) return { reply: "IA Indisponível." };

    const today = new Date().toISOString().split('T')[0];
    const remindersContext = context?.reminders ? 
      `CONTEXTO DE LEMBRETES (Contas a vencer): ${JSON.stringify(context.reminders.map(r => ({ desc: r.description, valor: r.amount, dia: r.dueDay, pago: r.isPaid })))}` : 
      'Sem lembretes cadastrados.';
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Você é o GB, mentor financeiro de ${userName}. Hoje é ${today}.
      
      ${remindersContext}

      COMANDOS ESPECIAIS:
      - Se a mensagem for "GERAR_RESUMO_MATINAL": Gere um resumo motivador e informativo BASEADO NOS LEMBRETES ACIMA. 
        Mencione especificamente as contas que vencem hoje ou nos próximos dias. Se não houver contas próximas, dê uma dica de economia.
        Ex: "Bom dia, ${userName}! ☀️ Hoje vencem 2 contas (Luz e Internet). Seu saldo livre é R$ 1.200. Vamos manter o foco nos seus objetivos hoje?"
      
      REGRAS DE CATEGORIZAÇÃO E MAPEAMENTO:
      Sempre mapeie a categoria para um destes nomes EXATOS:
      - ALIMENTAÇÃO: Restaurante, Ifood, Rappi, Mercado, Padaria, Açougue, Feira, Marmita, Almoço, Jantar, Café, Pizza, Hambúrguer, Sushi, Churrasco, Compras, Lanche, Lanches, Salgado, Pastel, Coxinha, Padoca, Atacadão, Carrefour, Pão de Açúcar, Extra, Assaí, Quitanda, Empório, Cafeteria, McDonald's, Burger King, Subway, Sorvete, Doce, Bolo, Padaria, Supermercado, Mercearia, Conveniência, Bar, Boteco, Cerveja, Refrigerante, Suco, Água, Sobremesa, Hortifruti, Sacolão, Atacado, Varejo.
      - TRANSPORTE: Uber, 99, Táxi, Gasolina, Combustível, Álcool, Diesel, Ônibus, Metrô, Trem, Passagem, Viagem, Pedágio, Estacionamento, Oficina, Mecânico, Pneu, Revisão, Seguro, IPVA, Licenciamento, Multa, Lavagem, Carona, Bike, Patinete, Aluguel de Carro, Balsa, Avião, Aeroporto, Posto, GNV, Shell, Ipiranga, Petrobras, BR, Lubrificante, Troca de Óleo, Alinhamento, Balanceamento, Funilaria, Pintura, Auto Elétrica, Borracharia, Peças, Acessórios, Rodoviária, Bilhete Único, VLT.
      - MORADIA: Aluguel, Condomínio, IPTU, Luz, Energia, Água, Gás, Internet, Telefone, Celular, TV, Streaming, Netflix, Spotify, Limpeza, Faxina, Reforma, Móveis, Decoração, Utensílios, Reparos, Eletricista, Encanador, Pintura, Jardinagem, Piscina, Segurança, Monitoramento, Seguro Residencial, Lavanderia, Enel, Sabesp, Comgás, Vivo, Claro, Tim, Oi, Sky, Amazon Prime, Disney+, HBO Max, Globoplay, Leroy Merlin, Telhanorte, C&C, Tok&Stok, Etna, Camicado, Zelo.
      - SAÚDE: Farmácia, Remédio, Médico, Consulta, Dentista, Exame, Hospital, Pronto Socorro, Plano de Saúde, Academia, Suplemento, Terapia, Psicólogo, Fisioterapia, Ótica, Óculos, Lente, Vacina, Cirurgia, Internação, Ambulância, Massagem, Yoga, Pilates, Crossfit, Natação, Esporte, Clínica, Laboratório, Droga Raia, Drogasil, Pague Menos, Ultrafarma, Drogaria São Paulo, Onofre, Unimed, Amil, Bradesco Saúde, SulAmérica, Porto Seguro, Smart Fit, Bluefit, Selfit, Bio Ritmo, Personal Trainer, Nutricionista.
      - EDUCAÇÃO: Escola, Faculdade, Curso, Mensalidade, Livro, Material, Caderno, Caneta, Mochila, Curso Online, Udemy, Hotmart, Inglês, Idiomas, Pós-graduação, Mestrado, Doutorado, Workshop, Palestra, Evento, Certificação, Treinamento, Tutoria, Aula Particular, Intercâmbio, Biblioteca, Xerox, Impressão, Alura, Coursera, edX, Khan Academy, Duolingo, CNA, Fisk, Wizard, Cultura Inglesa, Wise Up, FGV, PUC, USP, UNIP, Estácio, Mackenzie, Senac, Senai, Sebrae, Papelaria, Livraria.
      - LAZER: Cinema, Teatro, Show, Festa, Balada, Evento, Museu, Parque, Viagem, Hotel, Airbnb, Pousada, Praia, Clube, Boliche, Games, Jogos, Steam, Playstation, Xbox, Nintendo, Hobby, Colecionável, Fotografia, Arte, Leitura, Revista, Jornal, Passeio, Férias, Cruzeiro, Youtube, Twitch, TikTok, Instagram, Facebook, Twitter, Tinder, Happn, Bumble, Badoo, Grindr, Eventim, Sympla, Ingresso.com, Ticketmaster, Rock in Rio, Lollapalooza, Carnaval, Réveillon.
      - PESSOAL: Roupas, Sapatos, Acessórios, Beleza, Salão, Cabeleireiro, Manicure, Maquiagem, Perfume, Cosmético, Presente, Doação, Dízimo, Caridade, Pet, Ração, Veterinário, Banho e Tosa, Brinquedo, Higiene, Sabonete, Shampoo, Desodorante, Pasta de Dente, Barbear, Depilação, Estética, Spa, Joia, Relógio, Zara, H&M, C&A, Renner, Riachuelo, Marisa, Youcom, Reserva, Arezzo, Schutz, Melissa, Nike, Adidas, Puma, Reebok, O Boticário, Natura, Avon, Sephora, MAC.
      - FINANCEIRO: Investimento, Ações, Fundos, Tesouro, Poupança, Juros, Multa, Tarifa, Anuidade, Empréstimo, Financiamento, Dívida, Parcelamento, Cartão, Fatura, Seguro de Vida, Previdência, Imposto, IRPF, Taxas, Corretagem, Câmbio, Dólar, Euro, Cripto, Bitcoin, Carteira, Banco, Transferência, Itaú, Bradesco, Santander, Banco do Brasil, Caixa, Nubank, Inter, C6 Bank, BTG Pactual, XP Investimentos, Rico, Clear, Avenue, Binance, Mercado Pago, PicPay, PagSeguro, PayPal, Wise.
 
      REGRAS DE MAPEAMENTO DE EVENTOS:
      - "Gastei 50 no cartão": type='ADD_CARD_CHARGE', cardId='default'
      - "Gastei 50 em dinheiro/pix": type='ADD_EXPENSE'
      - "Paguei a fatura do cartão de 300": type='PAY_CARD', cardId='default', amount=300
      - "Limite de X para categoria Y": type='UPDATE_LIMIT'
      - "Lembrete de conta Z dia W": type='CREATE_REMINDER'
      - "Guardar 100 na meta Reserva": type='ADD_TO_GOAL', amount=100, name='Reserva'
      - "Criar meta Carro de 50000": type='CREATE_GOAL', name='Carro', targetAmount=50000, location='Banco'
      
      REPOSTA (reply):
      Confirme o valor, categoria e diga onde foi refletido.
      Ex: "✅ Feito! R$ 100 guardados na meta Reserva. Seu progresso foi atualizado!"
      
      MENSAGEM: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: FINANCE_PARSER_SCHEMA
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (e) {
    return { reply: "Entendi. Pode me dar os detalhes para eu registrar?" };
  }
};
