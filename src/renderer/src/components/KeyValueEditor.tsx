import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { createKeyValue, type KeyValue } from '../../../shared/domain'

interface KeyValueEditorProps {
  rows: KeyValue[]
  onChange: (rows: KeyValue[]) => void
  secretValues?: boolean
  keyPlaceholder?: string
  valuePlaceholder?: string
}

export function KeyValueEditor({
  rows,
  onChange,
  secretValues = false,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value'
}: KeyValueEditorProps): React.JSX.Element {
  const update = (id: string, patch: Partial<KeyValue>): void => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  return (
    <div className="kv-editor">
      <div className="kv-heading">
        <span>Enabled</span>
        <span>{keyPlaceholder}</span>
        <span>{valuePlaceholder}</span>
        <span />
      </div>
      {rows.length === 0 && <div className="empty-inline">No values yet. Add one below.</div>}
      {rows.map((row) => (
        <div className="kv-row" key={row.id}>
          <input
            type="checkbox"
            checked={row.enabled}
            onChange={(event) => update(row.id, { enabled: event.target.checked })}
          />
          <input
            value={row.key}
            onChange={(event) => update(row.id, { key: event.target.value })}
            placeholder={keyPlaceholder}
          />
          <div className="secret-input">
            <input
              type={secretValues && row.secret !== false ? 'password' : 'text'}
              value={row.value}
              onChange={(event) => update(row.id, { value: event.target.value })}
              placeholder={valuePlaceholder}
            />
            {secretValues && (
              <button
                className="icon-button"
                onClick={() => update(row.id, { secret: row.secret === false })}
                title="Toggle visibility"
              >
                {row.secret === false ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            )}
          </div>
          <button
            className="icon-button danger"
            onClick={() => onChange(rows.filter((item) => item.id !== row.id))}
            title="Delete row"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button className="add-row" onClick={() => onChange([...rows, createKeyValue()])}>
        <Plus size={14} /> Add value
      </button>
    </div>
  )
}
