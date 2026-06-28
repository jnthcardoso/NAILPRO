import { useState } from 'react'
import { format, addMonths } from 'date-fns'
import { supabase } from '../lib/supabase'
import { formatBRL } from '../lib/formatters'
import { traduzErro } from '../lib/erros'
import { useAuth } from '../contexts/AuthContext'
import { useSalao } from '../contexts/SalaoContext'
import { useAssinatura } from '../contexts/AssinaturaContext'
import { useToast } from '../contexts/ToastContext'

const FORM_VAZIO = () => ({
  descricao: '', categoria: 'produtos', valor: '',
  data: format(new Date(), 'yyyy-MM-dd'),
  forma_pagamento: 'pix', recorrente: false, valor_variavel: false,
  recorrente_ate: '', observacoes: '', pago: false, tipo: 'salao',
})

/**
 * Gerencia ações sobre despesas e categorias personalizadas:
 * criar, editar, excluir, pagar e gerenciar categorias.
 *
 * Recebe `setCategoriasCustom` de `useFinanceiroConfig` para sincronizar
 * a lista de categorias sem duplicar estado.
 */
export function useFinanceiroDespesas({ loadDespesas, setCategoriasCustom }) {
  const { user } = useAuth()
  const { salaoId, gerenciaTudo } = useSalao()
  const { temAcesso } = useAssinatura()
  const { erro: toastErro, sucesso, confirmar } = useToast()

  const [showDespesaModal, setShowDespesaModal] = useState(false)
  const [editandoDespesa, setEditandoDespesa] = useState(null)
  const [formDespesa, setFormDespesa] = useState(FORM_VAZIO)
  const [savingDespesa, setSavingDespesa] = useState(false)
  const [despesaParaPagar, setDespesaParaPagar] = useState(null)
  const [formPagarDespesa, setFormPagarDespesa] = useState({ forma_pagamento: 'pix' })
  const [savingPagarDespesa, setSavingPagarDespesa] = useState(false)
  const [showNovaCat, setShowNovaCat] = useState(false)
  const [novaCat, setNovaCat] = useState({ label: '', icon: '📦', cor: '#8B2655' })
  const [savingCat, setSavingCat] = useState(false)

  function abrirNovaDespesa() {
    setEditandoDespesa(null)
    setFormDespesa(FORM_VAZIO())
    setShowDespesaModal(true)
  }

  function abrirEditarDespesa(despesa) {
    setEditandoDespesa(despesa)
    setFormDespesa({
      descricao: despesa.descricao,
      categoria: despesa.categoria,
      valor: String(despesa.valor),
      data: despesa.data,
      forma_pagamento: despesa.forma_pagamento || 'pix',
      recorrente: despesa.recorrente || false,
      valor_variavel: despesa.valor_variavel || false,
      recorrente_ate: '',
      observacoes: despesa.observacoes || '',
      pago: despesa.pago !== false,
      tipo: despesa.tipo || 'salao',
    })
    setShowDespesaModal(true)
  }

  function fecharDespesaModal() {
    setShowDespesaModal(false)
    setEditandoDespesa(null)
    setShowNovaCat(false)
    setFormDespesa(FORM_VAZIO())
  }

  function abrirConfirmarPagarDespesa(despesa) {
    setFormPagarDespesa({ forma_pagamento: despesa.forma_pagamento || 'pix' })
    setDespesaParaPagar(despesa)
  }

  async function salvarDespesa() {
    const ehVariavel = formDespesa.recorrente && formDespesa.valor_variavel
    if (!formDespesa.descricao || (!formDespesa.valor && !ehVariavel)) {
      toastErro('Preencha descrição e valor')
      return
    }
    if (formDespesa.recorrente && !editandoDespesa && !formDespesa.recorrente_ate) {
      toastErro('Escolha até quando repetir a despesa')
      return
    }
    setSavingDespesa(true)
    // "Contas a pagar" é Pro/Salão: no Solo toda despesa entra como já paga.
    const podeContasAPagar = temAcesso('contasAPagar')
    const baseValor = formDespesa.valor ? parseFloat(formDespesa.valor) : 0
    // Profissional: despesa privada (sem vínculo ao salão, fora do DRE da dona).
    const comum = {
      user_id: user.id,
      salao_id: gerenciaTudo ? salaoId : null,
      descricao: formDespesa.descricao,
      categoria: formDespesa.categoria,
      forma_pagamento: formDespesa.forma_pagamento || null,
      observacoes: formDespesa.observacoes || null,
      tipo: formDespesa.tipo || 'salao',
    }

    // EDIÇÃO: atualiza só ESTE lançamento (não regenera a série).
    if (editandoDespesa) {
      const dados = {
        ...comum,
        valor: baseValor,
        data: formDespesa.data,
        recorrente: formDespesa.recorrente,
        valor_variavel: formDespesa.valor_variavel,
        valor_a_preencher: !!editandoDespesa.valor_a_preencher && baseValor === 0,
        pago: podeContasAPagar ? formDespesa.pago : true,
      }
      const base = supabase.from('despesas')
      const resp = gerenciaTudo
        ? await base.update(dados).eq('id', editandoDespesa.id).eq('salao_id', salaoId)
        : await base.update(dados).eq('id', editandoDespesa.id).eq('user_id', user.id)
      setSavingDespesa(false)
      if (resp.error) { toastErro(traduzErro(resp.error, 'Não foi possível salvar a despesa.')); return }
      sucesso('Despesa atualizada ✓')
      fecharDespesaModal(); loadDespesas()
      return
    }

    // CRIAÇÃO simples (não recorrente).
    if (!formDespesa.recorrente) {
      const { error } = await supabase.from('despesas').insert({
        ...comum, valor: baseValor, data: formDespesa.data,
        recorrente: false, valor_variavel: false, valor_a_preencher: false,
        pago: podeContasAPagar ? formDespesa.pago : true,
      })
      setSavingDespesa(false)
      if (error) { toastErro(traduzErro(error, 'Não foi possível salvar a despesa.')); return }
      sucesso('Despesa registrada ✓')
      fecharDespesaModal(); loadDespesas()
      return
    }

    // CRIAÇÃO recorrente: gera um lançamento por mês até "repetir até".
    //   fixo: todos os meses com o valor; variável: meses seguintes ficam "a preencher".
    const recorrenciaId = crypto.randomUUID()
    const inicio = new Date(formDespesa.data + 'T12:00:00')
    const ate = new Date(formDespesa.recorrente_ate + 'T12:00:00')
    const LIMITE_MESES = 36
    const linhas = []
    for (let i = 0; i < LIMITE_MESES; i++) {
      const dt = addMonths(inicio, i)
      if (dt > ate) break
      const valorMes = i === 0 ? baseValor : (formDespesa.valor_variavel ? 0 : baseValor)
      linhas.push({
        ...comum,
        data: format(dt, 'yyyy-MM-dd'),
        valor: valorMes,
        recorrente: true,
        recorrencia_id: recorrenciaId,
        valor_variavel: formDespesa.valor_variavel,
        valor_a_preencher: formDespesa.valor_variavel && valorMes === 0,
        // 1º mês segue o checkbox; meses futuros já nascem "a pagar".
        pago: podeContasAPagar ? (i === 0 ? formDespesa.pago : false) : true,
      })
    }
    const { error } = await supabase.from('despesas').insert(linhas)
    setSavingDespesa(false)
    if (error) { toastErro(traduzErro(error, 'Não foi possível criar a despesa recorrente.')); return }
    sucesso(`Despesa recorrente criada (${linhas.length} ${linhas.length === 1 ? 'mês' : 'meses'}) ✓`)
    fecharDespesaModal(); loadDespesas()
  }

  async function confirmarPagarDespesa() {
    if (!despesaParaPagar) return
    setSavingPagarDespesa(true)
    const q = supabase.from('despesas')
      .update({ pago: true, forma_pagamento: formPagarDespesa.forma_pagamento })
      .eq('id', despesaParaPagar.id)
    const { error } = await (gerenciaTudo ? q.eq('salao_id', salaoId) : q.eq('user_id', user.id))
    setSavingPagarDespesa(false)
    if (error) { toastErro(traduzErro(error, 'Não foi possível marcar como paga.')); return }
    const despesaPaga = despesaParaPagar
    setDespesaParaPagar(null)
    loadDespesas()
    sucesso('Conta marcada como paga ✓', {
      acaoLabel: 'Desfazer',
      acao: async () => {
        const uq = supabase.from('despesas').update({ pago: false }).eq('id', despesaPaga.id)
        await (gerenciaTudo ? uq.eq('salao_id', salaoId) : uq.eq('user_id', user.id))
        loadDespesas()
      },
    })
  }

  async function excluirDespesa(despesa) {
    const ok = await confirmar({
      titulo: 'Excluir esta despesa?',
      mensagem: `${despesa.descricao} - ${formatBRL(despesa.valor)}`,
      confirmarLabel: 'Sim, excluir',
      tipo: 'perigo',
    })
    if (!ok) return

    // Se faz parte de série recorrente, oferece apagar os próximos também.
    if (despesa.recorrencia_id) {
      const serie = await confirmar({
        titulo: 'Apagar os próximos também?',
        mensagem: 'Esta despesa se repete nos próximos meses. Quer apagar também os lançamentos seguintes (do mesmo dia em diante)?',
        confirmarLabel: 'Sim, apagar os próximos',
        cancelarLabel: 'Não, só esta',
        tipo: 'perigo',
      })
      if (serie) {
        const dq = supabase.from('despesas').delete()
          .eq('recorrencia_id', despesa.recorrencia_id).gte('data', despesa.data)
        const { error } = await (gerenciaTudo ? dq.eq('salao_id', salaoId) : dq.eq('user_id', user.id))
        if (error) { toastErro(traduzErro(error, 'Não foi possível excluir os lançamentos.')); return }
        sucesso('Despesas recorrentes excluídas (deste mês em diante)')
        loadDespesas()
        return
      }
    }

    const delQ = supabase.from('despesas').delete().eq('id', despesa.id)
    const { error } = await (gerenciaTudo ? delQ.eq('salao_id', salaoId) : delQ.eq('user_id', user.id))
    if (error) { toastErro(traduzErro(error, 'Não foi possível excluir a despesa.')); return }
    sucesso('Despesa excluída', {
      acaoLabel: 'Desfazer',
      acao: async () => {
        const { id, created_at, updated_at, ...rest } = despesa
        await supabase.from('despesas').insert(rest)
        loadDespesas()
      },
    })
    loadDespesas()
  }

  async function salvarNovaCategoria() {
    const label = novaCat.label.trim()
    if (!label) { toastErro('Dê um nome para a categoria'); return }
    setSavingCat(true)
    const { data, error } = await supabase.from('categorias_despesa')
      .insert({ salao_id: salaoId, user_id: user.id, label, icon: novaCat.icon?.trim() || '📦', cor: novaCat.cor || '#525252' })
      .select().single()
    setSavingCat(false)
    if (error) { toastErro(traduzErro(error, 'Não foi possível criar a categoria.')); return }
    setCategoriasCustom(prev => [...prev, data])
    setFormDespesa(f => ({ ...f, categoria: data.id }))
    setShowNovaCat(false)
    setNovaCat({ label: '', icon: '📦', cor: '#8B2655' })
    sucesso('Categoria criada ✓')
  }

  async function excluirCategoria(cat) {
    const ok = await confirmar({
      titulo: 'Excluir esta categoria?',
      mensagem: `${cat.icon} ${cat.label} — despesas já lançadas com ela continuam, mas ficam sem categoria.`,
      confirmarLabel: 'Sim, excluir',
      tipo: 'perigo',
    })
    if (!ok) return
    const { error } = await supabase.from('categorias_despesa')
      .delete().eq('id', cat.id).eq('salao_id', salaoId)
    if (error) { toastErro(traduzErro(error, 'Não foi possível excluir a categoria.')); return }
    setCategoriasCustom(prev => prev.filter(c => c.id !== cat.id))
    if (formDespesa.categoria === cat.id) setFormDespesa(f => ({ ...f, categoria: 'produtos' }))
    sucesso('Categoria excluída')
  }

  return {
    showDespesaModal, setShowDespesaModal,
    editandoDespesa,
    formDespesa, setFormDespesa,
    savingDespesa,
    despesaParaPagar, setDespesaParaPagar,
    formPagarDespesa, setFormPagarDespesa,
    savingPagarDespesa,
    showNovaCat, setShowNovaCat,
    novaCat, setNovaCat,
    savingCat,
    abrirNovaDespesa,
    abrirEditarDespesa,
    fecharDespesaModal,
    abrirConfirmarPagarDespesa,
    salvarDespesa,
    confirmarPagarDespesa,
    excluirDespesa,
    salvarNovaCategoria,
    excluirCategoria,
  }
}
