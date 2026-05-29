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
  FileText,
  Code2
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
  const { isSidebarCollapsed, toggleSidebar } = useDashboardStore()
  const { profile } = useProfileStore()
  const location = useLocation()

  return (
    <aside 
      className={cn(
        "glass-sidebar text-slate-200 h-screen transition-all duration-300 ease-in-out flex flex-col relative",
        isSidebarCollapsed ? "w-20" : "w-64"
      )}
    >
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center font-bold text-white text-xl">
          B
        </div>
        {!isSidebarCollapsed && (
          <span className="font-bold text-xl tracking-tight text-white whitespace-nowrap">Biofactor Admin</span>
        )}
      </div>

      <button 
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 bg-primary text-white rounded-full p-1 shadow-lg border-2 border-white z-50"
      >
        {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4">
        {menuItems.map((group, idx) => (
          <div key={idx} className="mb-6">
            {!isSidebarCollapsed && (
              <p className="text-[10px] font-semibold text-slate-400/80 mb-2 px-3 tracking-widest uppercase">
                {group.group}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group relative",
                    location.pathname === item.path 
                      ? "bg-primary/20 text-white border-l-4 border-primary rounded-l-none" 
                      : "hover:bg-white/5 text-slate-400 hover:text-white"
                  )}
                >
                  <item.icon size={20} className={cn(
                    location.pathname === item.path ? "text-primary" : "text-slate-400 group-hover:text-white"
                  )} />
                  {!isSidebarCollapsed && (
                    <span className="text-sm font-medium">{item.name}</span>
                  )}
                  {isSidebarCollapsed && (
                    <div className="absolute left-14 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                      {item.name}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-white/10">
        <div className={cn("flex items-center gap-3", isSidebarCollapsed ? "justify-center" : "")}>
          <ProfileAvatar 
            src={profile?.profilePhoto || ""} 
            name={profile?.fullName || "Admin User"} 
            size="sm" 
            showStatus={true} 
            isOnline={profile?.isOnline ?? true} 
          />
          {!isSidebarCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-white truncate">{profile?.fullName || "Admin User"}</span>
              <span className="text-[10px] text-slate-400 truncate uppercase font-bold tracking-wider">{profile?.role || "SUPER ADMIN"}</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
