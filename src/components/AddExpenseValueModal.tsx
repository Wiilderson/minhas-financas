import { useEffect, useState, type FormEvent } from 'react'
import type { Transaction } from '../types'
import { appendValueToFormula, formatNumberForFormula } from '../lib/formula'
import { formatCurrency, parseCurrencyInput } from '../lib/format'

interface AddExpenseValueModalProps {
  isOpen: boolean
  transaction: Transaction | null
  isSaving: boolean
  onClose: () => void
  onLoadFormula: (tx: Transaction) => Promise<string>
  onSubmit: (tx: Transaction, amount: number) => Promise<void>
}

export function AddExpenseValueModal({
  isOpen,
  transaction,
  isSaving,
  onClose,
  onLoadFormula,
  onSubmit,
}: AddExpenseValueModalProps) {
  const [valor, setValor] = useState('')
  const [currentFormula, setCurrentFormula] = useState('')
  const [isLoadingFormula, setIsLoadingFormula] = useState(false)

  useEffect(() => {
    if (!isOpen || !transaction) {
      setValor('')
      setCurrentFormula('')
      return
    }

    let cancelled = false
    setIsLoadingFormula(true)

    void onLoadFormula(transaction)
      .then((formula) => {
        if (!cancelled) setCurrentFormula(formula)
      })
      .finally(() => {
        if (!cancelled) setIsLoadingFormula(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, transaction, onLoadFormula])

  if (!isOpen || !transaction) return null

  const parsed = parseCurrencyInput(valor)
  const preview =
    parsed > 0 && currentFormula
      ? appendValueToFormula(currentFormula, parsed)
      : parsed > 0
        ? `=${formatNumberForFormula(parsed)}`
        : ''

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (parsed <= 0) return
    await onSubmit(transaction, parsed)
    setValor('')
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Acrescentar valor</h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>

        <form className="modal-form" onSubmit={handleSubmit}>
          <p className="modal-context">
            <strong>{transaction.categoria}</strong>
            <span> · atual: {formatCurrency(transaction.valor)}</span>
          </p>

          {isLoadingFormula ? (
            <p className="formula-preview loading">Carregando fórmula da planilha…</p>
          ) : currentFormula ? (
            <div className="formula-preview">
              <span className="formula-label">Fórmula atual</span>
              <code>{currentFormula}</code>
            </div>
          ) : null}

          <label>
            Valor a somar (R$)
            <input
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="Ex: 9,90"
              required
              autoFocus
            />
          </label>

          {preview && (
            <div className="formula-preview formula-preview-next">
              <span className="formula-label">Nova fórmula na planilha</span>
              <code>{preview}</code>
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={isSaving || parsed <= 0}>
            {isSaving ? 'Salvando…' : 'Acrescentar à despesa'}
          </button>
        </form>
      </div>
    </div>
  )
}
