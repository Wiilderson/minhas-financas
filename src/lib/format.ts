export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function parseCurrencyInput(input: string): number {
  const normalized = input.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
  const num = Number(normalized)
  return Number.isFinite(num) ? num : 0
}
