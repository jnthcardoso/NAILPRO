import { supabase } from './supabase'
import { format } from 'date-fns'

/**
 * Exporta TODOS os dados do usuário em um arquivo XLSX com múltiplas abas.
 * Atende ao direito de portabilidade (LGPD Art. 18, IV).
 */
export async function exportarTodosDados(user) {
  const XLSX = await import('xlsx')

  // Busca todos os dados em paralelo
  const [
    { data: configuracoes },
    { data: clientes },
    { data: agendamentos },
    { data: pagamentos },
    { data: metas },
    { data: assinatura },
  ] = await Promise.all([
    supabase.from('configuracoes').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('clientes').select('*').order('nome'),
    supabase.from('agendamentos').select('*, clientes(nome)').order('data', { ascending: false }),
    supabase.from('pagamentos').select('*, agendamentos(servico, clientes(nome))').order('data', { ascending: false }),
    supabase.from('metas').select('*').order('created_at', { ascending: false }),
    supabase.from('assinaturas').select('*').eq('user_id', user.id).maybeSingle(),
  ])

  const workbook = XLSX.utils.book_new()

  // ─── Aba 1: Resumo da Conta ───
  const resumoData = [
    { Campo: 'Nome', Valor: user.user_metadata?.full_name || '' },
    { Campo: 'E-mail', Valor: user.email },
    { Campo: 'Cadastrado em', Valor: format(new Date(user.created_at), 'dd/MM/yyyy HH:mm') },
    { Campo: 'Nome do salão', Valor: configuracoes?.nome_salao || '' },
    { Campo: 'WhatsApp', Valor: configuracoes?.whatsapp || '' },
    { Campo: 'Meta mensal', Valor: configuracoes?.meta_mensal || 0 },
    { Campo: 'Total de clientes', Valor: clientes?.length || 0 },
    { Campo: 'Total de agendamentos', Valor: agendamentos?.length || 0 },
    { Campo: 'Total de pagamentos', Valor: pagamentos?.length || 0 },
    { Campo: 'Plano', Valor: assinatura?.plano || '—' },
    { Campo: 'Status assinatura', Valor: assinatura?.status || '—' },
    { Campo: 'Exportado em', Valor: format(new Date(), 'dd/MM/yyyy HH:mm') },
  ]
  const wsResumo = XLSX.utils.json_to_sheet(resumoData)
  wsResumo['!cols'] = [{ wch: 22 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(workbook, wsResumo, 'Resumo')

  // ─── Aba 2: Clientes ───
  const clientesRows = (clientes || []).map(c => ({
    Nome: c.nome,
    WhatsApp: c.telefone || '',
    'E-mail': c.email || '',
    'Data de nascimento': c.data_nascimento ? format(new Date(c.data_nascimento + 'T12:00:00'), 'dd/MM/yyyy') : '',
    'Último atendimento': c.ultimo_atendimento ? format(new Date(c.ultimo_atendimento + 'T12:00:00'), 'dd/MM/yyyy') : '',
    'Total visitas': c.total_visitas || 0,
    'Total gasto (R$)': c.total_gasto || 0,
    Observações: c.observacoes || '',
    'Cadastrada em': format(new Date(c.created_at), 'dd/MM/yyyy'),
  }))
  const wsClientes = XLSX.utils.json_to_sheet(clientesRows.length ? clientesRows : [{ Nome: '(nenhum cliente cadastrado)' }])
  wsClientes['!cols'] = [{ wch: 28 }, { wch: 15 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 40 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(workbook, wsClientes, 'Clientes')

  // ─── Aba 3: Agendamentos ───
  const agendamentosRows = (agendamentos || []).map(a => ({
    Data: a.data ? format(new Date(a.data + 'T12:00:00'), 'dd/MM/yyyy') : '',
    Horário: a.horario?.slice(0, 5) || '',
    Cliente: a.clientes?.nome || '',
    Serviço: a.servico || '',
    'Valor (R$)': a.valor || 0,
    Status: a.status,
    Observações: a.observacoes || '',
    'Criado em': format(new Date(a.created_at), 'dd/MM/yyyy HH:mm'),
  }))
  const wsAgendamentos = XLSX.utils.json_to_sheet(agendamentosRows.length ? agendamentosRows : [{ Data: '(nenhum agendamento)' }])
  wsAgendamentos['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 28 }, { wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 40 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(workbook, wsAgendamentos, 'Agendamentos')

  // ─── Aba 4: Pagamentos ───
  const pagamentosRows = (pagamentos || []).map(p => ({
    Data: p.data ? format(new Date(p.data + 'T12:00:00'), 'dd/MM/yyyy') : '',
    Cliente: p.agendamentos?.clientes?.nome || '—',
    Serviço: p.agendamentos?.servico || '—',
    'Valor (R$)': p.valor || 0,
    Forma: { pix: 'Pix', dinheiro: 'Dinheiro', cartao_debito: 'Débito', cartao_credito: 'Crédito' }[p.forma] || p.forma,
    Status: p.status,
    'Criado em': format(new Date(p.created_at), 'dd/MM/yyyy HH:mm'),
  }))
  const wsPagamentos = XLSX.utils.json_to_sheet(pagamentosRows.length ? pagamentosRows : [{ Data: '(nenhum pagamento)' }])
  wsPagamentos['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(workbook, wsPagamentos, 'Pagamentos')

  // ─── Aba 5: Metas ───
  const metasRows = (metas || []).map(m => ({
    Tipo: m.tipo,
    Período: m.periodo,
    'Valor da meta (R$)': m.valor_meta,
    'Criada em': format(new Date(m.created_at), 'dd/MM/yyyy'),
  }))
  const wsMetas = XLSX.utils.json_to_sheet(metasRows.length ? metasRows : [{ Tipo: '(nenhuma meta cadastrada)' }])
  wsMetas['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 18 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(workbook, wsMetas, 'Metas')

  // ─── Aba 6: Configurações (para auditoria) ───
  if (configuracoes) {
    const cfgRows = Object.entries(configuracoes)
      .filter(([k]) => !['id', 'user_id', 'created_at', 'updated_at'].includes(k))
      .map(([Chave, valor]) => ({
        Chave,
        Valor: typeof valor === 'object' ? JSON.stringify(valor) : (valor ?? ''),
      }))
    const wsCfg = XLSX.utils.json_to_sheet(cfgRows)
    wsCfg['!cols'] = [{ wch: 28 }, { wch: 60 }]
    XLSX.utils.book_append_sheet(workbook, wsCfg, 'Configurações')
  }

  // ─── Gera e baixa o arquivo ───
  const nomeArquivo = `lumen-backup-${configuracoes?.nome_salao?.replace(/[^\w]/g, '-').toLowerCase() || 'meus-dados'}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`
  XLSX.writeFile(workbook, nomeArquivo)
}
