import { useEffect, useState } from 'react'
import { Users, UserPlus, Crown, Trash2, Mail, Check, X, ShieldCheck, Headset, Sparkles, Info } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSalao } from '../contexts/SalaoContext'
import { useAssinatura, formatPreco, whatsappAssinarLink } from '../contexts/AssinaturaContext'
import { useToast } from '../contexts/ToastContext'

const PRECO_LICENCA_ADICIONAL = 1990 // R$ 19,90 por membro com login

const PAPEIS = {
  dona: { label: 'Dona', icon: Crown, cor: '#D4AF37', desc: 'Acesso total + gestão da equipe e licença' },
  recepcionista: { label: 'Recepcionista', icon: Headset, cor: '#8B2655', desc: 'Gerencia agenda e financeiro de todas as profissionais' },
  profissional: { label: 'Profissional', icon: Sparkles, cor: '#6366F1', desc: 'Vê apenas a própria agenda e o próprio financeiro' },
}

export default function Equipe() {
  const { user } = useAuth()
  const { salaoId, salao, podeGerenciarEquipe } = useSalao()
  const { plano } = useAssinatura()
  const { sucesso, erro, confirmar } = useToast()

  const [membros, setMembros] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ nome: '', email: '', papel: 'profissional' })

  useEffect(() => { if (salaoId) load() }, [salaoId])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('salao_membros')
      .select('id, user_id, nome, email, papel, ativo, created_at')
      .eq('salao_id', salaoId)
      .order('created_at', { ascending: true })
    setMembros(data || [])
    setLoading(false)
  }

  // Profissionais/recepcionistas COM login (user_id não nulo) → contam licença adicional.
  // A dona não conta (já está incluída no plano base).
  const membrosComLogin = membros.filter(m => m.papel !== 'dona' && m.user_id)
  const licencasAdicionais = membrosComLogin.length
  const custoAdicional = licencasAdicionais * PRECO_LICENCA_ADICIONAL

  async function adicionar(e) {
    e.preventDefault()
    const nome = form.nome.trim()
    const email = form.email.trim().toLowerCase()
    if (!nome || !email) { erro('Preencha nome e e-mail.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { erro('E-mail inválido.'); return }
    if (membros.some(m => (m.email || '').toLowerCase() === email)) {
      erro('Já existe um membro com esse e-mail.'); return
    }

    setSalvando(true)
    const { error } = await supabase.from('salao_membros').insert({
      salao_id: salaoId,
      nome,
      email,
      papel: form.papel,
      ativo: true,
    })
    setSalvando(false)

    if (error) { erro('Não foi possível adicionar: ' + error.message); return }
    sucesso('Membro adicionado! Peça para ela criar a conta com esse e-mail.')
    setForm({ nome: '', email: '', papel: 'profissional' })
    setShowForm(false)
    load()
  }

  async function alterarPapel(membro, novoPapel) {
    if (membro.papel === 'dona') return
    const { error } = await supabase.from('salao_membros')
      .update({ papel: novoPapel }).eq('id', membro.id)
    if (error) { erro('Erro ao alterar função: ' + error.message); return }
    sucesso('Função atualizada.')
    load()
  }

  async function toggleAtivo(membro) {
    if (membro.papel === 'dona') return
    const { error } = await supabase.from('salao_membros')
      .update({ ativo: !membro.ativo }).eq('id', membro.id)
    if (error) { erro('Erro: ' + error.message); return }
    sucesso(membro.ativo ? 'Acesso suspenso.' : 'Acesso reativado.')
    load()
  }

  async function remover(membro) {
    if (membro.papel === 'dona') return
    const ok = await confirmar({
      titulo: 'Remover membro?',
      mensagem: `${membro.nome || membro.email} perderá o acesso ao salão. Os agendamentos dela continuam salvos.`,
      confirmarLabel: 'Remover',
      tipo: 'perigo',
    })
    if (!ok) return
    const { error } = await supabase.from('salao_membros').delete().eq('id', membro.id)
    if (error) { erro('Erro ao remover: ' + error.message); return }
    sucesso('Membro removido.')
    load()
  }

  function abrirWhatsappLicencas() {
    const link = whatsappAssinarLink({
      nomeUsuario: user?.user_metadata?.full_name,
      emailUsuario: user?.email,
      planoId: plano?.id || 'pro',
      ciclo: 'anual',
    })
    window.open(link, '_blank')
  }

  // 🔒 Só a dona/admin gerencia a equipe
  if (!podeGerenciarEquipe) {
    return (
      <div style={s.page}>
        <div style={s.bloqueio}>
          <ShieldCheck size={40} color="var(--text3)" style={{ marginBottom: 12 }} />
          <div style={s.bloqueioTitulo}>Acesso restrito</div>
          <div style={s.bloqueioSub}>Só a dona do salão pode gerenciar a equipe.</div>
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerIcon}><Users size={22} color="white" /></div>
        <div style={{ flex: 1 }}>
          <h1 style={s.title}>Equipe</h1>
          <p style={s.sub}>{salao?.nome || 'Seu salão'}</p>
        </div>
        <button style={s.addBtn} onClick={() => setShowForm(v => !v)}>
          {showForm ? <X size={16} /> : <UserPlus size={16} />}
          {showForm ? 'Fechar' : 'Adicionar'}
        </button>
      </div>

      {/* Resumo de licenças / custo */}
      <div style={s.licencaCard}>
        <div style={s.licencaTop}>
          <div>
            <div style={s.licencaLabel}>Licenças adicionais</div>
            <div style={s.licencaValor}>{licencasAdicionais}</div>
            <div style={s.licencaHint}>profissionais/recepcionistas com login ativo</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={s.licencaLabel}>Custo adicional</div>
            <div style={s.licencaValor}>R$ {formatPreco(custoAdicional)}</div>
            <div style={s.licencaHint}>R$ {formatPreco(PRECO_LICENCA_ADICIONAL)} por login extra</div>
          </div>
        </div>
        <div style={s.licencaInfo}>
          <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            O plano <strong>{plano?.nome || 'Pro'}</strong> já cobre o salão inteiro. A dona não conta como licença extra —
            só os logins adicionais de profissionais e recepcionistas.
          </span>
        </div>
        {licencasAdicionais > 0 && (
          <button style={s.licencaBtn} onClick={abrirWhatsappLicencas}>
            Atualizar minha assinatura
          </button>
        )}
      </div>

      {/* Form de adicionar */}
      {showForm && (
        <form style={s.form} onSubmit={adicionar}>
          <div style={s.formTitulo}>Adicionar membro</div>
          <input
            style={s.input}
            placeholder="Nome"
            value={form.nome}
            onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
          />
          <input
            style={s.input}
            type="email"
            placeholder="E-mail (ela usará para criar a conta)"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          />
          <div style={s.papelOpcoes}>
            {['recepcionista', 'profissional'].map(p => {
              const cfg = PAPEIS[p]
              const Icon = cfg.icon
              const ativo = form.papel === p
              return (
                <button
                  type="button"
                  key={p}
                  style={{ ...s.papelOpcao, ...(ativo ? { borderColor: cfg.cor, background: cfg.cor + '12' } : {}) }}
                  onClick={() => setForm(f => ({ ...f, papel: p }))}
                >
                  <Icon size={16} color={cfg.cor} />
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={s.papelOpcaoLabel}>{cfg.label}</div>
                    <div style={s.papelOpcaoDesc}>{cfg.desc}</div>
                  </div>
                  {ativo && <Check size={15} color={cfg.cor} />}
                </button>
              )
            })}
          </div>
          <button style={s.submitBtn} type="submit" disabled={salvando}>
            {salvando ? 'Adicionando...' : 'Adicionar membro'}
          </button>
          <div style={s.formNota}>
            <Mail size={12} style={{ flexShrink: 0 }} />
            Ela receberá acesso assim que criar a conta no NailPro com esse mesmo e-mail.
          </div>
        </form>
      )}

      {/* Lista de membros */}
      {loading ? (
        <div style={s.empty}>Carregando equipe...</div>
      ) : (
        <div style={s.lista}>
          {membros.map(m => {
            const cfg = PAPEIS[m.papel] || PAPEIS.profissional
            const Icon = cfg.icon
            const isDona = m.papel === 'dona'
            const pendente = !m.user_id && !isDona
            return (
              <div key={m.id} style={{ ...s.membro, ...(m.ativo ? {} : { opacity: 0.55 }) }}>
                <div style={{ ...s.membroAvatar, background: cfg.cor }}>
                  <Icon size={18} color="white" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.membroNome}>
                    {m.nome || m.email}
                    {pendente && <span style={s.tagPendente}>aguardando cadastro</span>}
                    {!m.ativo && <span style={s.tagSuspenso}>suspensa</span>}
                  </div>
                  <div style={s.membroEmail}>{m.email}</div>
                  {isDona ? (
                    <div style={{ ...s.papelBadge, color: cfg.cor }}>{cfg.label} (você)</div>
                  ) : (
                    <select
                      style={s.papelSelect}
                      value={m.papel}
                      onChange={e => alterarPapel(m, e.target.value)}
                    >
                      <option value="recepcionista">Recepcionista</option>
                      <option value="profissional">Profissional</option>
                    </select>
                  )}
                </div>
                {!isDona && (
                  <div style={s.membroAcoes}>
                    <button
                      style={s.acaoBtn}
                      title={m.ativo ? 'Suspender acesso' : 'Reativar acesso'}
                      onClick={() => toggleAtivo(m)}
                    >
                      {m.ativo ? <X size={15} /> : <Check size={15} />}
                    </button>
                    <button style={{ ...s.acaoBtn, color: '#B91C1C' }} title="Remover" onClick={() => remover(m)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const s = {
  page: { padding: 16, paddingBottom: 80 },
  header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
  headerIcon: { width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #8B2655 0%, #C13B7A 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(139,38,85,0.3)' },
  title: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 },
  sub: { fontSize: 12, color: 'var(--text3)', margin: '2px 0 0' },
  addBtn: { display: 'flex', alignItems: 'center', gap: 6, background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-pill)', padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, boxShadow: 'var(--shadow-pink)' },

  licencaCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 16, marginBottom: 14, boxShadow: 'var(--shadow-xs)' },
  licencaTop: { display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  licencaLabel: { fontSize: 10, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' },
  licencaValor: { fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1, marginTop: 2 },
  licencaHint: { fontSize: 10, color: 'var(--text3)', marginTop: 2 },
  licencaInfo: { display: 'flex', gap: 6, alignItems: 'flex-start', background: 'var(--surface2)', borderRadius: 8, padding: '9px 11px', fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.5 },
  licencaBtn: { width: '100%', marginTop: 10, background: '#25D366', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '11px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },

  form: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 16, marginBottom: 14, boxShadow: 'var(--shadow-xs)' },
  formTitulo: { fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 },
  input: { width: '100%', boxSizing: 'border-box', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '11px 13px', fontSize: 14, marginBottom: 10, fontFamily: 'inherit', color: 'var(--text)', background: 'var(--surface)' },
  papelOpcoes: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 },
  papelOpcao: { display: 'flex', alignItems: 'center', gap: 10, border: '1.5px solid var(--border2)', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: '11px 12px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  papelOpcaoLabel: { fontSize: 13, fontWeight: 700, color: 'var(--text)' },
  papelOpcaoDesc: { fontSize: 11, color: 'var(--text3)', marginTop: 1 },
  submitBtn: { width: '100%', background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: 'var(--shadow-pink)' },
  formNota: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 11, color: 'var(--text3)', lineHeight: 1.4 },

  lista: { display: 'flex', flexDirection: 'column', gap: 8 },
  membro: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', boxShadow: 'var(--shadow-xs)' },
  membroAvatar: { width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  membroNome: { fontSize: 14, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  membroEmail: { fontSize: 11.5, color: 'var(--text3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  papelBadge: { fontSize: 11, fontWeight: 700, marginTop: 5 },
  papelSelect: { marginTop: 6, border: '1px solid var(--border2)', borderRadius: 6, padding: '4px 8px', fontSize: 11.5, fontFamily: 'inherit', color: 'var(--text2)', background: 'var(--surface)', cursor: 'pointer' },
  tagPendente: { fontSize: 9.5, fontWeight: 700, background: '#FEF3C7', color: '#92400E', padding: '2px 7px', borderRadius: 'var(--radius-pill)', textTransform: 'uppercase', letterSpacing: '0.3px' },
  tagSuspenso: { fontSize: 9.5, fontWeight: 700, background: '#FEE2E2', color: '#B91C1C', padding: '2px 7px', borderRadius: 'var(--radius-pill)', textTransform: 'uppercase', letterSpacing: '0.3px' },
  membroAcoes: { display: 'flex', gap: 4, flexShrink: 0 },
  acaoBtn: { width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text2)' },

  empty: { textAlign: 'center', padding: '40px 20px', color: 'var(--text3)', fontSize: 13 },
  bloqueio: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', textAlign: 'center' },
  bloqueioTitulo: { fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 },
  bloqueioSub: { fontSize: 13, color: 'var(--text3)' },
}
