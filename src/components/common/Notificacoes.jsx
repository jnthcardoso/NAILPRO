import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, X, Cake, UserX, Clock, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useSalao } from '../../contexts/SalaoContext'
import { differenceInDays, format, addDays } from 'date-fns'
import { DIAS_RETORNO_PADRAO } from '../../lib/constants'
import { formatBRL } from '../../lib/formatters'

const SEEN_KEY = 'notif_seen_ids'

function getSeenIds() {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]') } catch { return [] }
}
function saveSeenIds(ids) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(ids)) } catch {}
}

export default function Notificacoes({ variant = 'header', collapsed = false }) {
  const { salaoId, isProfissional } = useSalao()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [alertas, setAlertas] = useState([])
  const [seenIds, setSeenIds] = useState(getSeenIds)

  useEffect(() => { if (salaoId) load() }, [salaoId, isProfissional])

  // Ao abrir o painel: marca todos os alertas atuais como lidos
  useEffect(() => {
    if (!open || alertas.length === 0) return
    const ids = alertas.map(a => a.id)
    saveSeenIds(ids)
    setSeenIds(ids)
  }, [open, alertas])

  // Fecha com Escape — usa capture:true para ter prioridade sobre outros listeners
  useEffect(() => {
    if (!open) return
    const h = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) }
    }
    document.addEventListener('keydown', h, true)
    return () => document.removeEventListener('keydown', h, true)
  }, [open])

  async function load() {
    const hoje = format(new Date(), 'yyyy-MM-dd')
    const amanha = format(addDays(new Date(), 1), 'yyyy-MM-dd')
    const lista = []
    const diasAlerta = DIAS_RETORNO_PADRAO

    // Pagamentos pendentes (a receber)
    const { data: pend } = await supabase.from('pagamentos')
      .select('valor').eq('salao_id', salaoId).eq('status', 'pendente')
    if (pend?.length) {
      const total = pend.reduce((s, p) => s + (p.valor || 0), 0)
      lista.push({
        id: 'pag', icon: Clock, cor: '#D97706', bg: '#FEF3C7',
        titulo: `${pend.length} pagamento${pend.length > 1 ? 's' : ''} a receber`,
        sub: `${formatBRL(total)} pendente${pend.length > 1 ? 's' : ''}`,
        to: '/app/financeiro',
      })
    }

    // Atendimentos de hoje a confirmar
    const { data: hojeAg } = await supabase.from('agendamentos')
      .select('id').eq('salao_id', salaoId).eq('data', hoje).eq('status', 'pendente')
    if (hojeAg?.length) {
      lista.push({
        id: 'hoje', icon: CheckCircle, cor: '#1E40AF', bg: '#DBEAFE',
        titulo: `${hojeAg.length} atendimento${hojeAg.length > 1 ? 's' : ''} a confirmar hoje`,
        sub: 'Toque para ver a agenda', to: '/app/agenda',
      })
    }

    // Lembretes de amanhã pendentes
    const { data: ags } = await supabase.from('agendamentos')
      .select('lembrete_enviado_em, clientes(telefone)')
      .eq('salao_id', salaoId).eq('data', amanha).in('status', ['pendente', 'confirmado'])
    const lembr = (ags || []).filter(a => !a.lembrete_enviado_em && a.clientes?.telefone).length
    if (lembr) {
      lista.push({
        id: 'lembr', icon: Bell, cor: '#15803D', bg: '#DCFCE7',
        titulo: `${lembr} lembrete${lembr > 1 ? 's' : ''} pra enviar`,
        sub: 'Agendamentos de amanhã', to: '/app/lembretes',
      })
    }

    // Avisos do salão (clientes sumidas + aniversariantes) — só para dona/recepcionista.
    // A profissional não enxerga dados do salão inteiro.
    if (!isProfissional) {
      const { data: cls } = await supabase.from('clientes')
        .select('id, nome, telefone, ultimo_atendimento, data_nascimento, arquivada, dias_retorno').eq('salao_id', salaoId)
      // Só clientes com telefone — alinha com os cards de Oportunidades (que dependem do WhatsApp).
      const ativas = (cls || []).filter(c => !c.arquivada && c.telefone)
      const sumidas = ativas.filter(c => c.ultimo_atendimento && differenceInDays(new Date(), new Date(c.ultimo_atendimento + 'T12:00:00')) >= (c.dias_retorno ?? diasAlerta))
      if (sumidas.length) {
        lista.push({
          id: 'sumidas', icon: UserX, cor: '#B91C1C', bg: '#FEE2E2',
          titulo: `${sumidas.length} ${sumidas.length > 1 ? 'clientes' : 'cliente'} p/ retorno`,
          sub: sumidas.slice(0, 3).map(c => c.nome.split(' ')[0]).join(' · '), to: '/app/clientes',
        })
      }
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
          titulo: `${aniv.length} aniversariante${aniv.length > 1 ? 's' : ''} essa semana`,
          sub: aniv.slice(0, 3).map(c => c.nome.split(' ')[0]).join(' · '), to: '/app/clientes',
        })
      }
    }

    setAlertas(lista)
  }

  const total = alertas.length
  // Badge mostra apenas alertas que o usuário ainda não viu
  const naoVistos = alertas.filter(a => !seenIds.includes(a.id)).length

  function abrir() { setOpen(true) }

  return (
    <>
      {variant === 'sidebar' ? (
        <button
          onClick={abrir}
          style={{ ...s.sbTrigger, ...(collapsed ? { justifyContent: 'center', padding: '11px 0' } : {}) }}
          title={collapsed ? 'Avisos' : undefined}
        >
          <span style={{ position: 'relative', display: 'flex' }}>
            <Bell size={19} strokeWidth={1.8} />
            {naoVistos > 0 && <span style={s.dotSb}>{naoVistos}</span>}
          </span>
          {!collapsed && <span>Avisos</span>}
        </button>
      ) : (
        <button onClick={abrir} style={s.hdrTrigger} aria-label="Notificações">
          <Bell size={18} />
          {naoVistos > 0 && <span style={s.dotHdr}>{naoVistos}</span>}
        </button>
      )}

      {open && (
        <div style={s.overlay} onClick={() => setOpen(false)}>
          <div style={s.panel} onClick={e => e.stopPropagation()}>
            <div style={s.header}>
              <span style={s.headerTitle}>Avisos {total > 0 && <span style={s.headerCount}>{total}</span>}</span>
              <button onClick={() => setOpen(false)} style={s.closeBtn}><X size={16} /></button>
            </div>
            {alertas.length === 0 ? (
              <div style={s.vazio}>Tudo em dia! Nenhum aviso no momento ✨</div>
            ) : (
              <div style={s.lista}>
                {alertas.map(a => {
                  const Ico = a.icon
                  return (
                    <button key={a.id} style={s.item} onClick={() => { setOpen(false); navigate(a.to) }}>
                      <div style={{ ...s.itemIcon, background: a.bg, color: a.cor }}><Ico size={16} /></div>
                      <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                        <div style={s.itemTit}>{a.titulo}</div>
                        <div style={s.itemSub}>{a.sub}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

const s = {
  hdrTrigger: { position: 'relative', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', cursor: 'pointer', padding: 2 },
  dotHdr: { position: 'absolute', top: -6, right: -6, minWidth: 15, height: 15, padding: '0 4px', borderRadius: 8, background: '#EF4444', color: 'white', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--brand-dark-bg, #170D14)' },
  sbTrigger: { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 10, fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.65)', background: 'transparent', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' },
  dotSb: { position: 'absolute', top: -5, right: -7, minWidth: 15, height: 15, padding: '0 4px', borderRadius: 8, background: '#EF4444', color: 'white', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(24,7,18,0.35)', zIndex: 400 },
  panel: { position: 'fixed', top: 64, right: 12, width: 'min(360px, calc(100vw - 24px))', maxHeight: '70vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxShadow: '0 16px 48px rgba(0,0,0,0.22)', padding: 12 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  headerTitle: { fontSize: 14, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 7 },
  headerCount: { background: 'var(--pink)', color: 'white', fontSize: 11, fontWeight: 800, borderRadius: 'var(--radius-pill)', padding: '1px 8px' },
  closeBtn: { background: 'var(--surface2)', border: 'none', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text2)' },
  vazio: { fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '28px 12px' },
  lista: { display: 'flex', flexDirection: 'column', gap: 6 },
  item: { display: 'flex', alignItems: 'center', gap: 11, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit', width: '100%' },
  itemIcon: { width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  itemTit: { fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  itemSub: { fontSize: 11, color: 'var(--text3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
}
