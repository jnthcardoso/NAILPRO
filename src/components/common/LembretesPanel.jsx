import { useEffect, useState } from 'react'
import { MessageCircle, Check, Bell, X, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { format, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function LembretesPanel({ onChange }) {
  const { user } = useAuth()
  const [pendentes, setPendentes] = useState([])
  const [enviados, setEnviados] = useState([])
  const [config, setConfig] = useState({ mensagem_lembrete: '', nome_salao: '', lembretes_ativos: true })
  const [expanded, setExpanded] = useState(true)
  const [enviandoTodos, setEnviandoTodos] = useState(false)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const amanha = format(addDays(new Date(), 1), 'yyyy-MM-dd')

    const { data: cfg } = await supabase.from('configuracoes')
      .select('mensagem_lembrete, nome_salao, lembretes_ativos')
      .eq('user_id', user.id)
      .single()
    if (cfg) setConfig(cfg)

    if (cfg?.lembretes_ativos === false) {
      setPendentes([]); setEnviados([])
      return
    }

    const { data } = await supabase.from('agendamentos')
      .select('*, clientes(nome, telefone)')
      .eq('user_id', user.id)
      .eq('data', amanha)
      .in('status', ['pendente', 'confirmado'])
      .order('horario')

    const lista = data || []
    setPendentes(lista.filter(a => !a.lembrete_enviado_em && a.clientes?.telefone))
    setEnviados(lista.filter(a => a.lembrete_enviado_em && a.clientes?.telefone))
  }

  function montarMensagem(ag) {
    const nome = ag.clientes?.nome || ''
    const [y, m, d] = ag.data.split('-')
    const dataFmt = `${d}/${m}`
    const horario = ag.horario?.slice(0, 5)
    const template = config.mensagem_lembrete || 'Oi {nome}! Lembrete: amanhã ({data}) às {horario} - {servico}. Confirma?'

    return template
      .replace(/\{nome\}/g, nome.split(' ')[0])
      .replace(/\{nome_completo\}/g, nome)
      .replace(/\{data\}/g, dataFmt)
      .replace(/\{horario\}/g, horario)
      .replace(/\{servico\}/g, ag.servico || '')
      .replace(/\{salao\}/g, config.nome_salao || '')
  }

  function buildLink(ag) {
    const tel = (ag.clientes?.telefone || '').replace(/\D/g, '')
    const msg = montarMensagem(ag)
    return `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`
  }

  async function marcarEnviado(ag) {
    await supabase.from('agendamentos')
      .update({ lembrete_enviado_em: new Date().toISOString() })
      .eq('id', ag.id)
    load()
    onChange?.()
  }

  async function enviarUm(ag) {
    window.open(buildLink(ag), '_blank')
    await marcarEnviado(ag)
  }

  async function enviarTodos() {
    setEnviandoTodos(true)
    for (let i = 0; i < pendentes.length; i++) {
      const ag = pendentes[i]
      window.open(buildLink(ag), '_blank')
      await new Promise(r => setTimeout(r, 600))
    }
    // Marca todos como enviados
    const ids = pendentes.map(a => a.id)
    await supabase.from('agendamentos')
      .update({ lembrete_enviado_em: new Date().toISOString() })
      .in('id', ids)
    setEnviandoTodos(false)
    load()
    onChange?.()
  }

  if (config.lembretes_ativos === false) return null
  if (pendentes.length === 0 && enviados.length === 0) return null

  const amanhaFmt = format(addDays(new Date(), 1), "EEEE, dd 'de' MMM", { locale: ptBR })

  return (
    <div style={s.card}>
      <div style={s.header} onClick={() => setExpanded(e => !e)}>
        <div style={s.headerLeft}>
          <div style={s.iconBox}><Bell size={16} color="white" /></div>
          <div>
            <div style={s.title}>
              Lembretes pra enviar {pendentes.length > 0 && <span style={s.badge}>{pendentes.length}</span>}
            </div>
            <div style={s.sub}>Agendamentos de amanhã · <span style={{ textTransform: 'capitalize' }}>{amanhaFmt}</span></div>
          </div>
        </div>
        <button style={s.toggleBtn} onClick={e => { e.stopPropagation(); setExpanded(x => !x) }}>
          {expanded ? <X size={16} /> : 'Abrir'}
        </button>
      </div>

      {expanded && (
        <>
          {pendentes.length > 0 && (
            <>
              {pendentes.map(ag => (
                <div key={ag.id} style={s.item}>
                  <div style={s.itemTime}>{ag.horario?.slice(0, 5)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.itemNome}>{ag.clientes?.nome}</div>
                    <div style={s.itemServ}>{ag.servico}</div>
                  </div>
                  <button style={s.btnWa} onClick={() => enviarUm(ag)} title="Enviar lembrete">
                    <Send size={13} /> Enviar
                  </button>
                </div>
              ))}
              {pendentes.length > 1 && (
                <button style={s.btnEnviarTodos} onClick={enviarTodos} disabled={enviandoTodos}>
                  <MessageCircle size={14} />
                  {enviandoTodos ? 'Enviando...' : `Enviar todos (${pendentes.length})`}
                </button>
              )}
            </>
          )}

          {enviados.length > 0 && (
            <div style={s.enviadosBox}>
              <div style={s.enviadosTitle}>✓ Já enviados ({enviados.length})</div>
              {enviados.map(ag => (
                <div key={ag.id} style={s.enviadoItem}>
                  <Check size={12} color="#15803D" />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{ag.horario?.slice(0, 5)}</span>
                  <span style={{ fontSize: 12 }}>{ag.clientes?.nome}</span>
                </div>
              ))}
            </div>
          )}

          {pendentes.length === 0 && enviados.length > 0 && (
            <div style={s.tudoEnviadoMsg}>🎉 Todos os lembretes de amanhã foram enviados!</div>
          )}
        </>
      )}
    </div>
  )
}

const s = {
  card: { background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)', border: '1px solid #FCD34D', borderRadius: 'var(--radius-sm)', padding: '14px', marginBottom: 16, boxShadow: 'var(--shadow-sm)' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', gap: 10, marginBottom: 12 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10, flex: 1 },
  iconBox: { width: 32, height: 32, borderRadius: '50%', background: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { fontSize: 14, fontWeight: 700, color: '#7C2D12', display: 'flex', alignItems: 'center', gap: 6 },
  badge: { background: '#D97706', color: 'white', borderRadius: 10, fontSize: 11, padding: '1px 7px', fontWeight: 700 },
  sub: { fontSize: 11, color: '#9A3412', marginTop: 1 },
  toggleBtn: { background: 'transparent', color: '#7C2D12', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4, fontSize: 12, fontWeight: 600 },
  item: { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: '1px solid #FED7AA', borderRadius: 10, padding: '8px 10px', marginBottom: 6 },
  itemTime: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: '#7C2D12', minWidth: 42, textAlign: 'center', background: '#FED7AA', borderRadius: 6, padding: '3px 6px' },
  itemNome: { fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemServ: { fontSize: 11, color: 'var(--text3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  btnWa: { display: 'flex', alignItems: 'center', gap: 4, background: '#25D366', color: 'white', border: 'none', borderRadius: 'var(--radius-pill)', padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' },
  btnEnviarTodos: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#25D366', color: 'white', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 4, fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(37,211,102,0.3)' },
  enviadosBox: { marginTop: 10, paddingTop: 10, borderTop: '1px dashed #FCD34D' },
  enviadosTitle: { fontSize: 11, fontWeight: 700, color: '#15803D', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' },
  enviadoItem: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', color: 'var(--text2)' },
  tudoEnviadoMsg: { textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#15803D', padding: '8px 0' },
}
