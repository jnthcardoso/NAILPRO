// Mensagens padrão das "Oportunidades da semana" / cobrança e helper de variáveis.
// As donas podem editar os textos em Configurações; quando vazio, usa o padrão.
// Variáveis suportadas: {nome} (primeiro nome), {nome_completo}, {salao},
// {servico}, {valor}, {pix} (estas três só fazem sentido na cobrança).

export const MSG_ANIVERSARIO_PADRAO =
  'Oi {nome}! 🎉 Passei aqui pra te desejar um feliz aniversário! Preparei um agrado especial pra você comemorar com as unhas lindas. Bora marcar? 💅'

export const MSG_RETORNO_PADRAO =
  'Oi {nome}! 💅 Senti sua falta por aqui! Que tal agendar um horário pra deixar suas unhas em dia? Tenho novidades pra te mostrar 😊'

export const MSG_COBRANCA_PADRAO =
  'Oi {nome}! 💅 Passando pra lembrar do seu atendimento ({servico}) no valor de {valor}. Pode pagar pelo Pix: {pix}. 💜 Qualquer dúvida me chama!'

export const MSG_SINAL_PADRAO =
  'Oi {nome}! 💅 Pra confirmar e garantir seu horário, peço um sinal antecipado pelo Pix: {pix}. Assim sua vaga fica reservada 💜'

// Troca as variáveis do template pelos dados reais da cliente/salão.
// pix/servico/valor são opcionais — usados na mensagem de cobrança. Quando a
// chave Pix está vazia, removemos a linha/trecho do Pix pra não sobrar um buraco.
export function aplicarVariaveis(template, { nome = '', salao = '', servico = '', valor = '', pix = '' } = {}) {
  let texto = (template || '')
    .replace(/\{nome_completo\}/gi, nome || '')
    .replace(/\{nome\}/gi, (nome || '').split(' ')[0])
    .replace(/\{sal[aã]o\}/gi, salao || '')
    .replace(/\{servi[cç]o\}/gi, servico || '')
    .replace(/\{valor\}/gi, valor || '')

  // Pix vazio: remove a frase inteira que contém {pix} (incluindo a pontuação
  // que a encerra), pra não deixar "Pix: " nem ponto solto. Com chave, só substitui.
  if (pix) {
    texto = texto.replace(/\{pix\}/gi, pix)
  } else {
    texto = texto
      .replace(/[^.!?\n]*\{pix\}[^.!?\n]*[.!?]?/gi, '')
      .replace(/ {2,}/g, ' ')
      .replace(/\s+([.!?])/g, '$1')
      .trim()
  }
  return texto
}
