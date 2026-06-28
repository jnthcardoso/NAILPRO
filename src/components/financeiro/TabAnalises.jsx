import { formatBRL } from '../../lib/formatters'
import BarChart, { HBarChart } from '../charts/BarChart'
import DonutChart from '../charts/DonutChart'
import { s } from '../../pages/Financeiro.styles'

export default function TabAnalises({
  recebido, recebidoMesAnterior, totalAtendimentos, ticketMedio, margemLucro,
  totalDespesas, dadosReceita6m, dadosDespesas, dadosFormas, topServicos,
}) {
  return (
    <div style={s.tabContent}>
      <div style={s.kpiGrid}>
        {[
          {
            label: 'Receita recebida',
            valor: formatBRL(recebido),
            sub: recebidoMesAnterior !== null
              ? (recebido >= recebidoMesAnterior
                ? { seta: '▲', cor: '#15803D', txt: `+${formatBRL(recebido - recebidoMesAnterior)} vs mês ant.` }
                : { seta: '▼', cor: '#DC2626', txt: `-${formatBRL(recebidoMesAnterior - recebido)} vs mês ant.` })
              : null,
          },
          {
            label: 'Atendimentos',
            valor: totalAtendimentos,
            sub: null,
          },
          {
            label: 'Ticket médio',
            valor: ticketMedio > 0 ? formatBRL(ticketMedio) : '—',
            sub: null,
          },
          {
            label: 'Margem de lucro',
            valor: recebido > 0 ? `${margemLucro.toFixed(0)}%` : '—',
            sub: recebido > 0
              ? { cor: margemLucro >= 0 ? '#15803D' : '#DC2626', txt: margemLucro >= 0 ? 'positiva' : 'negativa' }
              : null,
          },
        ].map((k, i) => (
          <div key={i} style={s.kpiCard}>
            <div style={s.kpiLabel}>{k.label}</div>
            <div style={s.kpiValor}>{k.valor}</div>
            {k.sub && (
              <div style={{ ...s.kpiSub, color: k.sub.cor }}>
                {k.sub.seta && <span>{k.sub.seta} </span>}{k.sub.txt}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={s.graficosGrid}>
        <div style={s.graficoCard}>
          <div style={s.graficoTitulo}>Receita dos últimos 6 meses</div>
          <BarChart data={dadosReceita6m} cor="#15803D" prefixo="R$ " height={160} />
        </div>

        <div style={s.graficoCard}>
          <div style={s.graficoTitulo}>Despesas por categoria</div>
          {dadosDespesas.length === 0
            ? <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: 30 }}>Sem despesas no período</div>
            : <DonutChart data={dadosDespesas} size={160} centerLabel={formatBRL(totalDespesas)} centerSub="total" />
          }
        </div>

        <div style={s.graficoCard}>
          <div style={s.graficoTitulo}>Como você recebeu</div>
          {dadosFormas.length === 0
            ? <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: 30 }}>Sem dados</div>
            : <DonutChart data={dadosFormas} size={160} centerLabel={formatBRL(recebido)} centerSub="recebido" />
          }
        </div>

        <div style={{ ...s.graficoCard, gridColumn: '1 / -1' }}>
          <div style={s.graficoTitulo}>Top serviços por receita</div>
          <HBarChart data={topServicos} cor="var(--pink)" formatValor={(v) => formatBRL(v)} showQtd />
        </div>
      </div>
    </div>
  )
}
