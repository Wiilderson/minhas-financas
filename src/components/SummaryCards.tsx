import { formatCurrency } from '../lib/format'
import type { FinanceSummary } from '../types'

interface SummaryCardsProps {
  summary: FinanceSummary
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <section className="summary-grid">
      <article className="summary-card summary-saldo">
        <span className="summary-label">Saldo disponível</span>
        <strong className="summary-value">{formatCurrency(summary.saldo)}</strong>
      </article>
      <article className="summary-card summary-estimativa">
        <span className="summary-label">Gastos estimados no mês</span>
        <strong className="summary-value">{formatCurrency(summary.totalDespesas)}</strong>
      </article>
      <article className="summary-card summary-pagos">
        <span className="summary-label">Já pagos</span>
        <strong className="summary-value">{formatCurrency(summary.totalPago)}</strong>
      </article>
      <article className="summary-card summary-pendente">
        <span className="summary-label">A pagar</span>
        <strong className="summary-value">{formatCurrency(summary.totalPendente)}</strong>
      </article>
    </section>
  )
}
