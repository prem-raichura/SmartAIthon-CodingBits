import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { request, UNAUTHORIZED_EVENT } from './api'
import { TOKEN_KEY, USER_KEY } from '../config/api'

export interface User {
  id: string
  name: string
  email: string
  username: string
  role: 'officer' | 'admin'
  police_station: string
  avatar_url: string | null
  number: string
  push_token: string | null
  is_active: boolean
  created_at: string
}

interface AuthState {
  token: string | null
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  updateUser: (patch: Partial<User>) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken]   = useState<string | null>(null)
  const [user, setUser]     = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const t = localStorage.getItem(TOKEN_KEY)
      const u = localStorage.getItem(USER_KEY)
      // Older builds could persist the literal string "undefined"; treat any
      // non-token value as no session rather than half-authenticating.
      if (t && u && t !== 'undefined' && u !== 'undefined') {
        setToken(t)
        setUser(JSON.parse(u) as User)
      } else if (t || u) {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const data = await request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: { username, password },
    })
    // Guard against a malformed response: storing `undefined` used to write the
    // literal string "undefined" and lock the user out of every route.
    if (!data?.token || typeof data.token !== 'string' || !data.user) {
      throw new Error('Login failed: the server did not return a session token.')
    }
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
    setToken(data.token)
    setUser(data.user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  // Any 401 from the API drops the session so the user is sent back to /login
  // instead of staring at a page that silently fails to load.
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, logout)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout)
  }, [logout])

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev
      const updated = { ...prev, ...patch }
      localStorage.setItem(USER_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
