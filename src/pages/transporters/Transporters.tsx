import React, { useState, useMemo, useEffect } from 'react';
import { 
  UserCheck, Search, Filter, MoreHorizontal, CheckCircle2, 
  XCircle, AlertCircle, Clock, ShieldCheck, Eye, Truck, MapPin, 
  Calendar, Weight, CircleDollarSign, ArrowRight, Bell, User,
  Mail, Phone, FileText, Download, ShieldAlert, X, Edit2, Check,
  Maximize2, Minimize2, ZoomIn, ZoomOut, AlertTriangle, Building,
  Activity, ShieldAlert as ShieldIcon, RefreshCw, Cpu
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useTransporterStore, type TransporterProfile, type DocumentStatus } from '@/store/transporterStore';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/apiClient';
import { motion, AnimatePresence } from 'framer-motion';

export default function Transporters() {
  const { toast } = useToast();
  const { transporters, notifications, updateTransporter, verifyDocument, blacklistTransporter } = useTransporterStore();
  
  // Backend Pending Users Integration States
  const [backendPendingUsers, setBackendPendingUsers] = useState<TransporterProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Search filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Helper to map backend document types to frontend keys
  const mapDocTypeToKey = (type: string): keyof TransporterProfile['documents'] => {
    const t = type.toLowerCase().trim();
    if (t.includes('aadhaar')) return 'aadhaar';
    if (t.includes('pan')) return 'panCard';
    if (t.includes('gst')) return 'gstCert';
    if (t.includes('cheque')) return 'cancelledCheque';
    if (t.includes('rc') || t.includes('registration')) return 'vehicleRc';
    if (t.includes('insurance')) return 'insurance';
    if (t.includes('fitness')) return 'fitnessCert';
    if (t.includes('pollution') || t.includes('puc')) return 'pollutionCert';
    if (t.includes('license') || t.includes('dl')) return 'drivingLicense';
    if (t.includes('photo')) return 'vehiclePhotos';
    return 'aadhaar'; // default fallback
  };

  const fetchBackendUsers = async () => {
    setIsLoading(true);
    try {
      const connection = await apiClient.checkConnection();
      if (connection.isConnected) {
        const data = await apiClient.getPendingKycUsers();
        const mapped = data.map((user: any) => {
          const mappedDocuments: any = {
            aadhaar: { status: 'Missing', remarks: 'Not uploaded', fileUrl: '' },
            panCard: { status: 'Missing', remarks: 'Not uploaded', fileUrl: '' },
            gstCert: { status: 'Missing', remarks: 'Not uploaded', fileUrl: '' },
            cancelledCheque: { status: 'Missing', remarks: 'Not uploaded', fileUrl: '' },
            vehicleRc: { status: 'Missing', remarks: 'Not uploaded', fileUrl: '' },
            insurance: { status: 'Missing', remarks: 'Not uploaded', fileUrl: '' },
            fitnessCert: { status: 'Missing', remarks: 'Not uploaded', fileUrl: '' },
            pollutionCert: { status: 'Missing', remarks: 'Not uploaded', fileUrl: '' },
            drivingLicense: { status: 'Missing', remarks: 'Not uploaded', fileUrl: '' },
            vehiclePhotos: { status: 'Missing', remarks: 'Not uploaded', fileUrl: '' }
          };

          if (user.documents && Array.isArray(user.documents)) {
            user.documents.forEach((doc: any) => {
              const key = mapDocTypeToKey(doc.document_type);
              const filename = doc.file_path ? doc.file_path.split(/[\\/]/).pop() : '';
              const fileUrl = filename ? `${connection.url}/uploads/${filename}` : '';
              
              let status: DocumentStatus = 'Pending';
              if (doc.status === 'APPROVED') status = 'Verified';
              else if (doc.status === 'REJECTED') status = 'Rejected';
              else if (doc.status === 'EXPIRED') status = 'Expired';
              
              mappedDocuments[key] = {
                id: doc.id,
                status,
                remarks: doc.rejection_reason || 'Pending verification',
                fileUrl
              };
            });
          }

          return {
            id: user.id,
            ownerName: user.name || 'Jane Doe',
            companyName: user.role === 'Driver' ? `${user.name} (Driver)` : `${user.name} (Transporter)`,
            mobile: user.mobile || '9876543210',
            whatsapp: user.mobile || '9876543210',
            email: `${(user.name || 'user').toLowerCase().replace(/\s+/g, '')}@example.com`,
            address: user.city ? `${user.city}, ${user.state || ''}` : 'Awaiting Audit Details',
            city: user.city || 'Pending Location',
            district: 'Pending District',
            state: user.state || 'Pending State',
            fleetSize: user.role === 'Driver' ? 1 : 5,
            preferredRoutes: [],
            vehicleTypes: [],
            panNumber: 'PENDING',
            gstNumber: 'PENDING',
            bankName: 'PENDING',
            bankAccount: 'PENDING',
            ifsc: 'PENDING',
            upiId: 'PENDING',
            status: 'Pending' as const,
            role: user.role,
            trucks: user.trucks || [],
            documents: mappedDocuments
          };
        });
        setBackendPendingUsers(mapped);
        setIsLiveMode(true);
      } else {
        setIsLiveMode(false);
      }
    } catch (error) {
      console.error("Error fetching backend users:", error);
      setIsLiveMode(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBackendUsers();
  }, []);

  const handleVerifyUserSubmit = async (userId: string, isApproved: boolean) => {
    try {
      setIsLoading(true);
      await apiClient.verifyUser(userId, isApproved, isApproved ? undefined : rejectionReason);
      
      toast({
        title: isApproved ? "Carrier Account Approved" : "Carrier Account Rejected",
        description: isApproved 
          ? "The carrier has been fully approved and notified. They can now bid on active loads." 
          : "Rejection details successfully recorded. Driver has been notified to re-upload documents.",
        className: isApproved ? "bg-green-600 text-white border-none font-bold shadow-md" : "bg-rose-600 text-white border-none font-bold shadow-md"
      });

      setSelectedProfile(null);
      setRejectionReason('');
      await fetchBackendUsers();
    } catch (error: any) {
      console.error("Error verifying user:", error);
      toast({
        title: "Verification Request Failed",
        description: error.message || "An unexpected network error occurred while submitting review decisions.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Combine frontend mock database with backend pending reviews
  const displayTransporters = useMemo(() => {
    if (isLiveMode) {
      // Remove all mock carriers entirely and show ONLY live backend pending users when connected
      return backendPendingUsers;
    }
    return transporters;
  }, [transporters, backendPendingUsers, isLiveMode]);
  
  // Drawer & Modal States
  const [selectedProfile, setSelectedProfile] = useState<TransporterProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [blacklistingTarget, setBlacklistingTarget] = useState<TransporterProfile | null>(null);
  const isTransporter = selectedProfile ? selectedProfile.role !== 'Driver' : false;
  
  // Document Viewer States
  const [previewDocKey, setPreviewDocKey] = useState<keyof TransporterProfile['documents'] | null>(null);
  const [previewRemarks, setPreviewRemarks] = useState('');
  const [zoomScale, setZoomScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Dynamic Transporter Truck Document Verification States
  const [previewTruck, setPreviewTruck] = useState<any | null>(null);
  const [previewTruckDocType, setPreviewTruckDocType] = useState<'RC' | 'INSURANCE' | null>(null);
  const [previewTruckRemarks, setPreviewTruckRemarks] = useState('');

  // Editable Profile Form Fields
  const [editForm, setEditForm] = useState<Partial<TransporterProfile>>({});

  // Dynamic KPI Card Calculations
  const stats = useMemo(() => {
    const total = displayTransporters.length;
    const pending = displayTransporters.filter(t => t.status === 'Pending').length;
    const approved = displayTransporters.filter(t => t.status === 'Approved').length;
    const blacklisted = displayTransporters.filter(t => t.status === 'Blacklisted').length;
    
    // Count profiles with at least one expired document
    const expiredDocs = displayTransporters.filter(t => 
      Object.values(t.documents).some(d => d.status === 'Expired')
    ).length;

    // Sum fleet size of verified transporters
    const activeFleet = displayTransporters
      .filter(t => t.status === 'Approved')
      .reduce((sum, t) => sum + t.fleetSize, 0);

    return { total, pending, approved, blacklisted, expiredDocs, activeFleet };
  }, [displayTransporters]);

  // Real-time Duplicate Detection Scanner
  const duplicateAlerts = useMemo(() => {
    const alerts: { id: string; companyName: string; type: 'PAN' | 'GSTIN' | 'Mobile'; value: string; transporter: TransporterProfile }[] = [];
    const pans = new Map<string, TransporterProfile[]>();
    const gsts = new Map<string, TransporterProfile[]>();
    const mobiles = new Map<string, TransporterProfile[]>();

    displayTransporters.forEach(t => {
      if (t.panNumber && t.panNumber !== 'PENDING') {
        const list = pans.get(t.panNumber) || [];
        list.push(t);
        pans.set(t.panNumber, list);
      }
      if (t.gstNumber && t.gstNumber !== 'PENDING') {
        const list = gsts.get(t.gstNumber) || [];
        list.push(t);
        gsts.set(t.gstNumber, list);
      }
      if (t.mobile) {
        const cleanMobile = t.mobile.replace(/\s+/g, '');
        const list = mobiles.get(cleanMobile) || [];
        list.push(t);
        mobiles.set(cleanMobile, list);
      }
    });

    pans.forEach((list, key) => {
      if (list.length > 1) {
        list.forEach(t => {
          alerts.push({ id: `dup-pan-${t.id}`, companyName: t.companyName, type: 'PAN', value: key, transporter: t });
        });
      }
    });

    gsts.forEach((list, key) => {
      if (list.length > 1) {
        list.forEach(t => {
          alerts.push({ id: `dup-gst-${t.id}`, companyName: t.companyName, type: 'GSTIN', value: key, transporter: t });
        });
      }
    });

    mobiles.forEach((list, key) => {
      if (list.length > 1) {
        list.forEach(t => {
          alerts.push({ id: `dup-mob-${t.id}`, companyName: t.companyName, type: 'Mobile', value: key, transporter: t });
        });
      }
    });

    return alerts;
  }, [displayTransporters]);

  // Real-time Expired Documents alerts
  const expiredAlerts = useMemo(() => {
    const alerts: { id: string; companyName: string; docKey: string; docName: string; transporter: TransporterProfile }[] = [];
    displayTransporters.forEach(t => {
      Object.entries(t.documents).forEach(([key, doc]) => {
        if (doc.status === 'Expired') {
          alerts.push({
            id: `exp-${t.id}-${key}`,
            companyName: t.companyName,
            docKey: key,
            docName: key.replace(/([A-Z])/g, ' $1'),
            transporter: t
          });
        }
      });
    });
    return alerts;
  }, [displayTransporters]);

  // Left Section Queue: Pending reviews
  const pendingReviews = useMemo(() => {
    return displayTransporters.filter(t => t.status === 'Pending' || t.status === 'Under Review');
  }, [displayTransporters]);



  // Filter transporters for admin registry
  const filteredTransporters = useMemo(() => {
    return displayTransporters.filter(t => {
      const matchesSearch = 
        t.companyName.toLowerCase().includes(search.toLowerCase()) || 
        t.ownerName.toLowerCase().includes(search.toLowerCase()) || 
        t.email.toLowerCase().includes(search.toLowerCase()) || 
        t.city.toLowerCase().includes(search.toLowerCase()) ||
        t.state.toLowerCase().includes(search.toLowerCase()) ||
        t.mobile.toLowerCase().includes(search.toLowerCase());
      
      let matchesFilter = true;
      if (statusFilter === 'Pending') matchesFilter = t.status === 'Pending';
      else if (statusFilter === 'Approved') matchesFilter = t.status === 'Approved';
      else if (statusFilter === 'Under Review') matchesFilter = t.status === 'Under Review';
      else if (statusFilter === 'Blacklisted') matchesFilter = t.status === 'Blacklisted';
      else if (statusFilter === 'Expired Documents') {
        matchesFilter = Object.values(t.documents).some(d => d.status === 'Expired');
      }

      return matchesSearch && matchesFilter;
    });
  }, [displayTransporters, search, statusFilter]);

  // Document verification actions
  const handleVerifyDoc = async (transporterId: string, docKey: keyof TransporterProfile['documents'], status: DocumentStatus) => {
    const isBackendUser = backendPendingUsers.some(u => u.id === transporterId);
    
    let apiStatus: 'APPROVED' | 'REJECTED' | 'EXPIRED' | null = null;
    if (status === 'Verified') apiStatus = 'APPROVED';
    else if (status === 'Rejected') apiStatus = 'REJECTED';
    else if (status === 'Expired') apiStatus = 'EXPIRED';

    if (isBackendUser && apiStatus) {
      // Find the document to get the unique id from backend
      const user = backendPendingUsers.find(u => u.id === transporterId);
      const docId = user?.documents[docKey]?.id;
      if (!docId) {
        toast({
          title: "Verification Error",
          description: "Document ID not found for backend verification.",
          variant: "destructive"
        });
        return;
      }

      try {
        setIsLoading(true);
        await apiClient.verifyDocument(
          docId, 
          apiStatus, 
          apiStatus === 'REJECTED' ? (previewRemarks || 'Aadhaar Card photo is too blurry. Please upload a clear image.') : undefined
        );
        
        toast({
          title: status === 'Verified' ? "Document Approved" : status === 'Expired' ? "Document Expired" : "Document Rejected",
          description: `Document has been successfully verified on the backend.`,
          className: status === 'Verified' ? "bg-green-600 text-white border-none font-bold shadow-md" : "bg-rose-600 text-white border-none font-bold shadow-md"
        });

        setBackendPendingUsers(prev => prev.map(u => {
          if (u.id === transporterId) {
            const updatedDocs = {
              ...u.documents,
              [docKey]: {
                ...u.documents[docKey],
                status,
                remarks: previewRemarks || (status === 'Verified' ? 'Verified by KYC Audit' : status === 'Expired' ? 'Document has expired' : 'Document rejected')
              }
            };
            return {
              ...u,
              documents: updatedDocs
            };
          }
          return u;
        }));

        setSelectedProfile(prev => {
          if (prev && prev.id === transporterId) {
            return {
              ...prev,
              documents: {
                ...prev.documents,
                [docKey]: {
                  ...prev.documents[docKey],
                  status,
                  remarks: previewRemarks || (status === 'Verified' ? 'Verified by KYC Audit' : status === 'Expired' ? 'Document has expired' : 'Document rejected')
                }
              }
            };
          }
          return prev;
        });

        setPreviewDocKey(null);
        setPreviewRemarks('');
        await fetchBackendUsers();
      } catch (error: any) {
        console.error("Error verifying document:", error);
        toast({
          title: "Document Verification Failed",
          description: error.message || "An unexpected error occurred while saving verification choices.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      verifyDocument(transporterId, docKey, status, previewRemarks || 'Verified by KYC Audit');
      
      // Find updated transporter profile to refresh drawer state
      const updated = transporters.find(t => t.id === transporterId);
      if (updated) {
        setSelectedProfile({
          ...updated,
          documents: {
            ...updated.documents,
            [docKey]: { ...updated.documents[docKey], status, remarks: previewRemarks || 'Verified by KYC Audit' }
          }
        });
      }

      toast({
        title: status === 'Verified' ? "Document Approved (Mock)" : status === 'Expired' ? "Document Expired (Mock)" : "Document Flagged (Mock)",
        description: `Document ${docKey} updated status to ${status}.`,
        className: status === 'Verified' ? "bg-green-600 text-white border-none font-bold" : "bg-orange-600 text-white border-none font-bold"
      });
      setPreviewDocKey(null);
      setPreviewRemarks('');
    }
  };

  const handleVerifyTruckDoc = async (truckId: string, docType: 'RC' | 'INSURANCE', status: 'APPROVED' | 'REJECTED') => {
    try {
      setIsLoading(true);
      await apiClient.verifyTruck(truckId, docType, status, previewTruckRemarks);
      
      toast({
        title: status === 'APPROVED' ? "Vehicle Document Approved" : "Vehicle Document Rejected",
        description: `Successfully verified ${docType} for the vehicle.`,
        className: status === 'APPROVED' ? "bg-green-600 text-white border-none font-bold shadow-md" : "bg-rose-600 text-white border-none font-bold shadow-md"
      });

      // Dynamically update the truck document status in local state to refresh the UI immediately!
      setBackendPendingUsers(prev => prev.map(u => {
        if (u.trucks) {
          const updatedTrucks = u.trucks.map((tk: any) => {
            if (tk.id === truckId) {
              return {
                ...tk,
                [docType === 'RC' ? 'rc_status' : 'insurance_status']: status,
                [docType === 'RC' ? 'rc_rejection_reason' : 'insurance_rejection_reason']: status === 'REJECTED' ? previewTruckRemarks : null
              };
            }
            return tk;
          });
          return { ...u, trucks: updatedTrucks };
        }
        return u;
      }));

      setSelectedProfile(prev => {
        if (prev && prev.trucks) {
          const updatedTrucks = prev.trucks.map((tk: any) => {
            if (tk.id === truckId) {
              return {
                ...tk,
                [docType === 'RC' ? 'rc_status' : 'insurance_status']: status,
                [docType === 'RC' ? 'rc_rejection_reason' : 'insurance_rejection_reason']: status === 'REJECTED' ? previewTruckRemarks : null
              };
            }
            return tk;
          });
          return { ...prev, trucks: updatedTrucks };
        }
        return prev;
      });

      setPreviewTruck(null);
      setPreviewTruckDocType(null);
      setPreviewTruckRemarks('');
      await fetchBackendUsers();
    } catch (error: any) {
      console.error("Error verifying truck document:", error);
      toast({
        title: "Vehicle Document Verification Failed",
        description: error.message || "An unexpected error occurred while saving verification choices.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (profile: TransporterProfile) => {
    setEditForm({
      ownerName: profile.ownerName,
      companyName: profile.companyName,
      mobile: profile.mobile,
      email: profile.email,
      fleetSize: profile.fleetSize,
      panNumber: profile.panNumber,
      gstNumber: profile.gstNumber,
      bankName: profile.bankName,
      bankAccount: profile.bankAccount,
      ifsc: profile.ifsc
    });
    setIsEditing(true);
  };

  const handleEditSubmit = (e: React.FormEvent, transporterId: string) => {
    e.preventDefault();
    updateTransporter(transporterId, editForm);
    
    const updated = transporters.find(t => t.id === transporterId);
    if (updated) {
      setSelectedProfile({ ...updated, ...editForm });
    }

    toast({
      title: "Profile Overhauled",
      description: "Transporter registration details updated successfully.",
      className: "bg-green-600 text-white font-bold border-none"
    });
    setIsEditing(false);
  };

  const handleBlacklistConfirm = () => {
    if (!blacklistingTarget) return;
    blacklistTransporter(blacklistingTarget.id);
    
    // Refresh drawer if viewing target
    if (selectedProfile?.id === blacklistingTarget.id) {
      setSelectedProfile(prev => prev ? { ...prev, status: 'Blacklisted' } : null);
    }

    toast({
      title: "Transporter Blacklisted",
      description: `${blacklistingTarget.companyName} locked out from bidding and dispatches.`,
      className: "bg-red-600 text-white border-none font-bold shadow-md"
    });
    setBlacklistingTarget(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved': return <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 font-bold">Verified</Badge>;
      case 'Pending': return <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 font-bold animate-pulse">Pending Review</Badge>;
      case 'Under Review': return <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 font-bold">Under Review</Badge>;
      case 'Blacklisted': return <Badge className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-1 font-bold">Blacklisted</Badge>;
      default: return <Badge variant="outline" className="px-2.5 py-1 font-bold text-white border-white/10">{status}</Badge>;
    }
  };

  const getDocStatusBadge = (status: DocumentStatus) => {
    switch (status) {
      case 'Verified': return <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">Verified</Badge>;
      case 'Pending': return <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold animate-pulse">Review Pending</Badge>;
      case 'Rejected': return <Badge className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold">Rejected</Badge>;
      case 'Expired': return <Badge className="bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-bold flex items-center gap-1"><AlertTriangle size={9} /> Expired</Badge>;
      default: return <Badge variant="outline" className="text-[10px] text-white border-white/10">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-full overflow-hidden pb-12 font-sans text-white">
      
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Building className="text-white h-6 w-6" /> Transporter Registry & Verification
          </h1>
          <p className="text-sm text-slate-200 mt-1">Manage transporter registrations, KYC verification, and compliance approvals.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge 
            className={`px-3 py-1 text-xs font-bold flex items-center gap-1.5 rounded-full border transition-all duration-300 ${
              isLiveMode 
                ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300" 
                : "bg-amber-500/20 border-amber-500/30 text-amber-300"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isLiveMode ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
            {isLiveMode ? "Live API Connected" : "Demo Mode"}
          </Badge>
          {duplicateAlerts.length > 0 && (
            <Badge className="bg-amber-500/20 border border-amber-500/30 text-amber-300 px-3 py-1 text-xs font-bold animate-pulse flex items-center gap-1.5 rounded-full">
              <ShieldAlert size={13} className="text-amber-400" />
              {duplicateAlerts.length} Compliance Conflicts
            </Badge>
          )}
          {notifications.filter(n => !n.read).length > 0 && (
            <Badge className="bg-rose-500/20 border border-rose-500/30 text-rose-300 px-3 py-1 text-xs font-bold flex items-center gap-1.5 rounded-full">
              <Bell size={13} className="text-rose-400 animate-bounce" />
              {notifications.filter(n => !n.read).length} Alerts
            </Badge>
          )}
        </div>
      </div>

      {/* Modern KPI Stats Analytics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-xs p-4 glass-card text-white relative overflow-hidden">
          <div className="absolute right-2 bottom-2 text-white/5 opacity-10">
            <Truck size={60} />
          </div>
          <p className="text-[9px] font-bold text-slate-200 uppercase tracking-widest">Total Registry</p>
          <h3 className="text-2xl font-extrabold font-mono text-emerald-300 mt-1">{stats.total}</h3>
          <span className="text-[9px] text-slate-200 font-medium">registered carriers</span>
        </Card>
        
        <Card className="border-0 shadow-xs p-4 glass-card text-white relative overflow-hidden">
          <div className="absolute right-2 bottom-2 text-white/5 opacity-10">
            <Clock size={60} />
          </div>
          <p className="text-[9px] font-bold text-slate-200 uppercase tracking-widest">Pending Audit</p>
          <h3 className="text-2xl font-extrabold font-mono text-amber-300 mt-1">{stats.pending}</h3>
          <span className="text-[9px] text-slate-200 font-medium">KYC checks remaining</span>
        </Card>

        <Card className="border-0 shadow-xs p-4 glass-card text-white relative overflow-hidden">
          <div className="absolute right-2 bottom-2 text-white/5 opacity-10">
            <ShieldCheck size={60} />
          </div>
          <p className="text-[9px] font-bold text-slate-200 uppercase tracking-widest">Approved KYC</p>
          <h3 className="text-2xl font-extrabold font-mono text-emerald-300 mt-1">{stats.approved}</h3>
          <span className="text-[9px] text-slate-200 font-medium">compliant fleet partners</span>
        </Card>
      </div>

      {/* Enterprise Workspace Layout */}
      <div className="w-full space-y-6">
        
        {/* Main Transporter Table, Compliance Actions */}
        <div className="w-full space-y-6">
          
          <Card className="border-none shadow-sm glass-panel bg-transparent">
            <CardHeader className="pb-3 border-b border-white/10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                {/* Search Bar matching Name, Mobile, Email, City, State */}
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <Input 
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search Name, Mobile, Email, City or State..." 
                    className="pl-9 glass-input text-white text-xs h-9" 
                  />
                </div>

                {/* Filter Selector */}
                <div className="flex items-center gap-2">
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="flex h-9 rounded-md border border-white/10 bg-slate-950/40 px-3 py-1.5 text-xs shadow-none outline-none focus:ring-1 focus:ring-primary text-white"
                  >
                    <option className="bg-slate-950 text-white" value="All">All Carriers</option>
                    <option className="bg-slate-950 text-white" value="Pending">Pending Review</option>
                    <option className="bg-slate-950 text-white" value="Approved">Verified KYC</option>
                    <option className="bg-slate-950 text-white" value="Expired Documents">Expired Documents</option>
                  </select>
                </div>

              </div>
            </CardHeader>
            
            <CardContent className="p-0">
              <div className="overflow-x-auto w-full">
                <Table>
                  <TableHeader className="bg-white/5">
                    <TableRow className="border-b border-white/10 hover:bg-transparent">
                      <TableHead className="font-bold text-slate-200 uppercase text-[10px] pl-6 py-3.5">Name</TableHead>
                      <TableHead className="font-bold text-slate-200 uppercase text-[10px]">Mobile</TableHead>
                      <TableHead className="font-bold text-slate-200 uppercase text-[10px]">Email</TableHead>
                      <TableHead className="font-bold text-slate-200 uppercase text-[10px]">City</TableHead>
                      <TableHead className="font-bold text-slate-200 uppercase text-[10px]">State</TableHead>
                      <TableHead className="font-bold text-slate-200 uppercase text-[10px]">Verification Status</TableHead>
                      <TableHead className="font-bold text-slate-200 uppercase text-[10px] text-right pr-6">Audit Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence>
                      {filteredTransporters.map((tr) => {
                        const hasExpiredDocs = Object.values(tr.documents).some(d => d.status === 'Expired');
                        
                        return (
                          <TableRow 
                            key={tr.id} 
                            onClick={() => { setSelectedProfile(tr); setIsEditing(false); }}
                            className="hover:bg-white/5 cursor-pointer transition-all border-b border-white/5 last:border-0"
                          >
                            <TableCell className="pl-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                                  tr.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-300' :
                                  tr.status === 'Blacklisted' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                                }`}>
                                  {tr.companyName.charAt(0)}
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                                    {tr.companyName}
                                    {hasExpiredDocs && (
                                      <Badge className="bg-rose-500/20 text-rose-300 text-[8px] font-bold border border-rose-500/30 px-1 py-0 h-4">Expired Docs</Badge>
                                    )}
                                  </p>
                                  <p className="text-[10px] text-slate-200 mt-0.5">{tr.ownerName}</p>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell>
                              <span className="text-xs font-medium text-white">{tr.mobile}</span>
                            </TableCell>

                            <TableCell>
                              <span className="text-xs text-slate-200 font-medium">{tr.email}</span>
                            </TableCell>

                            <TableCell>
                              <span className="text-xs text-white font-medium">{tr.city}</span>
                            </TableCell>

                            <TableCell>
                              <span className="text-xs text-slate-200 font-medium">{tr.state}</span>
                            </TableCell>

                            <TableCell>{getStatusBadge(tr.status)}</TableCell>

                            <TableCell className="text-right pr-6" onClick={e => e.stopPropagation()}>
                              <div className="flex justify-end gap-1.5">
                                <Button 
                                  onClick={() => { setSelectedProfile(tr); setIsEditing(false); }}
                                  size="sm" 
                                  className="bg-white/10 hover:bg-white/20 text-white h-7 text-[10px] font-bold uppercase rounded border border-white/10"
                                >
                                  View Docs
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-200">
                                      <MoreHorizontal size={14} />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="bg-slate-950/95 border border-white/10 text-white">
                                    <DropdownMenuItem className="gap-2 text-xs hover:bg-white/10 focus:bg-white/10 focus:text-white" onClick={() => handleEditClick(tr)}>
                                      <Edit2 size={13} /> Edit Profile
                                    </DropdownMenuItem>
                                    {tr.status !== 'Blacklisted' && (
                                      <DropdownMenuItem className="gap-2 text-rose-400 font-bold text-xs hover:bg-white/10 focus:bg-white/10 focus:text-rose-400" onClick={() => setBlacklistingTarget(tr)}>
                                        <ShieldAlert size={13} /> Blacklist Carrier
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

        </div>

      </div>

      {/* DRAWER: Transporter Profile & Document Audit Drawer */}
      <AnimatePresence>
        {selectedProfile && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProfile(null)}
              className="fixed inset-0 bg-black z-40"
            />
            {/* Drawer Panel */}
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-xl glass-sidebar bg-slate-900/95 shadow-2xl z-50 flex flex-col font-sans border-l border-white/10 text-white"
            >
              {/* Drawer Header */}
              <div className="bg-white/5 border-b border-white/10 text-white p-6 flex justify-between items-center">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-slate-800 text-emerald-400 border border-slate-700 font-bold text-[9px] uppercase px-2 py-0.5">
                      Carrier Audit Hub
                    </Badge>
                    <span className="text-xs text-slate-300 font-mono">ID: {selectedProfile.id}</span>
                  </div>
                  <h3 className="text-lg font-bold">{selectedProfile.companyName}</h3>
                  <p className="text-xs text-slate-200">Managed by: {selectedProfile.ownerName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setSelectedProfile(null)}
                    className="h-8 w-8 rounded-full text-slate-300 hover:text-white hover:bg-white/10"
                  >
                    <X size={18} />
                  </Button>
                </div>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                
                {/* General Actions row */}
                <div className="flex justify-between items-center bg-slate-50 border rounded-xl p-4">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Account Status</span>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusBadge(selectedProfile.status)}
                    </div>
                  </div>

                </div>


                {/* Edit Form or Display Specs */}
                {isEditing ? (
                  <form onSubmit={(e) => handleEditSubmit(e, selectedProfile.id)} className="space-y-4 border rounded-xl p-5 bg-slate-50/50">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Modify Registration Info</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Owner Name</label>
                        <Input 
                          value={editForm.ownerName}
                          onChange={e => setEditForm(prev => ({ ...prev, ownerName: e.target.value }))}
                          className="bg-white h-9 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Company Name</label>
                        <Input 
                          value={editForm.companyName}
                          onChange={e => setEditForm(prev => ({ ...prev, companyName: e.target.value }))}
                          className="bg-white h-9 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Mobile No</label>
                        <Input 
                          value={editForm.mobile}
                          onChange={e => setEditForm(prev => ({ ...prev, mobile: e.target.value }))}
                          className="bg-white h-9 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Email Address</label>
                        <Input 
                          value={editForm.email}
                          onChange={e => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                          className="bg-white h-9 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Heavy Fleet Size</label>
                        <Input 
                          type="number"
                          value={editForm.fleetSize}
                          onChange={e => setEditForm(prev => ({ ...prev, fleetSize: parseInt(e.target.value) || 0 }))}
                          className="bg-white h-9 text-xs font-mono"
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider h-9 mt-2">
                      Save Changes
                    </Button>
                  </form>
                ) : (
                  <div className="space-y-5">
                    
                    {/* Contact details */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Business Coordinates</h4>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg">
                          <Phone size={13} className="text-slate-400" />
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-bold block">Mobile / WhatsApp</span>
                            <span className="font-semibold text-slate-800">{selectedProfile.mobile}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg">
                          <Mail size={13} className="text-slate-400" />
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-bold block">Email Address</span>
                            <span className="font-semibold text-slate-800">{selectedProfile.email}</span>
                          </div>
                        </div>

                      </div>
                    </div>


                    {/* KYC/KYT Document Registry */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                        <span>{isTransporter ? "KYT Document Registry" : "KYC Document Registry"}</span>
                        <span className="text-[10px] text-slate-400 lowercase font-medium">Click document to verify/preview</span>
                      </h4>
                      
                      <div className="grid grid-cols-1 gap-2">
                        {Object.entries(selectedProfile.documents)
                          .filter(([key]) => {
                            if (isTransporter && (key === 'vehicleRc' || key === 'insurance' || key === 'vehiclePhotos')) {
                              return false;
                            }
                            return true;
                          })
                          .map(([key, value]) => {
                            const val = value as TransporterProfile['documents'][keyof TransporterProfile['documents']];
                            return (
                              <div 
                                key={key} 
                                onClick={() => { setPreviewDocKey(key as any); setPreviewRemarks(val.remarks); }}
                                className="border border-slate-100 hover:border-slate-300 hover:bg-slate-50/50 cursor-pointer rounded-xl p-3.5 flex justify-between items-center transition-all"
                              >
                                <div className="flex items-center gap-3 text-xs">
                                  <div className="p-2 bg-slate-100 text-slate-500 rounded-lg">
                                    <FileText size={14} />
                                  </div>
                                  <div className="space-y-0.5">
                                    <span className="font-bold text-slate-800 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                                    {val.expiryDate && (
                                      <span className="text-[10px] text-slate-400 block">Expires: {val.expiryDate}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {getDocStatusBadge(val.status)}
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400">
                                    <Eye size={12} />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* Transporter Fleet & Trucks Audit Section */}
                    {isTransporter && (
                      <div className="space-y-4 pt-4 border-t border-slate-100">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                          <span>Registered Fleet & Trucks ({selectedProfile.trucks?.length || 0})</span>
                          <span className="text-[10px] text-slate-400 lowercase font-medium">Verify individual truck documents</span>
                        </h4>

                        {(!selectedProfile.trucks || selectedProfile.trucks.length === 0) ? (
                          <div className="p-6 bg-slate-50/50 border border-dashed rounded-xl text-center">
                            <Truck className="mx-auto text-slate-300 mb-2" size={24} />
                            <p className="text-xs text-slate-500">No trucks registered under this transporter yet.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {selectedProfile.trucks.map((truck: any) => {
                              const rcStatus = truck.rc_status || 'PENDING';
                              const insStatus = truck.insurance_status || 'PENDING';

                              return (
                                <div key={truck.id} className="border border-slate-100 bg-white rounded-xl p-4 space-y-3 shadow-xs">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <span className="font-mono text-xs font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{truck.truck_number}</span>
                                      <p className="text-xs font-bold text-slate-700 mt-1">{truck.truck_name}</p>
                                    </div>
                                    <Badge className="bg-slate-900 text-white text-[9px] font-bold">Truck Details</Badge>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-50">
                                    {/* RC document preview & verification status card */}
                                    <div 
                                      onClick={() => {
                                        setPreviewTruck(truck);
                                        setPreviewTruckDocType('RC');
                                        setPreviewTruckRemarks(truck.rc_rejection_reason || '');
                                      }}
                                      className="border border-slate-100 hover:border-slate-300 hover:bg-slate-50/50 cursor-pointer p-2.5 rounded-lg flex flex-col justify-between transition-all"
                                    >
                                      <div>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Vehicle RC</span>
                                        <span className="text-[10px] text-slate-700 font-medium block mt-0.5 truncate">{truck.rc_file_path?.split(/[\\/]/).pop()}</span>
                                      </div>
                                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-50/50">
                                        <Badge className={`text-[8px] font-bold border-none ${
                                          rcStatus === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' :
                                          rcStatus === 'REJECTED' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                                        }`}>{rcStatus === 'APPROVED' ? 'Verified' : rcStatus === 'REJECTED' ? 'Rejected' : 'Pending Verification'}</Badge>
                                        <Eye size={10} className="text-slate-400" />
                                      </div>
                                    </div>

                                    {/* Insurance document preview & verification status card */}
                                    <div 
                                      onClick={() => {
                                        setPreviewTruck(truck);
                                        setPreviewTruckDocType('INSURANCE');
                                        setPreviewTruckRemarks(truck.insurance_rejection_reason || '');
                                      }}
                                      className="border border-slate-100 hover:border-slate-300 hover:bg-slate-50/50 cursor-pointer p-2.5 rounded-lg flex flex-col justify-between transition-all"
                                    >
                                      <div>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Vehicle Insurance</span>
                                        <span className="text-[10px] text-slate-700 font-medium block mt-0.5 truncate">{truck.insurance_file_path?.split(/[\\/]/).pop()}</span>
                                      </div>
                                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-50/50">
                                        <Badge className={`text-[8px] font-bold border-none ${
                                          insStatus === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' :
                                          insStatus === 'REJECTED' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                                        }`}>{insStatus === 'APPROVED' ? 'Verified' : insStatus === 'REJECTED' ? 'Rejected' : 'Pending Verification'}</Badge>
                                        <Eye size={10} className="text-slate-400" />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* DOCUMENT PREVIEW MODAL */}
      <Dialog open={!!previewDocKey} onOpenChange={(val) => !val && setPreviewDocKey(null)}>
        <DialogContent className="sm:max-w-[750px] border-0 rounded-2xl shadow-xl bg-white p-0 overflow-hidden font-sans">
          {selectedProfile && previewDocKey && (() => {
            const doc = selectedProfile.documents[previewDocKey];
            return (
              <div className="flex flex-col">
                <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Document Audit</span>
                    <h3 className="text-sm font-bold capitalize">{previewDocKey.replace(/([A-Z])/g, ' $1')}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setZoomScale(s => Math.min(2, s + 0.1))} className="h-7 w-7 text-slate-400 hover:text-white"><ZoomIn size={14} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setZoomScale(s => Math.max(0.5, s - 0.1))} className="h-7 w-7 text-slate-400 hover:text-white"><ZoomOut size={14} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(!isFullscreen)} className="h-7 w-7 text-slate-400 hover:text-white"><Maximize2 size={14} /></Button>
                  </div>
                </div>

                {/* Main preview split */}
                <div className="grid grid-cols-1 md:grid-cols-3 h-[450px]">
                  
                  {/* Left: Interactive Media Preview */}
                  <div className="md:col-span-2 bg-slate-950 flex items-center justify-center overflow-hidden p-6 relative">
                    <img 
                      src={doc.fileUrl} 
                      alt="Verified Doc Preview"
                      className="max-h-full max-w-full rounded shadow-md object-contain transition-transform"
                      style={{ transform: `scale(${zoomScale})` }}
                    />
                  </div>

                  {/* Right: Audit decisions */}
                  <div className="md:col-span-1 border-l border-slate-100 p-5 flex flex-col justify-between bg-slate-50/50">
                    <div className="space-y-4">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Document Status</span>
                        <div className="mt-1.5">{getDocStatusBadge(doc.status)}</div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Audit Remarks / Feedback</label>
                        <textarea
                          value={previewRemarks}
                          onChange={e => setPreviewRemarks(e.target.value)}
                          placeholder="e.g. Aadhaar matched with NSDL records..."
                          className="w-full h-[120px] rounded-lg border border-slate-200 p-2.5 text-xs outline-none bg-white focus:ring-1 focus:ring-primary leading-snug"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-4 border-t">
                      <Button 
                        onClick={() => handleVerifyDoc(selectedProfile.id, previewDocKey, 'Verified')}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 uppercase text-[10px] tracking-wider shadow-xs"
                      >
                        Approve Document
                      </Button>
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          onClick={() => handleVerifyDoc(selectedProfile.id, previewDocKey, 'Rejected')}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 font-bold h-9 uppercase text-[9px] tracking-wider"
                        >
                          Reject Doc
                        </Button>
                        <Button 
                          onClick={() => handleVerifyDoc(selectedProfile.id, previewDocKey, 'Expired')}
                          className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-100 font-bold h-9 uppercase text-[9px] tracking-wider"
                        >
                          Mark Expired
                        </Button>
                      </div>
                    </div>
                  </div>

                </div>

                <div className="p-4 bg-slate-100 border-t flex justify-between items-center">
                  <span className="text-[10px] text-slate-500 font-medium">Remarks: {doc.remarks}</span>
                  <Button variant="outline" onClick={() => setPreviewDocKey(null)} className="h-8 text-xs">
                    Cancel Audit
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Dynamic Transporter Truck Document Preview Dialog */}
      <Dialog open={!!previewTruck && !!previewTruckDocType} onOpenChange={(val) => !val && setPreviewTruck(null)}>
        <DialogContent className="sm:max-w-[750px] border-0 rounded-2xl shadow-xl bg-white p-0 overflow-hidden font-sans">
          {previewTruck && previewTruckDocType && (() => {
            const fileName = previewTruckDocType === 'RC' ? previewTruck.rc_file_path : previewTruck.insurance_file_path;
            const fileUrl = fileName ? `${apiClient.getApiUrl()}/uploads/${fileName.split(/[\\/]/).pop()}` : '';
            const docStatus = previewTruckDocType === 'RC' ? previewTruck.rc_status : previewTruck.insurance_status;
            
            return (
              <div className="flex flex-col">
                <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Transporter Fleet Audit</span>
                    <h3 className="text-sm font-bold capitalize">Vehicle {previewTruckDocType} - {previewTruck.truck_number}</h3>
                    <span className="text-xs text-slate-400 font-mono block">Truck Name: {previewTruck.truck_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setZoomScale(s => Math.min(2, s + 0.1))} className="h-7 w-7 text-slate-400 hover:text-white"><ZoomIn size={14} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setZoomScale(s => Math.max(0.5, s - 0.1))} className="h-7 w-7 text-slate-400 hover:text-white"><ZoomOut size={14} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(!isFullscreen)} className="h-7 w-7 text-slate-400 hover:text-white"><Maximize2 size={14} /></Button>
                  </div>
                </div>

                {/* Main preview split */}
                <div className="grid grid-cols-1 md:grid-cols-3 h-[450px]">
                  
                  {/* Left: Interactive Media Preview */}
                  <div className="md:col-span-2 bg-slate-950 flex items-center justify-center overflow-hidden p-6 relative">
                    {fileUrl ? (
                      <img 
                        src={fileUrl} 
                        alt="Vehicle Doc Preview"
                        className="max-h-full max-w-full rounded shadow-md object-contain transition-transform"
                        style={{ transform: `scale(${zoomScale})` }}
                      />
                    ) : (
                      <span className="text-slate-400 text-xs">No image available</span>
                    )}
                  </div>

                  {/* Right: Audit decisions */}
                  <div className="md:col-span-1 border-l border-slate-100 p-5 flex flex-col justify-between bg-slate-50/50">
                    <div className="space-y-4">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Document Status</span>
                        <div className="mt-1.5">
                          <Badge className={`text-[10px] font-bold border-none ${
                            docStatus === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' :
                            docStatus === 'REJECTED' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                          }`}>{docStatus === 'APPROVED' ? 'Verified' : docStatus === 'REJECTED' ? 'Rejected' : 'Pending Verification'}</Badge>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Audit Remarks / Feedback</label>
                        <textarea
                          value={previewTruckRemarks}
                          onChange={e => setPreviewTruckRemarks(e.target.value)}
                          placeholder="e.g. Document image is clear and verified..."
                          className="w-full h-[120px] rounded-lg border border-slate-200 p-2.5 text-xs outline-none bg-white focus:ring-1 focus:ring-primary leading-snug"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-4 border-t">
                      <Button 
                        onClick={() => handleVerifyTruckDoc(previewTruck.id, previewTruckDocType, 'APPROVED')}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 uppercase text-[10px] tracking-wider shadow-xs"
                      >
                        Approve Document
                      </Button>
                      <Button 
                        onClick={() => handleVerifyTruckDoc(previewTruck.id, previewTruckDocType, 'REJECTED')}
                        className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold h-9 uppercase text-[10px] tracking-wider shadow-xs"
                      >
                        Reject Document
                      </Button>
                    </div>
                  </div>

                </div>

                <div className="p-4 bg-slate-100 border-t flex justify-end">
                  <Button variant="outline" onClick={() => { setPreviewTruck(null); setPreviewTruckDocType(null); }} className="h-8 text-xs">
                    Cancel Audit
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* MODAL: Blacklist Confirmation Modal */}
      <Dialog open={!!blacklistingTarget} onOpenChange={(val) => !val && setBlacklistingTarget(null)}>
        <DialogContent className="sm:max-w-[400px] border-0 rounded-2xl shadow-xl bg-white p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert size={18} className="text-rose-600 animate-pulse" /> Blacklist Carrier Partner
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 mt-2 leading-snug">
              Are you absolutely sure you want to blacklist <span className="font-extrabold text-slate-900">{blacklistingTarget?.companyName}</span>?
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl p-3.5 mt-2 leading-relaxed">
            <strong>WARNING:</strong> Blacklisting blocks the carrier from bidding on open loads, receiving assigned trips, and shuts down their active carrier dashboard workspace immediately.
          </p>
          <DialogFooter className="flex gap-2 sm:justify-end mt-4">
            <Button variant="outline" onClick={() => setBlacklistingTarget(null)} className="border-slate-200">
              Cancel Audit
            </Button>
            <Button 
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              onClick={handleBlacklistConfirm}
            >
              Confirm Blacklist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
