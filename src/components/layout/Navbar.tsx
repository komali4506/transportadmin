import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Bell, Settings, Menu, Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useDashboardStore } from '@/store/useStore'
import { useProfileStore } from '@/store/profileStore'
import { useLoadStore } from '@/store/loadStore'
import ProfileAvatar from '../profile/ProfileAvatar'
import ProfileDropdown from '../profile/ProfileDropdown'
import EditProfileModal from '../profile/EditProfileModal'
import LogoutModal from '../profile/LogoutModal'

const Navbar = () => {
  const { toggleSidebar } = useDashboardStore()
  const { profile } = useProfileStore()
  const { connectionMode, isConnecting } = useLoadStore()
  const navigate = useNavigate()

  // Modal & Dropdown visibility states
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false)

  // Default fallback details
  const adminName = profile?.fullName || "Admin User"
  const adminRole = profile?.role || "SUPER ADMIN"
  const adminPhoto = profile?.profilePhoto || ""
  const adminEmail = profile?.email || "admin@biofactor.in"
  const isOnline = profile?.isOnline ?? true

  return (
    <header className="h-16 glass-navbar flex items-center justify-between px-6 sticky top-0 z-40">
      <div className="flex items-center gap-4 w-1/2">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={toggleSidebar}>
          <Menu size={20} />
        </Button>
        <div className="relative w-full max-w-md hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input 
            placeholder="Search loads, vehicles, transporters..." 
            className="pl-10 glass-input text-xs font-medium text-slate-700 placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-primary/30"
          />
        </div>

        {/* Live Backend Connection Indicator */}
        <div className="flex items-center">
          {isConnecting ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50/70 text-blue-600 border border-blue-100/80 shadow-xs animate-pulse">
              <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
              <span>Connecting API...</span>
            </div>
          ) : connectionMode === 'live' ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50/70 text-emerald-700 border border-emerald-100/80 shadow-xs transition-all duration-300 hover:bg-emerald-100">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Wifi className="h-3 w-3 text-emerald-600" />
              <span className="hidden sm:inline">Backend Connected (ngrok)</span>
              <span className="sm:hidden">Backend Connected</span>
            </div>
          ) : (
            <div 
              title="Ngrok backend server is currently offline or unreachable. Running in local simulation mode."
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50/70 text-amber-700 border border-amber-100/80 shadow-xs transition-all duration-300 hover:bg-amber-100 cursor-help"
            >
              <span className="h-2 w-2 rounded-full bg-amber-500"></span>
              <WifiOff className="h-3 w-3 text-amber-600" />
              <span className="hidden sm:inline">Demo Mode (Local Offline)</span>
              <span className="sm:hidden">Demo Mode</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative text-slate-300 hover:text-white transition-colors">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/settings')}
          className="text-slate-300 hover:text-white transition-colors"
        >
          <Settings size={20} />
        </Button>

        <div className="h-8 w-[1px] bg-white/15 mx-2"></div>

        {/* Profile Top Right Corner Section */}
        <div className="relative">
          <Button 
            variant="ghost" 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-3 pl-2 pr-4 py-1 h-auto rounded-full hover:bg-white/5 text-white"
          >
            <ProfileAvatar 
              src={adminPhoto} 
              name={adminName} 
              size="sm" 
              showStatus={true}
              isOnline={isOnline}
            />
            <div className="text-left hidden sm:block">
              <p className="text-sm font-semibold leading-none text-white">{adminName}</p>
              <p className="text-[10px] text-slate-300 mt-1 uppercase font-bold tracking-wider">{adminRole}</p>
            </div>
          </Button>

          {/* Custom Animated Profile Dropdown */}
          <ProfileDropdown 
            isOpen={isDropdownOpen}
            onClose={() => setIsDropdownOpen(false)}
            onEditProfile={() => setIsEditModalOpen(true)}
            onLogout={() => setIsLogoutModalOpen(true)}
            adminProfile={{
              fullName: adminName,
              email: adminEmail,
              role: adminRole,
              profilePhoto: adminPhoto,
              isOnline: isOnline
            }}
          />
        </div>
      </div>

      {/* Edit Profile Modal */}
      <EditProfileModal 
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
      />

      {/* Secure Logout Confirmation Modal */}
      <LogoutModal 
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
      />
    </header>
  )
}

export default Navbar

