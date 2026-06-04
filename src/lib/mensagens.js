// Mensagens padrão das "Oportunidades da semana" e helper de variáveis.
// As donas podem editar os textos em Configurações; quando vazio, usa o padrão.
// Variáveis suportadas: {nome} (primeiro nome), {nome_completo}, {salao}.

export const MSG_ANIVERSARIO_PADRAO =
  'Oi {nome}! 🎉 Passei aqui pra te desejar um feliz aniversário! Preparei um agrado especial pra você comemorar com as unhas lindas. Bora marcar? 💅'

export const MSG_RETORNO_PADRAO =
  'Oi {nome}! 💅 Senti sua falta por aqui! Que tal agendar um horário pra deixar suas unhas em dia? Tenho novidades pra te mostrar 😊'

// Troca as variáveis do template pelos dados reais da cliente/salão.
export function aplicarVariaveis(template, { nome = '', salao = '' } = {}) {
  // Aceita {salão}/{salao} (com ou sem til).
  return (template || '')
    .replace(/\{nome_completo\}/gi, nome || '')
    .replace(/\{nome\}/gi, (nome || '').split(' ')[0])
    .replace(/\{sal[aã]o\}/gi, salao || '')
}
