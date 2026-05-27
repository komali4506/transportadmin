import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Package, 
  TrendingUp, 
  CheckCircle2, 
  Truck, 
  Wallet,
  ArrowRight,
  PlusCircle,
  Clock,
  CircleDollarSign,
  Loader2,
  HelpCircle,
  FolderOpen
} from 'lucide-react'
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import KPICard from '@/components/shared/KPICard'
import { useLoadStore, type Load } from '@/store/loadStore'
import { Link } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'

export default function DashboardHome() {
  const { loads, addLoad } = useLoadStore()
  const navigate = useNavigate()
  const { toast } = useToast()
  
  const [isQuickLoading, setIsQuickLoading] = useState(false)
  const [quickForm, setQuickForm] = useState({
    from: '',
    to: '',
    product: 'General',
    quantity: '',
    rate: '',
    date: ''
  })

  // Dynamic KPI Card Summaries
  const stats = useMemo(() => {
    const total = loads.length;
    const open = loads.filter(l => l.status === 'Open').length;
    const assigned = loads.filter(l => l.status === 'Assigned & Dispatched' || l.status === 'CLOSED').length;
    const completed = loads.filter(l => l.status === 'Completed').length;
    const revenue = loads.reduce((sum, l) => {
      if (l.status === 'Completed' || l.status === 'Assigned & Dispatched' || l.status === 'CLOSED') {
        const approvedBid = l.bids?.find(b => b.status === 'ACCEPTED' || b.status === 'Approved' || b.status === 'Selected');
        return sum + (approvedBid ? (approvedBid.bidAmount * (l.tonnes || 1)) : (l.totalFreight || 0));
      }
      return sum;
    }, 0);
    const activeVehicles = assigned;
    return { total, open, assigned, completed, revenue, activeVehicles };
  }, [loads]);

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickForm.from || !quickForm.to || !quickForm.quantity || !quickForm.rate || !quickForm.date) {
      toast({ title: 'Validation Error', description: 'Please fill all quick form fields', variant: 'destructive' });
      return;
    }
    
    setIsQuickLoading(true);
    setTimeout(() => {
      setIsQuickLoading(false);
      
      const tonnes = parseFloat(quickForm.quantity);
      const ratePerTonne = parseFloat(quickForm.rate);
      const totalFreight = tonnes * ratePerTonne;
      
      addLoad({
        id: `LD-${Math.floor(1000 + Math.random() * 9000)}`,
        bidId: `BF-BID-2026-${Math.floor(100 + Math.random() * 900)}`,
        from: quickForm.from,
        stops: [],
        to: quickForm.to,
        product: 'General',
        tonnes: tonnes,
        ratePerTonne: ratePerTonne,
        totalFreight: totalFreight,
        dispatchDate: quickForm.date,
        status: 'Open',
        createdAt: Date.now()
      });
      
      toast({ 
        title: "Success", 
        description: "Quick load published successfully.", 
        className: "bg-green-600 text-white border-none" 
      });
      
      setQuickForm({ from: '', to: '', product: 'General', quantity: '', rate: '', date: '' });
      navigate('/loads');
    }, 1000);
  };

  // Fully dynamic Pie Chart data based on actual loaded store state
  const pieData = useMemo(() => {
    const totalCount = loads.length || 1;
    return [
      { name: 'Open Loads', value: Math.round((stats.open / totalCount) * 100) || 0, color: '#10B981' }, 
      { name: 'Assigned Loads', value: Math.round((stats.assigned / totalCount) * 100) || 0, color: '#2563EB' }, 
      { name: 'Completed', value: Math.round((stats.completed / totalCount) * 100) || 0, color: '#9CA3AF' }, 
    ].filter(p => p.value > 0);
  }, [loads, stats]);

  // Dynamic dispatch versus revenue weekly bar chart based on actual loaded stores
  const barData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const sequence = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    const dayMap: Record<string, { loads: number; revenue: number }> = {
      'Mon': { loads: 0, revenue: 0 },
      'Tue': { loads: 0, revenue: 0 },
      'Wed': { loads: 0, revenue: 0 },
      'Thu': { loads: 0, revenue: 0 },
      'Fri': { loads: 0, revenue: 0 },
      'Sat': { loads: 0, revenue: 0 },
      'Sun': { loads: 0, revenue: 0 },
    };

    loads.forEach((load) => {
      // Group by creation date (createdAt) to show the day the load was posted
      // fallback to dispatchDate if createdAt is missing or invalid
      let date = new Date(load.createdAt || load.dispatchDate);
      if (isNaN(date.getTime()) && load.dispatchDate) {
        date = new Date(load.dispatchDate);
      }
      if (isNaN(date.getTime())) return;
      const dayName = days[date.getDay()];
      if (dayMap[dayName]) {
        dayMap[dayName].loads += 1;
        dayMap[dayName].revenue += Math.round((load.totalFreight || 0) / 1000); // Expressed in ₹K as the chart legend specifies
      }
    });

    return sequence.map(name => ({
      name,
      loads: dayMap[name].loads,
      revenue: dayMap[name].revenue
    }));
  }, [loads]);

  const formatRevenue = (value: number) => {
    if (value >= 100000) {
      return `₹ ${(value / 100000).toFixed(1)}L`;
    }
    return `₹ ${value.toLocaleString('en-IN')}`;
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Logistics Control Center</h1>
          <p className="text-gray-500 mt-1 font-medium">Real-time overview of your loads, dispatches, and enterprise revenue.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/create-load">
            <Button className="bg-green-600 hover:bg-green-700 text-white gap-2 shadow-md">
              <PlusCircle size={18} /> Create New Load
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard 
          title="Total Loads" 
          value={stats.total} 
          icon={Package} 
          trend={8} 
          trendType="up" 
          color="bg-blue-600" 
        />
        <KPICard 
          title="Open Loads" 
          value={stats.open} 
          icon={FolderOpen} 
          trend={5} 
          trendType="up" 
          color="bg-cyan-500" 
        />
        <KPICard 
          title="Assigned Loads" 
          value={stats.assigned} 
          icon={Truck} 
          trend={4} 
          trendType="up" 
          color="bg-blue-600" 
        />
        <KPICard 
          title="Completed Loads" 
          value={stats.completed} 
          icon={CheckCircle2} 
          trend={12} 
          trendType="up" 
          color="bg-gray-500" 
        />
        <KPICard 
          title="Money Spend" 
          value={formatRevenue(stats.revenue)} 
          icon={CircleDollarSign} 
          trend={10} 
          trendType="up" 
          color="bg-green-600" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Analytics Charts */}
        <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden bg-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Loads vs Money Spend</CardTitle>
              <CardDescription>Weekly dispatch logistics and freight billing overview</CardDescription>
            </div>
            <Tabs defaultValue="7days" className="w-[200px]">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="7days">7 Days</TabsTrigger>
                <TabsTrigger value="30days">30 Days</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="h-[350px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} 
                  cursor={{ fill: '#f3f4f6' }}
                />
                <Legend iconType="circle" />
                <Bar dataKey="loads" name="Loads Posted" fill="#10B981" radius={[4, 4, 0, 0]} barSize={24} />
                <Bar dataKey="revenue" name="Revenue (₹K)" fill="#2563EB" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Load Status Donut */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle>Load Status Overview</CardTitle>
            <CardDescription>Current state of all active logistics loads</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex flex-col items-center justify-center">
            {pieData.length === 0 ? (
              <div className="text-center text-gray-400 py-8">No loads recorded in store.</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value}%`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-4 w-full px-4">
                  {pieData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-gray-500 font-medium">{item.name}</span>
                      <span className="text-xs font-bold ml-auto">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-2">
        {/* Live Loads Activity */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Load Activity</CardTitle>
              <CardDescription>Latest loads posted to the marketplace</CardDescription>
            </div>
            <Link to="/loads">
              <Button variant="ghost" size="sm" className="text-green-700 gap-1 hover:text-green-800 hover:bg-green-50 font-bold">
                View All <ArrowRight size={14} />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {loads.slice(0, 3).map((load) => (
              <motion.div 
                key={load.id}
                whileHover={{ x: 5 }}
                className="group border border-gray-100 rounded-xl p-4 hover:bg-green-50/30 transition-all duration-200 cursor-pointer"
                onClick={() => navigate('/loads')}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 text-green-700 rounded-lg">
                      <Package size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">{load.id}</span>
                        <Badge variant="outline" className="text-[10px] font-bold border-green-200 text-green-700 bg-green-50 px-2 py-0.5">
                          {load.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 font-medium mt-0.5">{load.from} → {load.to}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Total Amount</p>
                    <p className="text-sm font-bold text-green-700 font-mono">₹{load.totalFreight.toLocaleString('en-IN')}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 py-2 mt-2 border-t border-gray-50">
                   <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                      <Clock size={14} className="text-gray-400" />
                      <span>{load.dispatchDate}</span>
                   </div>
                   <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                      <Package size={14} className="text-gray-400" />
                      <span>{load.tonnes} Tonnes</span>
                   </div>
                   <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                      <CircleDollarSign size={14} className="text-gray-400" />
                      <span>₹{load.ratePerTonne}/T</span>
                   </div>
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
