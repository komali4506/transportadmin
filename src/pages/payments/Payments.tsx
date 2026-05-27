import React, { useState, useMemo, useEffect } from 'react';
import { 
  CreditCard, ArrowUpRight, Clock, CheckCircle2, Search, Filter, 
  MoreVertical, ShieldCheck, Download, Plus, Receipt, FileText, 
  Coins, Scale, AlertTriangle, ArrowRight, MapPin, Calendar, 
  User, Building2, TrendingUp, BarChart3, Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useLoadStore } from '@/store/loadStore';
import { usePaymentStore, type PaymentEntry } from '@/store/paymentStore';
import { useTransporterStore } from '@/store/transporterStore';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { exportToPDF } from '@/utils/exportPdf';

export default function Payments() {
  const { toast } = useToast();
  const { payments, isLoading, fetchInvoicesFromBackend, settlePaymentOnBackend } = usePaymentStore();
  const { addNotification } = useTransporterStore();

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modals state
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<PaymentEntry | null>(null);

  // Fallback Form state
  const [selectedLoadId, setSelectedLoadId] = useState('');
  const [extraCharges, setExtraCharges] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<'Bank Transfer' | 'UPI' | 'RTGS' | 'NEFT'>('Bank Transfer');

  // Query actual submitted invoices on mount
  useEffect(() => {
    fetchInvoicesFromBackend();
  }, []);

  // Form field calculations (fallback only)
  const calculatedPayable = useMemo(() => {
    return { base: 0, penalty: 0, tax: 0, final: 0 };
  }, []);

  // Dynamic KPI Cards Computations
  const stats = useMemo(() => {
    const totalRevenue = payments.reduce((sum, p) => sum + p.finalAmount, 0);
    const outstanding = payments
      .filter(p => p.status !== 'Released' && p.status !== 'Completed')
      .reduce((sum, p) => sum + p.finalAmount, 0);
    const paidThisMonth = payments
      .filter(p => p.status === 'Released' || p.status === 'Completed')
      .reduce((sum, p) => sum + p.finalAmount, 0);
    const inReview = payments
      .filter(p => p.status === 'Under Review' || p.status === 'Processing')
      .reduce((sum, p) => sum + p.finalAmount, 0);
    const pendingCount = payments.filter(p => p.status === 'Pending').length;
    const completedCount = payments.filter(p => p.status === 'Released').length;

    return { totalRevenue, outstanding, paidThisMonth, inReview, pendingCount, completedCount };
  }, [payments]);

  // Filter and search
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const matchesSearch = 
        p.paymentId.toLowerCase().includes(search.toLowerCase()) ||
        p.loadId.toLowerCase().includes(search.toLowerCase()) ||
        p.transporter.toLowerCase().includes(search.toLowerCase()) ||
        p.invoiceId.toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [payments, search, statusFilter]);

  const handleCreatePayoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handleMarkAsPaid = async (tx: PaymentEntry) => {
    try {
      await settlePaymentOnBackend(tx.paymentId, 'Bank Transfer', 0);
      toast({
        title: "Invoice Settled Successfully",
        description: `Successfully marked Load ID: ${tx.loadId} as Paid.`,
        className: "bg-green-600 text-white font-bold border-none shadow-md"
      });
    } catch (err: any) {
      toast({
        title: "Settlement Failed",
        description: err.message || "Failed to settle payment on the backend.",
        variant: "destructive"
      });
    }
  };

  const triggerMockDownload = async (type: string, id: string, elementId?: string) => {
    if (elementId) {
      try {
        await exportToPDF(elementId, `${id}.pdf`);
        toast({
          title: "Document Downloaded",
          description: `${type} for ID: ${id} has been saved as PDF.`,
          className: "bg-green-600 text-white font-bold border-none"
        });
      } catch (err) {
        toast({
          title: "Download Failed",
          description: "Could not generate PDF.",
          variant: "destructive"
        });
      }
    } else {
      toast({
        title: "Document Compiled",
        description: `Downloading ${type} for ID: ${id} successfully completed.`,
        className: "bg-blue-600 text-white font-bold border-none"
      });
    }
  };

  const getStatusBadge = (status: PaymentEntry['status']) => {
    switch (status) {
      case 'Released':
      case 'Completed':
        return <Badge className="bg-emerald-100 text-emerald-800 border-none px-2.5 py-1 font-bold">Released</Badge>;
      case 'Pending':
        return <Badge className="bg-amber-100 text-amber-800 border-none px-2.5 py-1 font-bold animate-pulse">Pending</Badge>;
      case 'Under Review':
        return <Badge className="bg-blue-100 text-blue-800 border-none px-2.5 py-1 font-bold">In Review</Badge>;
      case 'Processing':
        return <Badge className="bg-violet-100 text-violet-800 border-none px-2.5 py-1 font-bold">Processing</Badge>;
      default:
        return <Badge variant="outline" className="px-2.5 py-1 font-bold">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Transporter Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">View and download invoices submitted by transporters and drivers.</p>
        </div>
        <div className="flex items-center gap-2.5">
          {/* Invoices are created strictly by the transporters/drivers on their mobile app */}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Total Outstanding */}
        <Card className="border-0 shadow-xs bg-slate-900 text-white overflow-hidden relative">
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-10">
            <CreditCard size={150} />
          </div>
          <CardContent className="p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Outstanding</p>
                <h3 className="text-3xl font-extrabold font-mono text-emerald-400">₹{stats.outstanding.toLocaleString('en-IN')}</h3>
              </div>
              <div className="p-2.5 bg-white/10 rounded-xl text-white">
                <CreditCard size={20} />
              </div>
            </div>
            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
              <span className="text-slate-400 font-medium">Pending Payouts:</span>
              <span className="font-bold font-mono text-emerald-400">{stats.pendingCount} Bills</span>
            </div>
          </CardContent>
        </Card>

        {/* Paid This Month */}
        <Card className="border-0 shadow-xs bg-white overflow-hidden relative">
          <CardContent className="p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Paid (Month)</p>
                <h3 className="text-3xl font-extrabold font-mono text-slate-900">₹{stats.paidThisMonth.toLocaleString('en-IN')}</h3>
              </div>
              <div className="p-2.5 bg-green-50 text-green-600 rounded-xl">
                <CheckCircle2 size={20} />
              </div>
            </div>
            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
              <span className="text-slate-400 font-medium">Completed Trips Paid:</span>
              <span className="font-bold text-green-600 flex items-center gap-1">
                <TrendingUp size={12} /> {stats.completedCount} Transactions
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table Container */}
      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold text-slate-800">Invoices Ledger</CardTitle>
              <CardDescription className="text-xs text-slate-400">View and download carrier-submitted invoices synced from completed trips.</CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <Input 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by ID, Load, Carrier..." 
                  className="pl-9 h-9 text-xs bg-slate-50 border-slate-200 w-[200px]" 
                />
              </div>
              
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="flex h-9 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-none outline-none focus:ring-1 focus:ring-primary text-slate-600"
              >
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Released">Released</option>
                <option value="Under Review">Under Review</option>
                <option value="Processing">Processing</option>
              </select>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-bold text-slate-500 uppercase text-[10px] py-3.5 pl-6">Load ID</TableHead>
                  <TableHead className="font-bold text-slate-500 uppercase text-[10px]">Transporter</TableHead>
                  <TableHead className="font-bold text-slate-500 uppercase text-[10px]">Date Submitted</TableHead>
                  <TableHead className="font-bold text-slate-500 uppercase text-[10px]">Invoice Amount</TableHead>
                  <TableHead className="font-bold text-slate-500 uppercase text-[10px]">Status</TableHead>
                  <TableHead className="font-bold text-slate-500 uppercase text-[10px] text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-slate-400 italic text-xs">
                      No matching records found in ledger.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.map((tx) => (
                    <TableRow key={tx.paymentId} className="hover:bg-slate-50/40">
                      <TableCell className="text-xs font-mono font-bold text-primary pl-6">{tx.loadId}</TableCell>
                      <TableCell className="text-xs font-semibold text-slate-700">{tx.transporter}</TableCell>
                      <TableCell className="text-xs text-slate-500">{tx.createdAt}</TableCell>
                      <TableCell className="font-bold text-xs font-mono text-slate-900">₹{tx.amount.toLocaleString()}</TableCell>
                      <TableCell>{getStatusBadge(tx.status)}</TableCell>
                      <TableCell className="text-right pr-6" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end gap-1.5 select-none">
                          <Button 
                            onClick={() => setViewingInvoice(tx)}
                            size="sm"
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 h-7 text-[10px] px-2.5 font-bold uppercase rounded"
                          >
                            View Invoice
                          </Button>
                          {tx.status !== 'Released' && tx.status !== 'Completed' && (
                            <Button 
                              onClick={() => handleMarkAsPaid(tx)}
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-[10px] px-2.5 font-bold uppercase rounded shadow-xs"
                            >
                              Paid
                            </Button>
                          )}
                          {tx.invoiceUrl && (
                            <a 
                              href={tx.invoiceUrl}
                              download={`invoice-${tx.invoiceId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center h-7 w-7 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                              title="Download Invoice"
                            >
                              <Download size={14} />
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>



      {/* MODAL 2: View Dynamic Invoice Modal */}
      <Dialog open={!!viewingInvoice} onOpenChange={(val) => !val && setViewingInvoice(null)}>
        <DialogContent className="sm:max-w-[550px] border-0 rounded-2xl shadow-xl bg-white p-0 overflow-hidden font-sans">
          {viewingInvoice && (
            <div id={`invoice-modal-${viewingInvoice.invoiceId}`} className="flex flex-col bg-white">
              
              {/* Invoice Header */}
              <div className="bg-slate-900 text-white p-6 flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Building2 className="text-emerald-400" size={18} />
                    <span className="text-sm font-bold tracking-wider text-slate-300">BIOFACTOR INVOICING</span>
                  </div>
                  <h3 className="text-xl font-bold font-mono">Invoice: {viewingInvoice.invoiceId}</h3>
                  <p className="text-[10px] text-slate-400">Date: {viewingInvoice.createdAt}</p>
                </div>
                <div className="text-right space-y-1">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-widest font-mono">
                    {viewingInvoice.status}
                  </span>
                  <p className="text-[10px] text-slate-400">Load Ref: {viewingInvoice.loadId}</p>
                </div>
              </div>

              {/* Invoice Specs */}
              <div className="p-6 space-y-6">
                
                {/* Transporter Details */}
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Carrier Account</span>
                    <p className="text-xs font-bold text-slate-800">{viewingInvoice.transporter}</p>
                    <p className="text-[10px] text-slate-500">Verified KYC Transport Partner</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Payment Mode</span>
                    <p className="text-xs font-bold text-slate-800 font-mono">{viewingInvoice.paymentMethod}</p>
                    <p className="text-[10px] text-slate-500">Scheduled Settlement</p>
                  </div>
                </div>

                {/* Billing details */}
                <div className="space-y-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Invoice Details</span>
                  <div className="border border-slate-100 rounded-xl p-4 space-y-3 text-xs">
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-600">Base Freight Amount</span>
                      <span className="font-mono font-bold text-slate-900">₹{viewingInvoice.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2.5">
                      <span className="font-bold text-slate-800">Total Invoice Value</span>
                      <span className="font-mono font-extrabold text-primary text-sm">₹{viewingInvoice.amount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Submitted Documents & Verification */}
                <div className="space-y-2 border-t pt-4">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Submitted Audit Documents</span>
                  <div className="grid grid-cols-3 gap-2">
                    {viewingInvoice.rcUrl ? (
                      <a 
                        href={viewingInvoice.rcUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1 p-2 bg-slate-50 border rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-100 hover:text-primary transition-all text-center"
                      >
                        <FileText size={12} className="text-blue-500" /> View RC
                      </a>
                    ) : (
                      <span className="p-2 bg-slate-50 border rounded-lg text-[10px] text-center text-slate-400">No RC Uploaded</span>
                    )}
                    {viewingInvoice.insuranceUrl ? (
                      <a 
                        href={viewingInvoice.insuranceUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1 p-2 bg-slate-50 border rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-100 hover:text-primary transition-all text-center"
                      >
                        <FileText size={12} className="text-blue-500" /> View Insurance
                      </a>
                    ) : (
                      <span className="p-2 bg-slate-50 border rounded-lg text-[10px] text-center text-slate-400">No Insurance</span>
                    )}
                    {viewingInvoice.invoiceUrl ? (
                      <a 
                        href={viewingInvoice.invoiceUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1 p-2 bg-emerald-50 border border-emerald-100 rounded-lg text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900 transition-all text-center"
                      >
                        <FileText size={12} className="text-emerald-500" /> View Invoice
                      </a>
                    ) : (
                      <span className="p-2 bg-slate-50 border rounded-lg text-[10px] text-center text-slate-400">No Invoice file</span>
                    )}
                  </div>
                  
                  {/* Inline Uploaded Invoice Image View */}
                  {viewingInvoice.invoiceUrl && (
                    <div className="space-y-2 border-t pt-4">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Uploaded Invoice Document</span>
                      <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center p-2 relative group max-h-[220px]">
                        <img 
                          src={viewingInvoice.invoiceUrl} 
                          alt="Transporter Invoice" 
                          className="object-contain max-h-[200px] w-full rounded shadow-xs" 
                        />
                      </div>
                    </div>
                  )}

                  {viewingInvoice.invoiceRemarks && (
                    <div className="bg-amber-50/50 border border-amber-100 p-2.5 rounded-lg mt-2">
                      <span className="text-[9px] font-bold text-amber-800 uppercase block">Remarks from Transporter/Driver:</span>
                      <p className="text-[11px] text-slate-600 italic mt-0.5">{viewingInvoice.invoiceRemarks}</p>
                    </div>
                  )}
                </div>

                {/* Final payable */}
                <div className="bg-slate-50 rounded-xl p-4 flex justify-between items-center border border-slate-100">
                  <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Total Invoice Amount</span>
                  <span className="text-xl font-black font-mono text-primary">₹{viewingInvoice.amount.toLocaleString('en-IN')}</span>
                </div>

              </div>

              {/* Invoice actions */}
              <div className="p-4 bg-slate-100 border-t flex justify-end gap-2">
                <Button variant="outline" onClick={() => setViewingInvoice(null)} className="h-9 px-4 border-slate-200">
                  Close
                </Button>
                {viewingInvoice.invoiceUrl ? (
                  <a 
                    href={viewingInvoice.invoiceUrl} 
                    download={`invoice-${viewingInvoice.invoiceId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 bg-primary hover:bg-primary-hover text-white h-9 px-4 rounded shadow-sm font-bold uppercase text-xs tracking-wider transition-all"
                  >
                    <Download size={14} /> Download Invoice File
                  </a>
                ) : (
                  <Button 
                    disabled 
                    className="bg-slate-300 text-slate-500 h-9 px-4 rounded font-bold uppercase text-xs tracking-wider cursor-not-allowed"
                  >
                    <Download size={14} /> No Invoice File
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>



      {/* MODAL 4: Payment History & Finance Analytics Portal */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="sm:max-w-[700px] border-0 rounded-2xl shadow-xl bg-white p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-slate-900 text-white flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <BarChart3 size={18} className="text-primary" /> Finance Analytics Portal
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 mt-1">
                Transporter revenue shares and monthly payout dispatch volume statistics.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-6 max-h-[500px] overflow-y-auto custom-scrollbar">
            
            {/* Visual Graph: CSS-Based Bars */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Monthly Settlements Outflow (INR)</h4>
              <div className="bg-slate-50 border rounded-xl p-6 flex justify-around items-end h-[160px] relative">
                
                {/* Horizontal Guide Lines */}
                <div className="absolute inset-x-0 top-1/4 border-t border-dashed border-slate-200" />
                <div className="absolute inset-x-0 top-2/4 border-t border-dashed border-slate-200" />
                <div className="absolute inset-x-0 top-3/4 border-t border-dashed border-slate-200" />

                <div className="flex flex-col items-center gap-1.5 z-10 w-12">
                  <span className="text-[10px] font-bold text-slate-500 font-mono">2.8L</span>
                  <div className="w-6 bg-slate-300 rounded-t-md hover:bg-slate-400 transition-all h-[50px]" />
                  <span className="text-[10px] font-semibold text-slate-400">Feb</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 z-10 w-12">
                  <span className="text-[10px] font-bold text-slate-500 font-mono">4.2L</span>
                  <div className="w-6 bg-slate-300 rounded-t-md hover:bg-slate-400 transition-all h-[75px]" />
                  <span className="text-[10px] font-semibold text-slate-400">Mar</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 z-10 w-12">
                  <span className="text-[10px] font-bold text-slate-500 font-mono">5.9L</span>
                  <div className="w-6 bg-slate-300 rounded-t-md hover:bg-slate-400 transition-all h-[100px]" />
                  <span className="text-[10px] font-semibold text-slate-400">Apr</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 z-10 w-12">
                  <span className="text-[10px] font-bold text-slate-800 font-mono">{((stats.paidThisMonth + stats.outstanding) / 100000).toFixed(1)}L</span>
                  <div className="w-6 bg-primary rounded-t-md hover:bg-primary/95 transition-all h-[125px] shadow-2xs" />
                  <span className="text-[10px] font-bold text-slate-800">May (Act)</span>
                </div>
              </div>
            </div>

            {/* Carrier Revenue Share Comparisons */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transporter Allocation Volume Compare</h4>
              <div className="border rounded-xl p-4.5 space-y-4">
                
                {/* Transporter 1 */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between font-semibold text-slate-800">
                    <span>Delhi Roadlines</span>
                    <span className="font-mono">48% Share</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: '48%' }} />
                  </div>
                </div>

                {/* Transporter 2 */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between font-semibold text-slate-800">
                    <span>SafeWay Express</span>
                    <span className="font-mono">32% Share</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: '32%' }} />
                  </div>
                </div>

                {/* Transporter 3 */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between font-semibold text-slate-800">
                    <span>FastFreight Solutions</span>
                    <span className="font-mono">20% Share</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-400" style={{ width: '20%' }} />
                  </div>
                </div>

              </div>
            </div>

          </div>

          <div className="p-4 bg-slate-50 border-t flex justify-end">
            <Button variant="outline" onClick={() => setIsHistoryOpen(false)} className="h-9 px-4 border-slate-200">
              Close Analytics
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
