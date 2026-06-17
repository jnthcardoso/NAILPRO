import { next } from '@vercel/functions'

// Middleware do Vercel — roda SÓ na rota de confirmação (/c/...).
export const config = {
  matcher: '/c/:path*',
}

// Quando o link de confirmar (/c/codigo) abre no WhatsApp, o app puxava o "card"
// do site (logo + texto da landing), porque toda rota serve o mesmo index.html.
// Aqui interceptamos APENAS os robôs de pré-visualização de link (WhatsApp,
// Facebook, etc.) e devolvemos uma página VAZIA, sem imagem/título/og — então
// nenhum card aparece. Pessoas de verdade (navegador comum) passam direto para
// o app normalmente, sem nenhuma alteração.
const ROBOS_PREVIEW = /whatsapp|facebookexternalhit|facebot|twitterbot|telegrambot|slackbot|discordbot|linkedinbot|skypeuripreview|embedly|redditbot|pinterest|vkshare|tumblr/i

export default function middleware(request) {
  const ua = request.headers.get('user-agent') || ''
  if (ROBOS_PREVIEW.test(ua)) {
    // Página vazia (200) ainda fazia o WhatsApp montar um card mínimo só com o
    // domínio. Devolvendo 404 pro robô, ele desiste de montar QUALQUER card.
    // (A cliente, no navegador normal, nunca vê isto — passa direto pro app.)
    return new Response(null, { status: 404 })
  }
  // Usuário normal: segue o fluxo normal (a SPA carrega a tela de confirmação).
  return next()
}
