/** Formata número para fórmula em planilha BR (vírgula decimal) */
export function formatNumberForFormula(value: number): string {
  return value.toFixed(2).replace('.', ',')
}

/**
 * Acrescenta um valor à célula da planilha, preservando fórmulas somadas.
 * Ex: "=(24,95 + 10,91)" + 5,5 → "=(24,95 + 10,91 + 5,5)"
 */
export function appendValueToFormula(currentRaw: string, amount: number): string {
  const add = formatNumberForFormula(amount)
  const trimmed = currentRaw.trim()

  if (!trimmed) {
    return `=${add}`
  }

  if (trimmed.startsWith('=')) {
    const body = trimmed.slice(1).trim()
    if (body.startsWith('(') && body.endsWith(')')) {
      const inner = body.slice(1, -1).trim()
      return `=(${inner} + ${add})`
    }
    return `=${body} + ${add}`
  }

  return `=(${trimmed} + ${add})`
}
