import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, startOfWeek, endOfWeek,
  isSameMonth, isToday, isBefore, startOfDay, getDay
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react'
import { LumenLogo, LumenFlameIcon } from '../components/common/Brand'
import { formatTelefone, unformatTelefone, validarTelefone, linkWhatsApp } from '../lib/formatters'
import { useToast } from '../contexts/ToastContext'
import { traduzErro } from '../lib/erros'

const DIAS_LABEL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DURACOES = [30, 45, 60, 90, 120]

function gerarSlots(inicio, fim, duracao) {
  const slots = []
  const [ih, im] = (inicio || '09:00').split(':').map(Number)
  const [fh, fm] = (fim || '18:00').split(':').map(Number)
  let curr = ih * 60 + im
  const end = fh * 60 + fm
  while (curr + duracao <= end) {
    const h = Math.floor(curr / 60).toString().padStart(2, '0')
    const m = (curr % 60).toString().padStart(2, '0')
    slots.push(`${h}:${m}`)
    curr += duracao
  }
  return slots
}

export default function AgendaPublica() {
  const { slug } = useParams()
  const { erro: toastErro } = useToast()
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [erroRede, setErroRede] = useState(false)
  const [step, setStep] = useState(1)
  const [mesAtual, setMesAtual] = useState(new Date())
  const [dataSel, setDataSel] = useState(null)
  const [horarioSel, setHorarioSel] = useState(null)
  const [slotsOcupados, setSlotsOcupados] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [form, setForm] = useState({ nome: '', telefone: '', servico: '', observacoes: '' })
  const [profissionais, setProfissionais] = useState([])
  const [profSel, setProfSel] = useState('') // '' = sem preferência
  const [erros, setErros] = useState({})
  const [saving, setSaving] = useState(false)
  const [tentativas, setTentativas] = useState(0)
  const [bloqueadoAte, setBloqueadoAte] = useState(() => {
    try { const t = localStorage.getItem(`agenda_block_${slug}`); return t ? new Date(Number(t)) : null } catch { return null }
  })
  const [ocupadosPeriodo, setOcupadosPeriodo] = useState({})
  const [ocupadosCarregados, setOcupadosCarregados] = useState(false)

  useEffect(() => { loadConfig() }, [slug])
  useEffect(() => { if (dataSel && config) carregarSlotsOcupados() }, [dataSel, profSel])
  // Ocupação do mês visível (para cinzar dias lotados no calendário)
  useEffect(() => { if (config && !config.agenda_externa_url) carregarOcupadosMes() }, [mesAtual, config, profSel])
  // Troca de profissional: zera a data/horário escolhidos (a agenda é outra)
  useEffect(() => { setDataSel(null); setHorarioSel(null) }, [profSel])

  async function loadConfig() {
    setErroRede(false)
    // 1) Agenda do salão (dona). Apenas colunas públicas - não expor configs internas.
    const { data, error } = await supabase
      .from('configuracoes')
      .select('slug, nome_salao, whatsapp, servicos_padrao, horario_inicio, horario_fim, duracao_atendimento, dias_semana, agenda_externa_url, agenda_publica_ativa')
      .eq('slug', slug)
      .eq('agenda_publica_ativa', true)
      .maybeSingle()
    if (error) { setLoading(false); setErroRede(true); return }
    if (data) {
      setConfig(data)
      // Link de salão: carrega as profissionais pro seletor (respeita o toggle do salão).
      const { data: profs } = await supabase.rpc('agenda_publica_profissionais', { p_slug: slug })
      setProfissionais(profs || [])
      setLoading(false)
      return
    }

    // 2) Não achou no salão → tenta o link PRÓPRIO de uma manicure (agenda_profissional).
    const { data: prof, error: erroProf } = await supabase
      .from('agenda_profissional')
      .select('slug, nome_exibicao, whatsapp, servicos_padrao, horario_inicio, horario_fim, duracao_atendimento, dias_semana, agenda_publica_ativa')
      .eq('slug', slug)
      .eq('agenda_publica_ativa', true)
      .maybeSingle()
    setLoading(false)
    if (erroProf) { setErroRede(true); return }
    if (!prof) { setNotFound(true); return }
    // Mapeia para o mesmo formato da agenda do salão (nome_exibicao → nome_salao).
    setConfig({ ...prof, nome_salao: prof.nome_exibicao || 'Agenda', agenda_externa_url: null })
  }

  async function carregarSlotsOcupados() {
    setLoadingSlots(true)
    // 🔒 RPC seguro: retorna apenas horários, sem expor dados de clientes
    const { data, error } = await supabase.rpc('agenda_publica_horarios_ocupados', {
      p_slug: slug,
      p_data: format(dataSel, 'yyyy-MM-dd'),
      p_profissional_id: profSel || null,
    })
    setLoadingSlots(false)
    // Se falhar, avisa em vez de mostrar todos os horários como livres (evita
    // que a cliente escolha um horário ja ocupado e so descubra ao confirmar).
    if (error) { toastErro('Não foi possível carregar os horários. Tente novamente.'); return }
    setSlotsOcupados(data?.map(a => a.horario.slice(0, 5)) || [])
  }

  async function carregarOcupadosMes() {
    const inicio = format(startOfMonth(mesAtual), 'yyyy-MM-dd')
    const fim = format(endOfMonth(mesAtual), 'yyyy-MM-dd')
    const { data, error } = await supabase.rpc('agenda_publica_ocupados_periodo', {
      p_slug: slug, p_inicio: inicio, p_fim: fim, p_profissional_id: profSel || null,
    })
    // Não-crítico (só cinza dias lotados no calendário); não duplica o toast dos slots.
    if (error) { console.warn('AgendaPublica: falha ao carregar ocupação do mês —', error.message); return }
    const mapa = {}
    ;(data || []).forEach(r => {
      const h = r.horario.slice(0, 5)
      if (!mapa[r.data]) mapa[r.data] = new Set()
      mapa[r.data].add(h)
    })
    setOcupadosPeriodo(mapa)
    setOcupadosCarregados(true)
  }

  function novoAgendamento() {
    setStep(1); setDataSel(null); setHorarioSel(null)
    setForm({ nome: '', telefone: '', servico: '', observacoes: '' }); setErros({})
  }

  async function confirmar() {
    // Rate limiting: máx 3 tentativas em 5 minutos
    if (bloqueadoAte && new Date() < bloqueadoAte) {
      const restante = Math.ceil((bloqueadoAte - new Date()) / 1000 / 60)
      toastErro(`Muitas tentativas. Aguarde ${restante} minuto(s) para tentar novamente.`)
      return
    }

    const errosNovos = {}
    if (!form.nome.trim()) errosNovos.nome = 'Nome obrigatório'
    if (!form.telefone.trim()) errosNovos.telefone = 'WhatsApp obrigatório'
    else if (!validarTelefone(form.telefone)) errosNovos.telefone = 'WhatsApp inválido (DDD + número)'
    if (!form.servico) errosNovos.servico = 'Selecione um serviço'
    if (Object.keys(errosNovos).length > 0) { setErros(errosNovos); return }

    setSaving(true)
    const telLimpo = unformatTelefone(form.telefone)

    // 🔒 RPC seguro: cria cliente (se necessário) + agendamento no contexto do dono do slug
    const { error } = await supabase.rpc('agenda_publica_criar_agendamento', {
      p_slug: slug,
      p_cliente_nome: form.nome.trim(),
      p_cliente_telefone: telLimpo,
      p_servico: form.servico,
      p_data: format(dataSel, 'yyyy-MM-dd'),
      p_horario: horarioSel + ':00',
      p_observacoes: form.observacoes || null,
      p_profissional_id: profSel || null,
    })
    setSaving(false)

    if (error) {
      // Rate limiting: conta só tentativas que FALHARAM (não penaliza quem
      // agenda varias vezes com sucesso — ex.: marcando para mais de uma pessoa).
      const novasTentativas = tentativas + 1
      if (novasTentativas >= 3) {
        const ate = new Date(Date.now() + 5 * 60 * 1000)
        setBloqueadoAte(ate)
        try { localStorage.setItem(`agenda_block_${slug}`, String(ate.getTime())) } catch { /* ignore */ }
        setTentativas(0)
      } else {
        setTentativas(novasTentativas)
      }
      toastErro(traduzErro(error, 'Não foi possível enviar seu agendamento. Tente novamente.'))
      return
    }
    setStep(4)
  }

  const todosSlots = config ? gerarSlots(
    config.horario_inicio?.slice(0, 5),
    config.horario_fim?.slice(0, 5),
    config.duracao_atendimento || 60
  ) : []
  const nomeSalao = config?.nome_salao || 'Agenda Online'
  const hojeStr = format(new Date(), 'yyyy-MM-dd')
  const agoraMin = new Date().getHours() * 60 + new Date().getMinutes()

  // Horários livres de um dia: tira os ocupados e, se for hoje, os que já passaram.
  function slotsLivres(diaStr, ocupados) {
    const ehHoje = diaStr === hojeStr
    return todosSlots.filter(slot => {
      if (ocupados.has(slot)) return false
      if (ehHoje) {
        const [h, m] = slot.split(':').map(Number)
        if (h * 60 + m <= agoraMin) return false
      }
      return true
    })
  }

  function diaDisponivel(dia) {
    if (isBefore(dia, startOfDay(new Date()))) return false
    const diasAtivos = config?.dias_semana || [1, 2, 3, 4, 5]
    if (!diasAtivos.includes(getDay(dia))) return false
    // Já carregou a ocupação do mês? Esconde dias sem nenhum horário livre.
    if (ocupadosCarregados) {
      const dStr = format(dia, 'yyyy-MM-dd')
      if (slotsLivres(dStr, ocupadosPeriodo[dStr] || new Set()).length === 0) return false
    }
    return true
  }

  // Horários do dia selecionado (ocupação "fresca" + remove passados se for hoje).
  const slotsDisponiveis = slotsLivres(
    dataSel ? format(dataSel, 'yyyy-MM-dd') : '',
    new Set(slotsOcupados)
  )

  // Navegação do calendário: do mês atual até 3 meses à frente.
  const mesAtualInicio = startOfMonth(mesAtual)
  const podeVoltar = isBefore(startOfMonth(new Date()), mesAtualInicio)
  const podeAvancar = isBefore(mesAtualInicio, startOfMonth(addMonths(new Date(), 3)))

  if (loading) return (
    <div style={s.center}>
      <div style={s.spinner} />
    </div>
  )

  if (erroRede) return (
    <div style={s.center} className="fade-in">
      <div style={{ marginBottom: 18 }} className="pulse-soft">
        <LumenFlameIcon size={64} />
      </div>
      <div style={s.h2}>não foi possível carregar</div>
      <div style={s.sub}>Verifique sua conexão e tente novamente</div>
      <button style={s.btn} onClick={() => { setLoading(true); loadConfig() }}>Tentar novamente</button>
    </div>
  )

  if (notFound) return (
    <div style={s.center} className="fade-in">
      <div style={{ marginBottom: 18 }} className="pulse-soft">
        <LumenFlameIcon size={64} />
      </div>
      <div style={s.h2}>agenda não encontrada</div>
      <div style={s.sub}>Verifique o link com a profissional</div>
    </div>
  )

  // ✨ Modo "Link Externo" (Google Calendar / Calendly / etc) - landing bonita
  if (config?.agenda_externa_url) {
    const whatsapp = (config.whatsapp || '').replace(/\D/g, '')
    return (
      <div style={ext.page} className="fade-in">
        <div style={ext.card}>
          <div style={ext.avatarWrap}>
            <div style={ext.avatarFallback}>
              <LumenFlameIcon size={44} variant="gold" />
            </div>
          </div>

          <h1 style={ext.nome}>{nomeSalao}</h1>
          <div style={ext.tagline}>nail designer</div>

          {/* Botão principal: Agendar online */}
          <a
            href={config.agenda_externa_url}
            target="_blank"
            rel="noreferrer"
            style={ext.btnPrincipal}
          >
            📅 Agendar online
          </a>

          {/* Botão WhatsApp */}
          {whatsapp && (
            <a
              href={linkWhatsApp(whatsapp)}
              target="_blank"
              rel="noreferrer"
              style={ext.btnSecundario}
            >
              💬 Conversar no WhatsApp
            </a>
          )}

          {/* Serviços */}
          {config.servicos_padrao?.length > 0 && (
            <>
              <div style={ext.sectionLabel}>Serviços oferecidos</div>
              <div style={ext.servicos}>
                {config.servicos_padrao.map(sv => (
                  <span key={sv} style={ext.servicoChip}>{sv}</span>
                ))}
              </div>
            </>
          )}

          {/* Horários */}
          {(config.horario_inicio || config.horario_fim) && (
            <div style={ext.horarios}>
              ⏰ Atendimento das {config.horario_inicio?.slice(0,5) || '09:00'} às {config.horario_fim?.slice(0,5) || '18:00'}
            </div>
          )}

          <a href="https://lumengestaoempresarial.com.br/?ref=agenda" target="_blank" rel="noreferrer" style={{ ...ext.footer, textDecoration: 'none', cursor: 'pointer' }}>
            <LumenLogo size={14} variant="reverso" />
            <span style={ext.footerText}>powered by lumen · crie sua agenda grátis</span>
          </a>
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <div style={s.header} className="fade-in">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <LumenLogo size={22} variant="reverso" />
        </div>
        <div style={s.headerName}>{nomeSalao}</div>
        <div style={s.headerSub}>agendamento online</div>
      </div>

      {step < 4 && (
        <div style={s.steps}>
          {[
            { n: 1, label: 'Data' },
            { n: 2, label: 'Horário' },
            { n: 3, label: 'Dados' },
          ].map(({ n, label }) => (
            <div key={n} style={s.stepWrap}>
              <div style={{
                ...s.stepDot,
                ...(step > n ? s.stepDotDone : step === n ? s.stepDotActive : {}),
              }}>
                {step > n ? <CheckCircle size={13} /> : n}
              </div>
              <span style={{ ...s.stepLabel, ...(step >= n ? { color: 'var(--pink, #8B2655)' } : {}) }}>{label}</span>
              {n < 3 && <div style={{ ...s.stepLine, ...(step > n ? s.stepLineDone : {}) }} />}
            </div>
          ))}
        </div>
      )}

      <div style={s.content}>

        {/* ── STEP 1: Calendário ─────────────────── */}
        {step === 1 && (
          <div style={s.card}>
            {profissionais.length >= 2 && (
              <div style={s.field}>
                <label style={s.label}>Profissional</label>
                <select
                  style={{ ...s.input, appearance: 'auto' }}
                  value={profSel}
                  onChange={e => setProfSel(e.target.value)}
                >
                  <option value="">Sem preferência</option>
                  {profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
            )}

            <div style={s.cardTitle}>Escolha uma data</div>

            <div style={s.calNav}>
              <button
                style={{ ...s.iconBtn, ...(!podeVoltar ? s.iconBtnOff : {}) }}
                onClick={() => podeVoltar && setMesAtual(m => subMonths(m, 1))}
                disabled={!podeVoltar}
                aria-label="Mês anterior"
              >
                <ChevronLeft size={18} />
              </button>
              <span style={s.calNavLabel}>
                {format(mesAtual, "MMMM 'de' yyyy", { locale: ptBR })}
              </span>
              <button
                style={{ ...s.iconBtn, ...(!podeAvancar ? s.iconBtnOff : {}) }}
                onClick={() => podeAvancar && setMesAtual(m => addMonths(m, 1))}
                disabled={!podeAvancar}
                aria-label="Próximo mês"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div style={s.calHeader}>
              {DIAS_LABEL.map(d => <div key={d} style={s.calHeaderCell}>{d}</div>)}
            </div>

            {(() => {
              const inicio = startOfMonth(mesAtual)
              const fim = endOfMonth(mesAtual)
              const dias = eachDayOfInterval({
                start: startOfWeek(inicio, { locale: ptBR }),
                end: endOfWeek(fim, { locale: ptBR }),
              })
              const semanas = []
              for (let i = 0; i < dias.length; i += 7) semanas.push(dias.slice(i, i + 7))
              return semanas.map((semana, si) => (
                <div key={si} style={s.calRow}>
                  {semana.map(dia => {
                    const doMes = isSameMonth(dia, mesAtual)
                    const disp = doMes && diaDisponivel(dia)
                    const sel = dataSel && format(dia, 'yyyy-MM-dd') === format(dataSel, 'yyyy-MM-dd')
                    const hoje = isToday(dia)
                    return (
                      <button
                        key={dia.toISOString()}
                        type="button"
                        disabled={!disp}
                        aria-label={format(dia, "d 'de' MMMM", { locale: ptBR }) + (disp ? '' : ' — indisponível')}
                        aria-pressed={!!sel}
                        style={{
                          ...s.calCell,
                          ...(!doMes ? { opacity: 0, pointerEvents: 'none' } : {}),
                          ...(doMes && !disp ? s.calCellOff : {}),
                          ...(disp && !sel ? s.calCellOn : {}),
                          ...(hoje && disp && !sel ? s.calCellHoje : {}),
                          ...(sel ? s.calCellSel : {}),
                        }}
                        onClick={() => {
                          if (!disp) return
                          setDataSel(dia)
                          setHorarioSel(null)
                        }}
                      >
                        {format(dia, 'd')}
                      </button>
                    )
                  })}
                </div>
              ))
            })()}

            <button
              style={{ ...s.btn, ...(!dataSel ? s.btnOff : {}) }}
              disabled={!dataSel}
              onClick={() => setStep(2)}
            >
              Próximo →
            </button>
          </div>
        )}

        {/* ── STEP 2: Horários ───────────────────── */}
        {step === 2 && (
          <div style={s.card}>
            <button style={s.backBtn} onClick={() => setStep(1)}>
              <ChevronLeft size={15} /> Voltar
            </button>
            <div style={s.cardTitle}>Escolha o horário</div>
            <div style={s.dataBadge}>
              📅 {format(dataSel, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </div>

            {loadingSlots ? (
              <div style={s.centerMini}><div style={s.spinner} /></div>
            ) : slotsDisponiveis.length === 0 ? (
              <div style={s.empty}>
                <div style={{ fontSize: 32 }}>😔</div>
                <div>Sem horários disponíveis neste dia</div>
                <button style={s.btnSec} onClick={() => setStep(1)}>Escolher outra data</button>
              </div>
            ) : (
              <div style={s.slotsGrid}>
                {slotsDisponiveis.map(slot => (
                  <button
                    key={slot}
                    style={{ ...s.slotBtn, ...(horarioSel === slot ? s.slotBtnActive : {}) }}
                    onClick={() => setHorarioSel(slot)}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}

            <button
              style={{ ...s.btn, ...(!horarioSel ? s.btnOff : {}) }}
              disabled={!horarioSel}
              onClick={() => setStep(3)}
            >
              Próximo →
            </button>
          </div>
        )}

        {/* ── STEP 3: Dados pessoais ─────────────── */}
        {step === 3 && (
          <div style={s.card}>
            <button style={s.backBtn} onClick={() => setStep(2)}>
              <ChevronLeft size={15} /> Voltar
            </button>
            <div style={s.cardTitle}>Seus dados</div>
            <div style={s.dataBadge}>
              📅 {format(dataSel, 'dd/MM/yyyy')} às {horarioSel}
            </div>

            {/* Serviços */}
            <div style={s.field}>
              <label style={s.label}>Serviço *</label>
              {config.servicos_padrao?.length > 0 ? (
                <div style={s.servGrid}>
                  {config.servicos_padrao.map(sv => (
                    <button
                      key={sv}
                      style={{
                        ...s.servBtn,
                        ...(form.servico === sv ? s.servBtnActive : {}),
                      }}
                      onClick={() => { setForm(f => ({ ...f, servico: sv })); setErros(e => ({ ...e, servico: null })) }}
                    >
                      {sv}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  style={{ ...s.input, ...(erros.servico ? s.inputErr : {}) }}
                  placeholder="Ex: Manutenção gel"
                  value={form.servico}
                  onChange={e => { setForm(f => ({ ...f, servico: e.target.value })); setErros(er => ({ ...er, servico: null })) }}
                />
              )}
              {erros.servico && <span style={s.err}>{erros.servico}</span>}
            </div>

            <div style={s.field}>
              <label style={s.label}>Nome completo *</label>
              <input
                style={{ ...s.input, ...(erros.nome ? s.inputErr : {}) }}
                placeholder="Seu nome"
                value={form.nome}
                onChange={e => { setForm(f => ({ ...f, nome: e.target.value })); setErros(er => ({ ...er, nome: null })) }}
              />
              {erros.nome && <span style={s.err}>{erros.nome}</span>}
            </div>

            <div style={s.field}>
              <label style={s.label}>WhatsApp *</label>
              <input
                style={{ ...s.input, ...(erros.telefone ? s.inputErr : {}) }}
                placeholder="(51) 99999-9999"
                type="tel"
                value={formatTelefone(form.telefone)}
                onChange={e => { setForm(f => ({ ...f, telefone: unformatTelefone(e.target.value) })); setErros(er => ({ ...er, telefone: null })) }}
                inputMode="numeric"
              />
              {erros.telefone && <span style={s.err}>{erros.telefone}</span>}
            </div>

            <div style={s.field}>
              <label style={s.label}>Observações (opcional)</label>
              <input
                style={s.input}
                placeholder="Algum detalhe para a profissional?"
                value={form.observacoes}
                onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
              />
            </div>

            <button style={s.btn} onClick={confirmar} disabled={saving}>
              {saving ? 'Confirmando...' : '✓ Confirmar agendamento'}
            </button>
          </div>
        )}

        {/* ── STEP 4: Sucesso ────────────────────── */}
        {step === 4 && (
          <div style={{ ...s.card, alignItems: 'center', textAlign: 'center' }}>
            <div style={s.successIcon}>🎉</div>
            <div style={s.h2}>Solicitação enviada!</div>
            <div style={s.sub}>
              <strong>{form.nome.split(' ')[0]}</strong>, seu pedido foi enviado para{' '}
              <strong>{nomeSalao}</strong>. Aguarde a confirmação!
            </div>
            <div style={s.summaryBox}>
              <div style={s.summaryRow}><span>📅 Data</span><strong>{format(dataSel, 'dd/MM/yyyy')}</strong></div>
              <div style={s.summaryRow}><span>🕐 Horário</span><strong>{horarioSel}</strong></div>
              <div style={s.summaryRow}><span>💅 Serviço</span><strong>{form.servico}</strong></div>
              {profSel && (
                <div style={s.summaryRow}><span>👤 Profissional</span><strong>{profissionais.find(p => p.id === profSel)?.nome}</strong></div>
              )}
            </div>
            <div style={s.footNote}>
              Seu horário ainda não está confirmado — a profissional vai confirmar pelo WhatsApp.
            </div>
            {(() => {
              const wpp = (config?.whatsapp || '').replace(/\D/g, '')
              if (!wpp) return null
              const msg = `Olá! Acabei de solicitar um agendamento para ${format(dataSel, 'dd/MM/yyyy')} às ${horarioSel} (${form.servico}). Pode confirmar?`
              return (
                <a href={linkWhatsApp(wpp, msg)} target="_blank" rel="noreferrer" style={s.btnWhats}>
                  💬 Confirmar pelo WhatsApp
                </a>
              )
            })()}
            <button style={s.btnSec} onClick={novoAgendamento}>Fazer outro agendamento</button>
          </div>
        )}
      </div>

      <div style={s.footer}>
        <a href="https://lumengestaoempresarial.com.br/?ref=agenda" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
          Powered by <strong>lumen</strong> 💅 · crie sua agenda grátis
        </a>
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', height: '100%', overflowY: 'auto', background: 'var(--bg, #FAF6F6)', fontFamily: 'var(--font)', display: 'flex', flexDirection: 'column' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 8, textAlign: 'center', padding: 24 },
  centerMini: { display: 'flex', justifyContent: 'center', padding: '24px 0' },
  spinner: { width: 28, height: 28, borderRadius: '50%', border: '3px solid var(--pink-light, #FAF6F6)', borderTopColor: 'var(--pink, #8B2655)', animation: 'spin 0.8s linear infinite' },
  header: { background: 'var(--pink, #8B2655)', padding: '16px 20px 13px', color: 'white', textAlign: 'center', boxShadow: '0 4px 20px rgba(139,38,85,0.15)' },
  headerName: { fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', fontFamily: "'Bricolage Grotesque', sans-serif" },
  headerSub: { fontSize: 13, opacity: 0.8, marginTop: 2, fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' },
  steps: { display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', padding: '14px 20px', gap: 0, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' },
  stepWrap: { display: 'flex', alignItems: 'center', gap: 6 },
  stepDot: { width: 26, height: 26, borderRadius: '50%', background: '#F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#AAA', flexShrink: 0 },
  stepDotActive: { background: 'var(--pink, #8B2655)', color: 'white' },
  stepDotDone: { background: '#2E7D32', color: 'white' },
  stepLabel: { fontSize: 12, fontWeight: 500, color: '#6B7280', marginRight: 6 },
  stepLine: { width: 28, height: 2, background: '#E0E0E0', borderRadius: 1 },
  stepLineDone: { background: '#2E7D32' },
  content: { flex: 1, padding: '12px 16px 24px', maxWidth: 440, margin: '0 auto', width: '100%' },
  card: { background: 'white', borderRadius: 18, padding: '16px 16px', boxShadow: '0 4px 24px rgba(139,38,85,0.08)', display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid var(--border)' },
  cardTitle: { fontSize: 17, fontWeight: 700, color: '#1A1A1A' },
  backBtn: { display: 'inline-flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', color: 'var(--pink, #8B2655)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '0 0 4px', alignSelf: 'flex-start' },
  calNav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#555', display: 'flex', padding: 4 },
  iconBtnOff: { color: '#D0D0D0', cursor: 'not-allowed' },
  calNavLabel: { fontSize: 14, fontWeight: 600, textTransform: 'capitalize', color: '#1A1A1A' },
  calHeader: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center' },
  calHeaderCell: { fontSize: 11, fontWeight: 600, color: '#6B7280', padding: '4px 0', textTransform: 'uppercase' },
  calRow: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 },
  calCell: { height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9, fontSize: 13, fontWeight: 500, color: '#C0C0C0', cursor: 'default', userSelect: 'none', border: 'none', background: 'transparent', fontFamily: 'inherit', padding: 0 },
  calCellOff: { color: '#D0D0D0' },
  calCellOn: { color: '#1A1A1A', background: '#F5F5F5', cursor: 'pointer' },
  calCellHoje: { color: 'var(--pink, #8B2655)', fontWeight: 700, border: '2px solid var(--pink, #8B2655)', background: 'white' },
  calCellSel: { background: 'var(--pink, #8B2655)', color: 'white', fontWeight: 700 },
  dataBadge: { background: 'var(--pink-light, #FAF6F6)', borderRadius: 10, padding: '9px 13px', fontSize: 13, fontWeight: 600, color: 'var(--pink, #8B2655)', textTransform: 'capitalize', border: '1px solid var(--border)' },
  slotsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 },
  slotBtn: { padding: '13px 0', borderRadius: 11, border: '1.5px solid #E0E0E0', background: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer', color: '#1A1A1A', textAlign: 'center', transition: 'all 0.12s' },
  slotBtnActive: { background: 'var(--pink, #8B2655)', border: '1.5px solid var(--pink, #8B2655)', color: 'white' },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 600, color: '#555' },
  input: { padding: '11px 13px', border: '1.5px solid #E0E0E0', borderRadius: 10, fontSize: 14, outline: 'none', color: '#1A1A1A', background: 'white', fontFamily: 'inherit' },
  inputErr: { border: '1.5px solid #C62828' },
  err: { fontSize: 11, color: '#C62828', fontWeight: 500 },
  servGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 },
  servBtn: { padding: '11px 8px', borderRadius: 10, border: '1.5px solid #E0E0E0', background: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer', color: '#555', textAlign: 'center', transition: 'all 0.12s', fontFamily: 'inherit' },
  servBtnActive: { background: 'var(--pink, #8B2655)', border: '1.5px solid var(--pink, #8B2655)', color: 'white', fontWeight: 700 },
  btn: { background: 'var(--pink, #8B2655)', color: 'white', border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4, boxShadow: 'var(--shadow-pink)', transition: 'background 0.15s', fontFamily: 'inherit' },
  btnOff: { background: '#E0E0E0', boxShadow: 'none', cursor: 'not-allowed', color: '#AAA' },
  btnSec: { background: '#F5F5F5', color: '#555', border: 'none', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  btnWhats: { display: 'block', width: '100%', boxSizing: 'border-box', textAlign: 'center', background: '#25D366', color: 'white', borderRadius: 12, padding: '13px', fontSize: 15, fontWeight: 700, textDecoration: 'none', marginTop: 4, fontFamily: "'Bricolage Grotesque', sans-serif" },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '16px 0', color: '#888', fontSize: 14, textAlign: 'center' },
  successIcon: { fontSize: 56, marginBottom: 4 },
  h2: { fontSize: 22, fontWeight: 800, color: '#1A1A1A', fontFamily: "'Bricolage Grotesque', sans-serif" },
  sub: { fontSize: 14, color: '#555', lineHeight: 1.6 },
  summaryBox: { background: 'var(--pink-light, #FAF6F6)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 9, width: '100%' },
  summaryRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, color: '#333' },
  footNote: { fontSize: 12, color: '#6B7280', textAlign: 'center' },
  footer: { padding: '16px', textAlign: 'center', fontSize: 12, color: '#6B7280' },
}

// ✨ Estilos da landing "Link Externo" (linktree-style)
const ext = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #1F0A18 0%, #2D0D20 40%, #1A0612 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 24,
    padding: '36px 26px 24px',
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
    textAlign: 'center',
  },
  avatarWrap: {
    width: 100,
    height: 100,
    margin: '0 auto 16px',
    borderRadius: '50%',
    overflow: 'hidden',
    border: '3px solid var(--gold, #E6C260)',
    boxShadow: '0 8px 24px rgba(230,194,96,0.3)',
  },
  avatar: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarFallback: {
    width: '100%', height: '100%',
    background: 'var(--pink-light)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  nome: {
    fontFamily: "'Instrument Serif', serif",
    fontStyle: 'italic',
    fontSize: 28,
    fontWeight: 400,
    color: 'white',
    margin: 0,
    letterSpacing: '-0.3px',
    lineHeight: 1.15,
  },
  tagline: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 24,
    marginTop: 6,
    fontWeight: 500,
    textTransform: 'lowercase',
    letterSpacing: '1px',
  },
  btnPrincipal: {
    display: 'block',
    background: 'var(--gold, #E6C260)',
    color: '#1A0612',
    padding: '14px 24px',
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 800,
    textDecoration: 'none',
    boxShadow: '0 10px 28px rgba(230,194,96,0.35)',
    marginBottom: 10,
    transition: 'transform 0.15s, box-shadow 0.15s',
    fontFamily: "'Bricolage Grotesque', sans-serif",
  },
  btnSecundario: {
    display: 'block',
    background: 'rgba(37,211,102,0.15)',
    color: '#25D366',
    border: '1px solid rgba(37,211,102,0.4)',
    padding: '12px 24px',
    borderRadius: 14,
    fontSize: 14,
    fontWeight: 700,
    textDecoration: 'none',
    marginBottom: 20,
    transition: 'all 0.15s',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: '1.2px',
    marginBottom: 10,
    marginTop: 16,
  },
  servicos: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 20,
  },
  servicoChip: {
    fontSize: 11,
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.85)',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '5px 12px',
    borderRadius: 'var(--radius-pill)',
    fontWeight: 500,
  },
  horarios: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 24,
    fontWeight: 500,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    paddingTop: 18,
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  footerText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: 500,
    letterSpacing: '0.5px',
  },
}
