import { useMemo, useState } from 'react'
import { displayCell, responseRecords } from '../lib/response-records'

export type VisualizationMode = 'table' | 'line' | 'bar'

interface ResponseVisualizationProps {
  body: string
  mode: VisualizationMode
}

export function ResponseVisualization({ body, mode }: ResponseVisualizationProps): React.JSX.Element {
  const records = useMemo(() => responseRecords(body), [body])
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null)

  if (!records || !records.rows.length || !records.columns.length) {
    return <div className="response-visual-empty">Table and chart views need a JSON array of objects.</div>
  }

  if (mode === 'table') {
    return (
      <div className="response-visualization">
        <p>
          Showing {Math.min(records.rows.length, 100)} of {records.totalRows} rows
        </p>
        <div className="response-table-scroll">
          <table>
            <thead>
              <tr>
                {records.columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.rows.slice(0, 100).map((row, index) => (
                <tr key={index}>
                  {records.columns.map((column) => (
                    <td key={column} title={displayCell(row[column])}>
                      {displayCell(row[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (!records.numericColumns.length) {
    return <div className="response-visual-empty">This response has no numeric column to plot.</div>
  }

  const column =
    selectedColumn && records.numericColumns.includes(selectedColumn)
      ? selectedColumn
      : records.numericColumns[0]
  const sampled = records.rows.slice(0, mode === 'bar' ? 20 : 80)
  const values = sampled.map((row) => (typeof row[column] === 'number' ? (row[column] as number) : 0))
  const minimum = Math.min(0, ...values)
  const maximum = Math.max(1, ...values)
  const span = Math.max(1, maximum - minimum)
  const heightFor = (value: number): number => ((value - minimum) / span) * 210
  const zeroY = 230 - heightFor(0)

  return (
    <div className="response-visualization">
      <div className="response-chart-controls">
        <label>
          Numeric column
          <select value={column} onChange={(event) => setSelectedColumn(event.target.value)}>
            {records.numericColumns.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <span>
          First {sampled.length} of {records.totalRows} rows
        </span>
      </div>
      <div className="response-chart-scroll">
        <svg
          viewBox="0 0 800 260"
          role="img"
          aria-label={`${mode === 'line' ? 'Line' : 'Bar'} chart of ${column}`}
        >
          <line x1="36" y1={zeroY} x2="780" y2={zeroY} className="chart-axis" />
          <line x1="36" y1="18" x2="36" y2="230" className="chart-axis" />
          {mode === 'line' ? (
            <polyline
              className="chart-line"
              points={values
                .map(
                  (value, index) =>
                    `${36 + (index * 744) / Math.max(1, values.length - 1)},${230 - heightFor(value)}`
                )
                .join(' ')}
            />
          ) : (
            values.map((value, index) => {
              const width = 700 / Math.max(1, values.length)
              const valueY = 230 - heightFor(value)
              const barHeight = Math.max(1, Math.abs(zeroY - valueY))
              return (
                <rect
                  key={index}
                  className="chart-bar"
                  x={46 + index * width}
                  y={Math.min(zeroY, valueY)}
                  width={Math.max(2, width - 6)}
                  height={barHeight}
                >
                  <title>{`${index + 1}: ${value}`}</title>
                </rect>
              )
            })
          )}
        </svg>
      </div>
    </div>
  )
}
