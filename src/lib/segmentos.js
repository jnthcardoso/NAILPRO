/**
 * Fichas de segmento da landing page.
 *
 * A landing (src/pages/Landing.jsx) é "camaleão": o layout é único e os textos
 * vêm daqui, de acordo com o segmento. Cada porta de entrada (manicure,
 * barbearia, ...) fala a língua do seu público, mas leva ao MESMO sistema.
 *
 * Para abrir um novo segmento no futuro: copie um bloco abaixo, troque os
 * textos e adicione a rota em src/App.jsx (ex.: /cabeleireiras).
 *
 * IMPORTANTE: o bloco `manicure` deve permanecer idêntico ao texto histórico
 * da home — é o segmento padrão e o negócio principal hoje.
 */

export const SEGMENTOS = {
  // ── Manicure / nail designer (segmento padrão = home) ──────────────────
  manicure: {
    // <title> da aba + categoria usada no rastreamento (Pixel/GA)
    titulo: 'lumen. | iluminando a gestão, impulsionando o seu talento',
    categoria: 'manicure',

    // Hero
    heroLinha1: 'Você não é só manicure.',
    heroEnfase: 'É dona.',
    heroSub: 'Chega de caderninho, esquecimento e dinheiro sem controle. A Lumen cuida da gestão enquanto você cuida das unhas.',
    heroNota: '"Finalmente sei quanto ganho de verdade." — Letícia, nail designer',

    // Funcionalidades
    funcionalidadesSub: 'Da agenda ao financeiro, do lembrete no WhatsApp ao link de agendamento — tudo num lugar só, feito pra nail designer.',
    beneficioAnamneseTexto: 'Ficha digital da cliente: alergias, saúde das unhas e histórico, tudo guardado.',
    // Textos dentro das mini-ilustrações dos cards de funcionalidade
    visualLembrete: 'Oi Ana! 💅 Confirma seu horário amanhã às 14h?',
    visualAnamRow: 'Saúde das unhas',

    // Depoimentos
    depoimentosTitulo: 'Nail designers reais. Resultados reais.',
    depoimentos: [
      { nome: 'Letícia Prado', cargo: 'Nail designer autônoma · Porto Alegre', texto: 'Antes eu não sabia nem quanto ganhava no mês. Hoje vejo tudo no celular em segundos. A Lumen mudou como eu me vejo como profissional.', iniciais: 'LP' },
      { nome: 'Camila Rossato', cargo: 'Proprietária · Studio CR Nails', texto: 'Minha equipe tem login próprio e cada uma vê só a própria agenda. Acabou a confusão e a falta de profissionalismo. Vale cada centavo.', iniciais: 'CR' },
      { nome: 'Fernanda Oliveira', cargo: 'Nail designer · São Paulo', texto: 'Tentei planilha, tentei caderninho, tentei outros apps. A Lumen é a única que foi feita de verdade pra quem faz unhas. Simples e completa.', iniciais: 'FO' },
    ],

    // Equipe / planos
    equipeLabel: 'para salões com equipe',
    equipeControle: 'Você controla todo o salão.',
    equipeInclusos: 'Dona e recepcionista inclusas',
    profissional: 'manicure', // usado em "cada {profissional} a mais por R$..."
    profissionalPlural: 'Manicures', // troca "Manicures adicionais" na vitrine de planos
    planosSub: 'Para autônomas e salões com equipe. Cancele quando quiser · garantia de 7 dias.',

    // CTA final
    ctaFinalTitulo: 'pronta pra organizar seu salão?',

    // Rodapé
    footerDesc: 'O app de gestão feito para nail designers — agenda, financeiro e clientes num só lugar.',

    // Mockup do app no hero
    mockNome: 'Letícia',
    mockServicos: [
      { hora: '09:00', nome: 'Ana Paula', servico: 'Gel francês' },
      { hora: '11:00', nome: 'Mariana', servico: 'Alongamento gel' },
      { hora: '14:00', nome: 'Carla', servico: 'Manutenção' },
    ],

    // Mensagens de WhatsApp (a do demo identifica de qual página veio o lead)
    whatsappContatoMsg: 'Olá! Quero saber mais sobre a Lumen 💅',
    whatsappDemoMsg: 'Olá! Vim pelo site da Lumen e quero agendar uma demonstração 💅',
  },

  // ── Barbearia (piloto de expansão) ─────────────────────────────────────
  barbearia: {
    titulo: 'Lumen — sistema de gestão e agenda para barbearia',
    categoria: 'barbearia',

    heroLinha1: 'Você não é só barbeiro.',
    heroEnfase: 'É dono.',
    heroSub: 'Chega de agenda no papel, horário esquecido e dinheiro sem controle. A Lumen cuida da gestão enquanto você cuida dos cortes.',
    heroNota: '"Reduzi as faltas e agora sei quanto entra de verdade." — Barbeiro, São Paulo',

    funcionalidadesSub: 'Da agenda ao financeiro, do lembrete no WhatsApp ao link de agendamento — tudo num lugar só, feito pra barbearia.',
    beneficioAnamneseTexto: 'Ficha digital do cliente: preferências de corte, observações e histórico, tudo guardado.',
    visualLembrete: 'Oi João! 💈 Confirma seu horário amanhã às 14h?',
    visualAnamRow: 'Preferência de corte',

    depoimentosTitulo: 'Barbeiros reais. Resultados reais.',
    depoimentos: [
      { nome: 'Barbeiro autônomo', cargo: 'São Paulo · SP', texto: 'Antes eu anotava tudo no caderno e esquecia horário. Agora o cliente confirma sozinho no WhatsApp e as faltas despencaram.', iniciais: 'SP' },
      { nome: 'Dono de barbearia', cargo: 'Belo Horizonte · MG', texto: 'Cada barbeiro tem o próprio login e vê só a própria agenda. Organizou a barbearia e acabou a confusão de horário.', iniciais: 'MG' },
      { nome: 'Barbeiro', cargo: 'Rio de Janeiro · RJ', texto: 'Finalmente sei quanto entra e quanto sai por mês. Parou de ser no "achismo". Vale muito.', iniciais: 'RJ' },
    ],

    equipeLabel: 'para barbearias com equipe',
    equipeControle: 'Você controla toda a barbearia.',
    equipeInclusos: 'Dono e recepção inclusos',
    profissional: 'barbeiro',
    profissionalPlural: 'Barbeiros',
    planosSub: 'Para autônomos e barbearias com equipe. Cancele quando quiser · garantia de 7 dias.',

    ctaFinalTitulo: 'pronto pra organizar sua barbearia?',

    footerDesc: 'O app de gestão feito para barbearias — agenda, financeiro e clientes num só lugar.',

    mockNome: 'Rafael',
    mockServicos: [
      { hora: '09:00', nome: 'João Pedro', servico: 'Corte + Barba' },
      { hora: '10:00', nome: 'Marcos', servico: 'Degradê' },
      { hora: '11:30', nome: 'Felipe', servico: 'Barba' },
    ],

    whatsappContatoMsg: 'Olá! Quero saber mais sobre a Lumen para barbearia 💈',
    whatsappDemoMsg: 'Olá! Vim pela página de barbearia da Lumen e quero agendar uma demonstração 💈',
  },
}

/** Retorna a ficha do segmento, caindo em manicure se não existir. */
export function getSegmento(chave) {
  return SEGMENTOS[chave] || SEGMENTOS.manicure
}
