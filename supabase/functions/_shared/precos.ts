// Fonte de verdade dos preços cobrados pelo Asaas.
//
// Para alterar um preço: edite APENAS aqui. As duas edge functions
// (asaas-criar-checkout e asaas-webhook) importam deste arquivo.
//
// O frontend (AssinaturaContext.jsx) espelha estes valores em centavos:
//   precoMensalMensal  = PRECOS["plano_mensal"] * 100
//   precoAnual         = PRECOS["plano_anual"]  * 100
//   PRECO_USUARIO_ADICIONAL = PRECO_MANICURE    * 100

export const PRECOS: Record<string, number> = {
  solo_mensal:  127.00,
  solo_anual:  1164.00,
  pro_mensal:   229.00,
  pro_anual:   2148.00,
  salao_mensal: 249.00,
  salao_anual: 2388.00,
}

export const PRECO_MANICURE = 44.90  // R$/mês por manicure adicional (plano Salão)
export const MAX_MANICURES  = 15
