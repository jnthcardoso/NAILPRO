-- ============================================================================
-- Atualização da base de DEMONSTRAÇÃO (Studio Bella Nails / contatojcardoso12)
-- Objetivo: popular ~3 meses de dados à frente (jun/22 → set/03 de 2026) e
-- exibir TODAS as novas funcionalidades: equipe (plano Salão), agenda por
-- profissional, metas (semana/mês/ano), despesas e ciclo de retorno por cliente.
--
-- Segurança: tudo é escopado por user_id/salao_id da conta demo. Nenhuma conta
-- real é tocada. A rotina remove apenas o que ela mesma cria (janela de datas e
-- lançamentos marcados) antes de inserir, então é segura para reexecução.
-- ============================================================================

DO $$
DECLARE
  v_uid       uuid;
  v_salao     uuid := '363ec096-51c0-4e75-a14f-e14425544373';
  v_membros   uuid[];
  v_clientes  uuid[];
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'contatojcardoso12@gmail.com';
  IF v_uid IS NULL THEN
    RAISE NOTICE 'Conta demo não encontrada; nada foi feito.';
    RETURN;
  END IF;

  -- 1) Plano Salão (libera equipe) -------------------------------------------
  UPDATE assinaturas
     SET plano = 'salao',
         status = 'active',
         licencas_adicionais = 2,
         observacoes = 'Conta demonstração - plano Salão (equipe + todas as funcionalidades)',
         updated_at = now()
   WHERE user_id = v_uid;

  -- 2) Equipe ----------------------------------------------------------------
  -- A "dona" vira uma pessoa (era o nome do salão).
  UPDATE salao_membros
     SET nome = 'Bella Martins'
   WHERE salao_id = v_salao AND papel = 'dona';

  -- 2 profissionais (idempotente por e-mail). user_id fica nulo até criarem login.
  INSERT INTO salao_membros (salao_id, nome, email, papel, ativo)
  SELECT v_salao, 'Carol Souza', 'carol.studiobella@exemplo.com', 'profissional', true
  WHERE NOT EXISTS (
    SELECT 1 FROM salao_membros WHERE salao_id = v_salao AND lower(email) = 'carol.studiobella@exemplo.com'
  );
  INSERT INTO salao_membros (salao_id, nome, email, papel, ativo)
  SELECT v_salao, 'Duda Lima', 'duda.studiobella@exemplo.com', 'profissional', true
  WHERE NOT EXISTS (
    SELECT 1 FROM salao_membros WHERE salao_id = v_salao AND lower(email) = 'duda.studiobella@exemplo.com'
  );

  -- Arrays usados na geração dos atendimentos
  SELECT array_agg(id) INTO v_membros
    FROM salao_membros
   WHERE salao_id = v_salao AND ativo AND papel IN ('dona', 'profissional');

  SELECT array_agg(id) INTO v_clientes
    FROM clientes
   WHERE user_id = v_uid AND NOT arquivada;

  -- 3) Histórico existente ganha profissional (agenda por profissional completa)
  UPDATE agendamentos
     SET profissional_id = v_membros[1 + floor(random() * array_length(v_membros, 1))::int]
   WHERE salao_id = v_salao AND profissional_id IS NULL;

  -- 4) Limpa a janela-alvo (reexecução segura) -------------------------------
  DELETE FROM pagamentos
   WHERE agendamento_id IN (
     SELECT id FROM agendamentos
      WHERE salao_id = v_salao AND data BETWEEN DATE '2026-06-22' AND DATE '2026-09-03'
   );
  DELETE FROM agendamentos
   WHERE salao_id = v_salao AND data BETWEEN DATE '2026-06-22' AND DATE '2026-09-03';

  -- 5) Agenda cheia (seg–sáb, 4–6 atendimentos/dia) --------------------------
  INSERT INTO agendamentos
    (user_id, salao_id, cliente_id, profissional_id, data, horario, servico, valor, status, created_at)
  SELECT
    v_uid,
    v_salao,
    v_clientes[1 + floor(random() * array_length(v_clientes, 1))::int],
    v_membros[1 + floor(random() * array_length(v_membros, 1))::int],
    d.data,
    (ARRAY['09:00','10:30','13:00','14:30','16:00','17:30'])[s]::time,
    serv.nome,
    serv.valor,
    CASE
      WHEN random() < 0.10 THEN 'cancelado'
      WHEN random() < 0.45 THEN 'pendente'
      ELSE 'confirmado'
    END,
    now()
  FROM (
    SELECT g::date AS data
      FROM generate_series(DATE '2026-06-22', DATE '2026-09-03', INTERVAL '1 day') g
     WHERE extract(dow FROM g) BETWEEN 1 AND 6           -- segunda a sábado
  ) d
  CROSS JOIN LATERAL generate_series(1, 4 + floor(random() * 3)::int) s   -- 4 a 6 horários
  CROSS JOIN LATERAL (
    SELECT nome, valor FROM (VALUES
      ('Manutenção', 70),  ('Alongamento gel', 150), ('Fibra de vidro', 160),
      ('Pedicure', 50),    ('Manicure', 45),         ('Gel francês', 90),
      ('Esmaltação', 40),  ('Nail art', 110),        ('Baby boomer', 130),
      ('Encapsulamento', 140)
    ) v(nome, valor) ORDER BY random() LIMIT 1
  ) serv;

  -- 6) Pagamentos dos novos atendimentos (cancelados não geram pagamento) -----
  INSERT INTO pagamentos (user_id, salao_id, agendamento_id, valor, status, forma, data, created_at)
  SELECT
    v_uid, v_salao, a.id, a.valor,
    CASE WHEN a.status = 'confirmado' AND random() < 0.30 THEN 'pago' ELSE 'pendente' END,
    (ARRAY['pix','pix','pix','dinheiro','cartao_debito','cartao_credito'])[1 + floor(random() * 6)::int],
    a.data,
    now()
  FROM agendamentos a
  WHERE a.salao_id = v_salao
    AND a.data BETWEEN DATE '2026-06-22' AND DATE '2026-09-03'
    AND a.status IN ('confirmado', 'pendente');

  -- 7) Metas futuras: meses jul/ago/set + 2 semanais -------------------------
  DELETE FROM metas
   WHERE user_id = v_uid
     AND ( (tipo = 'mes'    AND periodo IN ('2026-07','2026-08','2026-09'))
        OR (tipo = 'semana' AND periodo IN ('2026-06-08','2026-06-15')) );
  INSERT INTO metas (user_id, salao_id, tipo, periodo, valor_meta) VALUES
    (v_uid, v_salao, 'mes',    '2026-07',    5500),
    (v_uid, v_salao, 'mes',    '2026-08',    6000),
    (v_uid, v_salao, 'mes',    '2026-09',    6500),
    (v_uid, v_salao, 'semana', '2026-06-08', 1400),
    (v_uid, v_salao, 'semana', '2026-06-15', 1500);

  -- 8) Despesas jun–ago (recorrentes + avulsas) ------------------------------
  DELETE FROM despesas
   WHERE user_id = v_uid AND observacoes = 'Lançamento de demonstração';
  INSERT INTO despesas
    (user_id, salao_id, descricao, categoria, valor, data, forma_pagamento, recorrente, observacoes)
  SELECT
    v_uid, v_salao, t.descricao, t.categoria, t.valor,
    make_date(2026, mo, t.dia), t.forma, t.recorrente, 'Lançamento de demonstração'
  FROM generate_series(6, 8) mo
  CROSS JOIN (VALUES
    ('Aluguel do espaço',              'aluguel',    900, 5,  'pix',      true),
    ('Conta de luz',                   'luz',        195, 10, 'debito',   true),
    ('Conta de água',                  'agua',        68, 10, 'debito',   true),
    ('Internet fibra',                 'internet',   120, 15, 'debito',   true),
    ('Conta de telefone',              'telefone',    45, 22, 'debito',   true),
    ('Salário Carol',                  'salario',   1300, 5,  'pix',      true),
    ('Esmaltes e gel (reposição)',     'produtos',   320, 8,  'credito',  false),
    ('Lixas, algodão e descartáveis',  'materiais',   85, 18, 'dinheiro', false),
    ('Anúncios Instagram',             'marketing',  150, 20, 'credito',  false)
  ) t(descricao, categoria, valor, dia, forma, recorrente);

  -- 9) Ciclo de retorno individual em ~8 clientes ----------------------------
  UPDATE clientes
     SET dias_retorno = (ARRAY[21,28,30,45])[1 + floor(random() * 4)::int]
   WHERE id IN (
     SELECT id FROM clientes
      WHERE user_id = v_uid AND NOT arquivada
      ORDER BY random() LIMIT 8
   );

  RAISE NOTICE 'Base de demonstração atualizada com sucesso.';
END $$;
