import type { FinanceSummary, Transaction, TransactionType } from '../types'
import { debugGroup, debugLog } from './debug'
import { appendValueToFormula } from './formula'
import { ensureAccessToken } from './googleAuth'

const API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

type SheetMeta = {
  title: string
  sheetId: number
}

export type SheetLayout = {
  categoriaCol: number
  valorCol: number
  pagoCol: number
  observacaoCol: number
}

type SheetRow = unknown[]

const DEFAULT_LAYOUT: SheetLayout = {
  categoriaCol: 0,
  valorCol: 1,
  pagoCol: 2,
  observacaoCol: 3,
}

const LAYOUT_CANDIDATES: SheetLayout[] = [
  DEFAULT_LAYOUT,
  { categoriaCol: 1, valorCol: 2, pagoCol: 3, observacaoCol: 4 },
  { categoriaCol: 0, valorCol: 2, pagoCol: 3, observacaoCol: 4 },
]

const layoutCache = new Map<string, SheetLayout>()

function layoutKey(spreadsheetId: string, tab: string): string {
  return `${spreadsheetId}:${tab}`
}

function colToLetter(index: number): string {
  return String.fromCharCode(65 + index)
}

/** Notação A1: abas com espaço/acento precisam de aspas simples */
export function formatA1Range(tab: string, cells: string): string {
  const escaped = tab.replace(/'/g, "''")
  const needsQuotes = /[^a-zA-Z0-9_]/.test(tab)
  const sheetRef = needsQuotes ? `'${escaped}'` : tab
  return `${sheetRef}!${cells}`
}

function normalizeTabName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

async function sheetsFetch(
  spreadsheetId: string,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await ensureAccessToken()
  const response = await fetch(`${API_BASE}/${spreadsheetId}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    debugLog('API erro', { path, status: response.status, body })
    throw new Error(parseApiError(response.status, body))
  }

  return response
}

function parseApiError(status: number, body: string): string {
  try {
    const json = JSON.parse(body) as { error?: { message?: string } }
    return json.error?.message ?? `Erro ${status} na API do Sheets`
  } catch {
    return `Erro ${status} na API do Sheets`
  }
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'number') return String(value)
  return String(value).trim()
}

function parseBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  const normalized = cellToString(value).toUpperCase()
  return normalized === 'TRUE' || normalized === 'VERDADEIRO' || normalized === 'SIM' || normalized === '1'
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  const str = cellToString(value)
  if (!str) return 0

  const cleaned = str.replace(/[R$\s]/gi, '')
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(/[^\d.-]/g, '')

  const num = Number(normalized)
  return Number.isFinite(num) ? num : 0
}

function formatDateBR(date = new Date()): string {
  return date.toLocaleDateString('pt-BR')
}

function isSummaryRow(label: string): boolean {
  const text = label.trim().toLowerCase()
  return (
    text.includes('total') ||
    text.includes('saldo') ||
    text.includes('despesas segundo') ||
    text === 'valor' ||
    text === 'valor (r$)' ||
    text === 'descrição' ||
    text === 'descricao' ||
    text === 'categoria' ||
    text === 'item'
  )
}

function isEntrada(categoria: string): boolean {
  return /sal[aá]rio|receita|entrada/i.test(categoria.trim())
}

function getCell(row: SheetRow, index: number): unknown {
  return row[index]
}

function scoreLayout(rows: SheetRow[], layout: SheetLayout): number {
  let score = 0
  for (const row of rows) {
    const cat = cellToString(getCell(row, layout.categoriaCol))
    const val = parseNumber(getCell(row, layout.valorCol))
    if (cat && val > 0 && !isSummaryRow(cat)) {
      score++
      const pagoCell = getCell(row, layout.pagoCol)
      if (typeof pagoCell === 'boolean') score += 0.5
    }
  }
  return score
}

function detectLayout(rows: SheetRow[]): SheetLayout {
  const maxCol = rows.reduce((max, row) => Math.max(max, row.length - 1), 0)
  const candidates: SheetLayout[] = [...LAYOUT_CANDIDATES]

  // Varre todas as combinações nome+valor (ex.: colunas G, H, I na sua planilha)
  for (let categoriaCol = 0; categoriaCol < maxCol; categoriaCol++) {
    for (let valorCol = categoriaCol + 1; valorCol <= Math.min(categoriaCol + 3, maxCol); valorCol++) {
      candidates.push({
        categoriaCol,
        valorCol,
        pagoCol: valorCol + 1,
        observacaoCol: valorCol + 2,
      })
    }
  }

  let bestLayout = DEFAULT_LAYOUT
  let bestScore = 0

  for (const layout of candidates) {
    const score = scoreLayout(rows, layout)
    if (score > bestScore) {
      bestScore = score
      bestLayout = layout
    }
  }

  debugLog('Detecção de layout', { bestScore, bestLayout })
  return bestLayout
}

function parseRow(
  row: SheetRow,
  rowIndex: number,
  layout: SheetLayout,
): Transaction | null {
  const categoria = cellToString(getCell(row, layout.categoriaCol))
  const valor = getCell(row, layout.valorCol)
  const pago = getCell(row, layout.pagoCol)
  const observacao = cellToString(getCell(row, layout.observacaoCol))

  if (!categoria || isSummaryRow(categoria)) return null

  const val = parseNumber(valor)
  if (val <= 0) return null

  const entrada = isEntrada(categoria)

  return {
    id: `row-${rowIndex}`,
    rowIndex,
    data: formatDateBR(),
    tipo: entrada ? 'entrada' : 'despesa',
    categoria,
    valor: val,
    pago: entrada ? true : parseBool(pago),
    observacao,
  }
}

async function getSpreadsheetSheets(spreadsheetId: string): Promise<SheetMeta[]> {
  const response = await sheetsFetch(spreadsheetId, '')
  const data = (await response.json()) as {
    sheets?: Array<{ properties?: { title?: string; sheetId?: number } }>
  }

  return (data.sheets ?? [])
    .map((sheet) => ({
      title: sheet.properties?.title ?? '',
      sheetId: sheet.properties?.sheetId ?? -1,
    }))
    .filter((sheet) => sheet.title && sheet.sheetId >= 0)
}

async function getSheetMeta(spreadsheetId: string, sheetName: string): Promise<SheetMeta> {
  const sheets = await getSpreadsheetSheets(spreadsheetId)
  const sheet = sheets.find((item) => item.title === sheetName)
  if (!sheet) {
    throw new Error(`Aba "${sheetName}" não encontrada na planilha.`)
  }
  return sheet
}

async function fetchSheetRows(spreadsheetId: string, tab: string): Promise<SheetRow[]> {
  const range = formatA1Range(tab, 'A:Z')
  const path = `/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE&majorDimension=ROWS`

  debugLog('Lendo intervalo', { tab, range, path })

  const response = await sheetsFetch(spreadsheetId, path)
  const data = (await response.json()) as { values?: SheetRow[] }
  const rows = data.values ?? []

  debugLog(`Linhas brutas recebidas: ${rows.length}`)
  if (rows.length > 0) {
    debugLog('Primeiras 8 linhas (bruto)', rows.slice(0, 8))
  }

  return rows
}

function getLayout(spreadsheetId: string, tab: string, rows: SheetRow[]): SheetLayout {
  const key = layoutKey(spreadsheetId, tab)
  const cached = layoutCache.get(key)
  if (cached) return cached

  const layout = detectLayout(rows)
  layoutCache.set(key, layout)
  return layout
}

export function calculateSummary(transactions: Transaction[]): FinanceSummary {
  let totalEntradas = 0
  let totalDespesas = 0
  let totalPago = 0

  for (const tx of transactions) {
    if (tx.tipo === 'entrada') {
      totalEntradas += tx.valor
    } else {
      totalDespesas += tx.valor
      if (tx.pago) totalPago += tx.valor
    }
  }

  return {
    totalEntradas,
    totalDespesas,
    totalPago,
    totalPendente: totalDespesas - totalPago,
    saldo: totalEntradas - totalPago,
  }
}

export async function fetchSheetTabs(spreadsheetId: string): Promise<string[]> {
  const sheets = await getSpreadsheetSheets(spreadsheetId)
  return sheets.map((sheet) => sheet.title)
}

export async function resolveSheetTabName(
  spreadsheetId: string,
  preferred?: string,
): Promise<string> {
  const tabs = await fetchSheetTabs(spreadsheetId)
  debugLog('Abas disponíveis', tabs)

  if (tabs.length === 0) {
    throw new Error('A planilha não possui abas.')
  }

  if (preferred) {
    if (tabs.includes(preferred)) {
      debugLog('Aba selecionada (exata)', preferred)
      return preferred
    }

    const normalizedPreferred = normalizeTabName(preferred)
    const fuzzy = tabs.find((tab) => normalizeTabName(tab) === normalizedPreferred)
    if (fuzzy) {
      debugLog('Aba selecionada (aproximada)', { pedido: preferred, encontrado: fuzzy })
      return fuzzy
    }

    debugLog('Aba pedida não encontrada', { preferred, tabs })
  }

  const withoutLancamentos = tabs.find((tab) => tab !== 'Lancamentos')
  const fallback = withoutLancamentos ?? tabs[0]
  debugLog('Aba fallback', fallback)
  return fallback
}

export async function fetchTransactions(
  spreadsheetId: string,
  sheetTabName: string,
): Promise<{ transactions: Transaction[]; layout: SheetLayout; rawRowCount: number; tab: string }> {
  const tab = await resolveSheetTabName(spreadsheetId, sheetTabName)
  const rows = await fetchSheetRows(spreadsheetId, tab)
  const layout = getLayout(spreadsheetId, tab, rows)

  debugGroup('Parser', () => {
    debugLog('Layout detectado', layout)
    debugLog('Colunas', {
      categoria: colToLetter(layout.categoriaCol),
      valor: colToLetter(layout.valorCol),
      pago: colToLetter(layout.pagoCol),
      observacao: colToLetter(layout.observacaoCol),
    })

    let skipped = 0
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const row = rows[i]
      const cat = cellToString(getCell(row, layout.categoriaCol))
      const val = parseNumber(getCell(row, layout.valorCol))
      const parsed = parseRow(row, i + 1, layout)
      if (!parsed) {
        skipped++
        debugLog(`Linha ${i + 1} ignorada`, { cat, val, row })
      }
    }
    debugLog(`Amostra: ${skipped} linhas ignoradas nas primeiras 15`)
  })

  const transactions = rows
    .map((row, index) => parseRow(row, index + 1, layout))
    .filter((tx): tx is Transaction => tx !== null)
    .reverse()

  debugLog(`Itens parseados: ${transactions.length}`, transactions)

  return { transactions, layout, rawRowCount: rows.length, tab }
}

async function findInsertRow(
  spreadsheetId: string,
  sheetName: string,
  layout: SheetLayout,
): Promise<number> {
  const rows = await fetchSheetRows(spreadsheetId, sheetName)

  let lastDataRow = 0
  for (let i = 0; i < rows.length; i++) {
    const label = cellToString(getCell(rows[i], layout.categoriaCol))
    const value = getCell(rows[i], layout.valorCol)
    if (!label && parseNumber(value) <= 0) continue
    if (label && isSummaryRow(label)) break
    if (parseNumber(value) > 0 || (label && !isSummaryRow(label))) {
      lastDataRow = i + 1
    }
  }

  return lastDataRow + 1
}

function buildSparseRow(layout: SheetLayout, values: Record<number, unknown>): unknown[] {
  const maxCol = Math.max(layout.categoriaCol, layout.valorCol, layout.pagoCol, layout.observacaoCol)
  const row: unknown[] = []
  for (let i = 0; i <= maxCol; i++) {
    row[i] = values[i] ?? ''
  }
  return row
}

export async function appendTransaction(
  spreadsheetId: string,
  sheetTabName: string,
  input: {
    tipo: TransactionType
    categoria: string
    valor: number
    pago?: boolean
    observacao?: string
  },
): Promise<void> {
  const tab = await resolveSheetTabName(spreadsheetId, sheetTabName)
  const sheet = await getSheetMeta(spreadsheetId, tab)
  const rows = await fetchSheetRows(spreadsheetId, tab)
  const layout = getLayout(spreadsheetId, tab, rows)
  const insertRow = await findInsertRow(spreadsheetId, tab, layout)
  const insertIndex = insertRow - 1

  await sheetsFetch(spreadsheetId, ':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          insertDimension: {
            range: {
              sheetId: sheet.sheetId,
              dimension: 'ROWS',
              startIndex: insertIndex,
              endIndex: insertIndex + 1,
            },
          },
        },
      ],
    }),
  })

  const row = buildSparseRow(layout, {
    [layout.categoriaCol]: input.categoria,
    [layout.valorCol]: input.valor,
    [layout.pagoCol]: input.tipo === 'despesa' ? input.pago ?? false : true,
    [layout.observacaoCol]: input.observacao ?? '',
  })

  const startCol = colToLetter(0)
  const endCol = colToLetter(row.length - 1)

  await sheetsFetch(
    spreadsheetId,
    `/values/${encodeURIComponent(formatA1Range(tab, `${startCol}${insertRow}:${endCol}${insertRow}`))}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({ values: [row] }),
    },
  )
}

