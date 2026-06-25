export type TransactionType = 'entrada' | 'despesa'

export interface Transaction {
  id: string
  rowIndex: number
  data: string
  tipo: TransactionType
  categoria: string
  valor: number
  pago: boolean
  observacao: string
}

export interface FinanceSummary {
  totalEntradas: number
  totalDespesas: number
  totalPago: number
  totalPendente: number
  saldo: number
}

export interface SheetConfig {
  spreadsheetId: string
}
