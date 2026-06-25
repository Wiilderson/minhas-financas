import { useCallback, useEffect, useState } from 'react'
import { AddExpenseValueModal } from './components/AddExpenseValueModal'
import { AddTransactionModal } from './components/AddTransactionModal'
import { LoginScreen } from './components/LoginScreen'
import { getInitialSheetTabName, SettingsPanel } from './components/SettingsPanel'
import { SummaryCards } from './components/SummaryCards'
import { TransactionList } from './components/TransactionList'
import { useAuth } from './hooks/useAuth'
import { useFinances } from './hooks/useFinances'
import { getDefaultSheetTabName, getDefaultSpreadsheetId } from './lib/config'
import { extractSpreadsheetId, loadSpreadsheetId, saveSpreadsheetId } from './lib/storage'
import type { Transaction, TransactionType } from './types'

function App() {
  const { isAuthenticated, isBootstrapping, isLoading: authLoading, error: authError, login, logout } = useAuth()
  const [spreadsheetId, setSpreadsheetId] = useState(() => {
    const stored = loadSpreadsheetId()
    const envDefault = getDefaultSpreadsheetId()
    return stored || (envDefault ? extractSpreadsheetId(envDefault) : '')
  })
  const [sheetTabName, setSheetTabName] = useState(
    () => getInitialSheetTabName() || getDefaultSheetTabName(),
  )
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<TransactionType>('despesa')
  const [valueModalTx, setValueModalTx] = useState<Transaction | null>(null)

  const finances = useFinances(spreadsheetId, sheetTabName, isAuthenticated)

  const loadExpenseFormula = useCallback(
    (tx: Transaction) => finances.fetchExpenseFormula(tx),
    [finances.fetchExpenseFormula],
  )

  useEffect(() => {
    if (spreadsheetId) saveSpreadsheetId(spreadsheetId)
  }, [spreadsheetId])

  useEffect(() => {
    if (finances.activeTab) setSheetTabName(finances.activeTab)
  }, [finances.activeTab])

  if (isBootstrapping) {
    return <div className="login-screen"><div className="empty-state">Restaurando sessão…</div></div>
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={login} isLoading={authLoading} error={authError} />
  }

  const openModal = (tipo: TransactionType) => {
    setModalType(tipo)
    setModalOpen(true)
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Minhas Finanças</h1>
          <p className="app-subtitle">Sincronizado com Google Sheets</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={logout}>
          Sair
        </button>
      </header>

      <main className="app-main">
        <SettingsPanel
          spreadsheetId={spreadsheetId}
          sheetTabName={finances.activeTab || sheetTabName}
          availableTabs={finances.availableTabs}
          onSave={(id) => {
            setSpreadsheetId(id)
            void finances.reload()
          }}
          onTabChange={(tab) => {
            setSheetTabName(tab)
            finances.selectTab(tab)
          }}
        />

        {!spreadsheetId ? (
          <div className="alert alert-warning">
            Configure o ID da sua planilha acima para começar.
          </div>
        ) : (
          <>
            <SummaryCards summary={finances.summary} />

            <div className="action-bar">
              <button type="button" className="btn btn-despesa" onClick={() => openModal('despesa')}>
                + Despesa
              </button>
              <button type="button" className="btn btn-entrada" onClick={() => openModal('entrada')}>
                + Entrada
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void finances.reload()}
                disabled={finances.isLoading}
              >
                Atualizar
              </button>
            </div>

            <div className="filter-bar">
              {(['todos', 'pendentes', 'pagos'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`filter-chip ${finances.filter === item ? 'active' : ''}`}
                  onClick={() => finances.setFilter(item)}
                >
                  {item === 'todos' ? 'Todos' : item === 'pendentes' ? 'A pagar' : 'Pagos'}
                </button>
              ))}
            </div>

            {(authError || finances.error) && (
              <div className="alert alert-error">{finances.error ?? authError}</div>
            )}

            <TransactionList
              transactions={finances.transactions}
              isLoading={finances.isLoading}
              activeTab={finances.activeTab}
              rawRowCount={finances.rawRowCount}
              onTogglePaid={finances.togglePaid}
              onAddValue={setValueModalTx}
              onDelete={(tx) => {
                if (confirm(`Excluir "${tx.categoria}"?`)) {
                  void finances.removeTransaction(tx)
                }
              }}
            />
          </>
        )}
      </main>

      <AddTransactionModal
        isOpen={modalOpen}
        categories={finances.categories}
        defaultType={modalType}
        isSaving={finances.isSaving}
        onClose={() => setModalOpen(false)}
        onSubmit={finances.addTransaction}
      />

      <AddExpenseValueModal
        isOpen={!!valueModalTx}
        transaction={valueModalTx}
        isSaving={finances.isSaving}
        onClose={() => setValueModalTx(null)}
        onLoadFormula={loadExpenseFormula}
        onSubmit={finances.appendExpenseValue}
      />
    </div>
  )
}

export default App
