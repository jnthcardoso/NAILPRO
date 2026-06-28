import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { traduzErro } from '../lib/erros'
import { MSG_COBRANCA_PADRAO } from '../lib/mensagens'
import { useToast } from '../contexts/ToastContext'

/**
 * Gerencia as configurações do salão que aparecem no Financeiro:
 * chave PIX/template de cobrança, pró-labore e categorias de despesa.
 */
export function useFinanceiroConfig({ salaoId, user }) {
  const { erro: toastErro, sucesso } = useToast()

  const [cobranca, setCobranca] = useState({ chavePix: '', template: MSG_COBRANCA_PADRAO, nomeSalao: '' })
  const [proLabore, setProLabore] = useState(0)
  const [showProLabore, setShowProLabore] = useState(false)
  const [proLaboreInput, setProLaboreInput] = useState('')
  const [savingProLabore, setSavingProLabore] = useState(false)
  const [categoriasCustom, setCategoriasCustom] = useState([])

  async function loadCategorias() {
    const { data } = await supabase.from('categorias_despesa')
      .select('*').eq('salao_id', salaoId).order('label')
    setCategoriasCustom(data || [])
  }

  useEffect(() => {
    if (!salaoId) return
    supabase.from('configuracoes')
      .select('chave_pix, msg_cobranca, nome_salao, pro_labore')
      .eq('salao_id', salaoId).maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setCobranca({
          chavePix: data.chave_pix || '',
          template: data.msg_cobranca || MSG_COBRANCA_PADRAO,
          nomeSalao: data.nome_salao || '',
        })
        setProLabore(Number(data.pro_labore) || 0)
      })
    loadCategorias()
  }, [salaoId])

  function abrirProLabore() {
    setProLaboreInput(proLabore ? String(proLabore) : '')
    setShowProLabore(true)
  }

  async function salvarProLabore() {
    const valor = parseFloat(proLaboreInput) || 0
    setSavingProLabore(true)
    const { error } = await supabase.from('configuracoes')
      .update({ pro_labore: valor }).eq('salao_id', salaoId)
    setSavingProLabore(false)
    if (error) { toastErro(traduzErro(error, 'Não foi possível salvar seu salário.')); return }
    setProLabore(valor)
    setShowProLabore(false)
    sucesso('Pró-labore salvo ✓')
  }

  return {
    cobranca,
    proLabore,
    showProLabore, setShowProLabore,
    proLaboreInput, setProLaboreInput,
    savingProLabore,
    categoriasCustom, setCategoriasCustom,
    abrirProLabore,
    salvarProLabore,
  }
}
