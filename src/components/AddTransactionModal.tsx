import { useEffect, useState, type FormEvent } from 'react'
import type { TransactionType } from '../types'
import { parseCurrencyInput } from '../lib/format'

interface AddTransactionModalProps {
  isOpen: boolean
  categories: string[]
  defaultType: TransactionType
  isSaving: boolean
  onClose: () => void
  onSubmit: (data: {
    tipo: TransactionType
    categoria: string
    valor: number
    pago: boolean
    observacao: string
  }) => Promise<void>
}

export function AddTransactionModal({
  isOpen,
  categories,
  defaultType,
  isSaving,
  onClose,
  onSubmit,
}: AddTransactionModalProps) {
  const [tipo, setTipo] = useState<TransactionType>(defaultType)
  const [categoria, setCategoria] = useState('')
  const [valor, setValor] = useState('')
  const [pago, setPago] = useState(false)
  const [observacao, setObservacao] = useState('')

  useEffect(() => {
    if (isOpen) setTipo(defaultType)
  }, [isOpen, defaultType])

  if (!isOpen) return null

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const parsed = parseCurrencyInput(valor)
    if (!categoria.trim() || parsed <= 0) return

    await onSubmit({
      tipo,
      categoria: categoria.trim(),
      valor: parsed,
      pago: tipo === 'despesa' ? pago : true,
      observacao: observacao.trim(),
    })

    setCategoria('')
    setValor('')
    setPago(false)
    setObservacao('')
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Novo lançamento</h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="tipo-toggle">
            <button
              type="button"
              className={tipo === 'despesa' ? 'active despesa' : ''}
              onClick={() => setTipo('despesa')}
            >
              Despesa
            </button>
            <button
              type="button"
              className={tipo === 'entrada' ? 'active entrada' : ''}
              onClick={() => setTipo('entrada')}
            >
              Entrada
            </button>
          </div>

          <label>
            Categoria
            <input
              list="categorias"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Ex: Cartão Baby, Internet…"
              required
            />
            <datalist id="categorias">
              {categories.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </label>

          <label>
            Valor (R$)
            <input
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              required
            />
          </label>

          {tipo === 'despesa' && (
            <label className="checkbox-label">
              <input type="checkbox" checked={pago} onChange={(e) => setPago(e.target.checked)} />
              Já pago
            </label>
          )}

          <label>
            Observação
            <input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Opcional"
            />
          </label>

          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? 'Salvando…' : 'Salvar'}
          </button>
        </form>
      </div>
    </div>
  )
}
