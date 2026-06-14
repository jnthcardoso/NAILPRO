-- Atribuicao de anuncio (Meta) na conversao de compra.
-- Guarda os "carimbos do clique" do Meta (cookies _fbp e _fbc) capturados no
-- navegador na hora do checkout, para que o Purchase enviado pelo SERVIDOR
-- (Conversions API, no asaas-webhook) consiga atribuir a venda ao anuncio/clique
-- que a trouxe. Sem isso o Meta conta a venda, mas atribui mal a campanha.
--
-- Risco: minimo. Colunas novas, opcionais (NULL), ninguem depende delas;
-- nao altera dados existentes nem comportamento atual.

alter table public.assinaturas
  add column if not exists fbp text,
  add column if not exists fbc text;

comment on column public.assinaturas.fbp is
  'Meta Pixel: cookie _fbp do navegador, capturado no checkout. Usado na atribuicao do Purchase via CAPI (asaas-webhook).';
comment on column public.assinaturas.fbc is
  'Meta Pixel: cookie _fbc (clique do anuncio, fbclid) capturado no checkout. Usado na atribuicao do Purchase via CAPI (asaas-webhook).';
