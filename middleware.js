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
    // Sem og:image, og:title nem <title> → o WhatsApp não monta card nenhum.
    return new Response(
      '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="robots" content="noindex"></head><body></body></html>',
      { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }
    )
  }
  // Usuário normal: segue o fluxo normal (a SPA carrega a tela de confirmação).
  return next()
}
