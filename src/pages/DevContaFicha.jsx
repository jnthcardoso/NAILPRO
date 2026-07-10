import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Activity, Phone, Mail, HelpCircle, Calendar, DollarSign, Users, Receipt, Target, StickyNote, Bug } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from '../contexts/ToastContext'
import WaIcon from '../components/common/WaIcon'

function quando(ts) {
  if (!ts) return 'nunca'
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true, locale: ptBR }) } catch { return '—' }
}

const ATIV_ICON = { agendamento: Calendar, pagamento: DollarSign, cliente: Users, despesa: Receipt, meta: Target }
const CANAL_ICON = { whatsapp: WaIcon, ligacao: Phone, email: Mail, outro: HelpCircle }

const SAUDE = {
  2: { cor: '#15803D', bg: '#DCFCE7', label: 'Saudável' },
  1: { cor: '#C2410C', bg: '#FFEDD5', label: 'Atenção' },
  0: { cor: '#B91C1C', bg: '#FEE2E2', label: 'Risco' },
}

export default function DevContaFicha() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { sucesso, erro: toastErro } = useToast()

  const [loading, setLoading] = useState(true)
  const [conta, setConta] = useState(null)
  const [saude, setSaude] = useState(null)
  const [atividade, setAtividade] = useState([])
  const [contatos, setContatos] = useState([])
  const [erros, setErros] = useState([])
  const [nota, setNota] = useState('')
  const [notaTexto, setNotaTexto] = useState('')
  const [editandoNota, setEditandoNota] = useState(false)

  useEffect(() => { carregar() }, [userId])

  async function carregar() {
    setLoading(true)
    const [usuarios, sa, ativ, cont, notas, todosErros] = await Promise.all([
      supabase.rpc('admin_listar_usuarios'),
      supabase.rpc('admin_rel_saude', { p_user_id: userId }),
      supabase.rpc('admin_atividade_usuario', { p_user_id: userId, p_limit: 100 }),
      supabase.rpc('admin_listar_contatos', { p_user_id: userId }),
      supabase.rpc('admin_listar_notas'),
      supabase.rpc('admin_listar_erros', { p_limit: 200 }),
    ])
    const u = (usuarios.data || []).find(x => x.user_id === userId)
    setConta(u || null)
    setSaude(sa.data?.[0] || null)
    setAtividade(ativ.data || [])
    setContatos(cont.data || [])
    const minhaNota = (notas.data || []).find(n => n.user_id === userId)?.texto || ''
    setNota(minhaNota)
    setNotaTexto(minhaNota)
    setErros((todosErros.data || []).filter(e => e.user_id === userId))
    setLoading(false)
  }

  async function salvarNota() {
    const texto = notaTexto.trim()
    const { error } = await supabase.rpc('admin_salvar_nota', { p_user_id: userId, p_texto: texto })
    if (error) { toastErro('Erro ao salvar nota: ' + error.message); return }
    setNota(texto)
    setEditandoNota(false)
    sucesso('Nota salva')
  }

  if (loading) return <div style={s.page}><div style={s.loading}>Carregando…</div></div>
  if (!conta) return <div style={s.page}><div style={s.loading}>Conta não encontrada.</div></div>

  const sm = saude ? (SAUDE[saude.score] || SAUDE[1]) : null

  return (
    <div style={s.page}>
      <button style={s.voltar} onClick={() => navigate(-1)}>
        <ArrowLeft size={14} /> Voltar
      </button>

      {/* Cabeçalho */}
      <div style={s.header}>
        <div style={s.iconBox}><User size={20} color="white" /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={s.title}>{conta.nome || conta.email?.split('@')[0]}</h1>
          <p style={s.sub}>
            {conta.email}
            {conta.nome_salao && ` · ${conta.nome_salao}`}
            {' · '}{conta.assinatura_plano?.toUpperCase() || '—'} ({conta.assinatura_status})
          </p>
        </div>
        {sm && <span style={{ ...s.saudeBadge, background: sm.bg, color: sm.cor }}>{sm.label}</span>}
      </div>

      {/* Saúde */}
      {saude && (
        <section style={s.card}>
          <div style={s.cardHead}><Activity size={15} color="#B91C1C" /><h3 style={s.cardTitle}>Saúde</h3></div>
          <p style={s.metaLine}>
            Login {quando(saude.ultimo_acesso)} · atividade {quando(saude.ultima_atividade)} · {saude.agendamentos_30d} agendamentos em 30d
          </p>
        </section>
      )}

      {/* Nota interna */}
      <section style={s.card}>
        <div style={s.cardHead}><StickyNote size={15} color="#92400E" /><h3 style={s.cardTitle}>Nota interna</h3></div>
        {editandoNota ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea style={s.textarea} rows={3} value={notaTexto} onChange={e => setNotaTexto(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={s.btnCancelar} onClick={() => { setEditandoNota(false); setNotaTexto(nota) }}>Cancelar</button>
              <button style={s.btnSalvar} onClick={salvarNota}>Salvar</button>
            </div>
          </div>
        ) : (
          <div style={s.notaBox} onClick={() => setEditandoNota(true)}>
            {nota || <span style={{ color: 'var(--text3)' }}>Sem nota — clique para adicionar.</span>}
          </div>
        )}
      </section>

      {/* Contatos (CRM) */}
      <section style={s.card}>
        <div style={s.cardHead}><Phone size={15} color="var(--pink)" /><h3 style={s.cardTitle}>Contatos ({contatos.length})</h3></div>
        {contatos.length === 0 ? (
          <div style={s.vazio}>Nenhum contato registrado.</div>
        ) : (
          <div style={s.lista}>
            {contatos.map(c => {
              const Ico = CANAL_ICON[c.canal] || HelpCircle
              return (
                <div key={c.id} style={s.item}>
                  <div style={s.itemIcone}><Ico size={13} color="var(--text2)" /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.itemDesc}>{c.resumo}</div>
                    <div style={s.itemQuando}>{quando(c.created_at)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Erros recentes */}
      <section style={s.card}>
        <div style={s.cardHead}><Bug size={15} color="#B91C1C" /><h3 style={s.cardTitle}>Erros ({erros.length})</h3></div>
        {erros.length === 0 ? (
          <div style={s.vazio}>Nenhum erro registrado.</div>
        ) : (
          <div style={s.lista}>
            {erros.map(e => (
              <div key={e.id} style={s.item}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.itemDesc}>{e.mensagem}</div>
                  <div style={s.itemQuando}>{e.contexto} · {quando(e.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Atividade recente */}
      <section style={s.card}>
        <div style={s.cardHead}><Activity size={15} color="#0369A1" /><h3 style={s.cardTitle}>Atividade recente ({atividade.length})</h3></div>
        {atividade.length === 0 ? (
          <div style={s.vazio}>Nenhuma atividade registrada ainda.</div>
        ) : (
          <div style={s.lista}>
            {atividade.map((ev, i) => {
              const Ico = ATIV_ICON[ev.tipo] || Activity
              return (
                <div key={i} style={s.item}>
                  <div style={s.itemIcone}><Ico size={13} color="var(--text2)" /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.itemDesc}>{ev.descricao}</div>
                    <div style={s.itemQuando}>
                      {format(new Date(ev.quando), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} · {quando(ev.quando)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

const s = {
  page: { padding: 20, paddingBottom: 80, display: 'flex', flexDirection: 'column', gap: 12 },
  loading: { textAlign: 'center', padding: 48, color: 'var(--text3)', fontSize: 13 },
  voltar: { display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', background: 'transparent', border: 'none', color: 'var(--text3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
  header: { display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', borderRadius: 14, padding: '14px 16px', boxShadow: '0 4px 16px rgba(0,0,0,0.18)' },
  iconBox: { width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 17, fontWeight: 800, color: '#FFFFFF', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  sub: { fontSize: 11.5, color: 'rgba(255,255,255,0.6)', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  saudeBadge: { fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0 },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 16, boxShadow: 'var(--shadow-xs)' },
  cardHead: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  cardTitle: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 14, fontWeight: 800, color: 'var(--text)', margin: 0 },
  metaLine: { fontSize: 12, color: 'var(--text3)', margin: 0, lineHeight: 1.6 },
  vazio: { textAlign: 'center', padding: '16px 0', color: 'var(--text3)', fontSize: 12 },
  lista: { display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 320, overflowY: 'auto' },
  item: { display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 4px', borderBottom: '1px solid var(--border)' },
  itemIcone: { width: 26, height: 26, borderRadius: '50%', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  itemDesc: { fontSize: 12.5, color: 'var(--text)', fontWeight: 500, lineHeight: 1.35 },
  itemQuando: { fontSize: 10.5, color: 'var(--text3)', marginTop: 2 },
  notaBox: { padding: '10px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, fontSize: 12.5, color: '#92400E', lineHeight: 1.5, cursor: 'pointer' },
  textarea: { width: '100%', border: '1.5px solid #FDE68A', borderRadius: 8, padding: '8px 10px', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--text)', background: '#FFFBEB', outline: 'none', resize: 'vertical', boxSizing: 'border-box' },
  btnSalvar: { background: '#D4AF37', color: 'white', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnCancelar: { background: 'var(--surface)', color: 'var(--text3)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
}
