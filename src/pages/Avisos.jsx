import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Cake, UserX, Clock, CheckCircle, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useSalao } from '../contexts/SalaoContext'
import { differenceInDays, format, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { DIAS_RETORNO_PADRAO } from '../lib/constants'

export default function Avisos() {
  const { salaoId, isProfissional } = useSalao()
  const navigate = useNavigate()
  const [alertas, setAlertas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (salaoId) load() }, [salaoId])

  async function load() {
    setLoading(true)
    const hoje = format(new Date(), 'yyyy-MM-dd')
    const amanha = format(addDays(new Date(), 1), 'yyyy-MM-dd')
    const lista = []
    const diasAlerta = DIAS_RETORNO_PADRAO

    // Pagamentos pendentes
    const { data: pend } = await supabase.from('pagamentos')
      .select('valor, agendamentos(clientes(nome), servico)')
      .eq('salao_id', salaoId).eq('status', 'pendente')
    if (pend?.length) {
      const total = pend.reduce((s, p) => s + (p.valor || 0), 0)
      lista.push({
        id: 'pag', icon: Clock, cor: '#D97706', bg: '#FEF3C7',
        titulo: `${pend.length} pagamento${pend.length > 1 ? 's' : ''} a receber`,
        sub: `R$ ${total.toFixed(2).replace('.', ',')} pendentes no financeiro`,
        detalhe: pend.slice(0, 4).map(p => p.agendamentos?.clientes?.nome?.split(' ')[0]).filter(Boolean).join(', '),
        to: '/app/financeiro',
        urgente: true,
      })
    }

    // Atendimentos hoje a confirmar
    const { data: hojeAg } = await supabase.from('agendamentos')
      .select('id, clientes(nome), servico, horario')
      .eq('salao_id', salaoId).eq('data', hoje).eq('status', 'pendente')
    if (hojeAg?.length) {
      lista.push({
        id: 'hoje', icon: CheckCircle, cor: '#1E40AF', bg: '#DBEAFE',
        titulo: `${hojeAg.length} atendimento${hojeAg.length > 1 ? 's' : ''} aguardando confirmação hoje`,
        sub: 'Clique para ver e confirmar na agenda',
        detalhe: hojeAg.map(a => `${a.horario?.slice(0,5)} ${a.clientes?.nome?.split(' ')[0]}`).join(' · '),
        to: '/app/agenda',
      })
    }

    // Lembretes de amanhã
    const { data: ags } = await supabase.from('agendamentos')
      .select('lembrete_enviado_em, clientes(nome, telefone)')
      .eq('salao_id', salaoId).eq('data', amanha).in('status', ['pendente', 'confirmado'])
    const lembr = (ags || []).filter(a => !a.lembrete_enviado_em && a.clientes?.telefone)
    if (lembr.length) {
      lista.push({
        id: 'lembr', icon: Bell, cor: '#15803D', bg: '#DCFCE7',
        titulo: `${lembr.length} lembrete${lembr.length > 1 ? 's' : ''} para enviar amanhã`,
        sub: 'Clientes com atendimento amanhã que ainda não receberam lembrete',
        detalhe: lembr.slice(0, 4).map(a => a.clientes?.nome?.split(' ')[0]).join(', '),
        to: '/app/lembretes',
      })
    }

    if (!isProfissional) {
      const { data: cls } = await supabase.from('clientes')
        .select('id, nome, ultimo_atendimento, data_nascimento, arquivada, dias_retorno')
        .eq('salao_id', salaoId)
      const ativas = (cls || []).filter(c => !c.arquivada)

      // Clientes sumidas — usa o ciclo individual (dias_retorno) ou o padrão do salão
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
          to: '/app/clientes',
          urgente: sumidas.length > 3,
        })
      }

      // Aniversariantes
      const aniv = ativas.filter(c => {
        if (!c.data_nascimento) return false
        const n = new Date(c.data_nascimento + 'T12:00:00')
        const a = new Date(new Date().getFullYear(), n.getMonth(), n.getDate())
        const d = differenceInDays(a, new Date())
        return d >= 0 && d <= 7
      })
      if (aniv.length) {
        lista.push({
          id: 'aniv', icon: Cake, cor: '#86198F', bg: '#FAE8FF',
          titulo: `${aniv.length} aniversariante${aniv.length > 1 ? 's' : ''} essa semana 🎂`,
          sub: 'Que tal enviar uma mensagem especial?',
          detalhe: aniv.map(c => c.nome.split(' ')[0]).join(', '),
          to: '/app/clientes',
        })
      }
    }

    setAlertas(lista)
    setLoading(false)
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.iconBox}><Bell size={20} color="white" /></div>
          <div>
            <h1 style={s.title}>Avisos</h1>
            <p style={s.sub}>Ações e alertas do seu salão</p>
          </div>
        </div>
        <button style={s.refreshBtn} onClick={load} title="Atualizar">
          <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      {loading ? (
        <div style={s.empty}>Carregando avisos...</div>
      ) : alertas.length === 0 ? (
        <div style={s.emptyBox}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✨</div>
          <div style={s.emptyTitulo}>Tudo em dia!</div>
          <div style={s.emptySub}>Nenhum aviso no momento. Seu salão está organizado.</div>
        </div>
      ) : (
        <div style={s.lista}>
          {alertas.map(a => {
            const Ico = a.icon
            return (
              <button key={a.id} style={{ ...s.card, ...(a.urgente ? s.cardUrgente : {}) }} onClick={() => navigate(a.to)}>
                <div style={{ ...s.cardIcon, background: a.bg, color: a.cor }}>
                  <Ico size={22} />
                </div>
                <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                  <div style={s.cardTitulo}>{a.titulo}</div>
                  <div style={s.cardSub}>{a.sub}</div>
                  {a.detalhe && <div style={s.cardDetalhe}>{a.detalhe}</div>}
                </div>
                <div style={{ ...s.cardSeta, color: a.cor }}>→</div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

const s = {
  page: { padding: '20px 20px 80px' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  iconBox: { width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #8B2655 0%, #C13B7A 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(139,38,85,0.3)' },
  title: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0 },
  sub: { fontSize: 12, color: 'var(--text3)', margin: '2px 0 0' },
  refreshBtn: { width: 36, height: 36, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text2)' },
  lista: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: { display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 18px', cursor: 'pointer', fontFamily: 'inherit', width: '100%', boxShadow: 'var(--shadow-xs)', transition: 'box-shadow 0.15s' },
  cardUrgente: { border: '1.5px solid #FCA5A5', background: '#FFF9F9' },
  cardIcon: { width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardTitulo: { fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 3 },
  cardSub: { fontSize: 12, color: 'var(--text2)', lineHeight: 1.4 },
  cardDetalhe: { fontSize: 11, color: 'var(--text3)', marginTop: 4, fontStyle: 'italic' },
  cardSeta: { fontSize: 18, fontWeight: 700, flexShrink: 0, opacity: 0.7 },
  empty: { textAlign: 'center', color: 'var(--text3)', padding: 40, fontSize: 13 },
  emptyBox: { textAlign: 'center', padding: '60px 20px' },
  emptyTitulo: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 6 },
  emptySub: { fontSize: 14, color: 'var(--text3)', lineHeight: 1.5 },
}
