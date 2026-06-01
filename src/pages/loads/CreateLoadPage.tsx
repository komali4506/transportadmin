import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, ArrowLeft, Send, RotateCcw, Calendar, 
  Weight, CircleDollarSign, Plus, Trash2, ArrowRight, Route, Package, Clock
} from 'lucide-react';
import { useLoadStore } from '@/store/loadStore';

export default function CreateLoadPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const addLoad = useLoadStore(state => state.addLoad);
  
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    bidId: 'BF-BID-2026-001',
    fromLocation: '',
    stops: [] as string[],
    toLocation: '',
    dispatchDate: '',
    endDate: '',
    endTime: '',
    tonnes: '',
    costPerTonne: '',
    product: 'Rice'
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Generate a random Bid ID on mount
  useEffect(() => {
    const randomNum = Math.floor(100 + Math.random() * 900);
    setFormData(prev => ({ ...prev, bidId: `BF-BID-2026-${randomNum}` }));
  }, []);

  const totalFreight = 
    (parseFloat(formData.tonnes) || 0) * (parseFloat(formData.costPerTonne) || 0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleStopChange = (index: number, value: string) => {
    setFormData(prev => {
      const newStops = [...prev.stops];
      newStops[index] = value;
      return { ...prev, stops: newStops };
    });
    if (errors[`stop_${index}`]) {
      setErrors(prev => ({ ...prev, [`stop_${index}`]: '' }));
    }
  };

  const addStop = () => {
    setFormData(prev => ({ ...prev, stops: [...prev.stops, ''] }));
  };

  const removeStop = (index: number) => {
    setFormData(prev => {
      const newStops = [...prev.stops];
      newStops.splice(index, 1);
      return { ...prev, stops: newStops };
    });
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.fromLocation.trim()) newErrors.fromLocation = 'From Location is required';
    if (!formData.toLocation.trim()) newErrors.toLocation = 'To Location is required';
    if (!formData.dispatchDate) newErrors.dispatchDate = 'Dispatch Date is required';
    if (!formData.endDate) newErrors.endDate = 'End Date is required';
    if (!formData.endTime) newErrors.endTime = 'End Time is required';
    if (!formData.tonnes || parseFloat(formData.tonnes) <= 0) newErrors.tonnes = 'Enter a valid number of tonnes';
    if (!formData.costPerTonne || parseFloat(formData.costPerTonne) <= 0) newErrors.costPerTonne = 'Enter a valid cost per tonne';
    
    // Check for duplicate locations including from/to
    const allLocations = [
      formData.fromLocation.trim().toLowerCase(), 
      ...formData.stops.map(s => s.trim().toLowerCase()), 
      formData.toLocation.trim().toLowerCase()
    ].filter(Boolean);
    const uniqueLocations = new Set(allLocations);
    if (uniqueLocations.size !== allLocations.length) {
      newErrors.route = 'Duplicate locations are not allowed in the route.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      if (errors.route) {
        toast({ title: 'Validation Error', description: errors.route, variant: 'destructive' });
      }
      return;
    }

    setIsLoading(true);
    
    setTimeout(() => {
      setIsLoading(false);
      
      const newLoad = {
        id: `LD-${Math.floor(1000 + Math.random() * 9000)}`,
        bidId: formData.bidId,
        from: formData.fromLocation,
        stops: validStops,
        to: formData.toLocation,
        product: 'General',
        tonnes: parseFloat(formData.tonnes),
        ratePerTonne: parseFloat(formData.costPerTonne),
        totalFreight: totalFreight,
        dispatchDate: formData.dispatchDate,
        endDate: formData.endDate,
        endTime: formData.endTime,
        status: 'Open' as const,
        createdAt: Date.now()
      };
      
      addLoad(newLoad);
      
      toast({
        title: "Success",
        description: "Bid published successfully.",
        variant: "default",
        className: "bg-green-600 text-white border-none",
      });
      
      navigate('/loads');
    }, 1000);
  };

  const handleReset = () => {
    const randomNum = Math.floor(100 + Math.random() * 900);
    setFormData({
      bidId: `BF-BID-2026-${randomNum}`,
      fromLocation: '',
      stops: [],
      toLocation: '',
      dispatchDate: '',
      endDate: '',
      endTime: '',
      tonnes: '',
      costPerTonne: '',
      product: 'Rice'
    });
    setErrors({});
  };

  const validStops = formData.stops.filter(s => s.trim() !== '');
  const routeArray = [formData.fromLocation || 'Origin', ...validStops, formData.toLocation || 'Destination'];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 pb-20">
      <div className="flex items-center gap-4 mb-8">
        <Button 
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-full w-10 h-10 bg-[#4A3525]/10 border border-[#4A3525]/30 hover:bg-[#4A3525]/20 text-[#4A3525] shadow-sm flex items-center justify-center transition-all duration-200"
        >
          <ArrowLeft className="w-5 h-5 text-[#4A3525]" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Create New Bid</h1>
          <p className="text-sm text-slate-200 font-medium">Create and publish a new transportation bid with dynamic routing.</p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="border-0 shadow-lg glass-panel bg-transparent overflow-hidden rounded-2xl">
          <CardHeader className="bg-white/5 border-b border-white/10 pb-6">
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <Route className="w-5 h-5 text-green-300" />
              Route & Cargo Configuration
            </CardTitle>
            <CardDescription className="text-slate-200">Plan your logistics route and define load parameters.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-10">
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                
                {/* Left Column: Route Builder */}
                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-white/10 pb-2">Route Planner</h3>
                  
                  <div className="relative pl-8 space-y-6 py-2">
                    {/* Vertical Dashed Timeline Line */}
                    <div className="absolute left-[11px] top-6 bottom-6 w-0.5 border-l-2 border-dashed border-white/20"></div>
                    
                    {/* From Location */}
                    <div className="relative z-10">
                      <div className="absolute -left-[32.5px] top-3 w-4 h-4 rounded-full bg-blue-500 border-[3px] border-white shadow-md"></div>
                      <label className="text-xs font-bold text-slate-200 uppercase mb-1 block">From Location <span className="text-red-500">*</span></label>
                      <Input 
                        placeholder="e.g., Hyderabad"
                        name="fromLocation"
                        value={formData.fromLocation}
                        onChange={handleChange}
                        className={`glass-input text-white border-white/10 shadow-sm transition-all duration-200 ${errors.fromLocation ? 'border-red-500 focus-visible:ring-red-500' : 'focus-visible:ring-blue-500'}`}
                      />
                      {errors.fromLocation && <p className="text-xs text-red-500 mt-1 animate-in fade-in">{errors.fromLocation}</p>}
                    </div>

                    {/* Dynamic Stops */}
                    <AnimatePresence>
                      {formData.stops.map((stop, index) => (
                        <motion.div 
                          key={index} 
                          initial={{ opacity: 0, height: 0, scale: 0.9 }} 
                          animate={{ opacity: 1, height: 'auto', scale: 1 }} 
                          exit={{ opacity: 0, height: 0, scale: 0.9 }} 
                          transition={{ duration: 0.2 }}
                          className="relative z-10 overflow-hidden pt-2"
                        >
                          <div className="absolute -left-[32.5px] top-5 w-4 h-4 rounded-full bg-orange-400 border-[3px] border-white shadow-md"></div>
                          <label className="text-xs font-bold text-slate-200 uppercase mb-1 block text-orange-400">Stop {index + 1} (Midpoint)</label>
                          <div className="flex gap-2 items-center">
                            <Input 
                              placeholder="e.g., Vijayawada"
                              value={stop}
                              onChange={(e) => handleStopChange(index, e.target.value)}
                              className="glass-input text-white border-white/10 shadow-sm focus-visible:ring-orange-500"
                            />
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => removeStop(index)}
                              className="text-red-400 hover:text-red-300 hover:bg-white/5 flex-shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {/* Add Stop Button */}
                    <div className="relative z-10 pt-2">
                      <div className="absolute -left-[30px] top-3 w-3 h-3 rounded-full bg-slate-800 border-2 border-white/20"></div>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={addStop}
                        className="text-xs font-bold text-green-400 border-green-500/20 hover:bg-white/5 border-dashed"
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add Route Stop
                      </Button>
                    </div>

                    {/* To Location */}
                    <div className="relative z-10 pt-2">
                      <div className="absolute -left-[32.5px] top-5 w-4 h-4 rounded-full bg-green-500 border-[3px] border-white shadow-md"></div>
                      <label className="text-xs font-bold text-slate-200 uppercase mb-1 block">To Location <span className="text-red-500">*</span></label>
                      <Input 
                        placeholder="e.g., Chennai"
                        name="toLocation"
                        value={formData.toLocation}
                        onChange={handleChange}
                        className={`glass-input text-white border-white/10 shadow-sm transition-all duration-200 ${errors.toLocation ? 'border-red-500 focus-visible:ring-red-500' : 'focus-visible:ring-green-500'}`}
                      />
                      {errors.toLocation && <p className="text-xs text-red-500 mt-1 animate-in fade-in">{errors.toLocation}</p>}
                    </div>
                  </div>

                  {/* Live Route Summary Preview */}
                  <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10">
                    <p className="text-xs font-bold text-slate-200 uppercase mb-3">Live Route Preview</p>
                    <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-white">
                      {routeArray.map((loc, idx) => (
                        <React.Fragment key={idx}>
                          <span className={idx === 0 ? 'text-blue-300' : idx === routeArray.length - 1 ? 'text-green-300' : 'text-orange-300'}>
                            {loc}
                          </span>
                          {idx < routeArray.length - 1 && <ArrowRight className="w-3 h-3 text-slate-300" />}
                        </React.Fragment>
                      ))}
                    </div>
                    {errors.route && <p className="text-xs text-red-500 mt-2 font-medium">{errors.route}</p>}
                  </div>
                </div>

                {/* Right Column: Cargo Details */}
                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-white/10 pb-2">Cargo & Pricing Details</h3>
                  
                  <div className="space-y-5">
                    {/* Reference ID */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-200 uppercase">Bid ID</label>
                      <Input 
                        name="bidId"
                        value={formData.bidId}
                        disabled
                        className="glass-input font-mono text-slate-300 border-white/10 shadow-none"
                      />
                    </div>

                    {/* Dispatch Date */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-200 uppercase flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-300" />
                        Dispatch Date <span className="text-red-500">*</span>
                      </label>
                      <Input 
                        type="date"
                        name="dispatchDate"
                        value={formData.dispatchDate}
                        onChange={handleChange}
                        className={`glass-input text-white border-white/10 shadow-sm ${errors.dispatchDate ? 'border-red-500' : 'focus-visible:ring-green-500'}`}
                      />
                      {errors.dispatchDate && <p className="text-xs text-red-500 animate-in fade-in">{errors.dispatchDate}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Bid End Date */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-200 uppercase flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-300" />
                          Bid End Date <span className="text-red-500">*</span>
                        </label>
                        <Input 
                          type="date"
                          name="endDate"
                          value={formData.endDate}
                          onChange={handleChange}
                          className={`glass-input text-white border-white/10 shadow-sm ${errors.endDate ? 'border-red-500' : 'focus-visible:ring-green-500'}`}
                        />
                        {errors.endDate && <p className="text-xs text-red-500 animate-in fade-in">{errors.endDate}</p>}
                      </div>

                      {/* Bid End Time */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-200 uppercase flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-300" />
                          Bid End Time <span className="text-red-500">*</span>
                        </label>
                        <Input 
                          type="time"
                          name="endTime"
                          value={formData.endTime}
                          onChange={handleChange}
                          className={`glass-input text-white border-white/10 shadow-sm ${errors.endTime ? 'border-red-500' : 'focus-visible:ring-green-500'}`}
                        />
                        {errors.endTime && <p className="text-xs text-red-500 animate-in fade-in">{errors.endTime}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Number of Tonnes */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-200 uppercase flex items-center gap-1.5">
                          <Weight className="w-3.5 h-3.5 text-slate-300" />
                          Tonnes <span className="text-red-500">*</span>
                        </label>
                        <Input 
                          type="number"
                          placeholder="e.g., 20"
                          name="tonnes"
                          value={formData.tonnes}
                          onChange={handleChange}
                          min="0"
                          step="0.01"
                          className={`glass-input text-white border-white/10 shadow-sm ${errors.tonnes ? 'border-red-500' : 'focus-visible:ring-green-500'}`}
                        />
                        {errors.tonnes && <p className="text-xs text-red-500 animate-in fade-in">{errors.tonnes}</p>}
                      </div>

                      {/* Cost Per Tonne */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-200 uppercase flex items-center gap-1.5">
                          <CircleDollarSign className="w-3.5 h-3.5 text-slate-300" />
                          Rate / Tonne <span className="text-red-500">*</span>
                        </label>
                        <Input 
                          type="number"
                          placeholder="e.g., 2100"
                          name="costPerTonne"
                          value={formData.costPerTonne}
                          onChange={handleChange}
                          min="0"
                          step="0.01"
                          className={`glass-input text-white border-white/10 shadow-sm ${errors.costPerTonne ? 'border-red-500' : 'focus-visible:ring-green-500'}`}
                        />
                        {errors.costPerTonne && <p className="text-xs text-red-500 animate-in fade-in">{errors.costPerTonne}</p>}
                      </div>
                    </div>

                    {/* Total Freight Value Highlight */}
                    <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-6 relative overflow-hidden group hover:border-green-500/50 transition-colors">
                      <div className="relative z-10">
                        <h3 className="text-sm font-bold text-green-300 uppercase">Estimated Value</h3>
                        <p className="text-xs text-slate-200 mt-0.5 font-medium">Calculated: Tonnes × Rate / Tonne</p>
                      </div>
                      <div className="text-3xl font-bold text-green-300 font-mono tracking-tight mt-2">
                        ₹ {totalFreight.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-white/10 mt-10">
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-bold uppercase tracking-wider px-10 py-6 h-auto transition-all shadow-md active:scale-95"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      Publish Bid
                    </>
                  )}
                </Button>
                <Button 
                  type="button" 
                  onClick={handleReset}
                  disabled={isLoading}
                  className="w-full sm:w-auto bg-[#4A3525]/10 border border-[#4A3525]/30 hover:bg-[#4A3525]/20 text-[#4A3525] font-bold uppercase tracking-wider px-8 py-6 h-auto transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-5 h-5 mr-2 text-[#4A3525]" />
                  Reset Form
                </Button>
              </div>

            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
