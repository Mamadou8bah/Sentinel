import { useEffect, useState } from 'react'

/** Highlights the nav section closest to the top of the viewport (below sticky header). */
export function useScrollSpy(sectionIds: readonly string[], offset = 112) {
  const [activeId, setActiveId] = useState(sectionIds[0] ?? '')

  useEffect(() => {
    if (!sectionIds.length) return

    const resolveActive = () => {
      const scrollPosition = window.scrollY + offset
      let current = sectionIds[0]

      for (const id of sectionIds) {
        const element = document.getElementById(id)
        if (element && element.offsetTop <= scrollPosition) {
          current = id
        }
      }

      setActiveId(current)
    }

    resolveActive()
    window.addEventListener('scroll', resolveActive, { passive: true })
    window.addEventListener('resize', resolveActive)

    return () => {
      window.removeEventListener('scroll', resolveActive)
      window.removeEventListener('resize', resolveActive)
    }
  }, [sectionIds, offset])

  return activeId
}
