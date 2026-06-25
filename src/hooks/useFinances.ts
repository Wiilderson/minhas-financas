import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FinanceSummary, Transaction, TransactionType } from '../types'
import {
  appendToExpenseValor,
  appendTransaction,
  calculateSummary,
  deleteTransaction,
  fetchSheetTabs,
  fetchTransactions,
  fetchValorCellRaw,
  resolveSheetTabName,
  type SheetLayout,
  updatePaidStatus,
} from '../lib/sheetsApi'
import { saveSheetTabName } from '../lib/storage'
import { debugLog } from '../lib/debug'

type Filter = 'todos' | 'pendentes' | 'pagos'

export function useFinances(
  spreadsheetId: string,
  preferredTab: string,
  enabled: boolean,
) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [availableTabs, setAvailableTabs] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState(preferredTab)
  const [layout, setLayout] = useState<SheetLayout | null>(null)
  const [rawRowCount, setRawRowCount] = useState(0)
  const [filter, setFilter] = useState<Filter>('todos')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const summary: FinanceSummary = useMemo(
    () => calculateSummary(transactions),
    [transactions],
  )

  const filtered = useMemo(() => {
    if (filter === 'pendentes') {
      return transactions.filter((tx) => tx.tipo === 'despesa' && !tx.pago)
    }
    if (filter === 'pagos') {
      return transactions.filter((tx) => tx.tipo === 'despesa' && tx.pago)
    }
    return transactions
  }, [transactions, filter])

  const categories = useMemo(() => {
    const set = new Set(transactions.map((tx) => tx.categoria))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [transactions])

  useEffect(() => {
    setActiveTab(preferredTab)
  }, [preferredTab])

  useEffect(() => {
    if (!spreadsheetId || !enabled) return

    let cancelled = false

    async function bootstrap() {
      try {
        const tabs = await fetchSheetTabs(spreadsheetId)
        if (cancelled) return
        setAvailableTabs(tabs)

        const resolved = await resolveSheetTabName(spreadsheetId, preferredTab)
        if (cancelled) return
        setActiveTab(resolved)
        saveSheetTabName(resolved)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao listar abas')
        }
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [spreadsheetId, enabled, preferredTab])

  const reload = useCallback(async () => {
    if (!spreadsheetId || !enabled) return
    setIsLoading(true)
    setError(null)
    try {
      const tabToLoad = activeTab || preferredTab
      debugLog('Recarregando', { spreadsheetId, tabToLoad, activeTab, preferredTab })

      const result = await fetchTransactions(spreadsheetId, tabToLoad)
      setTransactions(result.transactions)
      setRawRowCount(result.rawRowCount)
      setLayout(result.layout)

      if (result.tab !== activeTab) {
        setActiveTab(result.tab)
        saveSheetTabName(result.tab)
      }

      debugLog('Carregamento concluído', {
        aba: result.tab,
        linhasBrutas: result.rawRowCount,
        itens: result.transactions.length,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar dados'
      debugLog('Erro no carregamento', message)
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [spreadsheetId, enabled, activeTab, preferredTab])

  useEffect(() => {
    void reload()
  }, [reload])

  const selectTab = useCallback((tab: string) => {
    setActiveTab(tab)
    saveSheetTabName(tab)
  }, [])

  const addTransaction = useCallback(
    async (input: {
      tipo: TransactionType
      categoria: string
      valor: number
      pago?: boolean
      observacao?: string
    }) => {
      if (!spreadsheetId || !activeTab) return
      setIsSaving(true)
      setError(null)
      try {
        await appendTransaction(spreadsheetId, activeTab, input)
        await reload()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao salvar')
        throw err
      } finally {
        setIsSaving(false)
      }
    },
    [spreadsheetId, activeTab, reload],
  )

  const fetchExpenseFormula = useCallback(
    async (tx: Transaction) => {
      if (!spreadsheetId || !activeTab || !layout) return ''
      return fetchValorCellRaw(spreadsheetId, activeTab, tx.rowIndex, layout)
    },
    [spreadsheetId, activeTab, layout],
  )

  const appendExpenseValue = useCallback(
    async (tx: Transaction, amount: number) => {
      if (!spreadsheetId || !activeTab || !layout) return
      setIsSaving(true)
      setError(null)
      try {
        await appendToExpenseValor(
          spreadsheetId,
          activeTab,
          tx.rowIndex,
          layout,
          amount,
        )
        await reload()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao atualizar valor')
        throw err
      } finally {
        setIsSaving(false)
      }
    },
    [spreadsheetId, activeTab, layout, reload],
  )

  const togglePaid = useCallback(
    async (tx: Transaction) => {
      if (!spreadsheetId || !activeTab || tx.tipo !== 'despesa') return
      setIsSaving(true)
      setError(null)
      const next = !tx.pago
      setTransactions((prev) =>
        prev.map((item) => (item.id === tx.id ? { ...item, pago: next } : item)),
      )
      try {
        await updatePaidStatus(spreadsheetId, activeTab, tx.rowIndex, next)
      } catch (err) {
        setTransactions((prev) =>
          prev.map((item) => (item.id === tx.id ? { ...item, pago: tx.pago } : item)),
        )
        setError(err instanceof Error ? err.message : 'Erro ao atualizar')
      } finally {
        setIsSaving(false)
      }
    },
    [spreadsheetId, activeTab],
  )

  const removeTransaction = useCallback(
    async (tx: Transaction) => {
      if (!spreadsheetId || !activeTab) return
      setIsSaving(true)
      setError(null)
      try {
        await deleteTransaction(spreadsheetId, activeTab, tx.rowIndex)
        await reload()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao excluir')
      } finally {
        setIsSaving(false)
      }
    },
    [spreadsheetId, activeTab, reload],
  )

  return {
    transactions: filtered,
    allTransactions: transactions,
    summary,
    categories,
    availableTabs,
    activeTab,
    rawRowCount,
    selectTab,
    filter,
    setFilter,
    isLoading,
    isSaving,
    error,
    setError,
    reload,
    addTransaction,
    fetchExpenseFormula,
    appendExpenseValue,
    togglePaid,
    removeTransaction,
  }
}
