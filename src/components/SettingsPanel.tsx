import { useEffect, useState, type FormEvent } from 'react'
import { extractSpreadsheetId, loadSheetTabName, saveSheetTabName } from '../lib/storage'

interface SettingsPanelProps {
  spreadsheetId: string
  sheetTabName: string
  availableTabs: string[]
  onSave: (id: string) => void
  onTabChange: (tab: string) => void
}

export function SettingsPanel({
  spreadsheetId,
  sheetTabName,
  availableTabs,
  onSave,
  onTabChange,
}: SettingsPanelProps) {
  const [value, setValue] = useState(spreadsheetId)
  const [isOpen, setIsOpen] = useState(!spreadsheetId)

  useEffect(() => {
    setValue(spreadsheetId)
  }, [spreadsheetId])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const id = extractSpreadsheetId(value)
    onSave(id)
    setIsOpen(false)
  }

  const handleTabChange = (tab: string) => {
    saveSheetTabName(tab)
    onTabChange(tab)
  }

  return (
    <section className="settings-panel">
      <button type="button" className="settings-toggle" onClick={() => setIsOpen((v) => !v)}>
        {isOpen ? 'Ocultar configurações' : 'Configurar planilha'}
      </button>

      {isOpen && (
        <form onSubmit={handleSubmit} className="settings-form">
          <label>
            ID ou URL da planilha
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Cole o link do Google Sheets"
              required
            />
          </label>

          {availableTabs.length > 0 && (
            <label>
              Aba da planilha
              <select
                value={sheetTabName || availableTabs[0]}
                onChange={(e) => handleTabChange(e.target.value)}
              >
                {availableTabs.map((tab) => (
                  <option key={tab} value={tab}>
                    {tab}
                  </option>
                ))}
              </select>
            </label>
          )}

          <p className="settings-hint">
            O app lê sua planilha atual: coluna <strong>A</strong> categoria,{' '}
            <strong>B</strong> valor, <strong>C</strong> pago, <strong>D</strong> observação.
          </p>
          <button type="submit" className="btn btn-secondary">Salvar planilha</button>
        </form>
      )}

      {!isOpen && sheetTabName && (
        <p className="settings-summary">
          Planilha conectada · aba <strong>{sheetTabName}</strong>
        </p>
      )}
    </section>
  )
}

export function getInitialSheetTabName(): string {
  return loadSheetTabName()
}
