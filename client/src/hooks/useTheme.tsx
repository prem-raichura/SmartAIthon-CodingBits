import { createContext, useContext, useEffect } from 'react'
import type { ReactNode } from 'react'

interface ThemeContextValue {
  theme: 'light'
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'light' })

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.remove('dark')
    localStorage.removeItem('tl-theme')
  }, [])
  return (
    <ThemeContext.Provider value={{ theme: 'light' }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}
