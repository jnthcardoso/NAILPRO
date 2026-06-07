import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Valor cobrado (em reais). Mensal = valor do mes; Anual = valor do ANO (1x na contratacao).
const PRECOS: Record<string, number> = {
  solo_mensal:  127.00,
  solo_anual:  1164.00,
  pro_mensal:   229.00,
  pro_anual:   2148.00,
  salao_mensal: 249.00,
  salao_anual: 2388.00,
}
const NOMES: Record<string, string> = { solo: 'Solo', pro: 'Pro', salao: 'Salao' }

// Manicure adicional (login proprio alem de dona/recepcionista) — so no plano Salao.
const PRECO_MANICURE = 44.90      // por mes
const MAX_MANICURES = 15

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

    const { plano, ciclo, manicures } = await req.json()
    const valorBase = PRECOS[`${plano}_${ciclo}`]
    if (!valorBase) return json({ error: 'Plano invalido' }, 400)

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
      // Anual = valor do ANO. Usando SO 'INSTALLMENT', o checkout do Asaas abre ja
      // no seletor de parcelas (ate 12x) — o parcelamento fica em destaque, e quem
      // quiser pagar a vista escolhe "1x". (Antes era ['DETACHED','INSTALLMENT'], que
      // abria priorizando a vista e escondia o 12x no final.)
      // OBS: parcelamento e assinatura recorrente (RECURRENT) sao mutuamente exclusivos
      // no Asaas. Por isso o anual NAO renova sozinho: ao fim dos 12 meses, a renovacao
      // e feita manualmente (acompanhada no Admin).
      body.chargeTypes = ['INSTALLMENT']
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
