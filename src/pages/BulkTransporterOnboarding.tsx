import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, FileSpreadsheet, FileText, CheckCircle2, AlertTriangle, 
  Trash2, Check, X, Search, RefreshCw, UserCheck, AlertCircle
} from 'lucide-react';

import { useOnboardingStore } from '../store/onboardingStore';
import type { OnboardingTransporter } from '../store/onboardingStore';
import { ocrService } from '../services/ocrService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

export default function BulkTransporterOnboarding() {
  const { toast } = useToast();
  
  // Onboarding Store
  const { 
    onboardingQueue, 
    activeFilter,
    setActiveFilter,
    addOnboardingBatch,
    deleteQueueRecord,
    approveQueueRecord,
    submitAllVerified,
    isProcessing
  } = useOnboardingStore();

  // Component State
  const [isParsing, setIsParsing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Dynamic KPI Card Calculations
  const stats = useMemo(() => {
    const total = onboardingQueue.length;
    const drivers = onboardingQueue.filter(item => item.data.role === 'Driver').length;
    const transporters = onboardingQueue.filter(item => item.data.role === 'Transporter').length;
    const ready = onboardingQueue.filter(item => item.report.status === 'AI Verified').length;
    const invalid = total - ready;

    return { total, drivers, transporters, ready, invalid };
  }, [onboardingQueue]);

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndProcess(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      validateAndProcess(file);
    }
  };

  const validateAndProcess = (file: File) => {
    const valid = ['.xlsx', '.xls'].some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );

    if (!valid) {
      toast({
        title: "Unsupported File Format",
        description: "Only Excel spreadsheets (.xlsx, .xls) are allowed.",
        variant: "destructive"
      });
      return;
    }

    processSpreadsheet(file);
  };

  const processSpreadsheet = async (file: File) => {
    const sizeStr = file.size > 1024 * 1024 
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
      : `${(file.size / 1024).toFixed(0)} KB`;
    
    try {
      setIsParsing(true);
      // Directly parse the spreadsheet records instantly!
      const extracted = await ocrService.extractExcelData(file);
      addOnboardingBatch(file.name, sizeStr, extracted);
      
      toast({
        title: "Excel Data Extracted",
        description: `Successfully loaded ${extracted.length} records from ${file.name}.`,
        className: "bg-emerald-600 text-white font-bold border-none"
      });
    } catch (err) {
      toast({
        title: "Spreadsheet Extraction Failed",
        description: "An error occurred during spreadsheet rows parsing.",
        variant: "destructive"
      });
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Quick manual Approval handler
  const handleApproveRecord = async (id: string, name: string) => {
    try {
      await approveQueueRecord(id);
      toast({
        title: "User Registered!",
        description: `${name} has been successfully registered in the live database.`,
        className: "bg-emerald-600 text-white font-bold border-none"
      });
    } catch (err: any) {
      toast({
        title: "Registration Failed",
        description: err.message || "An error occurred during registration. Check if mobile number is duplicate.",
        variant: "destructive"
      });
    }
  };

  const handleBulkApprove = async () => {
    try {
      const approvedCount = await submitAllVerified();
      if (approvedCount > 0) {
        toast({
          title: "Bulk Registration Success",
          description: `Successfully registered ${approvedCount} ready users to the database!`,
          className: "bg-emerald-600 text-white font-bold border-none"
        });
      } else {
        toast({
          title: "No Ready Records",
          description: "There are no valid users ready for registration in the queue.",
          variant: "destructive"
        });
      }
    } catch (err: any) {
      toast({
        title: "Bulk Registration Failed",
        description: err.message || "An error occurred during bulk registration.",
        variant: "destructive"
      });
    }
  };

  // Filters extracted queue rows based on active filter tabs & Search Queries
  const filteredQueue = useMemo(() => {
    return onboardingQueue.filter(item => {
      // 1. Search filter
      const nameVal = item.data.name || '';
      const emailVal = item.data.email || '';
      const mobileVal = item.data.mobile || '';
      const cityVal = item.data.city || '';
      const stateVal = item.data.state || '';
      const roleVal = item.data.role || '';
      const searchMatch = 
        nameVal.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emailVal.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mobileVal.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cityVal.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stateVal.toLowerCase().includes(searchQuery.toLowerCase()) ||
        roleVal.toLowerCase().includes(searchQuery.toLowerCase());

      if (!searchMatch) return false;

      // 2. Tab Filter
      switch (activeFilter) {
        case 'AI_VERIFIED':
          return item.report.status === 'AI Verified';
        case 'REJECTED':
          return item.report.status === 'Rejected' || item.report.status === 'Needs Manual Review';
        default:
          return true;
      }
    });
  }, [onboardingQueue, activeFilter, searchQuery]);

  return (
    <div className="space-y-6 font-sans text-white">
      
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <UserCheck className="text-emerald-300" />
            Bulk User Registration
          </h1>
          <p className="text-sm text-slate-200 mt-1">Upload an Excel spreadsheet to automatically register Drivers and Transporters to the live system database.</p>
        </div>
      </div>

      {/* Top KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-xs p-4 glass-card text-white relative overflow-hidden rounded-xl">
          <p className="text-[10px] font-bold text-slate-200 uppercase tracking-widest">Total Users Extracted</p>
          <h3 className="text-2xl font-extrabold font-mono text-emerald-300 mt-1">{stats.total}</h3>
        </Card>
        <Card className="border-0 shadow-xs p-4 glass-card border-l-4 border-blue-500 text-white rounded-xl">
          <p className="text-[10px] font-bold text-slate-200 uppercase tracking-widest">Transporters Found</p>
          <h3 className="text-2xl font-extrabold font-mono text-blue-300 mt-1">{stats.transporters}</h3>
        </Card>
        <Card className="border-0 shadow-xs p-4 glass-card border-l-4 border-indigo-500 text-white rounded-xl">
          <p className="text-[10px] font-bold text-slate-200 uppercase tracking-widest">Drivers Found</p>
          <h3 className="text-2xl font-extrabold font-mono text-indigo-300 mt-1">{stats.drivers}</h3>
        </Card>
        <Card className={`border-0 shadow-xs p-4 glass-card border-l-4 rounded-xl text-white ${stats.invalid > 0 ? 'border-rose-500' : 'border-emerald-500'}`}>
          <p className="text-[10px] font-bold text-slate-200 uppercase tracking-widest">Missing / Invalid Fields</p>
          <h3 className={`text-2xl font-extrabold font-mono mt-1 ${stats.invalid > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{stats.invalid}</h3>
        </Card>
      </div>

      {/* Grid Layout depending on queue state */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Side: Upload Column */}
        <div className="xl:col-span-1 space-y-6">
          <Card className="border-0 shadow-sm glass-panel bg-transparent overflow-hidden rounded-xl">
            <CardHeader className="bg-white/5 border-b border-white/10 text-white p-5">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-emerald-300" /> Excel Spreadsheet
              </CardTitle>
              <CardDescription className="text-xs text-slate-200">Excel spreadsheets (.xlsx, .xls) containing user registration records.</CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-4 ${
                  isDragOver ? 'border-emerald-500 bg-emerald-500/20' : 'border-white/10 hover:border-emerald-400 bg-white/5 text-white'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange}
                  accept=".xlsx,.xls" 
                  className="hidden" 
                />
                
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-xl shadow-sm">
                  {isParsing ? (
                    <RefreshCw size={24} className="text-emerald-300 animate-spin" />
                  ) : (
                    <Upload size={24} className="text-emerald-300 animate-pulse" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-white">
                    {isParsing ? "Extracting user details..." : "Drag & Drop spreadsheet here"}
                  </p>
                  <p className="text-[10px] text-slate-200 mt-1">Supports Excel spreadsheets (.xlsx, .xls)</p>
                </div>
              </div>

              {/* Sample Excel Instruction Box */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-2.5 text-white">
                <h4 className="text-[11px] font-bold text-white flex items-center gap-1.5">
                  <AlertCircle size={13} className="text-emerald-300" /> Recommended Columns
                </h4>
                <p className="text-[10px] text-slate-200 leading-relaxed">
                  Your Excel sheet headers can be dynamic. The parser intelligently reads the following columns:
                </p>
                <div className="grid grid-cols-2 gap-1 text-[9px] font-medium text-slate-200">
                  <div className="bg-white/5 px-2 py-1 border border-white/10 rounded flex items-center gap-1">✓ name</div>
                  <div className="bg-white/5 px-2 py-1 border border-white/10 rounded flex items-center gap-1">✓ mobile number</div>
                  <div className="bg-white/5 px-2 py-1 border border-white/10 rounded flex items-center gap-1">✓ role <span className="text-[8px] text-slate-400">(Driver/Transporter)</span></div>
                  <div className="bg-white/5 px-2 py-1 border border-white/10 rounded flex items-center gap-1">✓ email</div>
                  <div className="bg-white/5 px-2 py-1 border border-white/10 rounded flex items-center gap-1">✓ password</div>
                  <div className="bg-white/5 px-2 py-1 border border-white/10 rounded flex items-center gap-1">✓ city / state</div>
                  <div className="bg-white/5 px-2 py-1 border border-white/10 rounded flex items-center gap-1 col-span-2">✓ whatsapp number</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Preview & Registration Grid */}
        <div className="xl:col-span-2 space-y-6">
          <Card className="border-0 shadow-sm glass-panel bg-transparent overflow-hidden rounded-xl">
            
            {/* Table Header Controls */}
            <CardHeader className="border-b border-white/10 p-5 bg-white/5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                    <FileSpreadsheet size={16} className="text-emerald-300" />
                    Extracted User Registry List
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-200">Review parsed rows, verify credentials, and commit them to the live database.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={handleBulkApprove}
                    disabled={stats.ready === 0 || isProcessing}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-wider h-8 shadow-xs rounded-lg flex items-center gap-1.5"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" />
                        Registering...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={12} />
                        Register All Ready ({stats.ready})
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Filtering & Search Controls */}
              <div className="flex flex-col md:flex-row md:items-center justify-between pt-4 gap-3">
                
                {/* Search Bar */}
                <div className="relative w-full md:w-72">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                  <Input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Name, Email, Role, City..."
                    className="pl-9 h-8 glass-input text-white text-xs w-full focus:bg-transparent rounded-lg"
                  />
                </div>

                {/* Queue Filter Tabs */}
                <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/10 gap-0.5 overflow-x-auto self-start md:self-auto">
                  {[
                    { id: 'ALL', label: `All Users (${stats.total})` },
                    { id: 'AI_VERIFIED', label: `Ready to Onboard (${stats.ready})` },
                    { id: 'REJECTED', label: `Invalid / Attention (${stats.invalid})` }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveFilter(tab.id as any)}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md whitespace-nowrap transition-all ${
                        activeFilter === tab.id 
                          ? 'bg-white/20 text-white shadow-xs border border-white/10' 
                          : 'text-slate-200 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

              </div>
            </CardHeader>
            
            {/* Table Queue */}
            <CardContent className="p-0">
              {filteredQueue.length === 0 ? (
                <div className="text-center py-20 space-y-3">
                  <FileText size={44} className="text-slate-400 mx-auto" />
                  <p className="text-sm text-slate-200 italic font-medium">No registrations matching the selected filters.</p>
                  <p className="text-xs text-slate-300/70">Drag & drop your Excel file on the left to review records here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-white/5">
                      <TableRow className="border-b border-white/10 hover:bg-transparent">
                        <TableHead className="font-bold text-slate-200 uppercase text-[9px] pl-5 py-3">Name & Role</TableHead>
                        <TableHead className="font-bold text-slate-200 uppercase text-[9px]">Contact Info</TableHead>
                        <TableHead className="font-bold text-slate-200 uppercase text-[9px]">Location</TableHead>
                        <TableHead className="font-bold text-slate-200 uppercase text-[9px]">Credentials</TableHead>
                        <TableHead className="font-bold text-slate-200 uppercase text-[9px]">Status</TableHead>
                        <TableHead className="font-bold text-slate-200 uppercase text-[9px] text-right pr-5">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence initial={false}>
                        {filteredQueue.map((item) => {
                          const isInvalid = item.report.status === 'Rejected' || item.report.status === 'Needs Manual Review';
                          
                          return (
                            <motion.tr 
                              key={item.id}
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, x: -50 }}
                              className="hover:bg-white/5 transition-all border-b border-white/5"
                            >
                              
                              {/* User Name & Role */}
                              <TableCell className="pl-5 py-3.5">
                                <div className="space-y-1">
                                  <p className="text-xs font-bold text-white">{item.data.name}</p>
                                  <Badge className={`${item.data.role === 'Driver' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'} border font-bold text-[9px] px-1.5 py-0.5 rounded`}>
                                    {item.data.role}
                                  </Badge>
                                </div>
                              </TableCell>

                              {/* Contact Info */}
                              <TableCell>
                                <div className="space-y-0.5 text-[10px]">
                                  <p className="text-white font-medium">Mob: <span className="font-bold">{item.data.mobile || '—'}</span></p>
                                  {item.data.email && <p className="text-slate-200">Mail: {item.data.email}</p>}
                                  {item.data.whatsapp && (
                                    <p className="text-emerald-300 font-semibold flex items-center gap-1 text-[9px] mt-0.5">
                                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                      WA: {item.data.whatsapp}
                                    </p>
                                  )}
                                </div>
                              </TableCell>

                              {/* Location */}
                              <TableCell>
                                <div className="space-y-0.5 text-[10px] text-white">
                                  <p className="font-bold">{item.data.city || '—'}</p>
                                  <p className="text-slate-300 font-medium">{item.data.state || '—'}</p>
                                </div>
                              </TableCell>

                              {/* Credentials */}
                              <TableCell>
                                <div className="font-mono text-[10px] text-white font-bold bg-white/5 px-2 py-0.5 rounded border border-white/10 inline-block">
                                  Password: {item.data.password || 'password123'}
                                </div>
                              </TableCell>

                              {/* Simple Status badge */}
                              <TableCell>
                                {isInvalid ? (
                                  <Badge className="bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 w-max">
                                    <AlertTriangle size={10} /> Invalid Data
                                  </Badge>
                                ) : (
                                  <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 w-max">
                                    <Check size={10} /> Ready
                                  </Badge>
                                )}
                                {isInvalid && item.report.rejectionReason && (
                                  <p className="text-[8px] text-rose-400 font-medium mt-1 leading-tight max-w-[130px]">
                                    {item.report.rejectionReason}
                                  </p>
                                )}
                              </TableCell>

                              {/* Row Actions */}
                              <TableCell className="text-right pr-5">
                                <div className="flex justify-end gap-1.5">
                                  {/* Quick Register */}
                                  <Button 
                                    onClick={() => handleApproveRecord(item.id, item.data.name || 'User')}
                                    disabled={isInvalid || isProcessing}
                                    size="icon" 
                                    className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 h-7 w-7 rounded border border-emerald-500/30 shadow-2xs"
                                    title="Register User Now"
                                  >
                                    <Check size={12} />
                                  </Button>

                                  {/* Delete Record from grid */}
                                  <Button 
                                    onClick={() => {
                                      deleteQueueRecord(item.id);
                                      toast({ title: "Record Removed", description: "User entry removed from preview list." });
                                    }}
                                    disabled={isProcessing}
                                    size="icon" 
                                    className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 h-7 w-7 rounded border border-rose-500/30 shadow-2xs"
                                    title="Remove from list"
                                  >
                                    <Trash2 size={12} />
                                  </Button>
                                </div>
                              </TableCell>

                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>

    </div>
  );
}
