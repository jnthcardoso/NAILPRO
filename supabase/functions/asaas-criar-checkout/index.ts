import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PRECOS, PRECO_MANICURE, MAX_MANICURES } from '../_shared/precos.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_URL') ?? 'https://lumengestaoempresarial.com.br',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const NOMES: Record<string, string> = { solo: 'Solo', pro: 'Pro', salao: 'Salao' }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const json = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const key = Deno.env.get('ASAAS_API_KEY') ?? ''
    const APP_URL = Deno.env.get('APP_URL') ?? 'https://lumengestaoempresarial.com.br'
    const base = key.includes('_hmlg_') ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3'

    // Autentica o usuario pelo JWT
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return json({ error: 'Nao autorizado' }, 401)

    const { plano, ciclo, manicures, fbp, fbc } = await req.json()
    const valorBase = PRECOS[`${plano}_${ciclo}`]
    if (!valorBase) return json({ error: 'Plano invalido' }, 400)

    // Carimbos do anuncio (Meta): guarda _fbp/_fbc na assinatura para o webhook
    // atribuir o Purchase (CAPI) ao anuncio que trouxe a cliente. So aceita o
    // formato esperado do Meta ("fb.1...."); qualquer outra coisa e ignorada.
    const fbCookie = (v: unknown) =>
      typeof v === 'string' && /^fb\.\d\.\d+\..+$/.test(v) && v.length <= 255 ? v : null
    const fbpOk = fbCookie(fbp)
    const fbcOk = fbCookie(fbc)
    if (fbpOk || fbcOk) {
      try {
        const admin = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        )
        const patch: Record<string, string> = {}
        if (fbpOk) patch.fbp = fbpOk
        if (fbcOk) patch.fbc = fbcOk
        const { error: upErr } = await admin.from('assinaturas').update(patch).eq('user_id', user.id)
        if (upErr) console.error('Falha ao gravar fbp/fbc (ignorado):', upErr.message)
      } catch (e) {
        console.error('Erro ao gravar fbp/fbc (ignorado):', e)
      }
    }

    const isAnual = ciclo === 'anual'
    // Manicures adicionais so valem para o Salao; clampa em 0..MAX para nao confiar no cliente.
    const qtdManicures = plano === 'salao'
      ? Math.max(0, Math.min(MAX_MANICURES, Math.floor(Number(manicures) || 0)))
      : 0
    // Extra cobrado: mensal soma 1x/mes; anual soma 12x (cobranca do ano).
    const extraManicures = qtdManicures * PRECO_MANICURE * (isAnual ? 12 : 1)
    const valor = valorBase + extraManicures

    const nomePlano = NOMES[plano] ?? 'Pro'
    const cicloNome = isAnual ? 'Anual' : 'Mensal'
    // Data de vencimento = hoje (fuso de Brasilia) -> cobra na contratacao
    const hoje = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
    const nextDueDate = hoje.toISOString().slice(0, 10)

    const descManicures = qtdManicures > 0
      ? ` + ${qtdManicures} manicure(s) adicional(is)`
      : ''
    const body: Record<string, unknown> = {
      billingTypes: ['CREDIT_CARD'],
      minutesToExpire: 60,
      callback: {
        successUrl: `${APP_URL}/app?pagamento=sucesso`,
        cancelUrl: `${APP_URL}/planos`,
        expiredUrl: `${APP_URL}/planos`,
      },
      items: [{
        // ATENCAO: o Asaas limita "name" a 30 caracteres. O detalhe das manicures
        // vai so na "description" (texto longo) para nao estourar o limite.
        name: `Lumen ${nomePlano} (${cicloNome.toLowerCase()})`,
        description: `Assinatura Lumen ${nomePlano} - cobranca ${cicloNome.toLowerCase()}${descManicures}`,
        quantity: 1,
        value: valor, // anual = valor do ANO (parcelavel); mensal = valor do mes — ja inclui manicures
      }],
      // Ref carrega a qtd de manicures pagas para o webhook liberar os assentos.
      externalReference: `${user.id}|${plano}|${ciclo}|${qtdManicures}`,
    }

    if (isAnual) {
      // Anual = compra unica do ano: a cliente escolhe pagar a vista (DETACHED) ou
      // parcelar em ate 12x (INSTALLMENT). O Asaas EXIGE DETACHED junto de INSTALLMENT
      // (testado: usar so INSTALLMENT retorna erro "DETACHED deve ser informado junto").
      // Por isso NAO da pra abrir o checkout ja no parcelamento — o Asaas decide a ordem.
      // OBS: parcelamento e assinatura recorrente (RECURRENT) sao mutuamente exclusivos
      // no Asaas. Por isso o anual NAO renova sozinho: ao fim dos 12 meses, a renovacao
      // e feita manualmente (acompanhada no Admin).
      body.chargeTypes = ['DETACHED', 'INSTALLMENT']
      body.installment = { maxInstallmentCount: 12 }
    } else {
      // Mensal = assinatura recorrente que renova sozinha todo mes.
      body.chargeTypes = ['RECURRENT']
      body.subscription = { cycle: 'MONTHLY', nextDueDate }
    }

    const res = await fetch(`${base}/checkouts`, {
      method: 'POST',
      headers: { access_token: key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok || !data?.link) {
      console.error('Asaas checkout error:', JSON.stringify(data))
      return json({ error: data?.errors?.[0]?.description || 'Erro ao criar checkout no Asaas' }, 400)
    }
    return json({ url: data.link, id: data.id })
  } catch (err) {
    console.error('Erro interno:', err)
    return json({ error: 'Erro interno do servidor' }, 500)
  }
})
