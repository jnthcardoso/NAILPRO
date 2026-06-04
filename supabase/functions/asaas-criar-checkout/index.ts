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

    const { plano, ciclo } = await req.json()
    const valor = PRECOS[`${plano}_${ciclo}`]
    if (!valor) return json({ error: 'Plano invalido' }, 400)

    const isAnual = ciclo === 'anual'
    const nomePlano = NOMES[plano] ?? 'Pro'
    const cicloNome = isAnual ? 'Anual' : 'Mensal'
    // Data de vencimento = hoje (fuso de Brasilia) -> cobra na contratacao
    const hoje = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
    const nextDueDate = hoje.toISOString().slice(0, 10)

    const body: Record<string, unknown> = {
      billingTypes: ['CREDIT_CARD'],
      minutesToExpire: 60,
      callback: {
        successUrl: `${APP_URL}/app?pagamento=sucesso`,
        cancelUrl: `${APP_URL}/planos`,
        expiredUrl: `${APP_URL}/planos`,
      },
      items: [{
        name: `Lumen ${nomePlano} (${cicloNome.toLowerCase()})`,
        description: `Assinatura Lumen ${nomePlano} - cobranca ${cicloNome.toLowerCase()}`,
        quantity: 1,
        value: valor, // anual = valor do ANO (parcelavel); mensal = valor do mes
      }],
      externalReference: `${user.id}|${plano}|${ciclo}`,
    }

    if (isAnual) {
      // Anual = compra unica do ano: a cliente escolhe pagar a vista (DETACHED)
      // ou parcelar em ate 12x (INSTALLMENT). O Asaas EXIGE DETACHED junto de INSTALLMENT.
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
