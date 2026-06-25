import type { Transaction } from '../types'
import { formatCurrency } from '../lib/format'

interface TransactionListProps {
  transactions: Transaction[]
  isLoading: boolean
  activeTab?: string
  rawRowCount?: number
  onTogglePaid: (tx: Transaction) => void
  onAddValue: (tx: Transaction) => void
  onDelete: (tx: Transaction) => void
}

export function TransactionList({
  transactions,
  isLoading,
  activeTab,
  rawRowCount = 0,
  onTogglePaid,
  onAddValue,
  onDelete,
}: TransactionListProps) {
  if (isLoading) {
    return <div className="empty-state">Carregando lançamentos…</div>
  }

  if (transactions.length === 0) {
    return (
      <div className="empty-state">
        <p>Nenhum item encontrado{activeTab ? ` na aba "${activeTab}"` : ''}.</p>
        <p className="empty-hint">
          O app detecta automaticamente em qual coluna estão <strong>nome</strong>,{' '}
          <strong>valor</strong>, <strong>pago</strong> e <strong>observação</strong>.
          {rawRowCount > 0 ? (
            <>
              {' '}
              A aba tem {rawRowCount} linhas, mas nenhuma bate com esse formato (nome + valor
              preenchido). Abra o <strong>Console</strong> do navegador (F12) para ver o debug.
            </>
          ) : (
            <>
              {' '}
              A API devolveu <strong>0 linhas</strong> — confira se a aba está certa e abra o{' '}
              <strong>Console</strong> (F12) para ver os logs <code>[Finanças]</code>.
            </>
          )}
        </p>
      </div>
    )
  }

  return (
    <section className="items-section">
      <div className="section-header">
        <h2>Seus lançamentos</h2>
        <span className="section-count">{transactions.length} itens</span>
      </div>

      <div className="item-cards-grid">
        {transactions.map((tx) => (
          <article
            key={tx.id}
            className={`item-card ${tx.tipo} ${tx.tipo === 'despesa' ? (tx.pago ? 'paid' : 'unpaid') : ''}`}
          >
            <div className="item-card-top">
              <span className={`type-badge ${tx.tipo}`}>
                {tx.tipo === 'entrada' ? 'Entrada' : 'Despesa'}
              </span>
              {tx.tipo === 'despesa' && (
                <span className={`status-badge ${tx.pago ? 'paid' : 'pending'}`}>
                  {tx.pago ? 'Pago' : 'A pagar'}
                </span>
              )}
            </div>

            <h3 className="item-card-title">{tx.categoria}</h3>
            <p className={`item-card-value ${tx.tipo}`}>
              {tx.tipo === 'despesa' ? '-' : '+'}
              {formatCurrency(tx.valor)}
            </p>

            {tx.observacao && <p className="item-card-note">{tx.observacao}</p>}

            <div className="item-card-actions">
              {tx.tipo === 'despesa' && (
                <>
                  <button
                    type="button"
                    className="btn btn-small btn-add-value"
                    onClick={() => onAddValue(tx)}
                    aria-label={`Acrescentar valor em ${tx.categoria}`}
                    title="Acrescentar valor"
                  >
                    + R$
                  </button>
                  <button
                    type="button"
                    className={`btn btn-small ${tx.pago ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={() => onTogglePaid(tx)}
                  >
                    {tx.pago ? 'Desmarcar pago' : 'Marcar pago'}
                  </button>
                </>
              )}
              <button
                type="button"
                className="btn btn-small btn-ghost"
                onClick={() => onDelete(tx)}
              >
                Excluir
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
