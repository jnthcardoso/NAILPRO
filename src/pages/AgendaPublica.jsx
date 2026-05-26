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
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [step, setStep] = useState(1)
  const [mesAtual, setMesAtual] = useState(new Date())
  const [dataSel, setDataSel] = useState(null)
  const [horarioSel, setHorarioSel] = useState(null)
  const [slotsOcupados, setSlotsOcupados] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [form, setForm] = useState({ nome: '', telefone: '', servico: '', observacoes: '' })
  const [erros, setErros] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadConfig() }, [slug])
  useEffect(() => { if (dataSel && config) carregarSlotsOcupados() }, [dataSel])

  async function loadConfig() {
    const { data } = await supabase
      .from('configuracoes')
      .select('*')
      .eq('slug', slug)
      .eq('agenda_publica_ativa', true)
      .single()
    if (!data) { setNotFound(true) } else { setConfig(data) }
    setLoading(false)
  }

  async function carregarSlotsOcupados() {
    setLoadingSlots(true)
    const { data } = await supabase
      .from('agendamentos')
      .select('horario')
      .eq('user_id', config.user_id)
      .eq('data', format(dataSel, 'yyyy-MM-dd'))
      .neq('status', 'cancelado')
    setSlotsOcupados(data?.map(a => a.horario.slice(0, 5)) || [])
    setLoadingSlots(false)
  }

  async function confirmar() {
    const errosNovos = {}
    if (!form.nome.trim()) errosNovos.nome = 'Nome obrigatório'
    if (!form.telefone.trim()) errosNovos.telefone = 'WhatsApp obrigatório'
    if (!form.servico) errosNovos.servico = 'Selecione um serviço'
    if (Object.keys(errosNovos).length > 0) { setErros(errosNovos); return }

    setSaving(true)
    const telLimpo = form.telefone.replace(/\D/g, '')

    const { data: clienteExist } = await supabase
      .from('clientes')
      .select('id')
      .eq('user_id', config.user_id)
      .eq('telefone', telLimpo)
      .maybeSingle()

    let clienteId = clienteExist?.id
    if (!clienteId) {
      const { data: novo } = await supabase
        .from('clientes')
        .insert({ user_id: config.user_id, nome: form.nome.trim(), telefone: telLimpo })
        .select('id')
        .single()
      clienteId = novo?.id
    }

    if (clienteId) {
      await supabase.from('agendamentos').insert({
        user_id: config.user_id,
        cliente_id: clienteId,
        data: format(dataSel, 'yyyy-MM-dd'),
        horario: horarioSel + ':00',
        servico: form.servico,
        status: 'pendente',
        observacoes: form.observacoes || null,
        valor: 0,
      })
      setStep(4)
    }
    setSaving(false)
  }

  function diaDisponivel(dia) {
    if (isBefore(dia, startOfDay(new Date()))) return false
    const diasAtivos = config?.dias_semana || [1, 2, 3, 4, 5]
    return diasAtivos.includes(getDay(dia))
  }

  const todosSlots = config ? gerarSlots(
    config.horario_inicio?.slice(0, 5),
    config.horario_fim?.slice(0, 5),
    config.duracao_atendimento || 60
  ) : []
  const slotsDisponiveis = todosSlots.filter(s => !slotsOcupados.includes(s))
  const nomeSalao = config?.nome_salao || 'Agenda Online'

  if (loading) return (
    <div style={s.center}>
      <div style={s.spinner} />
    </div>
  )

  if (notFound) return (
    <div style={s.center}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>💅</div>
      <div style={s.h2}>Agenda não encontrada</div>
      <div style={s.sub}>Verifique o link com a profissional</div>
    </div>
  )

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.headerEmoji}>💅</div>
        <div style={s.headerName}>{nomeSalao}</div>
        <div style={s.headerSub}>Agendamento online</div>
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
              <span style={{ ...s.stepLabel, ...(step >= n ? { color: '#C2185B' } : {}) }}>{label}</span>
              {n < 3 && <div style={{ ...s.stepLine, ...(step > n ? s.stepLineDone : {}) }} />}
            </div>
          ))}
        </div>
      )}

      <div style={s.content}>

        {/* ── STEP 1: Calendário ─────────────────── */}
        {step === 1 && (
          <div style={s.card}>
            <div style={s.cardTitle}>Escolha uma data</div>

            <div style={s.calNav}>
              <button style={s.iconBtn} onClick={() => setMesAtual(m => subMonths(m, 1))}>
                <ChevronLeft size={18} />
              </button>
              <span style={s.calNavLabel}>
                {format(mesAtual, "MMMM 'de' yyyy", { locale: ptBR })}
              </span>
              <button style={s.iconBtn} onClick={() => setMesAtual(m => addMonths(m, 1))}>
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
                      <div
                        key={dia.toISOString()}
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
                      </div>
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
                value={form.telefone}
                onChange={e => { setForm(f => ({ ...f, telefone: e.target.value })); setErros(er => ({ ...er, telefone: null })) }}
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
            </div>
            <div style={s.footNote}>
              Salve o contato da profissional para receber a confirmação pelo WhatsApp.
            </div>
          </div>
        )}
      </div>

      <div style={s.footer}>
        Powered by <strong>nailpro</strong> 💅
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: '#F9F0F4', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 8, textAlign: 'center', padding: 24 },
  centerMini: { display: 'flex', justifyContent: 'center', padding: '24px 0' },
  spinner: { width: 28, height: 28, borderRadius: '50%', border: '3px solid #FCE4EC', borderTopColor: '#C2185B', animation: 'spin 0.8s linear infinite' },
  header: { background: '#C2185B', padding: '28px 20px 22px', color: 'white', textAlign: 'center' },
  headerEmoji: { fontSize: 32, marginBottom: 6 },
  headerName: { fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px' },
  headerSub: { fontSize: 13, opacity: 0.8, marginTop: 2 },
  steps: { display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', padding: '14px 20px', gap: 0, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' },
  stepWrap: { display: 'flex', alignItems: 'center', gap: 6 },
  stepDot: { width: 26, height: 26, borderRadius: '50%', background: '#F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#AAA', flexShrink: 0 },
  stepDotActive: { background: '#C2185B', color: 'white' },
  stepDotDone: { background: '#2E7D32', color: 'white' },
  stepLabel: { fontSize: 12, fontWeight: 500, color: '#AAA', marginRight: 6 },
  stepLine: { width: 28, height: 2, background: '#E0E0E0', borderRadius: 1 },
  stepLineDone: { background: '#2E7D32' },
  content: { flex: 1, padding: '16px 16px 32px', maxWidth: 440, margin: '0 auto', width: '100%' },
  card: { background: 'white', borderRadius: 18, padding: '22px 18px', boxShadow: '0 4px 24px rgba(194,24,91,0.08)', display: 'flex', flexDirection: 'column', gap: 14 },
  cardTitle: { fontSize: 17, fontWeight: 700, color: '#1A1A1A' },
  backBtn: { display: 'inline-flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', color: '#C2185B', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '0 0 4px', alignSelf: 'flex-start' },
  calNav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#555', display: 'flex', padding: 4 },
  calNavLabel: { fontSize: 14, fontWeight: 600, textTransform: 'capitalize', color: '#1A1A1A' },
  calHeader: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center' },
  calHeaderCell: { fontSize: 11, fontWeight: 600, color: '#AAA', padding: '4px 0', textTransform: 'uppercase' },
  calRow: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 },
  calCell: { aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9, fontSize: 13, fontWeight: 500, color: '#CCC', cursor: 'default', userSelect: 'none' },
  calCellOff: { color: '#DDD' },
  calCellOn: { color: '#1A1A1A', background: '#F5F5F5', cursor: 'pointer' },
  calCellHoje: { color: '#C2185B', fontWeight: 700, border: '2px solid #C2185B', background: 'white' },
  calCellSel: { background: '#C2185B', color: 'white', fontWeight: 700 },
  dataBadge: { background: '#FCE4EC', borderRadius: 10, padding: '9px 13px', fontSize: 13, fontWeight: 600, color: '#C2185B', textTransform: 'capitalize' },
  slotsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 },
  slotBtn: { padding: '13px 0', borderRadius: 11, border: '1.5px solid #E0E0E0', background: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer', color: '#1A1A1A', textAlign: 'center', transition: 'all 0.12s' },
  slotBtnActive: { background: '#C2185B', border: '1.5px solid #C2185B', color: 'white' },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 600, color: '#555' },
  input: { padding: '11px 13px', border: '1.5px solid #E0E0E0', borderRadius: 10, fontSize: 14, outline: 'none', color: '#1A1A1A', background: 'white', fontFamily: 'inherit' },
  inputErr: { border: '1.5px solid #C62828' },
  err: { fontSize: 11, color: '#C62828', fontWeight: 500 },
  servGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 },
  servBtn: { padding: '11px 8px', borderRadius: 10, border: '1.5px solid #E0E0E0', background: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer', color: '#555', textAlign: 'center', transition: 'all 0.12s', fontFamily: 'inherit' },
  servBtnActive: { background: '#C2185B', border: '1.5px solid #C2185B', color: 'white', fontWeight: 700 },
  btn: { background: '#C2185B', color: 'white', border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4, boxShadow: '0 4px 14px rgba(194,24,91,0.28)', transition: 'background 0.15s', fontFamily: 'inherit' },
  btnOff: { background: '#E0E0E0', boxShadow: 'none', cursor: 'not-allowed', color: '#AAA' },
  btnSec: { background: '#F5F5F5', color: '#555', border: 'none', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '16px 0', color: '#888', fontSize: 14, textAlign: 'center' },
  successIcon: { fontSize: 56, marginBottom: 4 },
  h2: { fontSize: 22, fontWeight: 800, color: '#1A1A1A' },
  sub: { fontSize: 14, color: '#555', lineHeight: 1.6 },
  summaryBox: { background: '#F9F0F4', border: '1px solid #F8BBD0', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 9, width: '100%' },
  summaryRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, color: '#333' },
  footNote: { fontSize: 12, color: '#AAA', textAlign: 'center' },
  footer: { padding: '16px', textAlign: 'center', fontSize: 12, color: '#AAA' },
}