export async function updatePaidStatus(
  spreadsheetId: string,
  sheetTabName: string,
  rowIndex: number,
  pago: boolean,
): Promise<void> {
  const tab = await resolveSheetTabName(spreadsheetId, sheetTabName)
  const rows = await fetchSheetRows(spreadsheetId, tab)
  const layout = getLayout(spreadsheetId, tab, rows)
  const col = colToLetter(layout.pagoCol)
  const range = formatA1Range(tab, `${col}${rowIndex}`)

  await sheetsFetch(
    spreadsheetId,
    `/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({ values: [[pago]] }),
    },
  )
}

export async function deleteTransaction(
  spreadsheetId: string,
  sheetTabName: string,
  rowIndex: number,
): Promise<void> {
  const tab = await resolveSheetTabName(spreadsheetId, sheetTabName)
  const sheet = await getSheetMeta(spreadsheetId, tab)

  await sheetsFetch(spreadsheetId, ':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheet.sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1,
              endIndex: rowIndex,
            },
          },
        },
      ],
    }),
  })
}

export async function fetchValorCellRaw(
  spreadsheetId: string,
  sheetTabName: string,
  rowIndex: number,
  layout: SheetLayout,
): Promise<string> {
  const tab = await resolveSheetTabName(spreadsheetId, sheetTabName)
  const col = colToLetter(layout.valorCol)
  const range = formatA1Range(tab, `${col}${rowIndex}`)

  const formulaResponse = await sheetsFetch(
    spreadsheetId,
    `/values/${encodeURIComponent(range)}?valueRenderOption=FORMULA`,
  )
  const formulaData = (await formulaResponse.json()) as { values?: string[][] }
  const formula = formulaData.values?.[0]?.[0]

  if (formula !== undefined && formula !== '') {
    return String(formula)
  }

  const valueResponse = await sheetsFetch(
    spreadsheetId,
    `/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`,
  )
  const valueData = (await valueResponse.json()) as { values?: unknown[][] }
  const value = valueData.values?.[0]?.[0]

  return value !== undefined && value !== '' ? String(value) : ''
}

export async function updateValorCell(
  spreadsheetId: string,
  sheetTabName: string,
  rowIndex: number,
  layout: SheetLayout,
  formulaOrValue: string,
): Promise<void> {
  const tab = await resolveSheetTabName(spreadsheetId, sheetTabName)
  const col = colToLetter(layout.valorCol)
  const range = formatA1Range(tab, `${col}${rowIndex}`)

  await sheetsFetch(
    spreadsheetId,
    `/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({ values: [[formulaOrValue]] }),
    },
  )
}

export async function appendToExpenseValor(
  spreadsheetId: string,
  sheetTabName: string,
  rowIndex: number,
  layout: SheetLayout,
  amount: number,
): Promise<void> {
  const current = await fetchValorCellRaw(spreadsheetId, sheetTabName, rowIndex, layout)
  const next = appendValueToFormula(current, amount)
  await updateValorCell(spreadsheetId, sheetTabName, rowIndex, layout, next)
  debugLog('Valor atualizado', { rowIndex, de: current, para: next })
}
