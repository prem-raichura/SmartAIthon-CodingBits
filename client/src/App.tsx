import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ThemeProvider } from './hooks/useTheme.tsx'
import { useAuth } from './lib/auth.tsx'
import { PageLoader } from './components/ui/PageLoader'
import { AppShell } from './components/layout/AppShell'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Hotspots from './pages/Hotspots'
import Congestion from './pages/Congestion'
import Analytics from './pages/Analytics'
import FieldReports from './pages/FieldReports'
import OfficerManagement from './pages/OfficerManagement'
import CSVUpload from './pages/CSVUpload'
import Profile from './pages/Profile'
import NotFound from './pages/NotFound'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Toaster
          theme="light"
          position="top-right"
          richColors
          duration={4000}
          closeButton
          toastOptions={{ style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: '14px' } }}
        />
        <Routes>
          {/* Public routes — no shell */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />

          {/* Authenticated routes — wrapped in AppShell + RequireAuth */}
          <Route path="/dashboard"  element={<RequireAuth><AppShell><Dashboard /></AppShell></RequireAuth>} />
          <Route path="/hotspots"   element={<RequireAuth><AppShell><Hotspots /></AppShell></RequireAuth>} />
          <Route path="/congestion" element={<RequireAuth><AppShell><Congestion /></AppShell></RequireAuth>} />
          <Route path="/analytics"  element={<RequireAuth><AppShell><Analytics /></AppShell></RequireAuth>} />
          <Route path="/officers"   element={<RequireAuth><AppShell><OfficerManagement /></AppShell></RequireAuth>} />
          <Route path="/reports"    element={<RequireAuth><AppShell><FieldReports /></AppShell></RequireAuth>} />
          <Route path="/csv-upload" element={<RequireAuth><AppShell><CSVUpload /></AppShell></RequireAuth>} />
          <Route path="/profile"   element={<RequireAuth><AppShell><Profile /></AppShell></RequireAuth>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
