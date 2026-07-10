import { supabase } from './supabase'

// Registra um erro do app no banco (fire-and-forget), pra o dev ver em Relatórios > Erros
// em vez de só descobrir se a cliente reclamar. Nunca trava a UI nem propaga falha.
export async function registrarErro(mensagem, stack, contexto) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('app_errors').insert({
      user_id: user.id,
      mensagem: String(mensagem || '').slice(0, 2000),
      stack: stack ? String(stack).slice(0, 4000) : null,
      contexto,
    })
  } catch { /* nunca deixa o registro de erro gerar outro erro */ }
}
