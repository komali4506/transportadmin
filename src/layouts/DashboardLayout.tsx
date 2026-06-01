import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import Navbar from '@/components/layout/Navbar'
import { Toaster } from '@/components/ui/toaster'
import { useAuthStore } from '@/store/authStore'
import { useProfileStore } from '@/store/profileStore'
import { useLoadStore } from '@/store/loadStore'
import { useDashboardStore } from '@/store/useStore'

const DashboardLayout = () => {
  const { isAuthenticated, initializeAuth } = useAuthStore()
  const { fetchProfile } = useProfileStore()
  const fetchLoads = useLoadStore(state => state.fetchLoads)
  const { isSidebarCollapsed, setSidebarCollapsed } = useDashboardStore()
  const navigate = useNavigate()

  useEffect(() => {
    // Initialize Auth Session
    initializeAuth()
    // Fetch Profile details
    fetchProfile()
    // Fetch loads from backend (with automatic local storage fallback)
    fetchLoads()
  }, [initializeAuth, fetchProfile, fetchLoads])

  useEffect(() => {
    // Enforce Route Protection
    if (!isAuthenticated) {
      navigate('/login')
    }
  }, [isAuthenticated, navigate])

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="flex h-screen bg-transparent overflow-hidden relative">
      {/* Mobile Drawer Backdrop */}
      {!isSidebarCollapsed && (
        <div 
          className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
      <Toaster />
    </div>
  )
}

export default DashboardLayout

