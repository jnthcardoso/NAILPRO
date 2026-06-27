import { format, startOfMonth, endOfMonth, subDays, parseISO, differenceInDays } from 'date-fns'
import { DIAS_RETORNO_PADRAO } from './constants'

// Calcula o "recap do mês" de um salão para um mês (mesDate = qualquer dia do mês).
// Usado na aba "Meu mês" (Metas) e no card de início de mês na Home.
// No mês corrente, corta no dia de hoje (não conta o futuro).
export async function carregarRecap(supabase, { salaoId, gerenciaTudo = false, mesDate = new Date() }) {
  const inicio = format(startOfMonth(mesDate), 'yyyy-MM-dd')
  const fimMes = format(endOfMonth(mesDate), 'yyyy-MM-dd')
  const hojeStr = format(new Date(), 'yyyy-MM-dd')
  const fim = fimMes > hojeStr ? hojeStr : fimMes
  const inicioTs = inicio + 'T00:00:00'
  const fimTs = fim + 'T23:59:59'
  // Janela para detectar "recuperadas": 1 ano antes do mês até o fim do período.
  const janelaRecup = format(subDays(startOfMonth(mesDate), 365), 'yyyy-MM-dd')

  const [cfgRes, pagsRes, novasRes, cobrRes, confRes, realizRes, despRes, clientesRes] = await Promise.all([
    supabase.from('configuracoes').select('dias_retorno_alerta, pro_labore').eq('salao_id', salaoId).maybeSingle(),
    supabase.from('pagamentos').select('valor, agendamento_id, agendamentos(status, cliente_id)')
      .eq('salao_id', salaoId).eq('status', 'pago').gte('data', inicio).lte('data', fim),
    supabase.from('clientes').select('id', { count: 'exact', head: true })
      .eq('salao_id', salaoId).eq('arquivada', false).gte('created_at', inicioTs).lte('created_at', fimTs),
    supabase.from('pagamentos').select('valor, agendamentos(status)')
      .eq('salao_id', salaoId).eq('status', 'pago').gte('pago_em', inicioTs).lte('pago_em', fimTs),
    supabase.from('agendamentos').select('id', { count: 'exact', head: true })
      .eq('salao_id', salaoId).gte('confirmado_link_em', inicioTs).lte('confirmado_link_em', fimTs),
    supabase.from('agendamentos').select('cliente_id, data')
      .eq('salao_id', salaoId).eq('status', 'realizado').gte('data', janelaRecup).lte('data', fim),
    gerenciaTudo
      ? supabase.from('despesas').select('valor, tipo').eq('salao_id', salaoId).gte('data', inicio).lte('data', fim)
      : Promise.resolve({ data: [] }),
    supabase.from('clientes').select('id, dias_retorno').eq('salao_id', salaoId),
  ])

  const cicloPadrao = cfgRes.data?.dias_retorno_alerta || DIAS_RETORNO_PADRAO
  const proLabore = cfgRes.data?.pro_labore || 0

  // Faturamento recebido (exclui pagamento de atendimento cancelado).
  const pagos = (pagsRes.data || []).filter(p => p.agendamentos?.status !== 'cancelado')
  const receita = pagos.reduce((s, p) => s + (p.valor || 0), 0)
  const valorPorCliente = {}
  pagos.forEach(p => {
    const cid = p.agendamentos?.cliente_id
    if (cid) valorPorCliente[cid] = (valorPorCliente[cid] || 0) + (p.valor || 0)
  })

  const novas = novasRes.count || 0

  // Recebido de pendências: pagamentos que estavam pendentes e foram quitados no
  // mês (pago_em no período), com ou sem o WhatsApp de cobrança. É o dinheiro que
  // a aba de pendentes do Lumen ajudou a recuperar. Exclui atendimento cancelado.
  const pendPagas = (cobrRes.data || []).filter(p => p.agendamentos?.status !== 'cancelado')
  const pendenciasPagasValor = pendPagas.reduce((s, p) => s + (p.valor || 0), 0)
  const pendenciasPagasQtd = pendPagas.length

  const confirmacoesLink = confRes.count || 0

  // Atendimentos realizados no mês.
  const realiz = realizRes.data || []
  const atendimentos = realiz.filter(a => a.data >= inicio && a.data <= fim).length

  // Recuperadas: cliente com atendimento no mês cujo atendimento ANTERIOR (antes do
  // 1º do mês) ficou >= ciclo dela atrás = estava sumida e voltou. Valor = o que ela
  // pagou no mês. Quem nunca tinha vindo antes é "nova", não conta como recuperada.
  const cicloPorCliente = {}
  ;(clientesRes.data || []).forEach(c => { cicloPorCliente[c.id] = c.dias_retorno || cicloPadrao })
  const datasPorCliente = {}
  realiz.forEach(a => {
    if (!a.cliente_id) return
    ;(datasPorCliente[a.cliente_id] = datasPorCliente[a.cliente_id] || []).push(a.data)
  })
  let recuperadasQtd = 0, recuperadasValor = 0
  Object.entries(datasPorCliente).forEach(([cid, datas]) => {
    datas.sort()
    const primeiroNoMes = datas.find(d => d >= inicio && d <= fim)
    if (!primeiroNoMes) return
    const anteriores = datas.filter(d => d < primeiroNoMes)
    if (!anteriores.length) return
    const ultimoAntes = anteriores[anteriores.length - 1]
    const gap = differenceInDays(parseISO(primeiroNoMes), parseISO(ultimoAntes))
    if (gap >= (cicloPorCliente[cid] || cicloPadrao)) {
      recuperadasQtd++
      recuperadasValor += valorPorCliente[cid] || 0
    }
  })

  // Lucro (só dona/recepção).
  let lucro = null
  if (gerenciaTudo) {
    const despSalao = (despRes.data || []).filter(d => d.tipo !== 'pessoal').reduce((s, d) => s + (d.valor || 0), 0)
    lucro = receita - despSalao - proLabore
  }

  return {
    receita, lucro, atendimentos, novas,
    recuperadasQtd, recuperadasValor,
    pendenciasPagasValor, pendenciasPagasQtd,
    confirmacoesLink,
    temAlgumDado: receita > 0 || atendimentos > 0 || novas > 0,
  }
}
