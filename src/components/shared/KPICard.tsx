import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface KPICardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend: number
  trendType: 'up' | 'down'
  color: string
}

const KPICard = ({ title, value, icon: Icon, trend, trendType, color }: KPICardProps) => {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-full"
    >
      <Card className="overflow-hidden border-none shadow-sm glass-card glass-card-hover transition-all h-full">
        <CardContent className="p-6">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <p className="text-xs font-bold text-[#8C6239] uppercase tracking-wider">{title}</p>
              <h3 className="text-3xl font-extrabold text-[#4A3525]">{value}</h3>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "flex items-center text-xs font-bold px-1.5 py-0.5 rounded-full",
                  trendType === 'up' ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
                )}>
                  {trendType === 'up' ? <TrendingUp size={12} className="mr-1" /> : <TrendingDown size={12} className="mr-1" />}
                  {trend}%
                </span>
                <span className="text-[10px] text-slate-500 font-medium">vs last month</span>
              </div>
            </div>
            <div className={cn(
              "kpi-icon-wrapper p-4 rounded-2xl flex items-center justify-center text-white shadow-sm",
              color.replace("bg-blue-600", "bg-[#4A3525]")
                   .replace("bg-cyan-500", "bg-[#8C6239]")
                   .replace("bg-gray-500", "bg-[#705541]")
                   .replace("bg-green-600", "bg-[#5C4033]")
            )}>
              <Icon size={24} />
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-[#745325]/10 flex items-center gap-1.5">
            <div className="flex -space-x-1">
               {[1,2,3].map(i => (
                  <div key={i} className="w-5 h-5 rounded-full bg-[#f4efea] border border-[#745325]/20 overflow-hidden">
                     <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${title}${i}`} alt="" />
                  </div>
               ))}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Active trackers</span>
            <div className="ml-auto w-16 h-6 bg-[#f4efea] rounded overflow-hidden">
               {/* Mini sparkline placeholder */}
               <div className={cn(
                 "h-full w-[60%] opacity-35",
                 trendType === 'up' ? "bg-green-600" : "bg-red-600"
               )} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default KPICard
