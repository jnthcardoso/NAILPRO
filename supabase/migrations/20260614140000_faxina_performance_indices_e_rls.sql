-- Faxina de performance (sem alterar/apagar dados nem mudar comportamento).
-- Origem: avisos do analisador de performance do Supabase (database linter).
-- 1) Indices nas chaves estrangeiras apontadas pelo analisador.
-- 2) RLS: calcular auth.uid() uma vez (initplan) em vez de por linha.
-- 3) Remover sobreposicao de politica anon em configuracoes.
--
-- Operacao segura: indices e ajuste de RLS nao alteram nem apagam dados.
-- Os ajustes de RLS preservam o comportamento (mesmo resultado, so mais rapido).

-- ============ 1) INDICES DE CHAVE ESTRANGEIRA ============
CREATE INDEX IF NOT EXISTS idx_assinaturas_salao ON public.assinaturas (salao_id);
CREATE INDEX IF NOT EXISTS idx_clientes_user ON public.clientes (user_id);
CREATE INDEX IF NOT EXISTS idx_configuracoes_salao ON public.configuracoes (salao_id);
CREATE INDEX IF NOT EXISTS idx_despesas_user ON public.despesas (user_id);
CREATE INDEX IF NOT EXISTS idx_metas_user ON public.metas (user_id);
CREATE INDEX IF NOT EXISTS idx_oportunidade_contatos_cliente ON public.oportunidade_contatos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_user ON public.pagamentos (user_id);
CREATE INDEX IF NOT EXISTS idx_saloes_dona_user ON public.saloes (dona_user_id);

-- ============ 2) RLS INITPLAN (auth.uid() avaliado uma vez) ============
ALTER POLICY clientes_salao_select ON public.clientes
  USING (
    (salao_id = meu_salao_id())
    AND (
      (meu_papel() = ANY (ARRAY['dona'::text, 'recepcionista'::text]))
      OR (user_id = (select auth.uid()))
      OR (EXISTS (
            SELECT 1 FROM agendamentos a
            WHERE a.cliente_id = clientes.id
              AND a.profissional_id = meu_membro_id()
      ))
    )
  );

ALTER POLICY despesas_profissional_own ON public.despesas
  USING ((user_id = (select auth.uid())) AND (meu_papel() = 'profissional'::text))
  WITH CHECK ((user_id = (select auth.uid())) AND (meu_papel() = 'profissional'::text) AND (salao_id IS NULL));

-- ============ 3) REMOVER SOBREPOSICAO ANON EM CONFIGURACOES ============
-- config_salao_select e regra interna; anon ja e atendido por "anon read configuracoes by slug".
ALTER POLICY config_salao_select ON public.configuracoes TO authenticated;
