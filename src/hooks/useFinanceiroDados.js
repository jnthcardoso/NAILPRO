import { useState, useRef, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { supabase } from '../lib/supabase'
import { comTimeout } from '../lib/queryUtils'
import { traduzErro } from '../lib/erros'
import { useToast } from '../contexts/ToastContext'

/**
 * Gerencia todos os dados financeiros buscados do banco:
 * pagamentos, despesas, agendamentos e previsão de receita.
 * Inclui os efeitos de carga inicial e recarregamento por foco.
 */
export function useFinanceiroDados({ salaoId, user, gerenciaTudo, periodoSel, rangeMode, customInicio, customFim }) {
  const { erro: toastErro } = useToast()

  const [pagamentos, setPagamentos] = useState([])
  const [despesas, setDespesas] = useState([])
  const [pagamentos6m, setPagamentos6m] = useState([])
  const [agendamentos, setAgendamentos] = useState([])
  const [previsao, setPrevisao] = useState({ entraMes: 0, qtdEntraMes: 0 })
  const [loading, setLoading] = useState(true)
  const primeiraCarga = useRef(true)

  // Data de referência: usada na janela de 6 meses e no relatório anual.
  const refDate = (rangeMode === 'custom' && customFim)
    ? new Date(customFim + 'T12:00:00')
    : periodoSel

  function getRange() {
    if (rangeMode === 'custom' && customInicio && customFim) {
      return customInicio <= customFim
        ? { inicio: customInicio, fim: customFim }
        : { inicio: customFim, fim: customInicio }
    }
    return {
      inicio: format(startOfMonth(periodoSel), 'yyyy-MM-dd'),
      fim: format(endOfMonth(periodoSel), 'yyyy-MM-dd'),
    }
  }

  async function loadPagamentos() {
    const { inicio, fim } = getRange()
    try {
      const { data, error } = await comTimeout(
        supabase.from('pagamentos')
          .select('*, agendamentos(servico, status, clientes(nome, telefone))')
          .eq('salao_id', salaoId).gte('data', inicio).lte('data', fim)
          .order('data', { ascending: false }).limit(2000)
      )
      if (error) { toastErro(traduzErro(error, 'Não foi possível carregar os pagamentos.')); return }
      // Pagamento de atendimento CANCELADO não é receita.
      setPagamentos((data || []).filter(p => p.agendamentos?.status !== 'cancelado'))

      const inicio6m = format(startOfMonth(subMonths(refDate, 5)), 'yyyy-MM-dd')
      const fim6m = format(endOfMonth(refDate), 'yyyy-MM-dd')
      const { data: data6m, error: err6m } = await comTimeout(
        supabase.from('pagamentos')
          .select('data, valor, status, agendamentos(status)')
          .eq('salao_id', salaoId).eq('status', 'pago')
          .gte('data', inicio6m).lte('data', fim6m).limit(6000)
      )
      if (err6m) console.warn('Gráfico 6 meses: falha ao carregar', err6m.message)
      setPagamentos6m((data6m || []).filter(p => p.agendamentos?.status !== 'cancelado'))
    } catch (err) {
      toastErro(err.message || 'Não foi possível carregar os pagamentos.')
    }
  }

  async function loadDespesas() {
    const { inicio, fim } = getRange()
    // Dona/recepção veem as despesas do salão; profissional vê só as dela.
    let q = supabase.from('despesas')
      .select('*')
      .gte('data', inicio).lte('data', fim)
      .order('data', { ascending: false }).limit(500)
    q = gerenciaTudo ? q.eq('salao_id', salaoId) : q.eq('user_id', user.id)
    try {
      const { data, error } = await comTimeout(q)
      if (error) { toastErro(traduzErro(error, 'Não foi possível carregar as despesas.')); return }
      setDespesas(data || [])
    } catch (err) {
      toastErro(err.message || 'Não foi possível carregar as despesas.')
    }
  }

  async function loadAgendamentos() {
    const { data } = await supabase.from('agendamentos')
      .select('id, servico, data, clientes(nome)')
      .eq('salao_id', salaoId)
      .order('data', { ascending: false }).limit(50)
    setAgendamentos(data || [])
  }

  async function loadPrevisao() {
    const hoje = format(new Date(), 'yyyy-MM-dd')
    const fimMes = format(endOfMonth(new Date()), 'yyyy-MM-dd')
    // Só conta atendimentos SEM pagamento ainda — evita dupla contagem.
    const { data: ags } = await supabase
      .from('agendamentos').select('valor, pagamentos(status)')
      .eq('salao_id', salaoId)
      .gte('data', hoje).lte('data', fimMes)
      .in('status', ['pendente', 'confirmado'])
    const arr = (ags || []).filter(a => (a.pagamentos || []).length === 0)
    setPrevisao({ entraMes: arr.reduce((acc, a) => acc + (a.valor || 0), 0), qtdEntraMes: arr.length })
  }

  // Carga inicial e recarga ao trocar período.
  useEffect(() => {
    if (!salaoId) return
    if (primeiraCarga.current) setLoading(true)
    Promise.all([loadPagamentos(), loadAgendamentos(), loadDespesas(), loadPrevisao()])
      .finally(() => { setLoading(false); primeiraCarga.current = false })
  }, [salaoId, periodoSel, rangeMode, customInicio, customFim])

  // Recarrega ao voltar o foco — mantém dados frescos com sessões simultâneas.
  useEffect(() => {
    function aoFocar() {
      if (document.visibilityState === 'visible' && salaoId) {
        loadPagamentos(); loadDespesas()
      }
    }
    window.addEventListener('focus', aoFocar)
    document.addEventListener('visibilitychange', aoFocar)
    return () => {
      window.removeEventListener('focus', aoFocar)
      document.removeEventListener('visibilitychange', aoFocar)
    }
  }, [salaoId, periodoSel, rangeMode, customInicio, customFim])

  return {
    pagamentos, setPagamentos,
    despesas,
    pagamentos6m,
    agendamentos,
    previsao,
    loading,
    loadPagamentos,
    loadDespesas,
    refDate,
  }
}
