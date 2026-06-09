import { useCallback, useEffect, useState } from 'react'
import { Bell, Cake, UserX, Clock, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useSalao } from '../contexts/SalaoContext'
import { differenceInDays, differenceInCalendarDays, format, addDays } from 'date-fns'
import { DIAS_RETORNO_PADRAO } from '../lib/constants'
import { formatBRL, validarTelefone } from '../lib/formatters'

// Fonte única dos "Avisos do salão" — usada pela página /app/avisos e pelo
// contador do sino. Antes essa lógica estava duplicada (página + Notificacoes),
// o que fazia uma correção valer num lugar e no outro não.
export function useAvisos() {
  const { salaoId, isProfissional } = useSalao()
  const [alertas, setAlertas] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!salaoId) return
    setLoading(true)
    const hoje = format(new Date(), 'yyyy-MM-dd')
    const agora = format(new Date(), 'HH:mm')
    const amanha = format(addDays(new Date(), 1), 'yyyy-MM-dd')
    const lista = []
    const diasAlerta = DIAS_RETORNO_PADRAO

    // Pagamentos a receber — só os já vencidos (data <= hoje). Agendamentos
    // futuros ainda não são "a receber", então não entram na conta.
    const { data: pend } = await supabase.from('pagamentos')
      .select('valor, agendamentos(clientes(nome), servico)')
      .eq('salao_id', salaoId).eq('status', 'pendente').lte('data', hoje)
    if (pend?.length) {
      const total = pend.reduce((s, p) => s + (p.valor || 0), 0)
      lista.push({
        id: 'pag', icon: Clock, cor: '#D97706', bg: '#FEF3C7',
        titulo: `${pend.length} pagamento${pend.length > 1 ? 's' : ''} a receber`,
        sub: `${formatBRL(total)} pendentes no financeiro`,
        detalhe: pend.slice(0, 4).map(p => p.agendamentos?.clientes?.nome?.split(' ')[0]).filter(Boolean).join(', '),
        to: '/app/financeiro',
        urgente: true,
      })
    }

    // Atendimentos de hoje a confirmar — só os horários que ainda vão acontecer.
    const { data: hojeAg } = await supabase.from('agendamentos')
      .select('id, clientes(nome), servico, horario')
      .eq('salao_id', salaoId).eq('data', hoje).eq('status', 'pendente')
    const hojeFuturos = (hojeAg || []).filter(a => (a.horario?.slice(0, 5) || '99:99') >= agora)
    if (hojeFuturos.length) {
      lista.push({
        id: 'hoje', icon: CheckCircle, cor: '#1E40AF', bg: '#DBEAFE',
        titulo: `${hojeFuturos.length} atendimento${hojeFuturos.length > 1 ? 's' : ''} aguardando confirmação hoje`,
        sub: 'Clique para ver e confirmar na agenda',
        detalhe: hojeFuturos.map(a => `${a.horario?.slice(0, 5)} ${a.clientes?.nome?.split(' ')[0]}`).join(' · '),
        to: '/app/agenda',
      })
    }

    // Lembretes de amanhã — só p/ quem gerencia (a página de Lembretes é bloqueada
    // p/ a profissional) e se os lembretes estiverem ativos nas Configurações.
    if (!isProfissional) {
      const { data: cfg } = await supabase.from('configuracoes')
        .select('lembretes_ativos').eq('salao_id', salaoId).maybeSingle()
      if (cfg?.lembretes_ativos !== false) {
        const { data: ags } = await supabase.from('agendamentos')
          .select('lembrete_enviado_em, clientes(nome, telefone)')
          .eq('salao_id', salaoId).eq('data', amanha).in('status', ['pendente', 'confirmado'])
        // Mesmo critério da página de Lembretes: telefone precisa ser válido.
        const lembr = (ags || []).filter(a => !a.lembrete_enviado_em && validarTelefone(a.clientes?.telefone))
        if (lembr.length) {
          lista.push({
            id: 'lembr', icon: Bell, cor: '#15803D', bg: '#DCFCE7',
            titulo: `${lembr.length} lembrete${lembr.length > 1 ? 's' : ''} para enviar amanhã`,
            sub: 'Clientes com atendimento amanhã que ainda não receberam lembrete',
            detalhe: lembr.slice(0, 4).map(a => a.clientes?.nome?.split(' ')[0]).join(', '),
            to: '/app/lembretes',
          })
        }
      }
    }

    // Clientes sumidas + aniversariantes — só dona/recepção (dados do salão inteiro).
    if (!isProfissional) {
      const { data: cls } = await supabase.from('clientes')
        .select('id, nome, ultimo_atendimento, data_nascimento, arquivada, dias_retorno')
        .eq('salao_id', salaoId)
      const ativas = (cls || []).filter(c => !c.arquivada)

      // Usa o ciclo individual (dias_retorno) ou o padrão do salão.
      const sumidas = ativas.filter(c =>
        c.ultimo_atendimento &&
        differenceInDays(new Date(), new Date(c.ultimo_atendimento + 'T12:00:00')) >= (c.dias_retorno ?? diasAlerta)
      )
      if (sumidas.length) {
        lista.push({
          id: 'sumidas', icon: UserX, cor: '#B91C1C', bg: '#FEE2E2',
          titulo: `${sumidas.length} ${sumidas.length > 1 ? 'clientes passaram' : 'cliente passou'} do retorno`,
          sub: 'Clientes sem atendimento há muito tempo — que tal entrar em contato?',
          detalhe: sumidas.slice(0, 5).map(c => c.nome.split(' ')[0]).join(', '),
          to: '/app/clientes?filtro=sumidas',
          urgente: sumidas.length > 3,
        })
      }

      const aniv = ativas.filter(c => {
        if (!c.data_nascimento) return false
        const n = new Date(c.data_nascimento + 'T12:00:00')
        const a = new Date(new Date().getFullYear(), n.getMonth(), n.getDate())
        const d = differenceInCalendarDays(a, new Date())   // dias de calendário (ignora a hora)
        return d >= 0 && d <= 7
      })
      if (aniv.length) {
        lista.push({
          id: 'aniv', icon: Cake, cor: '#86198F', bg: '#FAE8FF',
          titulo: `${aniv.length} aniversariante${aniv.length > 1 ? 's' : ''} essa semana 🎂`,
          sub: 'Que tal enviar uma mensagem especial?',
          detalhe: aniv.map(c => c.nome.split(' ')[0]).join(', '),
          to: '/app/clientes?filtro=aniversariantes',
        })
      }
    }

    setAlertas(lista)
    setLoading(false)
  }, [salaoId, isProfissional])

  useEffect(() => { load() }, [load])

  return { alertas, loading, reload: load }
}
