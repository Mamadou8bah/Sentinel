import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ThemeMode = 'dark' | 'light'

type ThemeContextValue = {
  theme: ThemeMode
  isLight: boolean
  toggleTheme: () => void
  setTheme: (theme: ThemeMode) => void
}

const STORAGE_KEY = 'sentinel-desk-theme'

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* ignore */
  }
  return 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() =>
    typeof window === 'undefined' ? 'dark' : readStoredTheme(),
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  useEffect(() => {
    return () => {
      document.documentElement.setAttribute('data-theme', 'dark')
    }
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      isLight: theme === 'light',
      setTheme: setThemeState,
      toggleTheme: () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')),
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
