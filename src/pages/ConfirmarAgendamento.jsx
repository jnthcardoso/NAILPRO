import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { LumenLogo } from '../components/common/Brand'

// Telinha pública que a cliente abre pelo link "✅ Confirmar" do lembrete.
// Chama a função do banco (confirmar_agendamento_por_token) que muda o status
// pra 'confirmado' sozinho. Não exige login. Cada resultado tem sua mensagem.

function dataParaDate(d) {
  if (!d) return null
  const [y, m, dia] = d.split('-').map(Number)
  return new Date(y, m - 1, dia)
}

const VISUAL = {
  confirmado:    { icon: '✅', cor: 'var(--green, #2E7D32)', titulo: 'Horário confirmado!' },
  ja_confirmado: { icon: '💚', cor: 'var(--green, #2E7D32)', titulo: 'Já estava confirmado' },
  cancelado:     { icon: '⚠️', cor: '#B91C1C',               titulo: 'Esse horário foi cancelado' },
  expirado:      { icon: '🕓', cor: '#92400E',               titulo: 'Esse horário já passou' },
  nao_encontrado:{ icon: '🔗', cor: 'var(--text2, #555)',    titulo: 'Link inválido' },
  erro:          { icon: '😕', cor: 'var(--text2, #555)',    titulo: 'Não foi possível confirmar' },
}

export default function ConfirmarAgendamento() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [res, setRes] = useState(null)   // { resultado, nome, data, horario, servico }

  useEffect(() => {
    let cancelado = false
    async function confirmar() {
      const { data, error } = await supabase.rpc('confirmar_agendamento', { p_codigo: token })
      if (cancelado) return
      if (error) {
        console.warn('Confirmar agendamento:', error.message)
        setRes({ resultado: 'erro' })
      } else {
        setRes(data)
      }
      setLoading(false)
    }
    confirmar()
    return () => { cancelado = true }
  }, [token])

  if (loading) {
    return (
      <div style={s.page}>
        <div style={s.center}>
          <div style={s.spinner} />
          <div style={s.loadingTxt}>Confirmando seu horário...</div>
        </div>
      </div>
    )
  }

  const v = VISUAL[res?.resultado] || VISUAL.erro
  const data = dataParaDate(res?.data)
  const hora = res?.horario?.slice(0, 5)
  const ok = res?.resultado === 'confirmado' || res?.resultado === 'ja_confirmado'

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logoWrap}><LumenLogo size={26} /></div>

        <div style={{ ...s.iconBig, color: v.cor }}>{v.icon}</div>
        <h1 style={s.titulo}>{v.titulo}</h1>

        {ok && (
          <p style={s.sub}>
            {res?.nome ? <><strong>{res.nome}</strong>, </> : ''}
            seu horário está confirmado. A profissional já foi avisada. 💜
          </p>
        )}
        {res?.resultado === 'cancelado' && (
          <p style={s.sub}>Fale com a profissional pelo WhatsApp para marcar um novo horário.</p>
        )}
        {res?.resultado === 'expirado' && (
          <p style={s.sub}>Se precisar, fale com a profissional pelo WhatsApp para um novo horário.</p>
        )}
        {res?.resultado === 'nao_encontrado' && (
          <p style={s.sub}>Esse link não é válido. Confira a mensagem ou fale com a profissional.</p>
        )}
        {res?.resultado === 'erro' && (
          <p style={s.sub}>Tente abrir o link de novo em alguns instantes.</p>
        )}

        {data && hora && res?.resultado !== 'nao_encontrado' && res?.resultado !== 'erro' && (
          <div style={s.box}>
            <div style={s.row}><span>📅 Data</span><strong>{format(data, "EEEE, dd/MM", { locale: ptBR })}</strong></div>
            <div style={s.row}><span>🕐 Horário</span><strong>{hora}</strong></div>
            {res?.servico && <div style={s.row}><span>💅 Serviço</span><strong>{res.servico}</strong></div>}
          </div>
        )}
      </div>

      <div style={s.footer}>
        <a href="https://lumengestaoempresarial.com.br/?ref=confirmar" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
          Powered by <strong>lumen</strong> 💅
        </a>
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: 'var(--bg, #FAF6F6)', fontFamily: 'var(--font)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 18 },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 },
  spinner: { width: 30, height: 30, borderRadius: '50%', border: '3px solid #EADBE2', borderTopColor: 'var(--pink, #8B2655)', animation: 'spin 0.8s linear infinite' },
  loadingTxt: { fontSize: 14, color: 'var(--text2, #555)' },
  card: { background: 'white', borderRadius: 18, padding: '32px 26px', maxWidth: 380, width: '100%', textAlign: 'center', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  logoWrap: { marginBottom: 18, opacity: 0.9 },
  iconBig: { fontSize: 54, lineHeight: 1, marginBottom: 6 },
  titulo: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 700, color: 'var(--text, #2A2A2A)', margin: '6px 0 4px' },
  sub: { fontSize: 14, color: 'var(--text2, #555)', lineHeight: 1.5, margin: '0 0 4px' },
  box: { background: 'var(--bg, #FAF6F6)', borderRadius: 12, padding: '14px 16px', marginTop: 18, width: '100%', display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: 'var(--text2, #555)', gap: 12 },
  footer: { fontSize: 12, color: 'var(--text3, #999)' },
}
