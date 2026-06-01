import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, 
  Truck, 
  ClipboardList, 
  MapPin, 
  CheckCircle2, 
  CreditCard, 
  Users, 
  BarChart3, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  FileText
} from 'lucide-react'
import { useDashboardStore } from '@/store/useStore'
import { useProfileStore } from '@/store/profileStore'
import ProfileAvatar from '../profile/ProfileAvatar'

const menuItems = [
  { group: "DASHBOARD", items: [
    { name: "Overview", icon: LayoutDashboard, path: "/" }
  ]},
  { group: "LOADS", items: [
    { name: "Create Bid", icon: MapPin, path: "/create-load" },
    { name: "Manage Loads", icon: ClipboardList, path: "/loads" }
  ]},
  { group: "FLEET TRACKING", items: [
    { name: "Live Tracking", icon: Truck, path: "/tracking" }
  ]},
  { group: "PAYMENTS", items: [
    { name: "Payments", icon: CreditCard, path: "/payments" }
  ]},
  { group: "USERS", items: [
    { name: "Users", icon: Users, path: "/users" },
    { name: "Bulk Registrations", icon: FileText, path: "/bulk-registrations" }
  ]},
  { group: "REPORTS", items: [
    { name: "Business Reports", icon: BarChart3, path: "/reports" }
  ]},
  { group: "SETTINGS", items: [
    { name: "General Settings", icon: Settings, path: "/settings" }
  ]}
]

const Sidebar = () => {
  const { isSidebarCollapsed, toggleSidebar, setSidebarCollapsed } = useDashboardStore()
  const { profile } = useProfileStore()
  const location = useLocation()

  return (
    <aside 
      className={cn(
        "glass-sidebar text-[#4A3525] h-screen transition-all duration-300 ease-in-out flex flex-col",
        // Desktop Layout: stays inline, scales width
        "lg:translate-x-0 lg:relative lg:flex lg:shadow-none",
        isSidebarCollapsed ? "lg:w-20" : "lg:w-64",
        // Mobile Drawer Layout: slides in/out, overlaps page with z-index overlay
        "fixed left-0 top-0 z-50 h-screen w-64 shadow-2xl",
        isSidebarCollapsed ? "-translate-x-full" : "translate-x-0"
      )}
    >
      <div className="px-5 py-6 flex items-center justify-center border-b border-[#745325]/10 bg-white/40">
        {isSidebarCollapsed ? (
          <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center bg-white border border-[#4A3525]/10 shadow-sm lg:flex hidden">
            <img src="/biofactor_logo.png" alt="Biofactor" className="w-11 h-11 object-contain" />
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center bg-white border border-[#4A3525]/10 shadow-sm">
              <img src="/biofactor_logo.png" alt="Biofactor" className="w-11 h-11 object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-sm tracking-tight text-[#4A3525] leading-none uppercase">Biofactor</span>
              <span className="text-[10px] text-[#8C6239] font-bold tracking-wider uppercase mt-1">Logistics Admin</span>
            </div>
          </div>
        )}
        {/* Mobile Header Logo fallback (when collapsed in mobile it has hidden container above but we want full logo in drawer) */}
        {isSidebarCollapsed && (
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center bg-white border border-[#4A3525]/10 shadow-sm">
              <img src="/biofactor_logo.png" alt="Biofactor" className="w-11 h-11 object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-sm tracking-tight text-[#4A3525] leading-none uppercase">Biofactor</span>
              <span className="text-[10px] text-[#8C6239] font-bold tracking-wider uppercase mt-1">Logistics Admin</span>
            </div>
          </div>
        )}
      </div>

      <button 
        onClick={toggleSidebar}
        className="sidebar-toggle-btn absolute -right-3 top-20 bg-[#4A3525] rounded-full p-1 shadow-lg border-2 border-[#faf8f6] z-50 lg:block hidden cursor-pointer hover:scale-105 active:scale-95 transition-all"
      >
        {isSidebarCollapsed ? (
          <ChevronRight size={14} />
        ) : (
          <ChevronLeft size={14} />
        )}
      </button>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4">
        {menuItems.map((group, idx) => (
          <div key={idx} className="mb-6">
            {/* Desktop header label (hidden on collapsed desktop only) */}
            <p className={cn(
              "text-[10px] font-semibold text-[#8C6239] mb-2 px-3 tracking-widest uppercase",
              isSidebarCollapsed ? "lg:hidden block" : "block"
            )}>
              {group.group}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => {
                    // Auto-collapse sidebar overlay when a menu item is tapped on mobile
                    if (window.innerWidth < 1024) {
                      setSidebarCollapsed(true)
                    }
                  }}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group relative",
                    location.pathname === item.path 
                      ? "bg-[#4A3525]/10 text-[#4A3525] border-l-4 border-[#4A3525] rounded-l-none" 
                      : "hover:bg-[#4A3525]/5 text-slate-600 hover:text-[#4A3525]"
                  )}
                >
                  <item.icon size={20} className={cn(
                    location.pathname === item.path ? "text-[#4A3525]" : "text-slate-500 group-hover:text-[#4A3525]"
                  )} />
                  {/* Text label hides on desktop collapsed only */}
                  <span className={cn(
                    "text-sm font-medium",
                    isSidebarCollapsed ? "lg:hidden block" : "block"
                  )}>{item.name}</span>
                  
                  {isSidebarCollapsed && (
                    <div className="absolute left-14 bg-[#4A3525] text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 lg:block hidden">
                      {item.name}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

    </aside>
  )
}

export default Sidebar
