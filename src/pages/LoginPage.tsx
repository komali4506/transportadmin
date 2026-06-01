import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Mail, Loader2, ArrowRight, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/use-toast';
import { useTransporterStore } from '@/store/transporterStore';
import { useOnboardingStore } from '@/store/onboardingStore';

export const LoginPage: React.FC = () => {
  const { login } = useAuthStore();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('dinesh.kumar@biofactor.in');
  const [password, setPassword] = useState('admin123');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate backend credentials verification (800ms delay)
    setTimeout(() => {
      setIsLoading(false);
      
      // 1. Check default admin credentials
      if (email === 'dinesh.kumar@biofactor.in' && (password === 'admin123' || password === '••••••••')) {
        login('mock_jwt_token_biofactor_superadmin');
        toast({
          title: "Access Granted",
          description: "Welcome back, Dinesh Kumar. Session established successfully.",
        });
        navigate('/');
        return;
      }

      // 2. Check transporters/drivers in store
      const transporters = useTransporterStore.getState().transporters;
      const matchTransporter = transporters.find(
        t => t.email.toLowerCase() === email.toLowerCase() && t.password === password
      );

      if (matchTransporter) {
        login(`mock_jwt_token_${matchTransporter.id}`);
        toast({
          title: "Access Granted",
          description: `Welcome back, ${matchTransporter.ownerName} (${matchTransporter.role || 'Transporter'}). Session established.`,
        });
        navigate('/');
        return;
      }

      // 3. Check onboarding queue (unapproved/pending accounts)
      const queue = useOnboardingStore.getState().onboardingQueue;
      const matchQueue = queue.find(
        q => q.data.email.toLowerCase() === email.toLowerCase() && q.data.password === password
      );

      if (matchQueue) {
        login(`mock_jwt_token_${matchQueue.id}`);
        toast({
          title: "Access Granted",
          description: `Welcome back, ${matchQueue.data.ownerName} (${matchQueue.data.role || 'User'}). Session established.`,
        });
        navigate('/');
        return;
      }

      // If no matching account found, show error
      toast({
        title: "Access Denied",
        description: "Invalid email or password. Please verify the credentials extracted from your Excel spreadsheet.",
        variant: "destructive"
      });
    }, 850);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Decorative Blur Spheres */}
      <div className="absolute top-0 -left-4 w-96 h-96 bg-[#8C6239]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-4 w-96 h-96 bg-[#4A3525]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#745325]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#745325_1px,transparent_1px),linear-gradient(to_bottom,#745325_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-5 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.7 }}
        className="w-full max-w-md glass-panel p-8 rounded-3xl shadow-2xl space-y-8 relative z-10"
      >
        {/* Brand / Logo */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center bg-white border border-[#4A3525]/10 shadow-lg shadow-[#4A3525]/5">
            <img src="/biofactor_logo.png" alt="Biofactor Logo" className="w-14 h-14 object-contain" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#4A3525] tracking-tight">Biofactor Logistics</h2>
            <p className="text-xs text-[#8C6239] mt-1 uppercase font-semibold tracking-wider">Enterprise ERP Gateway</p>
          </div>
        </div>

        {/* Informative Alert for quick demo */}
        <div className="p-3 bg-[#8C6239]/10 border border-[#8C6239]/20 rounded-xl flex gap-2.5 items-start">
          <ShieldCheck className="text-[#8C6239] shrink-0 mt-0.5" size={16} />
          <div className="text-left">
            <p className="text-[11px] font-bold text-[#4A3525] uppercase tracking-wide">ERP Demo Access</p>
            <p className="text-[10px] text-slate-600 mt-0.5">Use the prefilled administrator credentials to log back in instantly.</p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          {/* Email */}
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-bold text-[#8C6239] uppercase tracking-widest block">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C6239]/80" size={16} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 text-sm bg-white/40 border border-[#745325]/20 focus:border-[#4A3525] focus:ring-1 focus:ring-[#4A3525]/30 text-[#4A3525] rounded-xl outline-none transition-all placeholder:text-slate-400"
                placeholder="admin@biofactor.in"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-bold text-[#8C6239] uppercase tracking-widest block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C6239]/80" size={16} />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-3 text-sm bg-white/40 border border-[#745325]/20 focus:border-[#4A3525] focus:ring-1 focus:ring-[#4A3525]/30 text-[#4A3525] rounded-xl outline-none transition-all placeholder:text-slate-400"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8C6239]/80 hover:text-[#4A3525] transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-[#4A3525] to-[#8C6239] hover:from-[#3d2c1e] hover:to-[#745325] text-sm font-bold text-white shadow-lg shadow-[#4A3525]/10 flex items-center justify-center gap-2 transition-all disabled:opacity-75"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Verifying Credentials...
              </>
            ) : (
              <>
                Secure Login
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-[10px] text-[#8C6239]/80 text-center">
          © {new Date().getFullYear()} Biofactor Agri-Sciences. All Administrative Actions are Audited.
        </p>
      </motion.div>
    </div>
  );
};

export default LoginPage;
