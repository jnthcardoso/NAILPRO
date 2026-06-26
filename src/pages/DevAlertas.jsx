import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'
import AdminAlertas from './admin/AdminAlertas'
import Modal from '../components/common/Modal'
import { Activity, DollarSign, Calendar, Users, Receipt, Target } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const ATIV_ICON = {
  agendamento: Calendar, pagamento: DollarSign,
  cliente: Users, despesa: Receipt, meta: Target,
}

function quando(ts) {
  if (!ts) return '—'
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true, locale: ptBR }) } catch { return '—' }
}

export default function DevAlertas() {
  const { confirmar, sucesso, erro: toastErro } = useToast()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [acaoLoading, setAcaoLoading] = useState(false)
  const [atividadeUser, setAtividadeUser] = useState(null)
  const [atividade, setAtividade] = useState([])
  const [loadingAtiv, setLoadingAtiv] = useState(false)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.rpc('admin_listar_usuarios')
    setUsuarios(data || [])
    setLoading(false)
  }

  async function estenderTrial(userId, dias) {
    const ok = await confirmar({
      titulo: `Estender trial em +${dias} dias?`,
      mensagem: 'O usuário ganha mais tempo de teste gratuito.',
      confirmarLabel: 'Sim, estender',
    })
    if (!ok) return
    setAcaoLoading(true)
    const { error } = await supabase.rpc('admin_estender_trial', { p_user_id: userId, p_dias: dias })
    setAcaoLoading(false)
    if (error) { toastErro('Erro: ' + error.message); return }
    sucesso(`Trial estendido +${dias} dias ✓`)
    carregar()
  }

  async function ativar(userId, plano, ciclo) {
    const ok = await confirmar({
      titulo: `Ativar ${plano.toUpperCase()} (${ciclo})?`,
      mensagem: 'O usuário terá acesso completo.',
      confirmarLabel: 'Sim, ativar',
    })
    if (!ok) return
    setAcaoLoading(true)
    const { error } = await supabase.rpc('admin_ativar_assinatura', { p_user_id: userId, p_plano: plano, p_ciclo: ciclo })
    setAcaoLoading(false)
    if (error) { toastErro('Erro: ' + error.message); return }
    sucesso(`${plano.toUpperCase()} ativado ✓`)
    carregar()
  }

  async function verAtividade(u) {
    setAtividadeUser(u)
    setAtividade([])
    setLoadingAtiv(true)
    const { data } = await supabase.rpc('admin_atividade_usuario', { p_user_id: u.user_id, p_limit: 30 })
    setLoadingAtiv(false)
    setAtividade(data || [])
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.iconBox}><Bell size={20} color="white" /></div>
        <div>
          <h1 style={s.title}>Alertas</h1>
          <p style={s.sub}>Contas que precisam de atenção</p>
        </div>
      </div>

      {loading
        ? <div style={s.loading}>Carregando…</div>
        : <AdminAlertas
            usuarios={usuarios}
            onEstenderTrial={estenderTrial}
            onVerAtividade={verAtividade}
            onAtivar={ativar}
          />}

      {atividadeUser && (
        <Modal onClose={() => setAtividadeUser(null)} boxStyle={s.ativModal}>
          <div style={s.ativHeader}>
            <Activity size={18} color="#0369A1" />
            <div>
              <div style={s.ativTitulo}>{atividadeUser.nome || atividadeUser.email?.split('@')[0]}</div>
              <div style={s.ativSub}>Últimas alterações</div>
            </div>
          </div>
          {loadingAtiv ? (
            <div style={s.ativVazio}>Carregando…</div>
          ) : atividade.length === 0 ? (
            <div style={s.ativVazio}>Nenhuma atividade registrada.</div>
          ) : (
            <div style={s.ativLista}>
              {atividade.map((ev, i) => {
                const Ico = ATIV_ICON[ev.tipo] || Activity
                return (
                  <div key={i} style={s.ativItem}>
                    <div style={s.ativIcone}><Ico size={14} color="var(--text2)" /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={s.ativDesc}>{ev.descricao}</div>
                      <div style={s.ativQuando}>
                        {format(new Date(ev.quando), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} · {quando(ev.quando)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

const s = {
  page:      { padding: 20, paddingBottom: 80 },
  header:    { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 },
  iconBox:   { width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#C2410C,#F97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title:     { fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0 },
  sub:       { fontSize: 12, color: 'var(--text3)', margin: '2px 0 0' },
  loading:   { textAlign: 'center', padding: 48, color: 'var(--text3)', fontSize: 13 },
  ativModal: { background: 'var(--surface)', borderRadius: 16, padding: 18, width: '100%', maxWidth: 460, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' },
  ativHeader:{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 4 },
  ativTitulo:{ fontSize: 15, fontWeight: 700, color: 'var(--text)' },
  ativSub:   { fontSize: 11, color: 'var(--text3)', marginTop: 1 },
  ativLista: { overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 },
  ativItem:  { display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 4px', borderBottom: '1px solid var(--border)' },
  ativIcone: { width: 28, height: 28, borderRadius: '50%', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  ativDesc:  { fontSize: 13, color: 'var(--text)', fontWeight: 500, lineHeight: 1.35 },
  ativQuando:{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2 },
  ativVazio: { textAlign: 'center', padding: '32px 0', color: 'var(--text3)', fontSize: 13 },
}
