import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, MessageCircle, Check, Send, Settings, AlertCircle, Phone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSalao } from '../contexts/SalaoContext'
import { useAssinatura } from '../contexts/AssinaturaContext'
import { useToast } from '../contexts/ToastContext'
import { UpgradeBlock } from '../components/common/UpgradeBlock'
import { format, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { linkWhatsApp, dataParaDate, validarTelefone, quandoRelativo, MSG_LEMBRETE_PADRAO } from '../lib/formatters'
import { traduzErro } from '../lib/erros'

const TABS = [
  { id: 'amanha', label: 'Amanhã', dias: 1 },
  { id: 'hoje',   label: 'Hoje',   dias: 0 },
  { id: '7dias',  label: 'Próximos 7 dias', dias: 7 },
]

export default function Lembretes() {
  const { user } = useAuth()
  const { salaoId } = useSalao()
  const navigate = useNavigate()
  const { erro, sucesso } = useToast()
  const { temAcesso, loading: loadingAssinatura } = useAssinatura()
  const [tab, setTab] = useState('amanha')
  const [config, setConfig] = useState({ mensagem_lembrete: '', nome_salao: '', lembretes_ativos: true })
  const [agendamentos, setAgendamentos] = useState([])
  const [semTelefone, setSemTelefone] = useState([])
  // Cards que abriram o WhatsApp e aguardam a usuária confirmar "Já enviei"
  // (só aí marcamos como enviado — fechar a aba sem mandar NÃO conta como enviado).
  const [aguardando, setAguardando] = useState(() => new Set())
  // Modo "enviar todos" em sequência (um por vez, sem ser bloqueado pelo navegador).
  const [seq, setSeq] = useState(null)

  useEffect(() => {
    if (!salaoId) return
    // Trocar de aba zera o estado de "aguardando confirmação" e a sequência.
    setAguardando(new Set())
    setSeq(null)
    load()
  }, [salaoId, tab])

  async function load() {
    const { data: cfg } = await supabase.from('configuracoes')
      .select('mensagem_lembrete, nome_salao, lembretes_ativos')
      .eq('salao_id', salaoId)
      .maybeSingle()
    if (cfg) setConfig(cfg)

    const t = TABS.find(x => x.id === tab)
    let dataInicio, dataFim
    if (t.id === 'hoje') {
      dataInicio = dataFim = format(new Date(), 'yyyy-MM-dd')
    } else if (t.id === 'amanha') {
      dataInicio = dataFim = format(addDays(new Date(), 1), 'yyyy-MM-dd')
    } else {
      dataInicio = format(addDays(new Date(), 1), 'yyyy-MM-dd')
      dataFim = format(addDays(new Date(), 7), 'yyyy-MM-dd')
    }

    const { data, error } = await supabase.from('agendamentos')
      .select('*, clientes(nome, telefone)')
      .eq('salao_id', salaoId)
      .gte('data', dataInicio).lte('data', dataFim)
      .in('status', ['pendente', 'confirmado'])
      .order('data').order('horario')

    if (error) { erro(traduzErro(error, 'Não foi possível carregar os lembretes.')); return }
    let lista = data || []

    // Aba "Hoje": não faz sentido lembrar de horário que já passou.
    if (t.id === 'hoje') {
      const agora = format(new Date(), 'HH:mm')
      lista = lista.filter(a => (a.horario?.slice(0, 5) || '99:99') >= agora)
    }

    // Telefone precisa ser válido (10 ou 11 dígitos) pra gerar um link de WhatsApp que funciona.
    setAgendamentos(lista.filter(a => validarTelefone(a.clientes?.telefone)))
    setSemTelefone(lista.filter(a => !validarTelefone(a.clientes?.telefone)))
  }

  function montarMensagem(ag) {
    const nome = ag.clientes?.nome || ''
    const [y, m, d] = ag.data.split('-')
    const dataFmt = `${d}/${m}`
    const horario = ag.horario?.slice(0, 5)
    const template = config.mensagem_lembrete || MSG_LEMBRETE_PADRAO

    // Aceita as variáveis com ou sem acento ({horário}/{horario}, {salão}/{salao}, {serviço}/{servico}).
    // {quando} = "hoje" / "amanhã" / "na terça-feira (10/06)" conforme a data do agendamento.
    const texto = template
      .replace(/\{nome_completo\}/gi, nome)
      .replace(/\{nome\}/gi, nome.split(' ')[0])
      .replace(/\{quando\}/gi, quandoRelativo(ag.data))
      .replace(/\{data\}/gi, dataFmt)
      .replace(/\{hor[aá]rio\}/gi, horario)
      .replace(/\{servi[cç]o\}/gi, ag.servico || '')
      .replace(/\{sal[aã]o\}/gi, config.nome_salao || '')

    // Link "Confirmar": a cliente toca e o agendamento vira 'confirmado' sozinho,
    // sem a manicure marcar na mão. (Se a cliente não quiser, é só responder a msg.)
    const codigo = ag.codigo_confirmacao || ag.token_confirmacao
    if (codigo) {
      const url = `${window.location.origin}/c/${codigo}`
      return `${texto}\n\nConfirme aqui: ${url}`
    }
    return texto
  }

  function buildLink(ag) {
    const msg = montarMensagem(ag)
    return linkWhatsApp(ag.clientes?.telefone, msg)
  }

  // O WhatsApp já abriu — se o registro do "enviado" falhar, o card só
  // continua como pendente (auto-corrige). Logamos sem alarmar a usuária.
  async function marcarEnviado(filtro) {
    const { error } = await filtro(
      supabase.from('agendamentos').update({ lembrete_enviado_em: new Date().toISOString() })
    ).eq('salao_id', salaoId)
    if (error) console.warn('Lembretes: falha ao marcar enviado —', error.message)
    load()
  }

  // Abre o WhatsApp e coloca o card em "aguardando confirmação".
  // Só marcamos como enviado quando a usuária confirmar que mandou de verdade.
  function enviarUm(ag) {
    window.open(buildLink(ag), '_blank')
    setAguardando(prev => new Set(prev).add(ag.id))
  }

  async function confirmarEnvio(ag) {
    setAguardando(prev => { const n = new Set(prev); n.delete(ag.id); return n })
    await marcarEnviado(q => q.eq('id', ag.id))
  }

  function cancelarEnvio(ag) {
    setAguardando(prev => { const n = new Set(prev); n.delete(ag.id); return n })
  }

  // "Enviar todos" em sequência, um por vez, em duas etapas por cliente:
  //  1) 'preview' — mostra QUEM é a próxima antes de abrir nada;
  //  2) 'confirm' — depois de abrir o WhatsApp, pergunta se enviou.
  // O window.open acontece só no clique "Abrir WhatsApp" → nunca é bloqueado.
  function iniciarSequencia() {
    if (pendentes.length === 0) return
    setSeq({ items: [...pendentes], pos: 0, phase: 'preview' })
  }

  function seqAbrir() {
    window.open(buildLink(seq.items[seq.pos]), '_blank')
    setSeq(s => ({ ...s, phase: 'confirm' }))
  }

  // Vai pra próxima cliente (de volta ao 'preview') ou encerra a sequência.
  function seqAvancar() {
    setSeq(s => {
      const prox = s.pos + 1
      if (prox >= s.items.length) { sucesso('Sequência concluída! 🎉'); return null }
      return { ...s, pos: prox, phase: 'preview' }
    })
  }

  async function seqEnviei() {
    const atual = seq.items[seq.pos]
    seqAvancar()
    await marcarEnviado(q => q.eq('id', atual.id))   // marca enviado (sem window.open → sem bloqueio)
  }

  // "Não enviei" / "Pular": mantém a cliente como PENDENTE e segue em frente.
  function seqPular() {
    seqAvancar()
  }

  function reenviarUm(ag) {
    if (!window.confirm(`Reenviar lembrete para ${ag.clientes?.nome}?`)) return
    window.open(buildLink(ag), '_blank')
    marcarEnviado(q => q.eq('id', ag.id))      // atualiza o "enviado às"
  }

  const pendentes = agendamentos.filter(a => !a.lembrete_enviado_em)
  const enviados = agendamentos.filter(a => a.lembrete_enviado_em)
  const total = agendamentos.length

  // 🔒 Gate: lembretes WhatsApp é feature Pro
  if (!loadingAssinatura && !temAcesso('lembretesWhatsapp')) {
    return (
      <UpgradeBlock
        titulo="Lembretes WhatsApp são exclusivos do Pro"
        descricao="Envie lembretes automáticos pras suas clientes com 1 clique, reduza faltas e aumente sua receita."
        feature="Lembretes via WhatsApp"
        icon={Bell}
      />
    )
  }

  return (
    <div style={s.page}>

      {/* Header */}
      <div style={s.header}>
        <div style={s.headerIcon}><Bell size={22} color="white" /></div>
        <div style={{ flex: 1 }}>
          <h1 style={s.title}>Lembretes WhatsApp</h1>
          <p style={s.sub}>Envie lembretes às clientes com 1 clique</p>
        </div>
        <button style={s.cfgBtn} onClick={() => navigate('/app/configuracoes')} title="Configurar mensagem">
          <Settings size={16} />
        </button>
      </div>

      {/* Aviso lembretes desativados */}
      {config.lembretes_ativos === false && (
        <div style={s.warningCard}>
          <AlertCircle size={16} />
          <div>
            Lembretes estão <strong>desativados</strong>.{' '}
            <span style={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={() => navigate('/app/configuracoes')}>
              Ativar nas Configurações
            </span>
          </div>
        </div>
      )}

      {/* Resumo */}
      <div style={s.resumo}>
        <div style={s.resumoCard}>
          <div style={s.resumoValor}>{total}</div>
          <div style={s.resumoLabel}>total</div>
        </div>
        <div style={{ ...s.resumoCard, borderTop: '3px solid #D97706' }}>
          <div style={{ ...s.resumoValor, color: '#D97706' }}>{pendentes.length}</div>
          <div style={s.resumoLabel}>pendentes</div>
        </div>
        <div style={{ ...s.resumoCard, borderTop: '3px solid var(--green)' }}>
          <div style={{ ...s.resumoValor, color: 'var(--green)' }}>{enviados.length}</div>
          <div style={s.resumoLabel}>enviados</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            style={{ ...s.tab, ...(tab === t.id ? s.tabActive : {}) }}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Pendentes */}
      {pendentes.length > 0 && (
        <div style={s.sectionPending}>
          <div style={s.sectionHeader}>
            <div style={s.sectionTitle}>
              <span style={{ ...s.dot, background: '#D97706' }} />
              Pendentes ({pendentes.length})
            </div>
            {pendentes.length > 1 && !seq && (
              <button style={s.btnEnviarTodos} onClick={iniciarSequencia}>
                <MessageCircle size={14} />
                Enviar todos
              </button>
            )}
          </div>
          {pendentes.map(ag => (
            <div key={ag.id} style={s.item}>
              <div style={s.itemDia}>
                <div style={s.itemDiaLabel}>{format(dataParaDate(ag.data), 'EEE', { locale: ptBR }).toUpperCase()}</div>
                <div style={s.itemDiaNum}>{format(dataParaDate(ag.data), 'dd/MM')}</div>
                <div style={s.itemHorario}>{ag.horario?.slice(0, 5)}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={s.itemNome}>{ag.clientes?.nome}</div>
                <div style={s.itemServ}>{ag.servico}</div>
              </div>
              {aguardando.has(ag.id) ? (
                <div style={s.confirmWrap}>
                  <button style={s.btnConfirmei} onClick={() => confirmarEnvio(ag)}>
                    <Check size={13} /> Já enviei
                  </button>
                  <button style={s.btnNaoEnviei} onClick={() => cancelarEnvio(ag)}>
                    Não enviei
                  </button>
                </div>
              ) : (
                <button style={s.btnEnviar} onClick={() => enviarUm(ag)}>
                  <Send size={13} /> Enviar
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Barra da sequência "Enviar todos" — uma cliente por vez, em 2 etapas */}
      {seq && (
        <div className="seq-bar" style={s.seqBar}>
          {seq.phase === 'preview' ? (
            <>
              <div style={s.seqInfo}>
                <div style={s.seqProg}>Próxima · {seq.pos + 1} de {seq.items.length}</div>
                <div style={s.seqNome}>{seq.items[seq.pos]?.clientes?.nome}</div>
                <div style={s.seqHint}>
                  {format(dataParaDate(seq.items[seq.pos].data), 'EEE dd/MM', { locale: ptBR })} às {seq.items[seq.pos].horario?.slice(0, 5)}
                  {seq.items[seq.pos].servico ? ` · ${seq.items[seq.pos].servico}` : ''}
                </div>
              </div>
              <div style={s.seqBtns}>
                <button style={s.btnConfirmei} onClick={seqAbrir}>
                  <MessageCircle size={14} /> Abrir WhatsApp
                </button>
                <button style={s.btnNaoEnviei} onClick={seqPular}>Pular</button>
                <button style={s.btnNaoEnviei} onClick={() => setSeq(null)}>Parar</button>
              </div>
            </>
          ) : (
            <>
              <div style={s.seqInfo}>
                <div style={s.seqProg}>Enviando · {seq.pos + 1} de {seq.items.length}</div>
                <div style={s.seqNome}>{seq.items[seq.pos]?.clientes?.nome}</div>
                <div style={s.seqHint}>Você enviou a mensagem no WhatsApp?</div>
              </div>
              <div style={s.seqBtns}>
                <button style={s.btnConfirmei} onClick={seqEnviei}>
                  <Check size={13} /> Enviei
                </button>
                <button style={s.btnNaoEnviei} onClick={seqPular}>Não enviei</button>
                <button style={s.btnNaoEnviei} onClick={() => setSeq(null)}>Parar</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Enviados */}
      {enviados.length > 0 && (
        <div style={s.sectionSent}>
          <div style={s.sectionHeader}>
            <div style={s.sectionTitle}>
              <Check size={14} color="var(--green)" />
              Já enviados ({enviados.length})
            </div>
          </div>
          {enviados.map(ag => (
            <div key={ag.id} style={{ ...s.item, opacity: 0.85 }}>
              <div style={{ ...s.itemDia, background: '#DCFCE7' }}>
                <div style={{ ...s.itemDiaLabel, color: '#15803D' }}>{format(dataParaDate(ag.data), 'EEE', { locale: ptBR }).toUpperCase()}</div>
                <div style={{ ...s.itemDiaNum, color: '#15803D' }}>{format(dataParaDate(ag.data), 'dd/MM')}</div>
                <div style={{ ...s.itemHorario, color: '#15803D' }}>{ag.horario?.slice(0, 5)}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={s.itemNome}>{ag.clientes?.nome}</div>
                <div style={s.itemServ}>{ag.servico}</div>
                {ag.lembrete_enviado_em && (
                  <div style={s.itemEnviadoEm}>
                    Enviado {format(new Date(ag.lembrete_enviado_em), "dd/MM 'às' HH:mm")}
                  </div>
                )}
              </div>
              <button style={s.btnReenviar} onClick={() => reenviarUm(ag)} title="Reenviar">
                Reenviar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Sem telefone */}
      {semTelefone.length > 0 && (
        <div style={s.sectionWarn}>
          <div style={s.sectionHeader}>
            <div style={s.sectionTitle}>
              <Phone size={14} color="#B91C1C" />
              Sem WhatsApp válido ({semTelefone.length})
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
            Cadastre um WhatsApp válido (com DDD) dessas clientes pra poder enviar lembretes:
          </div>
          {semTelefone.map(ag => (
            <div key={ag.id} style={{ ...s.item, background: '#FFFBEB' }}>
              <div style={s.itemDia}>
                <div style={s.itemDiaLabel}>{format(dataParaDate(ag.data), 'EEE', { locale: ptBR }).toUpperCase()}</div>
                <div style={s.itemDiaNum}>{format(dataParaDate(ag.data), 'dd/MM')}</div>
                <div style={s.itemHorario}>{ag.horario?.slice(0, 5)}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={s.itemNome}>{ag.clientes?.nome}</div>
                <div style={s.itemServ}>{ag.servico}</div>
              </div>
              <button style={s.btnEditar} onClick={() => navigate('/app/clientes')}>
                Cadastrar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Vazio */}
      {pendentes.length === 0 && enviados.length === 0 && semTelefone.length === 0 && (
        <div style={s.empty}>
          <Bell size={40} color="var(--text3)" style={{ marginBottom: 12 }} />
          <div style={s.emptyTitle}>Nenhum lembrete pra enviar</div>
          <div style={s.emptySub}>
            {tab === 'hoje' && 'Você não tem agendamentos hoje.'}
            {tab === 'amanha' && 'Você não tem agendamentos amanhã.'}
            {tab === '7dias' && 'Nada nos próximos 7 dias.'}
          </div>
          <button style={s.emptyBtn} onClick={() => navigate('/app/agenda')}>
            Ver agenda
          </button>
        </div>
      )}

      {/* Footer: link pra configurar mensagem */}
      <div style={s.footerCfg} onClick={() => navigate('/app/configuracoes')}>
        <Settings size={14} />
        <span>Personalizar mensagem padrão dos lembretes</span>
      </div>

    </div>
  )
}

const s = {
  page: { padding: 16, paddingBottom: 80 },
  header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
  headerIcon: { width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(217,119,6,0.3)' },
  title: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 },
  sub: { fontSize: 12, color: 'var(--text3)', margin: '2px 0 0' },
  cfgBtn: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text2)' },
  warningCard: { display: 'flex', alignItems: 'center', gap: 8, background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#92400E', fontWeight: 500 },
  resumo: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 },
  resumoCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 10px', textAlign: 'center', boxShadow: 'var(--shadow-xs)' },
  resumoValor: { fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1 },
  resumoLabel: { fontSize: 10, color: 'var(--text3)', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' },
  tabs: { display: 'flex', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: 3, marginBottom: 14, gap: 3, boxShadow: 'var(--shadow-xs)', border: '1px solid var(--border)' },
  tab: { flex: 1, padding: '9px 0', borderRadius: 7, fontSize: 12, fontWeight: 500, background: 'transparent', color: 'var(--text3)', border: 'none', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' },
  tabActive: { background: 'white', color: 'var(--pink)', boxShadow: 'var(--shadow-xs)', fontWeight: 700 },
  sectionPending: { background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)', border: '1px solid #FCD34D', borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 12, boxShadow: 'var(--shadow-sm)' },
  sectionSent: { background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)', border: '1px solid #86EFAC', borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 12, boxShadow: 'var(--shadow-sm)' },
  sectionWarn: { background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 12 },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: '50%' },
  btnEnviarTodos: { display: 'flex', alignItems: 'center', gap: 5, background: 'var(--whatsapp)', color: 'white', border: 'none', borderRadius: 'var(--radius-pill)', padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(37,211,102,0.3)' },
  item: { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', borderRadius: 10, padding: '10px 12px', marginBottom: 6, border: '1px solid var(--border)' },
  itemDia: { background: '#FED7AA', borderRadius: 8, padding: '6px 8px', textAlign: 'center', minWidth: 54, flexShrink: 0 },
  itemDiaLabel: { fontSize: 9, fontWeight: 700, color: '#7C2D12', letterSpacing: '0.5px' },
  itemDiaNum: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: '#7C2D12', marginTop: 1 },
  itemHorario: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: '#7C2D12', marginTop: 2 },
  itemNome: { fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemServ: { fontSize: 11, color: 'var(--text3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemEnviadoEm: { fontSize: 10, color: 'var(--green)', marginTop: 3, fontWeight: 500 },
  btnEnviar: { display: 'flex', alignItems: 'center', gap: 4, background: 'var(--whatsapp)', color: 'white', border: 'none', borderRadius: 'var(--radius-pill)', padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' },
  confirmWrap: { display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, alignItems: 'stretch' },
  btnConfirmei: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'var(--green)', color: 'white', border: 'none', borderRadius: 'var(--radius-pill)', padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' },
  btnNaoEnviei: { background: 'transparent', color: 'var(--text3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-pill)', padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' },
  // Posição (fixed acima do menu inferior) fica no .seq-bar do index.css.
  seqBar: { display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--surface)', border: '2px solid var(--whatsapp)', borderRadius: 'var(--radius-sm)', padding: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' },
  seqInfo: {},
  seqProg: { fontSize: 10, fontWeight: 700, color: '#15803D', textTransform: 'uppercase', letterSpacing: '0.6px' },
  seqNome: { fontSize: 15, fontWeight: 700, color: 'var(--text)', marginTop: 2 },
  seqHint: { fontSize: 11, color: 'var(--text3)', marginTop: 2 },
  seqBtns: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  btnReenviar: { background: 'transparent', color: 'var(--text3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-pill)', padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' },
  btnEditar: { background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-pill)', padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '50px 20px', textAlign: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 },
  emptySub: { fontSize: 13, color: 'var(--text3)', marginBottom: 18 },
  emptyBtn: { background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-pink)' },
  footerCfg: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, padding: '12px', fontSize: 12, color: 'var(--text3)', cursor: 'pointer', fontWeight: 500 },
}
