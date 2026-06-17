import { next } from '@vercel/functions'

// Middleware do Vercel — roda SÓ na rota de confirmação (/c/...).
export const config = {
  matcher: '/c/:path*',
}

// Quando o link de confirmar (/c/codigo) abre no WhatsApp, o app puxava o "card"
// do site (logo + texto da landing), porque toda rota serve o mesmo index.html.
// Não dá pra impedir 100% o WhatsApp de montar um card. Então, em vez de brigar
// com isso, entregamos pro robô de preview um card BONITO e com a cara do Lumen:
// se a manicure esquecer de clicar no "x" pra remover, o que aparece é caprichado
// (logo + "Confirme seu horário"), não um card quebrado/pelado.
// Pessoas de verdade (navegador comum) passam direto pro app, sem ver nada disso.
const ROBOS_PREVIEW = /whatsapp|facebookexternalhit|facebot|twitterbot|telegrambot|slackbot|discordbot|linkedinbot|skypeuripreview|embedly|redditbot|pinterest|vkshare|tumblr/i

const SITE = 'https://lumengestaoempresarial.com.br'
const IMAGEM_CARD = `${SITE}/logo/lumen-logo-horizontal-1000.png`

// HTML mínimo, SÓ com as tags de pré-visualização (Open Graph). É o que o robô lê
// pra montar o card. A cliente nunca vê esta página.
function cardPreview(url) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Confirme seu horário · Lumen</title>
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Lumen" />
<meta property="og:url" content="${url}" />
<meta property="og:title" content="Confirme seu horário ✨" />
<meta property="og:description" content="Toque para confirmar o seu horário. É rápido e seguro." />
<meta property="og:image" content="${IMAGEM_CARD}" />
<meta property="og:image:width" content="1000" />
<meta property="og:image:height" content="400" />
<meta property="og:locale" content="pt_BR" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Confirme seu horário ✨" />
<meta name="twitter:description" content="Toque para confirmar o seu horário. É rápido e seguro." />
<meta name="twitter:image" content="${IMAGEM_CARD}" />
</head>
<body></body>
</html>`
}

export default function middleware(request) {
  const ua = request.headers.get('user-agent') || ''
  if (ROBOS_PREVIEW.test(ua)) {
    // Robô de preview: recebe o card bonito (logo + "Confirme seu horário").
    return new Response(cardPreview(request.url), {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }
  // Usuário normal: segue o fluxo normal (a SPA carrega a tela de confirmação).
  return next()
}
