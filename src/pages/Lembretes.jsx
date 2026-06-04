import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, MessageCircle, Check, Send, Settings, AlertCircle, Phone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSalao } from '../contexts/SalaoContext'
import { useAssinatura } from '../contexts/AssinaturaContext'
import { useToast } from '../contexts/ToastContext'
import { UpgradeBlock } from '../components/common/UpgradeBlock'
import { format, addDays, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { linkWhatsApp, dataParaDate } from '../lib/formatters'

const TABS = [
  { id: 'amanha', label: 'Amanhã', dias: 1 },
  { id: 'hoje',   label: 'Hoje',   dias: 0 },
  { id: '7dias',  label: 'Próximos 7 dias', dias: 7 },
]

export default function Lembretes() {
  const { user } = useAuth()
  const { salaoId } = useSalao()
  const navigate = useNavigate()
  const { erro } = useToast()
  const { temAcesso, loading: loadingAssinatura } = useAssinatura()
  const [tab, setTab] = useState('amanha')
  const [config, setConfig] = useState({ mensagem_lembrete: '', nome_salao: '', lembretes_ativos: true })
  const [agendamentos, setAgendamentos] = useState([])
  const [semTelefone, setSemTelefone] = useState([])
  const [enviandoTodos, setEnviandoTodos] = useState(false)

  useEffect(() => { if (salaoId) load() }, [salaoId, tab])

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

    if (error) { erro('Erro ao carregar lembretes: ' + error.message); return }
    const lista = data || []
    setAgendamentos(lista.filter(a => a.clientes?.telefone))
    setSemTelefone(lista.filter(a => !a.clientes?.telefone))
  }

  function montarMensagem(ag) {
    const nome = ag.clientes?.nome || ''
    const [y, m, d] = ag.data.split('-')
    const dataFmt = `${d}/${m}`
    const horario = ag.horario?.slice(0, 5)
    const template = config.mensagem_lembrete || 'Oi {nome}! Lembrete: amanhã ({data}) às {horario} - {servico}. Confirma?'

    // Aceita as variáveis com ou sem acento ({horário}/{horario}, {salão}/{salao}, {serviço}/{servico}).
    return template
      .replace(/\{nome_completo\}/gi, nome)
      .replace(/\{nome\}/gi, nome.split(' ')[0])
      .replace(/\{data\}/gi, dataFmt)
      .replace(/\{hor[aá]rio\}/gi, horario)
      .replace(/\{servi[cç]o\}/gi, ag.servico || '')
      .replace(/\{sal[aã]o\}/gi, config.nome_salao || '')
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

  async function enviarUm(ag) {
    window.open(buildLink(ag), '_blank')
    await marcarEnviado(q => q.eq('id', ag.id))
  }

  async function enviarTodos() {
    setEnviandoTodos(true)
    for (let i = 0; i < pendentes.length; i++) {
      window.open(buildLink(pendentes[i]), '_blank')
      await new Promise(r => setTimeout(r, 600))
    }
    await marcarEnviado(q => q.in('id', pendentes.map(a => a.id)))
    setEnviandoTodos(false)
  }

  async function reenviarUm(ag) {
    window.open(buildLink(ag), '_blank')
    await marcarEnviado(q => q.eq('id', ag.id))
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
            {pendentes.length > 1 && (
              <button style={s.btnEnviarTodos} onClick={enviarTodos} disabled={enviandoTodos}>
                <MessageCircle size={14} />
                {enviandoTodos ? 'Enviando...' : 'Enviar todos'}
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
              <button style={s.btnEnviar} onClick={() => enviarUm(ag)}>
                <Send size={13} /> Enviar
              </button>
            </div>
          ))}
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
              Sem telefone cadastrado ({semTelefone.length})
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
            Cadastre o WhatsApp dessas clientes pra poder enviar lembretes:
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
  btnEnviarTodos: { display: 'flex', alignItems: 'center', gap: 5, background: '#25D366', color: 'white', border: 'none', borderRadius: 'var(--radius-pill)', padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(37,211,102,0.3)' },
  item: { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', borderRadius: 10, padding: '10px 12px', marginBottom: 6, border: '1px solid var(--border)' },
  itemDia: { background: '#FED7AA', borderRadius: 8, padding: '6px 8px', textAlign: 'center', minWidth: 54, flexShrink: 0 },
  itemDiaLabel: { fontSize: 9, fontWeight: 700, color: '#7C2D12', letterSpacing: '0.5px' },
  itemDiaNum: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: '#7C2D12', marginTop: 1 },
  itemHorario: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: '#7C2D12', marginTop: 2 },
  itemNome: { fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemServ: { fontSize: 11, color: 'var(--text3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemEnviadoEm: { fontSize: 10, color: 'var(--green)', marginTop: 3, fontWeight: 500 },
  btnEnviar: { display: 'flex', alignItems: 'center', gap: 4, background: '#25D366', color: 'white', border: 'none', borderRadius: 'var(--radius-pill)', padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' },
  btnReenviar: { background: 'transparent', color: 'var(--text3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-pill)', padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' },
  btnEditar: { background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-pill)', padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '50px 20px', textAlign: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 },
  emptySub: { fontSize: 13, color: 'var(--text3)', marginBottom: 18 },
  emptyBtn: { background: 'var(--pink)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-pink)' },
  footerCfg: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, padding: '12px', fontSize: 12, color: 'var(--text3)', cursor: 'pointer', fontWeight: 500 },
}
