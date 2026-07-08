import { useEffect } from 'react'

// html/body/#root do app são fixados em height:100% (necessário pras telas
// internas com sidebar). Isso cria rolagem aninhada no #root, que trava o
// gesto de arrastar em navegadores mobile/PWA. Enquanto a tela de
// login/criar estiver montada, soltamos essa altura fixa pra rolagem
// normal da página assumir.
export function useAuthPageScroll() {
  useEffect(() => {
    document.body.classList.add('auth-page-active')
    return () => document.body.classList.remove('auth-page-active')
  }, [])
}
