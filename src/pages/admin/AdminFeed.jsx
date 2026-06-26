import { useEffect, useState } from 'react'
import { Calendar, DollarSign, Users, Star, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const TIPO_CONFIG = {
  cadastro:    { Ico: Star,       cor: '#7C3AED', bg: '#F5F3FF', label: 'Cadastro'    },
  agendamento: { Ico: Calendar,   cor: '#1E40AF', bg: '#DBEAFE', label: 'Agendamento' },
  pagamento:   { Ico: DollarSign, cor: '#15803D', bg: '#DCFCE7', label: 'Pagamento'   },
  cliente:     { Ico: Users,      cor: '#92400E', bg: '#FEF3C7', label: 'Cliente'     },
}

const FILTROS = [
  { id: 'todos',       label: 'Todos'       },
  { id: 'cadastro',    label: 'Cadastros'   },
  { id: 'pagamento',   label: 'Pagamentos'  },
  { id: 'agendamento', label: 'Agendamentos'},
  { id: 'cliente',     label: 'Clientes'    },
]

function quando(ts) {
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true, locale: ptBR }) } catch { return '—' }
}

export default function AdminFeed() {
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.rpc('admin_rel_feed', { p_limit: 80 })
    setEventos(data || [])
    setLoading(false)
  }

  const filtrados = filtro === 'todos' ? eventos : eventos.filter(e => e.tipo === filtro)

  return (
    <div style={s.wrap}>
      <div style={s.topo}>
        <div style={s.filtros}>
          {FILTROS.map(f => (
            <button
              key={f.id}
              style={{ ...s.filtroBtn, ...(filtro === f.id ? s.filtroBtnAtivo : {}) }}
              onClick={() => setFiltro(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button style={s.refreshBtn} onClick={carregar} title="Atualizar">
          <RefreshCw size={15} color="var(--text3)" />
        </button>
      </div>

      {loading ? (
        <div style={s.carregando}>Carregando…</div>
      ) : filtrados.length === 0 ? (
        <div style={s.vazio}>Nenhum evento nos últimos 7 dias.</div>
      ) : (
        <div style={s.lista}>
          {filtrados.map((ev, i) => {
            const cfg = TIPO_CONFIG[ev.tipo] || TIPO_CONFIG.agendamento
            const { Ico } = cfg
            const nomeLabel = ev.nome || ev.email?.split('@')[0] || '?'
            return (
              <div key={i} style={s.item}>
                <div style={{ ...s.iconBox, background: cfg.bg }}>
                  <Ico size={13} color={cfg.cor} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.desc}>{ev.descricao}</div>
                  <div style={s.meta}>
                    <span style={{ ...s.tipoBadge, background: cfg.bg, color: cfg.cor }}>{cfg.label}</span>
                    {' '}
                    <span style={s.conta}>{nomeLabel}{ev.nome_salao ? ` · ${ev.nome_salao}` : ''}</span>
                  </div>
                </div>
                <div style={s.tempo}>
                  <div style={s.hora}>{format(new Date(ev.quando), 'HH:mm', { locale: ptBR })}</div>
                  <div style={s.relativo}>{quando(ev.quando)}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const s = {
  wrap:         { display: 'flex', flexDirection: 'column', gap: 10 },
  topo:         { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  filtros:      { display: 'flex', gap: 5, flexWrap: 'wrap', flex: 1 },
  filtroBtn:    { padding: '5px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text3)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  filtroBtnAtivo:{ background: 'var(--pink)', color: 'white', border: '1px solid var(--pink)' },
  refreshBtn:   { width: 32, height: 32, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
  carregando:   { textAlign: 'center', padding: 32, color: 'var(--text3)', fontSize: 13 },
  vazio:        { textAlign: 'center', padding: 32, color: 'var(--text3)', fontSize: 13 },
  lista:        { display: 'flex', flexDirection: 'column', gap: 2 },
  item:         { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px', borderBottom: '1px solid var(--border)' },
  iconBox:      { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  desc:         { fontSize: 12.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 },
  meta:         { fontSize: 10.5, color: 'var(--text3)', marginTop: 2 },
  tipoBadge:    { fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 999 },
  conta:        { color: 'var(--text3)' },
  tempo:        { textAlign: 'right', flexShrink: 0 },
  hora:         { fontSize: 11, fontWeight: 700, color: 'var(--text2)', fontFamily: "'JetBrains Mono', monospace" },
  relativo:     { fontSize: 9.5, color: 'var(--text3)', marginTop: 1 },
}
