import { differenceInDays, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AlertTriangle, Clock, RefreshCw } from 'lucide-react'
import WaIcon from '../../components/common/WaIcon'

function quando(ts) {
  if (!ts) return 'nunca'
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true, locale: ptBR }) } catch { return '—' }
}

function diasAte(ts) {
  if (!ts) return null
  return differenceInDays(new Date(ts), new Date())
}

function linkWpp(wpp, texto) {
  const num = wpp?.replace(/\D/g, '')
  if (!num) return null
  const msg = encodeURIComponent(texto)
  return `https://api.whatsapp.com/send?phone=55${num}&text=${msg}`
}

export default function AdminAlertas({ usuarios, onEstenderTrial, onVerAtividade, onAtivar }) {
  const pagantes  = usuarios.filter(u => u.assinatura_status === 'active' && !u.cortesia)
  const trials    = usuarios.filter(u => u.assinatura_status === 'trialing' && !u.cortesia)
  const ativos    = usuarios.filter(u => ['active', 'trialing'].includes(u.assinatura_status) && !u.cortesia)

  const trialsExpirando = trials
    .filter(u => diasAte(u.trial_termina_em) !== null && diasAte(u.trial_termina_em) <= 3)
    .sort((a, b) => new Date(a.trial_termina_em) - new Date(b.trial_termina_em))

  const renovacoes = pagantes
    .filter(u => u.assinatura_ciclo === 'anual'
      && diasAte(u.periodo_termina_em) !== null
      && diasAte(u.periodo_termina_em) <= 30)
    .sort((a, b) => new Date(a.periodo_termina_em) - new Date(b.periodo_termina_em))

  const sumidas = ativos
    .filter(u => !u.ultimo_acesso || differenceInDays(new Date(), new Date(u.ultimo_acesso)) >= 7)
    .sort((a, b) => {
      const da = a.ultimo_acesso ? new Date(a.ultimo_acesso) : new Date(0)
      const db = b.ultimo_acesso ? new Date(b.ultimo_acesso) : new Date(0)
      return da - db
    })

  const total = trialsExpirando.length + renovacoes.length + sumidas.length

  function nome(u) { return u.nome || u.email?.split('@')[0] || '?' }

  if (total === 0) {
    return (
      <div style={s.vazio}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
        Nenhum alerta no momento — tudo ok!
      </div>
    )
  }

  return (
    <div style={s.wrap}>

      {/* ── Trials expirando ── */}
      {trialsExpirando.length > 0 && (
        <section style={s.grupo}>
          <div style={s.grupoHead}>
            <AlertTriangle size={14} color="#B91C1C" />
            <span style={{ ...s.grupoLabel, color: '#B91C1C' }}>
              Trial expirando ({trialsExpirando.length})
            </span>
          </div>
          {trialsExpirando.map(u => {
            const dias = diasAte(u.trial_termina_em)
            const wppLink = linkWpp(u.whatsapp, `Oi ${nome(u)}! Vi que seu trial do Lumen ${dias <= 0 ? 'expirou' : `expira em ${dias} dia${dias === 1 ? '' : 's'}`}. Posso te ajudar com alguma dúvida?`)
            return (
              <div key={u.user_id} style={{ ...s.alerta, borderLeft: '3px solid #B91C1C' }}>
                <div style={s.alertaInfo}>
                  <div style={s.alertaNome}>{nome(u)}</div>
                  <div style={s.alertaMeta}>
                    {u.nome_salao && <>{u.nome_salao} · </>}
                    Trial {dias <= 0 ? 'expirado' : `expira em ${dias}d`} · {u.total_clientes || 0} clientes · ativo {quando(u.ultima_atividade)}
                  </div>
                </div>
                <div style={s.acoes}>
                  {wppLink && (
                    <a href={wppLink} target="_blank" rel="noreferrer" style={s.btnWpp}>
                      <WaIcon size={12} /> Wpp
                    </a>
                  )}
                  {onEstenderTrial && (
                    <button style={s.btnSecundario} onClick={() => onEstenderTrial(u.user_id, 7)}>
                      +7d
                    </button>
                  )}
                  {onAtivar && (
                    <button style={s.btnPrimario} onClick={() => onAtivar(u.user_id, 'solo', 'mensal')}>
                      Ativar Solo
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </section>
      )}

      {/* ── Renovações manuais ── */}
      {renovacoes.length > 0 && (
        <section style={s.grupo}>
          <div style={s.grupoHead}>
            <Clock size={14} color="#C2410C" />
            <span style={{ ...s.grupoLabel, color: '#C2410C' }}>
              Renovação manual ({renovacoes.length})
            </span>
          </div>
          {renovacoes.map(u => {
            const dias = diasAte(u.periodo_termina_em)
            const wppLink = linkWpp(u.whatsapp, `Oi ${nome(u)}! Seu plano anual do Lumen vence em ${dias} dias. Vamos renovar?`)
            return (
              <div key={u.user_id} style={{ ...s.alerta, borderLeft: '3px solid #C2410C' }}>
                <div style={s.alertaInfo}>
                  <div style={s.alertaNome}>{nome(u)}</div>
                  <div style={s.alertaMeta}>
                    {u.nome_salao && <>{u.nome_salao} · </>}
                    Anual vence em {dias}d · plano {u.assinatura_plano?.toUpperCase()}
                  </div>
                </div>
                <div style={s.acoes}>
                  {wppLink && (
                    <a href={wppLink} target="_blank" rel="noreferrer" style={s.btnWpp}>
                      <WaIcon size={12} /> Wpp
                    </a>
                  )}
                  {onVerAtividade && (
                    <button style={s.btnSecundario} onClick={() => onVerAtividade(u)}>
                      Ver
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </section>
      )}

      {/* ── Sumidas ── */}
      {sumidas.length > 0 && (
        <section style={s.grupo}>
          <div style={s.grupoHead}>
            <RefreshCw size={14} color="#6B7280" />
            <span style={{ ...s.grupoLabel, color: '#6B7280' }}>
              Sumidas ({sumidas.length})
            </span>
          </div>
          {sumidas.map(u => {
            const wppLink = linkWpp(u.whatsapp, `Oi ${nome(u)}! Tudo bem? Vi que faz um tempo que você não acessa o Lumen. Posso te ajudar com alguma coisa?`)
            return (
              <div key={u.user_id} style={{ ...s.alerta, borderLeft: '3px solid #D1D5DB' }}>
                <div style={s.alertaInfo}>
                  <div style={s.alertaNome}>{nome(u)}</div>
                  <div style={s.alertaMeta}>
                    {u.nome_salao && <>{u.nome_salao} · </>}
                    Último acesso {quando(u.ultimo_acesso)} · {u.assinatura_status === 'trialing' ? 'trial' : 'ativa'}
                  </div>
                </div>
                <div style={s.acoes}>
                  {wppLink && (
                    <a href={wppLink} target="_blank" rel="noreferrer" style={s.btnWpp}>
                      <WaIcon size={12} /> Wpp
                    </a>
                  )}
                  {onVerAtividade && (
                    <button style={s.btnSecundario} onClick={() => onVerAtividade(u)}>
                      Ver
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </section>
      )}

    </div>
  )
}

const s = {
  wrap:       { display: 'flex', flexDirection: 'column', gap: 16 },
  vazio:      { textAlign: 'center', padding: '32px 0', color: 'var(--text3)', fontSize: 13 },
  grupo:      { display: 'flex', flexDirection: 'column', gap: 6 },
  grupoHead:  { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 },
  grupoLabel: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' },
  alerta:     { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, flexWrap: 'wrap' },
  alertaInfo: { flex: 1, minWidth: 0 },
  alertaNome: { fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  alertaMeta: { fontSize: 11, color: 'var(--text3)', marginTop: 2, lineHeight: 1.4 },
  acoes:      { display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' },
  btnWpp:     { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC', borderRadius: 8, fontSize: 11, fontWeight: 700, textDecoration: 'none', cursor: 'pointer', fontFamily: 'inherit' },
  btnSecundario:{ padding: '5px 10px', background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnPrimario:  { padding: '5px 10px', background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
}
