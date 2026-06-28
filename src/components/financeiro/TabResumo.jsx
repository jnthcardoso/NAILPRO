import { DollarSign, Receipt, Calendar, TrendingUp, TrendingDown, Pencil, ChevronRight } from 'lucide-react'
import { formatBRL } from '../../lib/formatters'
import { s } from '../../pages/Financeiro.styles'

function LinhaDespesaExpansivel({ label, sub, valor, cor, items, aberto, onToggle, categorias = [] }) {
  return (
    <>
      <div style={{ ...s.dreLinha, cursor: 'pointer' }} onClick={onToggle}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <ChevronRight size={13} style={{ transition: 'transform .15s', transform: aberto ? 'rotate(90deg)' : 'none', flexShrink: 0 }} />
          {label}{sub && <span style={{ color: 'var(--text3)', fontSize: 11 }}> {sub}</span>}
        </span>
        <span style={{ ...s.mono, color: cor }}>− {formatBRL(valor)}</span>
      </div>
      {aberto && (
        <div style={s.dreSubLista}>
          {items.length === 0
            ? <div style={{ ...s.dreSubItem, color: 'var(--text3)' }}>nenhum lançamento</div>
            : items.map(d => {
              const c = categorias.find(x => x.id === d.categoria)
              return (
                <div key={d.id} style={s.dreSubItem}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                    {c?.icon || '📦'} {d.descricao}
                  </span>
                  <span style={{ ...s.mono, color: 'var(--text2)', flexShrink: 0 }}>
                    {d.valor_a_preencher ? '—' : formatBRL(d.valor)}
                  </span>
                </div>
              )
            })}
        </div>
      )}
    </>
  )
}

