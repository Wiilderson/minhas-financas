export function getClientId(): string {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
}

export function getDefaultSpreadsheetId(): string {
  return import.meta.env.VITE_SPREADSHEET_ID ?? ''
}

export function getDefaultSheetTabName(): string {
  return import.meta.env.VITE_SHEET_TAB_NAME ?? ''
}

export const SCOPES = 'https://www.googleapis.com/auth/spreadsheets'

/** Layout da planilha atual: A=categoria, B=valor, C=pago, D=observação */
export const LEGACY_COLUMNS = {
  categoria: 'A',
  valor: 'B',
  pago: 'C',
  observacao: 'D',
} as const
