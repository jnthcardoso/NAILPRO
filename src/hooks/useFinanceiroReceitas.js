import { useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { formatBRL } from '../lib/formatters'
import { traduzErro } from '../lib/erros'
import { useAuth } from '../contexts/AuthContext'
import { useSalao } from '../contexts/SalaoContext'
import { useToast } from '../contexts/ToastContext'

const FORMA_LABEL = {
  pix: 'Pix', dinheiro: 'Dinheiro',
  cartao_debito: 'Débito', cartao_credito: 'Crédito', sem: 'Sem forma registrada',
}

/**
 * Gerencia ações sobre pagamentos/receitas:
 * registrar, confirmar pago, reverter para pendente, cobrar via WhatsApp.
 */
export function useFinanceiroReceitas({ loadPagamentos, setPagamentos }) {
  const { user } = useAuth()
  const { salaoId } = useSalao()
  const { erro: toastErro, sucesso, confirmar } = useToast()

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    agendamento_id: '', valor: '', status: 'pendente', forma: 'pix',
    data: format(new Date(), 'yyyy-MM-dd'),
  })
  const [saving, setSaving] = useState(false)
  const [pagSelecionado, setPagSelecionado] = useState(null)
  const [formPag, setFormPag] = useState({
    forma: 'pix', status: 'pago', valor: '', modo: 'simples', forma2: 'cartao_credito', valor2: '',
  })
  const [savingPag, setSavingPag] = useState(false)

  async function salvarPagamento() {
    if (!form.valor) return
    setSaving(true)
    // agendamento_id vazio não é uuid válido — precisa virar null.
    const { error } = await supabase.from('pagamentos').insert({
      ...form,
      agendamento_id: form.agendamento_id || null,
      user_id: user.id,
      salao_id: salaoId,
      valor: parseFloat(form.valor),
    })
    setSaving(false)
    if (error) { toastErro(traduzErro(error, 'Não foi possível registrar o pagamento.')); return }
    setShowModal(false)
    setForm({ agendamento_id: '', valor: '', status: 'pendente', forma: 'pix', data: format(new Date(), 'yyyy-MM-dd') })
    loadPagamentos()
    sucesso('Pagamento registrado')
  }

  async function reverterParaPendente(pag) {
    const ok = await confirmar({
      titulo: 'Marcar como pendente?',
      mensagem: `${pag.agendamentos?.clientes?.nome || 'Este pagamento'} · ${formatBRL(pag.valor ?? 0)} (${FORMA_LABEL[pag.forma] || pag.forma}) deixará de ser um valor recebido.`,
      confirmarLabel: 'Sim, marcar pendente',
      tipo: 'perigo',
    })
    if (!ok) return
    const { error } = await supabase.from('pagamentos')
      .update({ status: 'pendente' }).eq('id', pag.id).eq('salao_id', salaoId)
    if (error) { toastErro(traduzErro(error, 'Não foi possível atualizar o pagamento.')); return }
    loadPagamentos()
  }

  // Atualização otimista: marca enviado na tela antes da confirmação do banco.
  async function marcarCobrado(pag) {
    if (pag.cobranca_enviada_em) return
    const agora = new Date().toISOString()
    setPagamentos(prev => prev.map(x => x.id === pag.id ? { ...x, cobranca_enviada_em: agora } : x))
    await supabase.from('pagamentos')
      .update({ cobranca_enviada_em: agora }).eq('id', pag.id).eq('salao_id', salaoId)
  }

  function abrirConfirmarPago(pag) {
    setFormPag({ forma: pag.forma || 'pix', status: 'pago', valor: String(pag.valor || ''), modo: 'simples', forma2: 'cartao_credito', valor2: '' })
    setPagSelecionado(pag)
  }

  async function salvarPagamentoConfirmado() {
    if (!pagSelecionado) return
    const v1 = parseFloat(formPag.valor) || 0
    const v2 = formPag.modo === 'duplo' ? (parseFloat(formPag.valor2) || 0) : 0
    if (v1 <= 0) { toastErro('Informe o valor do pagamento.'); return }
    if (formPag.modo === 'duplo' && v2 <= 0) { toastErro('Informe o valor da 2ª forma de pagamento.'); return }
    setSavingPag(true)
    // 1ª forma: atualiza o lançamento existente (mantém o vínculo com o agendamento).
    const { error } = await supabase.from('pagamentos')
      .update({ status: formPag.status, forma: formPag.forma, valor: v1 })
      .eq('id', pagSelecionado.id).eq('salao_id', salaoId)
    let erro2 = null
    // 2ª forma (duplo): cria um segundo lançamento para o mesmo agendamento.
    if (!error && formPag.modo === 'duplo') {
      const r = await supabase.from('pagamentos').insert({
        user_id: pagSelecionado.user_id || user.id, salao_id: salaoId,
        agendamento_id: pagSelecionado.agendamento_id || null, data: pagSelecionado.data,
        status: formPag.status, valor: v2, forma: formPag.forma2,
      })
      erro2 = r.error
    }
    setSavingPag(false)
    if (error || erro2) { toastErro('Erro ao registrar pagamento: ' + (error || erro2).message); return }
    setPagSelecionado(null)
    sucesso(formPag.modo === 'duplo' ? 'Pagamento em 2 formas registrado' : 'Pagamento registrado')
    loadPagamentos()
  }

  return {
    showModal, setShowModal,
    form, setForm,
    saving,
    pagSelecionado, setPagSelecionado,
    formPag, setFormPag,
    savingPag,
    salvarPagamento,
    reverterParaPendente,
    marcarCobrado,
    abrirConfirmarPago,
    salvarPagamentoConfirmado,
  }
}
