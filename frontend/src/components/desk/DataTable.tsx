import { useMemo, useState, type ReactNode } from 'react'
import { SkeletonRows } from './ui'
import { Icon } from './icons'

export type Column<Row> = {
  key: string
  header: ReactNode
  render: (row: Row) => ReactNode
  align?: 'left' | 'right'
  /** Hide this column below the sm breakpoint. */
  hideOnMobile?: boolean
  /** Client-side sort value. */
  sortValue?: (row: Row) => string | number
  /** Row header cell (usually the name with the link). */
  rowHeader?: boolean
  width?: string
  /** Show a sort button (defaults to true when sortValue is set). */
  sortable?: boolean
}

export type SortState = { key: string; dir: 'asc' | 'desc' } | null

/**
 * Dense data table (after Zender's DataTable): sticky header, aria-sort
 * buttons, right-aligned tabular figures, hideOnMobile, skeleton when loading.
 * Rows are not clickable as a whole; the first cell holds a real link so it
 * can be opened in a new tab and reached by keyboard.
 */
export function DataTable<Row>({
  rows,
  columns,
  rowKey,
  caption,
  loading = false,
  empty,
  sort: controlledSort,
  onSortChange,
  stickyOffset = 0,
}: {
  rows: Row[]
  columns: Column<Row>[]
  rowKey: (row: Row) => string | number
  caption: string
  loading?: boolean
  empty?: ReactNode
  /** Controlled sort (e.g. server-side). When omitted, sorting is client-side. */
  sort?: SortState
  onSortChange?: (sort: SortState) => void
  stickyOffset?: number
}) {
  const [localSort, setLocalSort] = useState<SortState>(null)
  const sort = controlledSort !== undefined ? controlledSort : localSort

  const sorted = useMemo(() => {
    if (controlledSort !== undefined || !sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const x = col.sortValue!(a)
      const y = col.sortValue!(b)
      return (x < y ? -1 : x > y ? 1 : 0) * dir
    })
  }, [rows, columns, sort, controlledSort])

  function toggle(key: string) {
    const next: SortState =
      sort?.key === key ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }
    if (onSortChange) onSortChange(next)
    else setLocalSort(next)
  }

  if (loading && rows.length === 0) return <SkeletonRows label={`Loading ${caption.toLowerCase()}`} />
  if (!loading && rows.length === 0 && empty) return <>{empty}</>

  return (
    <div className="max-sm:overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key
              const sortable = c.sortable ?? Boolean(c.sortValue)
              return (
                <th
                  key={c.key}
                  scope="col"
                  style={{ top: stickyOffset, width: c.width }}
                  aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={[
                    'sticky z-[1] h-9 whitespace-nowrap border-b border-line bg-surface-raised px-4 text-xs font-medium text-content-muted',
                    c.align === 'right' ? 'text-right' : 'text-left',
                    c.hideOnMobile ? 'hidden sm:table-cell' : '',
                  ].join(' ')}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => toggle(c.key)}
                      className={[
                        'inline-flex items-center gap-1 rounded hover:text-content',
                        c.align === 'right' ? 'flex-row-reverse' : '',
                        active ? 'text-content' : '',
                      ].join(' ')}
                    >
                      {c.header}
                      <Icon
                        name={active && sort!.dir === 'asc' ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        className={active ? 'opacity-100' : 'opacity-40'}
                      />
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className={loading ? 'opacity-60' : undefined} aria-busy={loading || undefined}>
          {sorted.map((row) => (
            <tr key={rowKey(row)} className="border-b border-line transition-colors last:border-b-0 hover:bg-surface-raised/60">
              {columns.map((c) => {
                const Cell = c.rowHeader ? 'th' : 'td'
                return (
                  <Cell
                    key={c.key}
                    scope={c.rowHeader ? 'row' : undefined}
                    className={[
                      'h-10 px-4 py-2 align-middle font-normal',
                      c.align === 'right' ? 'text-right tabular-nums' : 'text-left',
                      c.hideOnMobile ? 'hidden sm:table-cell' : '',
                    ].join(' ')}
                  >
                    {c.render(row)}
                  </Cell>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
