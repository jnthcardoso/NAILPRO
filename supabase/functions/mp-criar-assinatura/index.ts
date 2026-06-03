import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Precos em reais (centavos / 100). Sao apenas os valores-base do plano —
// manicures adicionais do Salao seguem o fluxo manual (WhatsApp).
const PRECOS: Record<string, number> = {
  solo_mensal:  127.00,
  solo_anual:    97.00,
  pro_mensal:   229.00,
  pro_anual:    179.00,
  salao_mensal: 249.00,
  salao_anual:  199.00,
}

const PLANO_NOMES: Record<string, string> = {
  solo:  'Solo',
  pro:   'Pro',
  salao: 'Salão',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN') ?? ''
    const APP_URL = Deno.env.get('APP_URL') ?? 'https://lumengestaoempresarial.com.br'
    const IS_SANDBOX = MP_ACCESS_TOKEN.startsWith('TEST-')

    // Autentica o usuario pelo JWT
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Nao autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { plano, ciclo } = await req.json()
    const chave = `${plano}_${ciclo}`
    const valor = PRECOS[chave]

    if (!valor) {
      return new Response(JSON.stringify({ error: 'Plano invalido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const planoNome = PLANO_NOMES[plano] ?? 'Pro'
    const cicloNome = ciclo === 'anual' ? 'Anual' : 'Mensal'
    const reason = `Lumen ${planoNome} ${cicloNome} - R$ ${valor.toFixed(2).replace('.', ',')}/mes`

    // Cria preapproval (assinatura recorrente) no Mercado Pago
    const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `${user.id}-${plano}-${ciclo}-${Date.now()}`,
      },
      body: JSON.stringify({
        reason,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: valor,
          currency_id: 'BRL',
        },
        payer_email: user.email,
        back_url: `${APP_URL}/app?pagamento=sucesso`,
        external_reference: `${user.id}|${plano}|${ciclo}`,
        status: 'pending',
      }),
    })

    const mpData = await mpRes.json()

    if (!mpRes.ok) {
      console.error('MP error:', JSON.stringify(mpData))
      return new Response(JSON.stringify({ error: mpData.message || 'Erro no Mercado Pago' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Em sandbox usa sandbox_init_point, em producao usa init_point
    const url = IS_SANDBOX ? mpData.sandbox_init_point : mpData.init_point

    return new Response(JSON.stringify({
      url,
      id: mpData.id,
      sandbox: IS_SANDBOX,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('Erro interno:', err)
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
