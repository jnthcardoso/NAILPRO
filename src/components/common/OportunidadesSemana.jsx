import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Cake, UserX, CalendarClock, CalendarX, MessageCircle, Link2, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useSalao } from '../../contexts/SalaoContext'
import { useToast } from '../../contexts/ToastContext'
import { linkWhatsApp, formatBRL } from '../../lib/formatters'
import { DIAS_RETORNO_PADRAO } from '../../lib/constants'
import { MSG_ANIVERSARIO_PADRAO, MSG_RETORNO_PADRAO, MSG_REAGENDAR_PADRAO, aplicarVariaveis } from '../../lib/mensagens'
import { format, addDays, differenceInDays, getDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// "Oportunidades da semana" — ponte entre a Fase 1 (gestão) e a Fase 2 (negócio).
// Insights ACIONÁVEIS a partir dos dados que o salão já tem: número + ação + R$.
// Só leitura; não cria nada no banco.
const primeiroNome = (nome) => (nome || '').split(' ')[0]

// Memória de quem já foi contatada, pra não repetir o mesmo aviso todo dia.
// Fonte de verdade = banco (tabela oportunidade_contatos), sincroniza entre
// aparelhos. O localStorage continua como reforço (offline + transição suave).
const CONTATADOS_KEY = 'oportunidades_contatadas'
const JANELA_ANIV = 8    // dias que esconde a aniversariante após contatar
const JANELA_SUMIDA = 14 // dias que esconde a sumida após contatar
function getContatadosLocal() {
  try { return JSON.parse(localStorage.getItem(CONTATADOS_KEY) || '{}') } catch { return {} }
}
function marcarContatadaLocal(tipo, clienteId, quando) {
  const m = getContatadosLocal()
  m[`${tipo}_${clienteId}`] = quando
  try { localStorage.setItem(CONTATADOS_KEY, JSON.stringify(m)) } catch { /* ignora */ }
}

export default function OportunidadesSemana({ variant = 'banner', withHeader = false }) {
  const { salaoId, isProfissional } = useSalao()
  const { sucesso, erro } = useToast()
  const navigate = useNavigate()
  const [dados, setDados] = useState(null)
  // Quem já foi contatada (mapa "tipo_clienteId" -> ISO). Começa do localStorage
  // (offline/transição) e é mesclado com o banco ao carregar.
  const [contatados, setContatados] = useState(() => getContatadosLocal())

  useEffect(() => {
    // A profissional não enxerga dados do salão inteiro.
    if (!salaoId || isProfissional) return
    let ativo = true
    ;(async () => {
      const hoje = new Date()
      const hojeStr = format(hoje, 'yyyy-MM-dd')
      const fim7Str = format(addDays(hoje, 6), 'yyyy-MM-dd')
      const inicio90 = format(addDays(hoje, -90), 'yyyy-MM-dd')
      const inicio30 = format(addDays(hoje, -30), 'yyyy-MM-dd')

      const [{ data: clientes }, { data: pagos }, { data: ags }, { data: config }, { data: contatos }, { data: cancelados30 }, { data: futuros }] = await Promise.all([
        supabase.from('clientes')
          .select('id, nome, telefone, ultimo_atendimento, data_nascimento, dias_retorno, arquivada')
          .eq('salao_id', salaoId),
        supabase.from('pagamentos')
          .select('valor').eq('salao_id', salaoId).eq('status', 'pago').gte('data', inicio90),
        supabase.from('agendamentos')
          .select('data').eq('salao_id', salaoId).gte('data', hojeStr).lte('data', fim7Str).neq('status', 'cancelado'),
        supabase.from('configuracoes')
          .select('slug, agenda_publica_ativa, nome_salao, dias_semana, msg_aniversario, msg_retorno, msg_reagendar')
          .eq('salao_id', salaoId).maybeSingle(),
        supabase.from('oportunidade_contatos')
          .select('cliente_id, tipo, contatado_em').eq('salao_id', salaoId),
        // cancelamentos recentes (30 dias) e horários futuros — pro insight de reagendar
        supabase.from('agendamentos')
          .select('cliente_id, data').eq('salao_id', salaoId).eq('status', 'cancelado').gte('data', inicio30),
        supabase.from('agendamentos')
          .select('cliente_id').eq('salao_id', salaoId).in('status', ['pendente', 'confirmado']).gte('data', hojeStr),
      ])

      // Só clientes acionáveis (com telefone) — alinha a contagem com a ação possível.
      const ativas = (clientes || []).filter(c => !c.arquivada && c.telefone)

      // Ticket médio (últimos 90 dias) — base para estimar potencial em R$
      const pg = (pagos || []).map(p => p.valor || 0).filter(v => v > 0)
      const ticket = pg.length ? pg.reduce((a, b) => a + b, 0) / pg.length : 0

      // 1) Aniversariantes nos próximos 7 dias
      const aniversariantes = ativas.filter(c => {
        if (!c.data_nascimento) return false
        const n = new Date(c.data_nascimento + 'T12:00:00')
        const prox = new Date(hoje.getFullYear(), n.getMonth(), n.getDate())
        const d = differenceInDays(prox, hoje)
        return d >= 0 && d <= 7
      })

      // 2) Clientes que passaram do tempo de retorno (sumindo)
      const sumidas = ativas.filter(c =>
        c.ultimo_atendimento &&
        differenceInDays(hoje, new Date(c.ultimo_atendimento + 'T12:00:00')) >= (c.dias_retorno ?? DIAS_RETORNO_PADRAO)
      )

      // 3) Dias com a agenda vazia — SÓ nos dias em que o salão trabalha (dias_semana)
      const diasTrabalho = config?.dias_semana?.length ? config.dias_semana : [1, 2, 3, 4, 5]
      const ocupados = new Set((ags || []).map(a => a.data))
      const diasLivres = [...Array(7)].map((_, i) => addDays(hoje, i))
        .filter(d => diasTrabalho.includes(getDay(d)) && !ocupados.has(format(d, 'yyyy-MM-dd')))

      // 4) Cancelaram (últimos 30 dias) e não remarcaram: sem horário futuro e sem
      //    ter voltado depois do cancelamento. Sinal mais fresco que "sumida".
      const lastCancel = {}
      ;(cancelados30 || []).forEach(a => {
        if (!a.cliente_id) return
        if (!lastCancel[a.cliente_id] || a.data > lastCancel[a.cliente_id]) lastCancel[a.cliente_id] = a.data
      })
      const comFuturo = new Set((futuros || []).map(f => f.cliente_id).filter(Boolean))
      const byId = {}
      ;(clientes || []).forEach(c => { byId[c.id] = c })
      const cancelouNaoRemarcou = Object.keys(lastCancel).map(id => {
        const c = byId[id]
        if (!c || c.arquivada || !c.telefone) return null
        if (comFuturo.has(id)) return null // remarcou
        if (c.ultimo_atendimento && c.ultimo_atendimento > lastCancel[id]) return null // voltou depois
        return c
      }).filter(Boolean)
      // Dedup: prioridade ao cancelamento (sinal mais claro) — tira do "sumidas".
      // Também exclui quem já tem agendamento futuro (não precisa de ação).
      const cancelIds = new Set(cancelouNaoRemarcou.map(c => c.id))
      const sumidasDedup = sumidas.filter(c => !cancelIds.has(c.id) && !comFuturo.has(c.id))

      if (ativo) {
        setDados({
          ticket,
          slug: config?.slug || '',
          agendaPublicaAtiva: !!config?.agenda_publica_ativa,
          nomeSalao: config?.nome_salao || '',
          tplAniversario: config?.msg_aniversario || MSG_ANIVERSARIO_PADRAO,
          tplRetorno: config?.msg_retorno || MSG_RETORNO_PADRAO,
          tplReagendar: config?.msg_reagendar || MSG_REAGENDAR_PADRAO,
          aniversariantes, sumidas: sumidasDedup, diasLivres, cancelouNaoRemarcou,
        })
        // Mescla os contatos do banco por cima do que veio do localStorage.
        setContatados(prev => {
          const m = { ...prev }
          ;(contatos || []).forEach(c => { m[`${c.tipo}_${c.cliente_id}`] = c.contatado_em })
          return m
        })
      }
    })()
    return () => { ativo = false }
  }, [salaoId, isProfissional])

  if (!dados) return null
  const { ticket, slug, agendaPublicaAtiva, nomeSalao, tplAniversario, tplRetorno, tplReagendar } = dados

  // Esconde quem já foi contatada recentemente (banco + aparelho) — não repete o aviso.
  const foiContatada = (tipo, clienteId, dias) => {
    const ts = contatados[`${tipo}_${clienteId}`]
    return ts ? differenceInDays(new Date(), new Date(ts)) < dias : false
  }
  const aniversariantes = dados.aniversariantes.filter(c => !foiContatada('aniv', c.id, JANELA_ANIV))
  const sumidas = dados.sumidas.filter(c => !foiContatada('retorno', c.id, JANELA_SUMIDA))
  const cancelouNaoRemarcou = (dados.cancelouNaoRemarcou || []).filter(c => !foiContatada('retorno', c.id, JANELA_SUMIDA))
  const diasLivres = dados.diasLivres

  const temAlgo = aniversariantes.length || sumidas.length || cancelouNaoRemarcou.length || diasLivres.length
  if (!temAlgo) return null

  const linkPublico = `${window.location.origin}/agendar/${slug}`
  const copiarLink = () => {
    // Sem slug OU agenda desativada -> leva para ativar (não copia link que não abre).
    if (!slug || !agendaPublicaAtiva) { navigate('/app/configuracoes'); return }
    navigator.clipboard?.writeText(linkPublico)
      .then(() => sucesso('Link de agendamento copiado'))
      .catch(() => erro('Não consegui copiar. Copie pela tela de Configurações.'))
  }

  // Marca a cliente como contatada: atualiza a tela na hora (otimista), grava no
  // aparelho (offline) e no banco (sincroniza entre dispositivos).
  const contatar = (tipo, id) => {
    const agora = new Date().toISOString()
    setContatados(prev => ({ ...prev, [`${tipo}_${id}`]: agora }))
    marcarContatadaLocal(tipo, id, agora)
    supabase.from('oportunidade_contatos')
      .upsert({ salao_id: salaoId, cliente_id: id, tipo, contatado_em: agora }, { onConflict: 'salao_id,cliente_id,tipo' })
      .then(({ error }) => { if (error) console.warn('Oportunidades: falha ao salvar contato —', error.message) })
  }
  const msgAniversario = (nome) => aplicarVariaveis(tplAniversario, { nome, salao: nomeSalao })
  const msgRetorno = (nome) => aplicarVariaveis(tplRetorno, { nome, salao: nomeSalao })
  const msgReagendar = (nome) => aplicarVariaveis(tplReagendar, { nome, salao: nomeSalao })

  // Pílulas de WhatsApp (uma por cliente) reaproveitadas pelos dois modos.
  const Pessoas = ({ clientes, montarMsg, tipo }) => (
    <div style={s.pessoas}>
      {clientes.slice(0, 3).map(c => (
        <a
          key={c.id} style={s.pessoa}
          href={linkWhatsApp(c.telefone, montarMsg(c.nome))}
          target="_blank" rel="noreferrer"
          onClick={() => contatar(tipo, c.id)}
          aria-label={`Enviar WhatsApp para ${primeiroNome(c.nome)}`}
        >
          <span style={s.pessoaNome}>{primeiroNome(c.nome)}</span>
          <span style={s.pessoaWa}><MessageCircle size={12} /> WhatsApp</span>
        </a>
      ))}
      {clientes.length > 3 && <div style={s.maisPessoas}>+{clientes.length - 3}</div>}
    </div>
  )

  // ── Modo "insights": cards compactos que entram na lista de Insights da Home ──
  // (já retornou null acima quando não há nada — nunca sobra cabeçalho órfão)
  if (variant === 'insights') {
    if (!aniversariantes.length && !sumidas.length && !cancelouNaoRemarcou.length) return null
    const rows = (
      <>
        {aniversariantes.length > 0 && (
          <div style={{ ...s.insight, background: 'linear-gradient(135deg, #FDF4FF, #FAE8FF)', borderColor: '#E9D5FF' }}>
            <Cake size={18} color="#86198F" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...s.insightTitle, color: '#701A75' }}>
                {aniversariantes.length} aniversário{aniversariantes.length > 1 ? 's' : ''} chegando
              </div>
              <div style={{ ...s.insightSub, color: '#86198F' }}>Toque no nome pra mandar um carinho no WhatsApp</div>
              <Pessoas clientes={aniversariantes} montarMsg={msgAniversario} tipo="aniv" />
            </div>
          </div>
        )}

        {cancelouNaoRemarcou.length > 0 && (
          <div style={{ ...s.insight, background: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)', borderColor: '#FDBA74' }}>
            <CalendarX size={18} color="#C2410C" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...s.insightTitle, color: '#7C2D12' }}>
                {cancelouNaoRemarcou.length} cancelaram e não remarcaram
              </div>
              <div style={{ ...s.insightSub, color: '#9A3412' }}>Toque no nome pra chamar pra remarcar no WhatsApp</div>
              <Pessoas clientes={cancelouNaoRemarcou} montarMsg={msgReagendar} tipo="retorno" />
            </div>
          </div>
        )}

        {sumidas.length > 0 && (
          <div
            style={{ ...s.insight, background: 'linear-gradient(135deg, #FEF2F2, #FEE2E2)', borderColor: '#FCA5A5', cursor: 'pointer' }}
            onClick={() => navigate('/app/metas?tab=indicadores')}
            role="button"
            aria-label="Ver clientes sumidas nos indicadores"
          >
            <UserX size={18} color="#B91C1C" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...s.insightTitle, color: '#7F1D1D' }}>
                {sumidas.length} cliente{sumidas.length > 1 ? 's' : ''} pra trazer de volta
              </div>
              <div style={{ ...s.insightSub, color: '#991B1B', marginBottom: 0 }}>
                {ticket > 0 ? `Potencial de ~${formatBRL(sumidas.length * ticket)} se voltarem` : 'Já passaram do tempo de retorno'}
              </div>
            </div>
            <ChevronRight size={18} color="#B91C1C" style={{ flexShrink: 0, alignSelf: 'center' }} />
          </div>
        )}

      </>
    )
    if (!withHeader) return rows
    return (
      <div style={s.insightsCol}>
        <div style={s.insightsTitle}>💡 insights pra você</div>
        {rows}
      </div>
    )
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <Sparkles size={16} color="var(--pink)" />
        <span style={s.title}>Oportunidades da semana</span>
      </div>

      <div style={s.grid}>
        {/* 1) Aniversariantes */}
        {aniversariantes.length > 0 && (
          <Card
            icon={<Cake size={16} />} cor="#86198F" bg="#FAE8FF"
            titulo={`${aniversariantes.length} aniversário${aniversariantes.length > 1 ? 's' : ''} chegando`}
            sub="Mande um carinho e traga ela pra agendar — aumenta o retorno e o ticket."
            clientes={aniversariantes} montarMsg={msgAniversario}
            onContatar={(id) => contatar('aniv', id)}
          />
        )}

        {/* 2) Cancelaram e não remarcaram (sinal mais fresco que sumida) */}
        {cancelouNaoRemarcou.length > 0 && (
          <Card
            icon={<CalendarX size={16} />} cor="#C2410C" bg="#FFEDD5"
            titulo={`${cancelouNaoRemarcou.length} cancelaram e não remarcaram`}
            sub="Cancelaram nos últimos 30 dias e não voltaram a marcar. Chame pra remarcar antes que esfrie."
            clientes={cancelouNaoRemarcou} montarMsg={msgReagendar}
            onContatar={(id) => contatar('retorno', id)}
          />
        )}

        {/* 3) Clientes sumindo */}
        {sumidas.length > 0 && (
          <Card
            icon={<UserX size={16} />} cor="#B91C1C" bg="#FEE2E2"
            titulo={`${sumidas.length} cliente${sumidas.length > 1 ? 's' : ''} pra trazer de volta`}
            sub={ticket > 0
              ? `Já passaram do retorno. Potencial de ~${formatBRL(sumidas.length * ticket)} se voltarem.`
              : 'Já passaram do tempo de retorno. Chame antes que esfriem.'}
            clientes={sumidas} montarMsg={msgRetorno}
            onContatar={(id) => contatar('retorno', id)}
          />
        )}

        {/* 3) Agenda livre */}
        {diasLivres.length > 0 && (
          <div style={s.card}>
            <div style={s.cardHead}>
              <div style={{ ...s.cardIcon, background: '#DBEAFE', color: '#1E40AF' }}><CalendarClock size={16} /></div>
              <div style={s.cardTit}>{diasLivres.length} dia{diasLivres.length > 1 ? 's' : ''} com a agenda livre</div>
            </div>
            <div style={s.cardSub}>
              {diasLivres.slice(0, 4).map(d => format(d, 'EEE dd/MM', { locale: ptBR })).join(' · ')}
              {diasLivres.length > 4 ? '…' : ''}
            </div>
            <div style={s.cardSub2}>Divulgue seu link de agendamento pra encher esses horários.</div>
            <button style={s.acaoBtn} onClick={copiarLink}>
              {agendaPublicaAtiva && slug
                ? <><Link2 size={13} /> Copiar link de agendamento</>
                : <><ChevronRight size={13} /> Ativar agenda online</>}
            </button>
          </div>
        )}
      </div>
      {/* Fase 2 (Negócio): aqui entra futuramente a linha "a Lumen faz isso por você". */}
    </div>
  )
}

