const SPREADSHEET_KEY = 'financas_spreadsheet_id'
const SHEET_TAB_KEY = 'financas_sheet_tab'

export function loadSpreadsheetId(): string {
  return localStorage.getItem(SPREADSHEET_KEY) ?? ''
}

export function saveSpreadsheetId(id: string): void {
  localStorage.setItem(SPREADSHEET_KEY, id.trim())
}

export function loadSheetTabName(): string {
  return localStorage.getItem(SHEET_TAB_KEY) ?? ''
}

export function saveSheetTabName(name: string): void {
  localStorage.setItem(SHEET_TAB_KEY, name.trim())
}

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim()
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return match ? match[1] : trimmed
}
