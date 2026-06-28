import { useEffect, useState } from 'react'
import { Phone, Mail, HelpCircle, Plus, Trash2, Calendar } from 'lucide-react'
import WaIcon from '../../components/common/WaIcon'
import { supabase } from '../../lib/supabase'
import { format, formatDistanceToNow, isPast, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const CANAIS = [
  { id: 'whatsapp', label: 'WhatsApp', Ico: WaIcon, cor: '#25D366', bg: '#DCFCE7' },
  { id: 'ligacao',  label: 'Ligação',  Ico: Phone,         cor: '#1E40AF', bg: '#DBEAFE' },
  { id: 'email',    label: 'E-mail',   Ico: Mail,          cor: '#92400E', bg: '#FEF3C7' },
  { id: 'outro',    label: 'Outro',    Ico: HelpCircle,    cor: '#6B7280', bg: '#F3F4F6' },
]

function canalConfig(canal) {
  return CANAIS.find(c => c.id === canal) || CANAIS[3]
}

function quando(ts) {
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true, locale: ptBR }) } catch { return '—' }
}

export default function AdminCRM({ usuarios }) {
  const [contatos,     setContatos]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [abrirForm,    setAbrirForm]    = useState(false)
  const [salvando,     setSalvando]     = useState(false)
  const [filtroUser,   setFiltroUser]   = useState('')

  // Form
  const [fUserId,   setFUserId]   = useState('')
  const [fCanal,    setFCanal]    = useState('whatsapp')
  const [fResumo,   setFResumo]   = useState('')
  const [fFollowup, setFFollowup] = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.rpc('admin_listar_contatos')
    setContatos(data || [])
    setLoading(false)
  }

  async function registrar() {
    if (!fUserId || !fResumo.trim()) return
    setSalvando(true)
    await supabase.rpc('admin_registrar_contato', {
      p_user_id:          fUserId,
      p_canal:            fCanal,
      p_resumo:           fResumo.trim(),
      p_proximo_followup: fFollowup || null,
    })
    setSalvando(false)
    setAbrirForm(false)
    setFUserId(''); setFCanal('whatsapp'); setFResumo(''); setFFollowup('')
    carregar()
  }

  async function deletar(id) {
    await supabase.rpc('admin_deletar_contato', { p_id: id })
    setContatos(prev => prev.filter(c => c.id !== id))
  }

  // Follow-ups pendentes (data <= hoje ou nos próximos 7 dias)
  const followupsPendentes = contatos
    .filter(c => c.proximo_followup)
    .filter(c => differenceInDays(new Date(c.proximo_followup), new Date()) <= 7)
    .sort((a, b) => new Date(a.proximo_followup) - new Date(b.proximo_followup))

  const contatosFiltrados = filtroUser
    ? contatos.filter(c => c.user_id === filtroUser)
    : contatos

  function nomeUsuario(userId) {
    const u = usuarios.find(u => u.user_id === userId)
    return u ? (u.nome || u.email?.split('@')[0]) : userId?.slice(0, 8)
  }

  return (
    <div style={s.wrap}>

      {/* ── Follow-ups pendentes ── */}
      {followupsPendentes.length > 0 && (
        <section style={s.followupSection}>
          <div style={s.secHead}>
            <Calendar size={14} color="#C2410C" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#C2410C', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Follow-ups ({followupsPendentes.length})
            </span>
          </div>
          {followupsPendentes.map(c => {
            const dias = differenceInDays(new Date(c.proximo_followup), new Date())
            const vencido = dias < 0
            return (
              <div key={c.id} style={{ ...s.followupItem, borderLeft: `3px solid ${vencido ? '#B91C1C' : '#C2410C'}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.followupNome}>{nomeUsuario(c.user_id)}</div>
                  <div style={s.followupResumo}>{c.resumo}</div>
                </div>
                <div style={{ ...s.followupDias, color: vencido ? '#B91C1C' : '#C2410C' }}>
                  {vencido ? `${Math.abs(dias)}d atrás` : dias === 0 ? 'hoje' : `em ${dias}d`}
                </div>
              </div>
            )
          })}
        </section>
      )}

      {/* ── Cabeçalho histórico ── */}
      <div style={s.histHead}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' }}>
          <span style={s.histTitulo}>Histórico</span>
          <select
            style={s.selectUser}
            value={filtroUser}
            onChange={e => setFiltroUser(e.target.value)}
          >
            <option value="">Todos os contatos</option>
            {usuarios.map(u => (
              <option key={u.user_id} value={u.user_id}>
                {u.nome || u.email?.split('@')[0]}
              </option>
            ))}
          </select>
        </div>
        <button style={s.addBtn} onClick={() => setAbrirForm(true)}>
          <Plus size={14} /> Registrar
        </button>
      </div>

      {/* ── Formulário ── */}
      {abrirForm && (
        <div style={s.form}>
          <div style={s.formGrid}>
            <div style={s.formGrupo}>
              <label style={s.label}>Conta</label>
              <select style={s.select} value={fUserId} onChange={e => setFUserId(e.target.value)}>
                <option value="">Selecionar...</option>
                {usuarios.map(u => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.nome || u.email?.split('@')[0]} {u.nome_salao ? `· ${u.nome_salao}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div style={s.formGrupo}>
              <label style={s.label}>Canal</label>
              <div style={s.canalOpts}>
                {CANAIS.map(c => (
                  <button
                    key={c.id}
                    style={{ ...s.canalBtn, ...(fCanal === c.id ? { background: c.bg, color: c.cor, border: `1px solid ${c.cor}` } : {}) }}
                    onClick={() => setFCanal(c.id)}
                    type="button"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={s.formGrupo}>
            <label style={s.label}>Resumo da conversa</label>
            <textarea
              style={s.textarea}
              rows={3}
              placeholder="O que foi discutido..."
              value={fResumo}
              onChange={e => setFResumo(e.target.value)}
            />
          </div>
          <div style={s.formGrupo}>
            <label style={s.label}>Próximo follow-up (opcional)</label>
            <input
              type="date"
              style={s.select}
              value={fFollowup}
              onChange={e => setFFollowup(e.target.value)}
            />
          </div>
          <div style={s.formAcoes}>
            <button style={s.btnCancelar} onClick={() => setAbrirForm(false)}>Cancelar</button>
            <button style={s.btnSalvar} onClick={registrar} disabled={!fUserId || !fResumo.trim() || salvando}>
              {salvando ? 'Salvando…' : 'Salvar contato'}
            </button>
          </div>
        </div>
      )}

      {/* ── Lista de contatos ── */}
      {loading ? (
        <div style={s.vazio}>Carregando…</div>
      ) : contatosFiltrados.length === 0 ? (
        <div style={s.vazio}>Nenhum contato registrado ainda.</div>
      ) : (
        <div style={s.lista}>
          {contatosFiltrados.map(c => {
            const cfg = canalConfig(c.canal)
            const { Ico } = cfg
            return (
              <div key={c.id} style={s.item}>
                <div style={{ ...s.iconBox, background: cfg.bg }}>
                  <Ico size={13} color={cfg.cor} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.itemNome}>{nomeUsuario(c.user_id)}</div>
                  <div style={s.itemResumo}>{c.resumo}</div>
                  {c.proximo_followup && (
                    <div style={s.itemFollowup}>
                      Follow-up: {format(new Date(c.proximo_followup), 'dd/MM/yyyy', { locale: ptBR })}
                    </div>
                  )}
                </div>
                <div style={s.itemDireita}>
                  <div style={s.itemQuando}>{quando(c.created_at)}</div>
                  <button style={s.delBtn} onClick={() => deletar(c.id)} title="Remover">
                    <Trash2 size={12} />
                  </button>
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
  wrap:            { display: 'flex', flexDirection: 'column', gap: 14 },
  /* Follow-ups */
  followupSection: { background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 },
  secHead:         { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 },
  followupItem:    { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'white', borderRadius: 6, border: '1px solid #FDE68A' },
  followupNome:    { fontSize: 12.5, fontWeight: 700, color: '#92400E' },
  followupResumo:  { fontSize: 11, color: '#92400E', marginTop: 1 },
  followupDias:    { fontSize: 11, fontWeight: 700, flexShrink: 0 },
  /* Cabeçalho histórico */
  histHead:        { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  histTitulo:      { fontSize: 13, fontWeight: 700, color: 'var(--text)' },
  selectUser:      { fontSize: 12, border: '1px solid var(--border2)', borderRadius: 8, padding: '5px 8px', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', flex: 1, minWidth: 0 },
  addBtn:          { display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  /* Formulário */
  form:            { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 },
  formGrid:        { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  formGrupo:       { display: 'flex', flexDirection: 'column', gap: 5 },
  label:           { fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px' },
  select:          { fontSize: 12.5, border: '1px solid var(--border2)', borderRadius: 8, padding: '7px 10px', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' },
  canalOpts:       { display: 'flex', gap: 5, flexWrap: 'wrap' },
  canalBtn:        { padding: '5px 10px', background: 'var(--surface)', color: 'var(--text3)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  textarea:        { fontSize: 12.5, border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 10px', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', resize: 'vertical' },
  formAcoes:       { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  btnCancelar:     { padding: '7px 14px', background: 'var(--surface)', color: 'var(--text3)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  btnSalvar:       { padding: '7px 16px', background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  /* Lista */
  vazio:           { textAlign: 'center', padding: '24px 0', color: 'var(--text3)', fontSize: 13 },
  lista:           { display: 'flex', flexDirection: 'column', gap: 2 },
  item:            { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 4px', borderBottom: '1px solid var(--border)' },
  iconBox:         { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  itemNome:        { fontSize: 12.5, fontWeight: 700, color: 'var(--text)' },
  itemResumo:      { fontSize: 12, color: 'var(--text2)', marginTop: 2, lineHeight: 1.4 },
  itemFollowup:    { fontSize: 10.5, color: '#C2410C', marginTop: 4, fontWeight: 600 },
  itemDireita:     { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  itemQuando:      { fontSize: 10.5, color: 'var(--text3)' },
  delBtn:          { background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2, display: 'flex', alignItems: 'center' },
}