// Card com lista de clientes acionáveis (botão de WhatsApp pré-preenchido por pessoa).
// Ao clicar, marca a cliente como contatada para não repetir o aviso.
function Card({ icon, cor, bg, titulo, sub, clientes, montarMsg, onContatar }) {
  return (
    <div style={s.card}>
      <div style={s.cardHead}>
        <div style={{ ...s.cardIcon, background: bg, color: cor }}>{icon}</div>
        <div style={s.cardTit}>{titulo}</div>
      </div>
      <div style={s.cardSub}>{sub}</div>
      <div style={s.pessoas}>
        {clientes.slice(0, 3).map(c => (
          <a
            key={c.id} style={s.pessoa}
            href={linkWhatsApp(c.telefone, montarMsg(c.nome))}
            target="_blank" rel="noreferrer"
            onClick={() => onContatar(c.id)}
            aria-label={`Enviar WhatsApp para ${primeiroNome(c.nome)}`}
          >
            <span style={s.pessoaNome}>{primeiroNome(c.nome)}</span>
            <span style={s.pessoaWa}><MessageCircle size={12} /> WhatsApp</span>
          </a>
        ))}
        {clientes.length > 3 && <div style={s.maisPessoas}>+{clientes.length - 3}</div>}
      </div>
    </div>
  )
}

