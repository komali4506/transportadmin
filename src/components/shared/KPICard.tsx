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
              <p className="text-sm font-bold text-slate-200 uppercase tracking-wider">{title}</p>
              <h3 className="text-3xl font-extrabold text-white">{value}</h3>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "flex items-center text-xs font-bold px-1.5 py-0.5 rounded-full",
                  trendType === 'up' ? "bg-green-500/20 text-green-300 border border-green-500/30" : "bg-red-500/20 text-red-300 border border-red-500/30"
                )}>
                  {trendType === 'up' ? <TrendingUp size={12} className="mr-1" /> : <TrendingDown size={12} className="mr-1" />}
                  {trend}%
                </span>
                <span className="text-[10px] text-slate-300 font-medium">vs last month</span>
              </div>
            </div>
            <div className={cn(
              "p-4 rounded-2xl flex items-center justify-center text-white",
              color
            )}>
              <Icon size={24} />
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-1.5">
            <div className="flex -space-x-1">
               {[1,2,3].map(i => (
                 <div key={i} className="w-5 h-5 rounded-full bg-slate-800 border-2 border-white/20 overflow-hidden">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${title}${i}`} alt="" />
                 </div>
               ))}
            </div>
            <span className="text-[10px] text-slate-300 font-medium">Active trackers</span>
            <div className="ml-auto w-16 h-6 bg-gray-50 rounded overflow-hidden">
               {/* Mini sparkline placeholder */}
               <div className={cn(
                 "h-full w-[60%] opacity-20",
                 trendType === 'up' ? "bg-green-500" : "bg-red-500"
               )} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default KPICard
