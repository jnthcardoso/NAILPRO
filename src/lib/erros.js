/**
 * Tradução de erros técnicos → mensagens amigáveis em português.
 *
 * Motivo: o `error.message` do Supabase/Postgres é técnico e em inglês
 * ("Failed to fetch", "duplicate key value violates unique constraint…",
 * "new row violates row-level security policy"). Mostrar isso direto pro
 * usuário (que não é dev) — ou pior, pra cliente do salão na agenda pública —
 * é ruído. Esta função traduz os casos comuns e, no que não reconhecer, cai
 * num texto de contexto que VOCÊ define em cada chamada.
 *
 * Uso:
 *   import { traduzErro } from '../lib/erros'
 *   if (error) { erro(traduzErro(error, 'Não foi possível carregar as clientes.')); return }
 *
 * O erro cru continua disponível no console (F12) pra depuração.
 */
export function traduzErro(error, contexto = 'Algo deu errado. Tente novamente em instantes.') {
  const msg = (error?.message || error?.error_description || '').toLowerCase()

  // Loga o cru pra você conseguir depurar sem expor ao usuário.
  if (error) console.warn('[erro]', error?.code || '', error?.message || error)

  if (!msg) return contexto

  // ── Rede / conexão ──
  if (/failed to fetch|networkerror|fetch|timeout|timed out|load failed/.test(msg)) {
    return 'Sem conexão com a internet. Verifique sua rede e tente de novo.'
  }

  // ── Permissão / RLS ──
  if (/row-level security|permission denied|not authorized|forbidden|jwt|rls/.test(msg)) {
    return 'Você não tem permissão para fazer isso.'
  }

  // ── Duplicidade / conflito ──
  if (/duplicate key|already exists|unique constraint|violates unique/.test(msg)) {
    return 'Esse registro já existe.'
  }

  // ── Mensagens que os próprios RPCs do agendamento público disparam ──
  // (vêm em pt-br minúsculo; aqui viram texto amigável pra cliente do salão)
  if (/horario ja reservado|horario indispon/.test(msg)) return 'Esse horário acabou de ser reservado. Escolha outro, por favor.'
  if (/horario no passado|data no passado/.test(msg))    return 'Esse horário já passou. Escolha uma data ou horário futuro.'
  if (/agenda nao encontrada|inativa/.test(msg))         return 'Esta agenda não está disponível no momento.'
  if (/telefone invalido/.test(msg))                     return 'WhatsApp inválido. Confira o DDD e o número.'
  if (/nome invalido|nome muito longo/.test(msg))        return 'Confira o nome digitado.'
  if (/limite de agendamentos atingido/.test(msg))       return 'Você já tem agendamentos demais em aberto. Aguarde a confirmação dos anteriores.'
  if (/profissional invalida/.test(msg))                 return 'Profissional indisponível. Escolha outra opção.'

  // ── Não reconhecido: usa o contexto que a tela passou ──
  return contexto
}
