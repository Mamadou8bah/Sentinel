import { useEffect, useMemo, useState } from 'react'

export function usePagination<T>(items: T[], pageSize = 8) {
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [items, pageSize])

  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1)
  const safePage = Math.min(Math.max(1, page), totalPages)

  const slice = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, pageSize, safePage])

  return {
    page: safePage,
    setPage,
    totalPages,
    pageSize,
    total,
    slice,
    from: total === 0 ? 0 : (safePage - 1) * pageSize + 1,
    to: Math.min(safePage * pageSize, total),
  }
}
