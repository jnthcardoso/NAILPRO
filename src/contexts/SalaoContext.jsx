import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const SalaoContext = createContext({})

export function SalaoProvider({ children }) {
  const { user } = useAuth()
  const [membro, setMembro] = useState(null)
  const [salao, setSalao] = useState(null)
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    if (!user?.id) { setMembro(null); setSalao(null); setLoading(false); return }
    setLoading(true)
    // membro do usuário logado (papel + salao_id)
    const { data: m, error: mErr } = await supabase
      .from('salao_membros')
      .select('id, salao_id, user_id, nome, email, papel, ativo')
      .eq('user_id', user.id)
      .eq('ativo', true)
      .maybeSingle()
    if (mErr) console.error('SalaoContext: falha ao carregar membro', mErr.message)
    setMembro(m || null)
    if (m?.salao_id) {
      const { data: s } = await supabase
        .from('saloes')
        .select('id, nome, dona_user_id, created_at')
        .eq('id', m.salao_id)
        .maybeSingle()
      setSalao(s || null)
    } else {
      setSalao(null)
    }
    setLoading(false)
  }, [user?.id])

  useEffect(() => { carregar() }, [carregar])

  const papel = membro?.papel || null
  const salaoId = membro?.salao_id || null
  const membroId = membro?.id || null
  const isDona = papel === 'dona'
  const isRecepcionista = papel === 'recepcionista'
  const isProfissional = papel === 'profissional'
  // dona e recepcionista enxergam/gerenciam tudo do salão
  const gerenciaTudo = isDona || isRecepcionista
  // só a dona/admin gerencia equipe e licença
  const podeGerenciarEquipe = isDona

  return (
    <SalaoContext.Provider value={{
      membro, salao, loading,
      papel, salaoId, membroId,
      isDona, isRecepcionista, isProfissional,
      gerenciaTudo, podeGerenciarEquipe,
      recarregar: carregar,
    }}>
      {children}
    </SalaoContext.Provider>
  )
}

export const useSalao = () => useContext(SalaoContext)