export default function TabResumo({
  ehMesAtual, recebido, qtdPagos, totalDespesasSalao, despesas, pendente, pagamentos,
  lucro, margemLucro, previsao, dreAberto, toggleDre, categoriasTodas,
  salaoAPagar, salaoPagas, salaoPagasArr, salaoAPagarArr, despesasSalaoArr,
  mostraProLabore, proLabore, sobrouPraVoce, despesasPessoalArr, totalDespesasPessoal,
  periodoLabel, abrirProLabore, onVerPendentes,
}) {
  return (
    <div style={s.tabContent}>
      {/* KPIs */}
      <div style={{ ...s.grid4, ...(ehMesAtual ? { gridTemplateColumns: 'repeat(5, 1fr)' } : {}) }} className="fin-resumo-grid">
        <div style={{ ...s.card, borderTop: '3px solid var(--green)' }} className="fin-resumo-card">
          <div style={s.cardLabel} className="fin-card-label"><DollarSign size={11} /> Recebido</div>
          <div style={{ ...s.cardValue, color: 'var(--green)' }} className="fin-card-value">{formatBRL(recebido)}</div>
          <div style={s.cardSub} className="fin-card-sub">{qtdPagos} pagamento{qtdPagos !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ ...s.card, borderTop: '3px solid #B91C1C' }} className="fin-resumo-card">
          <div style={s.cardLabel} className="fin-card-label"><Receipt size={11} /> Despesas do salão</div>
          <div style={{ ...s.cardValue, color: '#B91C1C' }} className="fin-card-value">{formatBRL(totalDespesasSalao)}</div>
          <div style={s.cardSub} className="fin-card-sub">{despesas.filter(d => d.tipo !== 'pessoal').length} lançamento{despesas.filter(d => d.tipo !== 'pessoal').length !== 1 ? 's' : ''}</div>
        </div>
        <div
          style={{ ...s.card, borderTop: `3px solid ${pendente > 0 ? 'var(--amber)' : 'var(--border2)'}`, cursor: 'pointer' }}
          className="fin-resumo-card"
          onClick={onVerPendentes}
          title="Ver receitas pendentes"
        >
          <div style={s.cardLabel} className="fin-card-label">⏰ A receber</div>
          <div style={{ ...s.cardValue, color: pendente > 0 ? 'var(--amber)' : 'var(--text3)' }} className="fin-card-value">{formatBRL(pendente)}</div>
          <div style={s.cardSub} className="fin-card-sub">{pagamentos.filter(p => p.status === 'pendente').length} pendente{pagamentos.filter(p => p.status === 'pendente').length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ ...s.card, borderTop: `3px solid ${lucro >= 0 ? 'var(--gold, #D4AF37)' : '#B91C1C'}`, background: lucro >= 0 ? 'linear-gradient(135deg, #FEFCE8, var(--surface))' : 'linear-gradient(135deg, #FEF2F2, var(--surface))' }} className="fin-resumo-card">
          <div style={s.cardLabel} className="fin-card-label">{lucro >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />} Lucro líquido</div>
          <div style={{ ...s.cardValue, color: lucro >= 0 ? 'var(--gold, #B7791F)' : '#B91C1C' }} className="fin-card-value">{formatBRL(lucro)}</div>
          <div style={s.cardSub} className="fin-card-sub">{margemLucro.toFixed(0)}% de margem</div>
        </div>
        {ehMesAtual && (
          <div style={{ ...s.card, borderTop: '3px solid var(--pink)' }} className="fin-resumo-card">
            <div style={s.cardLabel} className="fin-card-label"><Calendar size={11} /> Previsão de fechamento</div>
            <div style={{ ...s.cardValue, color: 'var(--pink)' }} className="fin-card-value">{formatBRL(recebido + pendente + previsao.entraMes)}</div>
            <div style={s.cardSub} className="fin-card-sub">estimativa do mês</div>
          </div>
        )}
      </div>

      {/* DRE */}
      <div style={s.dreCard}>
        <div style={s.dreTitulo}>📊 DRE — {periodoLabel}</div>
        <div style={s.dreLinha}>
          <span>(+) Receitas recebidas</span>
          <span style={{ ...s.mono, color: 'var(--green)' }}>{formatBRL(recebido)}</span>
        </div>
        {salaoAPagar > 0 ? (
          <>
            <LinhaDespesaExpansivel
              label="(−) Despesas do salão" sub="(já pagas)"
              valor={salaoPagas} cor="#B91C1C" items={salaoPagasArr}
              aberto={!!dreAberto.pagas} onToggle={() => toggleDre('pagas')}
              categorias={categoriasTodas}
            />
            <LinhaDespesaExpansivel
              label="(−) Contas a pagar" sub="(vai sair)"
              valor={salaoAPagar} cor="#B45309" items={salaoAPagarArr}
              aberto={!!dreAberto.apagar} onToggle={() => toggleDre('apagar')}
              categorias={categoriasTodas}
            />
          </>
        ) : (
          <LinhaDespesaExpansivel
            label="(−) Despesas do salão"
            valor={totalDespesasSalao} cor="#B91C1C" items={despesasSalaoArr}
            aberto={!!dreAberto.salao} onToggle={() => toggleDre('salao')}
            categorias={categoriasTodas}
          />
        )}

        {mostraProLabore && (
          proLabore > 0 ? (
            <div style={s.dreLinha}>
              <span>
                (−) Seu salário <span style={{ color: 'var(--text3)', fontSize: 11 }}>(pró-labore)</span>
                <button onClick={abrirProLabore} style={s.proLaboreEdit} title="Editar seu salário"><Pencil size={11} /></button>
              </span>
              <span style={{ ...s.mono, color: '#7C3AED' }}>− {formatBRL(proLabore)}</span>
            </div>
          ) : (
            <div style={s.dreLinha}>
              <span>(−) Seu salário <span style={{ color: 'var(--text3)', fontSize: 11 }}>(pró-labore)</span></span>
              <button onClick={abrirProLabore} style={s.proLaboreLink}>+ definir</button>
            </div>
          )
        )}

        <div style={s.dreDivider} />
        <div style={{ ...s.dreLinha, ...s.dreTotal }}>
          <span>(=) Lucro líquido</span>
          <span style={{ ...s.mono, color: lucro >= 0 ? 'var(--green)' : '#B91C1C', fontSize: 16 }}>{formatBRL(lucro)}</span>
        </div>
        {recebido > 0 && (
          <div style={s.dreMargem}>
            Margem de lucro: <strong>{margemLucro.toFixed(1)}%</strong>
            {margemLucro >= 30 && ' 🎉 Excelente!'}
            {margemLucro >= 15 && margemLucro < 30 && ' 👍 Saudável'}
            {margemLucro >= 0 && margemLucro < 15 && ' ⚠️ Atenção'}
            {margemLucro < 0 && ' 🚨 Prejuízo'}
          </div>
        )}

        {mostraProLabore && totalDespesasPessoal > 0 && (
          <>
            <div style={s.dreDivider} />
            <LinhaDespesaExpansivel
              label="👤 Gastos pessoais" sub="(seu bolso)"
              valor={totalDespesasPessoal} cor="#7C3AED" items={despesasPessoalArr}
              aberto={!!dreAberto.pessoal} onToggle={() => toggleDre('pessoal')}
              categorias={categoriasTodas}
            />
            {proLabore > 0
              ? <div style={s.dreMargem}>
                  {sobrouPraVoce >= 0
                    ? <>Do seu salário de {formatBRL(proLabore)}, sobrou <strong>{formatBRL(sobrouPraVoce)}</strong> pra você 💜</>
                    : <>🚨 Você gastou <strong>{formatBRL(-sobrouPraVoce)}</strong> a mais do que tirou de salário</>}
                </div>
              : <div style={s.dreMargem}>Defina seu salário acima pra saber se seus gastos pessoais cabem no que você tira. 💡</div>}
          </>
        )}
      </div>
    </div>
  )
}