const s = {
  wrap: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px', marginBottom: 18, boxShadow: 'var(--shadow-sm)' },
  header: { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 },
  title: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 15, fontWeight: 800, color: 'var(--text)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 },
  card: { display: 'flex', flexDirection: 'column', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px' },
  cardHead: { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 },
  cardIcon: { width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardTit: { fontSize: 13.5, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 },
  cardSub: { fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 10 },
  cardSub2: { fontSize: 12, color: 'var(--text3)', lineHeight: 1.5, marginBottom: 12 },
  pessoas: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'auto' },
  pessoa: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-pill)', padding: '5px 10px', textDecoration: 'none', fontFamily: 'inherit' },
  pessoaNome: { fontSize: 12, fontWeight: 700, color: 'var(--text)' },
  pessoaWa: { display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: '#15803D' },
  maisPessoas: { display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text3)', padding: '5px 8px' },
  acaoBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 'auto', background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '9px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },

  /* ── Modo "insights" (cards compactos na Home) ── */
  insight: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid', boxShadow: 'var(--shadow-xs)' },
  insightTitle: { fontSize: 13, fontWeight: 700 },
  insightSub: { fontSize: 11, marginTop: 2, marginBottom: 8, opacity: 0.9 },
  acaoBtnSm: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '7px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  insightsCol: { display: 'flex', flexDirection: 'column', gap: 8 },
  insightsTitle: { fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px' },
}
