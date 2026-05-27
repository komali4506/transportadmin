import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Search, Filter, Download, Plus, Eye, Edit, Trash2, ArrowRight, FolderOpen,
  MapPin, Calendar, Weight, CircleDollarSign, Truck, CheckCircle2,
  Clock, X, BarChart3, TrendingUp, HelpCircle, Star, ShieldCheck, 
  Award, Sparkles, FileSpreadsheet, ChevronRight, AlertTriangle,
  Coins, MessageSquare, Building2
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useLoadStore, type Load, type Bid, type Transporter } from '@/store/loadStore';
import { useTrackingStore } from '@/store/trackingStore';
import { exportToExcel } from '@/utils/exportCsv';
import { apiClient } from '@/services/apiClient';

// Helper to identify if an assigned or selected carrier is a Driver vs Transporter
const isCarrierDriver = (carrierName: string, ownerName?: string, role?: string) => {
  if (role) {
    return role.toLowerCase() === 'driver';
  }
  return ownerName === 'Self-Employed Driver' || 
         carrierName === 'Vikram Singh' || 
         carrierName === 'Suresh Agarwal' || 
         carrierName === 'Rajesh Gupta' || 
         carrierName === 'Mohit Chawla' || 
         carrierName === 'Sanjay Dutt';
};

export default function ManageLoads() {
  const { toast } = useToast();
  const { loads, updateLoad, deleteLoad, approveBid, rejectBid, negotiateBid, autoCloseExpiredLoads, fetchBidsForLoad, connectionMode } = useLoadStore();
  
  // Filtering & Search for Main Table
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Drawer / Modals State
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('biofactor-selected-load-id');
    }
    return null;
  });
  const [editingLoad, setEditingLoad] = useState<Load | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Active Bidding States inside Drawer
  const [bidSearch, setBidSearch] = useState('');
  const [bidSort, setBidSort] = useState<'asc' | 'desc'>('asc');

  const lastFetchedLoadIdRef = useRef<string | null>(null);

  // Synchronize selectedLoadId with localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (selectedLoadId) {
        localStorage.setItem('biofactor-selected-load-id', selectedLoadId);
      } else {
        localStorage.removeItem('biofactor-selected-load-id');
      }
    }
  }, [selectedLoadId]);

  // Fetch live bids whenever a load is selected for viewing and exists in the store
  useEffect(() => {
    const hasLoad = loads.some(l => l.id === selectedLoadId || l.bidId === selectedLoadId);
    if (selectedLoadId && hasLoad && lastFetchedLoadIdRef.current !== selectedLoadId) {
      lastFetchedLoadIdRef.current = selectedLoadId;
      fetchBidsForLoad(selectedLoadId);
    }
    if (!selectedLoadId) {
      lastFetchedLoadIdRef.current = null;
    }
  }, [selectedLoadId, loads, fetchBidsForLoad]);

  // Auto-close expired loads on mount and every 60 seconds
  useEffect(() => {
    const checkAndClose = () => {
      const closedCount = autoCloseExpiredLoads();
      if (closedCount > 0) {
        toast({
          title: `${closedCount} Load${closedCount > 1 ? 's' : ''} Auto-Closed`,
          description: `${closedCount} load${closedCount > 1 ? 's have' : ' has'} passed their dispatch deadline and been marked as Completed.`,
          className: 'bg-slate-800 text-white border-none'
        });
      }
    };

    checkAndClose(); // Run immediately on mount
    const interval = setInterval(checkAndClose, 60000); // Re-check every 60s
    return () => clearInterval(interval);
  }, []);

  // Nested Modals State inside Drawer
  const [negotiatingBid, setNegotiatingBid] = useState<{ loadId: string; bid: any } | null>(null);
  const [counterOffer, setCounterOffer] = useState('');
  const [negotiationRemarks, setNegotiationRemarks] = useState('');
  const [negotiationValidTill, setNegotiationValidTill] = useState('2026-05-30');
  const [negotiationPriority, setNegotiationPriority] = useState('Medium');
  
  const [rejectConfirmBid, setRejectConfirmBid] = useState<{ loadId: string; bidId: string; transporterName: string } | null>(null);
  const [viewingTransporter, setViewingTransporter] = useState<any | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ type: 'rc' | 'insurance'; title: string } | null>(null);

  // Advanced dispatch & audit viewer states
  const [viewingTruckProfile, setViewingTruckProfile] = useState<any | null>(null);
  const [loadingTruckProfile, setLoadingTruckProfile] = useState(false);
  const [loadingAddressInput, setLoadingAddressInput] = useState('');
  const [unloadingAddressInput, setUnloadingAddressInput] = useState('');
  const [loadingGpsInput, setLoadingGpsInput] = useState('');
  const [unloadingGpsInput, setUnloadingGpsInput] = useState('');
  const [isSubmittingAddress, setIsSubmittingAddress] = useState(false);
  const [isGeocodingLoading, setIsGeocodingLoading] = useState(false);
  const [isGeocodingUnloading, setIsGeocodingUnloading] = useState(false);
  const [viewingDocTab, setViewingDocTab] = useState<'rc' | 'insurance'>('rc');
  const [rcImgFallback, setRcImgFallback] = useState(false);
  const [insImgFallback, setInsImgFallback] = useState(false);
  const [isTruckVerified, setIsTruckVerified] = useState(false);

  const handleViewTruckDetails = async (userId: string, bid: any) => {
    setLoadingTruckProfile(true);
    setRcImgFallback(false);
    setInsImgFallback(false);
    
    const isAlreadyVerified = selectedLoad ? localStorage.getItem(`verified_truck_${selectedLoad.id}`) === 'true' : false;
    setIsTruckVerified(isAlreadyVerified);
    
    setViewingDocTab('rc');
    try {
      let profileData: any = null;
      if (connectionMode === 'live' && userId) {
        try {
          profileData = await apiClient.getProfileDetails(userId);
        } catch (err) {
          console.warn("Failed to fetch live profile details, falling back to enriched local mock:", err);
        }
      }

      let tripData: any = null;
      if (connectionMode === 'live' && selectedLoad) {
        try {
          tripData = await apiClient.getTripByLoadId(selectedLoad.bidId || selectedLoad.id);
        } catch (err) {
          console.warn("Failed to fetch live trip details:", err);
        }
      } else if (selectedLoad) {
        const localTripId = selectedLoad.tripId || `TRIP-2026-${selectedLoad.id.split('-')[1] || '1001'}`;
        const localTrip = useTrackingStore.getState().trips.find(t => t.id === localTripId);
        if (localTrip) {
          tripData = {
            id: localTrip.id,
            vehicle_details: localTrip.vehicleNumber,
            vehicle_number: localTrip.vehicleNumber,
            status: localTrip.status === 'Moving' ? 'IN_TRANSIT' : localTrip.status,
            loading_address: localTrip.origin.name !== (selectedLoad.from || 'Origin') ? localTrip.origin.name : '',
            unloading_address: localTrip.destination.name !== (selectedLoad.to || 'Destination') ? localTrip.destination.name : '',
            loading_gps_coordinates: localTrip.origin.lat ? `${localTrip.origin.lat}, ${localTrip.origin.lng}` : '',
            unloading_gps_coordinates: localTrip.destination.lat ? `${localTrip.destination.lat}, ${localTrip.destination.lng}` : '',
          };
        }
      }

      const apiBase = apiClient.getApiUrl();
      const truckName = tripData?.vehicle_details || profileData?.vehicle_type || profileData?.truck_name || profileData?.truckName || bid.vehicleType || "Awaiting Driver Upload";
      const truckNumber = tripData?.vehicle_number || profileData?.vehicle_number || profileData?.truck_number || profileData?.truckNumber || "Awaiting Driver Upload";
      
      let rcImageUrl = null;
      let insImageUrl = null;

      if (tripData?.rc_url) {
        rcImageUrl = tripData.rc_url.startsWith('http') ? tripData.rc_url : `${apiBase}${tripData.rc_url}`;
      }
      if (tripData?.insurance_url) {
        insImageUrl = tripData.insurance_url.startsWith('http') ? tripData.insurance_url : `${apiBase}${tripData.insurance_url}`;
      }

      if (!rcImageUrl && profileData?.documents && Array.isArray(profileData.documents)) {
        const rcDoc = profileData.documents.find((d: any) => d.document_type === 'Vehicle RC' || d.document_type === 'vehicleRc');
        if (rcDoc?.file_path) {
          const filename = rcDoc.file_path.split(/[\\/]/).pop();
          rcImageUrl = `${apiBase}/uploads/${filename}`;
        }
      }

      if (!insImageUrl && profileData?.documents && Array.isArray(profileData.documents)) {
        const insDoc = profileData.documents.find((d: any) => d.document_type === 'Insurance' || d.document_type === 'insurance');
        if (insDoc?.file_path) {
          const filename = insDoc.file_path.split(/[\\/]/).pop();
          insImageUrl = `${apiBase}/uploads/${filename}`;
        }
      }

      if (!rcImageUrl) {
        const rcFilename = profileData?.vehicle_rc_image || profileData?.rcImage || profileData?.rc_image;
        rcImageUrl = rcFilename ? `${apiBase}/uploads/${rcFilename}` : null;
      }
      if (!insImageUrl) {
        const insFilename = profileData?.vehicle_insurance_image || profileData?.insuranceImage || profileData?.insurance_image;
        insImageUrl = insFilename ? `${apiBase}/uploads/${insFilename}` : null;
      }

      setViewingTruckProfile({
        userId,
        bid,
        tripId: tripData?.id || bid.trip_id || selectedLoad?.tripId,
        carrierName: bid.transporterName,
        role: bid.role,
        truckName,
        truckNumber,
        rcImageUrl,
        insImageUrl,
        rating: bid.driverRating || 4.8,
        experienceYears: bid.experienceYears || 6,
        kycStatus: bid.transporterDetails?.kycStatus || "Verified"
      });

      const loadStatusUpper = selectedLoad?.status?.toUpperCase() || '';
      const isAlreadyDispatched = loadStatusUpper === 'ASSIGNED & DISPATCHED' || tripData?.status === 'IN_TRANSIT';

      if (isAlreadyDispatched || tripData?.loading_address || tripData?.unloading_address) {
        setLoadingAddressInput(tripData?.loading_address || '');
        setUnloadingAddressInput(tripData?.unloading_address || '');
        setLoadingGpsInput(tripData?.loading_gps_coordinates || '');
        setUnloadingGpsInput(tripData?.unloading_gps_coordinates || '');
      } else {
        setLoadingAddressInput('');
        setUnloadingAddressInput('');
        setLoadingGpsInput('');
        setUnloadingGpsInput('');
      }
    } catch (e: any) {
      toast({
        title: "Error Loading Truck Profile",
        description: e.message || "Failed to load truck credentials.",
        variant: "destructive"
      });
    } finally {
      setLoadingTruckProfile(false);
    }
  };

  const handleDispatchTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingTruckProfile || !selectedLoad) return;
    
    setIsSubmittingAddress(true);
    try {
      const tripId = viewingTruckProfile.tripId || selectedLoad.tripId || `TRIP-2026-${selectedLoad.id.split('-')[1] || '1001'}`;
      const loadingGpsCoordinates = loadingGpsInput;
      const unloadingGpsCoordinates = unloadingGpsInput;

      if (connectionMode === 'live') {
        await apiClient.dispatchTripDetails(tripId, {
          loadingAddress: loadingAddressInput,
          unloadingAddress: unloadingAddressInput,
          loadingGpsCoordinates,
          unloadingGpsCoordinates
        });
      }

      // Sync local tracking store to initiate the live GPS movement simulation
      useTrackingStore.getState().dispatchTripDetails(tripId, {
        loadingAddress: loadingAddressInput,
        unloadingAddress: unloadingAddressInput,
        loadingGpsCoordinates,
        unloadingGpsCoordinates
      });

      updateLoad(selectedLoad.id, {
        status: 'Assigned & Dispatched',
      });

      toast({
        title: "Trip Dispatched!",
        description: `Successfully dispatched coordinates & addresses to Trip ID: ${tripId}. Driver has been notified.`,
        className: "bg-green-600 text-white border-none shadow-xl"
      });

      setViewingTruckProfile(null);
      setSelectedLoadId(null);
    } catch (error: any) {
      toast({
        title: "Dispatch Failed",
        description: error.message || "Failed to dispatch addresses to backend.",
        variant: "destructive"
      });
    } finally {
      setIsSubmittingAddress(false);
    }
  };

  const handleFetchLoadingGps = async () => {
    if (!loadingAddressInput) return;
    setIsGeocodingLoading(true);
    try {
      const parts = loadingAddressInput.split(',').map(p => p.trim()).filter(Boolean);
      let foundData = null;
      let matchedQuery = '';

      for (let i = 0; i < parts.length; i++) {
        const query = parts.slice(i).join(', ');
        if (!query) continue;

        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`, {
            headers: {
              'User-Agent': 'BiofactorLogisticsManager/1.0'
            }
          });
          const data = await res.json();
          if (data && data.length > 0) {
            foundData = data[0];
            matchedQuery = query;
            break;
          }
        } catch (e) {
          console.warn(`Geocoding fallback failed for: "${query}"`, e);
        }
      }

      if (foundData) {
        setLoadingGpsInput(`${parseFloat(foundData.lat).toFixed(6)}, ${parseFloat(foundData.lon).toFixed(6)}`);
        toast({
          title: "GPS Fetched Successfully",
          description: `Loaded from matched location: "${matchedQuery}"`,
          className: "bg-emerald-600 text-white font-bold border-none shadow-xl"
        });
      } else {
        toast({
          title: "GPS Fetch Failed",
          description: "Address not found in OpenStreetMap database. Please input coordinates manually.",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Network Error",
        description: "Failed to connect to Nominatim OpenStreetMap Geocoding API.",
        variant: "destructive"
      });
    } finally {
      setIsGeocodingLoading(false);
    }
  };

  const handleFetchUnloadingGps = async () => {
    if (!unloadingAddressInput) return;
    setIsGeocodingUnloading(true);
    try {
      const parts = unloadingAddressInput.split(',').map(p => p.trim()).filter(Boolean);
      let foundData = null;
      let matchedQuery = '';

      for (let i = 0; i < parts.length; i++) {
        const query = parts.slice(i).join(', ');
        if (!query) continue;

        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`, {
            headers: {
              'User-Agent': 'BiofactorLogisticsManager/1.0'
            }
          });
          const data = await res.json();
          if (data && data.length > 0) {
            foundData = data[0];
            matchedQuery = query;
            break;
          }
        } catch (e) {
          console.warn(`Geocoding fallback failed for: "${query}"`, e);
        }
      }

      if (foundData) {
        setUnloadingGpsInput(`${parseFloat(foundData.lat).toFixed(6)}, ${parseFloat(foundData.lon).toFixed(6)}`);
        toast({
          title: "GPS Fetched Successfully",
          description: `Loaded from matched location: "${matchedQuery}"`,
          className: "bg-emerald-600 text-white font-bold border-none shadow-xl"
        });
      } else {
        toast({
          title: "GPS Fetch Failed",
          description: "Address not found in OpenStreetMap database. Please input coordinates manually.",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Network Error",
        description: "Failed to connect to Nominatim OpenStreetMap Geocoding API.",
        variant: "destructive"
      });
    } finally {
      setIsGeocodingUnloading(false);
    }
  };

  const renderSmartRcCard = (profile: any) => {
    return (
      <div className="w-[440px] h-[260px] rounded-2xl bg-slate-950 border border-dashed border-slate-800 p-6 flex flex-col items-center justify-center text-center shadow-2xl relative select-none">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 animate-pulse">
          <AlertTriangle size={20} className="text-amber-500" />
        </div>
        <h4 className="text-sm font-bold text-slate-200">No Vehicle RC Document Uploaded</h4>
        <p className="text-[11px] text-slate-400 mt-2 max-w-[300px] leading-relaxed">
          The driver or transporter has not uploaded a digital copy of the Registration Certificate (RC) for this trip yet.
        </p>
      </div>
    );
  };

  const renderSmartInsuranceCard = (profile: any) => {
    return (
      <div className="w-[430px] h-[260px] rounded-2xl bg-slate-950 border border-dashed border-slate-800 p-6 flex flex-col items-center justify-center text-center shadow-2xl relative select-none">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 animate-pulse">
          <AlertTriangle size={20} className="text-amber-500" />
        </div>
        <h4 className="text-sm font-bold text-slate-200">No Insurance Document Uploaded</h4>
        <p className="text-[11px] text-slate-400 mt-2 max-w-[300px] leading-relaxed">
          The driver or transporter has not uploaded a digital copy of the Commercial Vehicle Insurance Policy for this trip yet.
        </p>
      </div>
    );
  };

  // Edit Load Form State
  const [editForm, setEditForm] = useState({
    from: '',
    stops: [] as string[],
    to: '',
    product: '',
    tonnes: 0,
    ratePerTonne: 0,
    dispatchDate: '',
    status: 'Open' as Load['status']
  });

  // Get the selected load dynamically from the store to ensure reactive updates
  const selectedLoad = useMemo(() => {
    return loads.find(l => l.id === selectedLoadId) || null;
  }, [loads, selectedLoadId]);

  // Dynamic Search & Sort Logic for Bids inside Drawer
  const filteredBids = useMemo(() => {
    if (!selectedLoad || !selectedLoad.bids) return [];
    
    let list = selectedLoad.bids.map((bid) => {
      const isDriver = bid.role ? (bid.role.toLowerCase() === 'driver') : false;
      return {
        ...bid,
        role: isDriver ? ('Driver' as const) : ('Transporter' as const),
        transporterName: bid.transporterName || 'Carrier',
        transporterDetails: {
          companyName: bid.transporterName || 'Carrier',
          ownerName: bid.transporterDetails?.ownerName || bid.transporterName || 'Owner',
          fleetSize: Number(bid.transporterDetails?.fleetSize || (isDriver ? 1 : 10)),
          completedTrips: Number(bid.transporterDetails?.completedTrips || 100),
          insuranceValidity: bid.transporterDetails?.insuranceValidity || 'Valid',
          kycStatus: bid.transporterDetails?.kycStatus || 'Verified',
          rating: Number(bid.driverRating || 4.5),
          experienceYears: Number(bid.experienceYears || 5),
          role: isDriver ? ('Driver' as const) : ('Transporter' as const)
        }
      };
    });
    // Normalize status according to the load's overall operational status.
    // If the load is Open/Negotiation/Awaiting, then no bid is approved yet. Force all bids to 'Pending' (unless Negotiating).
    // If the load is Closed/Assigned/Completed, ensure only the accepted/approved bid shows as 'Approved' and others show as 'Rejected'.
    const loadStatusUpper = selectedLoad.status?.toUpperCase() || '';
    const loadIsActive = loadStatusUpper === 'OPEN' || 
                         loadStatusUpper === 'NEGOTIATION IN PROGRESS' || 
                         loadStatusUpper === 'AWAITING NEW BIDS';
                          
    list = list.map(b => {
      let normalizedStatus = b.status;
      const bidStatusUpper = b.status?.toUpperCase() || '';
      
      if (loadIsActive) {
        if (bidStatusUpper === 'NEGOTIATING') {
          normalizedStatus = 'Negotiating';
        } else {
          normalizedStatus = 'Pending';
        }
      } else {
        const isApprovedBid = bidStatusUpper === 'ACCEPTED' || bidStatusUpper === 'APPROVED' || bidStatusUpper === 'SELECTED' || 
          (selectedLoad.assignedTransporter && selectedLoad.assignedTransporter.companyName === b.transporterName);
          
        if (isApprovedBid) {
          normalizedStatus = 'Approved';
        } else {
          normalizedStatus = 'Rejected';
        }
      }
      
      return {
        ...b,
        status: normalizedStatus
      };
    });
    
    // Filter out rejected bids from display
    list = list.filter(b => b.status !== 'Rejected' && b.status !== 'REJECTED');
    
    // Search by User Name (transporter/driver name) or Vehicle Type
    if (bidSearch.trim() !== '') {
      const query = bidSearch.toLowerCase();
      list = list.filter(b => 
        b.transporterName.toLowerCase().includes(query) ||
        b.vehicleType.toLowerCase().includes(query)
      );
    }
    
    // Sort by Bid Amount: Ascending or Descending
    list.sort((a, b) => bidSort === 'asc' ? a.bidAmount - b.bidAmount : b.bidAmount - a.bidAmount);
    
    return list;
  }, [selectedLoad, bidSearch, bidSort]);

  // Dynamic Search & Filter Logic for Main Table
  const filteredLoads = useMemo(() => {
    return loads.filter(l => {
      const stopsMatch = l.stops ? l.stops.some(stop => stop.toLowerCase().includes(search.toLowerCase())) : false;
      const matchesSearch = 
        l.id.toLowerCase().includes(search.toLowerCase()) || 
        l.from.toLowerCase().includes(search.toLowerCase()) || 
        l.to.toLowerCase().includes(search.toLowerCase()) || 
        l.product.toLowerCase().includes(search.toLowerCase()) ||
        stopsMatch;
        
      const matchesStatus = statusFilter === 'All' || 
        (statusFilter === 'Open' && (l.status === 'Open' || l.status === 'CLOSED')) ||
        (statusFilter === 'Assigned' && (l.status === 'Assigned & Dispatched' || l.status === 'CLOSED')) ||
        (statusFilter === 'Completed' && l.status === 'Completed');
      return matchesSearch && matchesStatus;
    });
  }, [loads, search, statusFilter]);

  // KPI Calculations
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

  const getStatusBadge = (status: Load['status']) => {
    switch (status) {
      case 'Open': 
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none px-3 py-1 font-semibold">Open</Badge>;
      case 'Assigned & Dispatched': 
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-none px-3 py-1 font-semibold">Assigned & Dispatched</Badge>;
      case 'CLOSED':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-none px-3 py-1 font-semibold">Assigned (Pending Dispatch)</Badge>;
      case 'Negotiation In Progress': 
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-none px-3 py-1 font-semibold">Negotiating</Badge>;
      case 'Awaiting New Bids': 
        return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-200 border-none px-3 py-1 font-semibold">Awaiting Bids</Badge>;
      case 'Completed': 
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-200 border-none px-3 py-1 font-semibold">Completed</Badge>;
      default: 
        return <Badge variant="outline" className="px-3 py-1 font-semibold">{status}</Badge>;
    }
  };

  const getBidStatusBadge = (status: Bid['status']) => {
    switch (status) {
      case 'Approved':
      case 'Selected':
      case 'ACCEPTED':
        return <Badge className="bg-green-100 text-green-800 border-none px-2 py-0.5 text-xs font-bold uppercase tracking-wider">Approved</Badge>;
      case 'Rejected':
      case 'REJECTED':
        return <Badge className="bg-red-100 text-red-800 border-none px-2 py-0.5 text-xs font-bold uppercase tracking-wider">Rejected</Badge>;
      case 'Negotiating':
        return <Badge className="bg-amber-100 text-amber-800 border-none px-2 py-0.5 text-xs font-bold uppercase tracking-wider">NEGOTIATING</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-none px-2 py-0.5 text-xs font-bold uppercase tracking-wider">PENDING</Badge>;
    }
  };

  const handleExport = () => {
    const data = filteredLoads.map(l => ({
      'Load ID': l.id,
      'From': l.from,
      'Stops': l.stops ? l.stops.join(' -> ') : 'None',
      'To': l.to,
      'Product': l.product,
      'Quantity (Tonnes)': l.tonnes,
      'Rate/Tonne (INR)': l.ratePerTonne,
      'Total Freight (INR)': l.totalFreight,
      'Dispatch Date': l.dispatchDate,
      'Status': l.status
    }));
    exportToExcel(data, 'Biofactor_Loads.xls');
    toast({ 
      title: 'Export Successful', 
      description: 'Loads database has been downloaded as an Excel spreadsheet.',
      className: "bg-green-600 text-white border-none"
    });
  };

  const handleExportBidsComparison = (load: Load) => {
    if (!load.bids) return;
    const data = load.bids.map(b => ({
      'Rank': b.rank,
      'Transporter': b.transporterName,
      'Vehicle Type': b.vehicleType,
      'Bid Amount (INR)': b.bidAmount,
      'Rate/Tonne': b.pricePerTonne,
      'Rating': b.driverRating,
      'Experience (Years)': b.experienceYears,
      'Verification Status': b.verificationStatus.join(', '),
      'Bid Status': b.status
    }));
    exportToExcel(data, `Bid_Comparison_${load.id}.xls`);
    toast({
      title: "Comparison Exported",
      description: "User comparison sheet downloaded successfully.",
      className: "bg-green-600 text-white border-none"
    });
  };

  const handleDelete = (id: string) => {
    deleteLoad(id);
    setDeleteConfirmId(null);
    toast({ 
      title: 'Load Deleted', 
      description: `Load ${id} has been permanently deleted.`,
      className: "bg-green-600 text-white border-none"
    });
  };

  const startEdit = (load: Load) => {
    setEditingLoad(load);
    setEditForm({
      from: load.from,
      stops: [...(load.stops || [])],
      to: load.to,
      product: load.product,
      tonnes: load.tonnes,
      ratePerTonne: load.ratePerTonne,
      dispatchDate: load.dispatchDate,
      status: load.status
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLoad) return;
    
    const totalFreight = editForm.tonnes * editForm.ratePerTonne;
    
    updateLoad(editingLoad.id, {
      from: editForm.from,
      stops: editForm.stops.filter(s => s.trim() !== ''),
      to: editForm.to,
      product: editForm.product,
      tonnes: editForm.tonnes,
      ratePerTonne: editForm.ratePerTonne,
      totalFreight: totalFreight,
      dispatchDate: editForm.dispatchDate,
      status: editForm.status
    });
    
    setEditingLoad(null);
    toast({
      title: 'Load Updated',
      description: `Load ${editingLoad.id} updated successfully.`,
      className: "bg-green-600 text-white border-none"
    });
  };

  const handleEditStopChange = (index: number, val: string) => {
    const newStops = [...editForm.stops];
    newStops[index] = val;
    setEditForm(prev => ({ ...prev, stops: newStops }));
  };

  // Bid Approval Workflow
  const handleApproveBid = async (loadId: string, bidId: string, transporterName: string) => {
    try {
      await approveBid(loadId, bidId);
      toast({
        title: "User Assigned!",
        description: `Bidding closed. ${transporterName} has been assigned to load ${loadId}.`,
        className: "bg-green-600 text-white border-none shadow-xl"
      });
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (error: any) {
      toast({
        title: "Error Assigning User",
        description: error.message || "Failed to assign user on backend.",
        variant: "destructive"
      });
    }
  };

  // Bid Rejection Workflow
  const handleRejectBid = () => {
    if (!rejectConfirmBid) return;
    rejectBid(rejectConfirmBid.loadId, rejectConfirmBid.bidId);
    toast({
      title: "Bid Rejected",
      description: `Bid from ${rejectConfirmBid.transporterName} was rejected.`,
      variant: "destructive"
    });
    setRejectConfirmBid(null);
  };

  // Negotiation Workflow
  const handleNegotiateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!negotiatingBid) return;
    
    const amount = parseFloat(counterOffer);
    if (!amount || amount <= 0) {
      toast({ title: "Validation Error", description: "Please enter a valid counter offer amount.", variant: "destructive" });
      return;
    }

    negotiateBid(negotiatingBid.loadId, negotiatingBid.bid.id, amount, negotiationRemarks, negotiationValidTill, negotiationPriority);
    toast({
      title: "Counter Offer Sent",
      description: `Sent offer of ₹${amount.toLocaleString()} to ${negotiatingBid.bid.transporterName}.`,
      className: "bg-amber-600 text-white border-none"
    });

    setNegotiatingBid(null);
    setCounterOffer('');
    setNegotiationRemarks('');
    setNegotiationValidTill('2026-05-30');
    setNegotiationPriority('Medium');
  };

  const formatRevenue = (value: number) => {
    if (value >= 100000) {
      return `₹ ${(value / 100000).toFixed(1)} Lakhs`;
    }
    return `₹ ${value.toLocaleString('en-IN')}`;
  };

  return (
    <div className="space-y-6 pb-20 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Manage Loads</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor, manage, and dispatch active logistics loads in real-time.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport} className="gap-2 bg-white border-gray-200 shadow-sm hover:bg-gray-50 text-gray-700">
            <Download size={16} /> Export DB
          </Button>
          <Link to="/create-load">
            <Button className="gap-2 bg-green-600 hover:bg-green-700 text-white shadow-md transition-all active:scale-95">
              <Plus size={16} /> New Bid
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Loads', val: stats.total, color: 'border-l-blue-500', icon: BarChart3, bg: 'text-blue-500' },
          { label: 'Open Loads', val: stats.open, color: 'border-l-cyan-500', icon: FolderOpen, bg: 'text-cyan-500' },
          { label: 'Assigned Loads', val: stats.assigned, color: 'border-l-blue-600', icon: Truck, bg: 'text-blue-600' },
          { label: 'Completed Loads', val: stats.completed, color: 'border-l-gray-400', icon: CheckCircle2, bg: 'text-gray-500' },
          { label: 'Money Spend', val: formatRevenue(stats.revenue), color: 'border-l-green-600', icon: CircleDollarSign, bg: 'text-green-600 font-mono' },
        ].map((c, i) => (
          <Card key={i} className={`border-0 border-l-4 ${c.color} shadow-sm bg-white overflow-hidden`}>
            <CardContent className="p-4 flex justify-between items-center">
              <div className="space-y-1">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{c.label}</p>
                <h3 className={`text-base font-bold text-gray-800 ${c.bg}`}>{c.val}</h3>
              </div>
              <c.icon className={`w-5 h-5 opacity-30 ${c.bg}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table Section */}
      <Card className="border-0 shadow-sm bg-white overflow-hidden">
        <CardHeader className="border-b border-gray-50 p-5 bg-gray-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-bold text-gray-800">Dispatch Registry</CardTitle>
            <CardDescription className="text-xs text-gray-400">All registered freight logistics loads.</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <Input 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                placeholder="Search route, load, cargo..." 
                className="pl-9 w-full sm:w-[220px] bg-gray-50/50 border-gray-200 h-9 text-xs focus-visible:ring-green-500 shadow-none"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-gray-50/50 p-1 border rounded-lg">
              {['All', 'Open', 'Assigned', 'Completed'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-all ${
                    statusFilter === tab 
                      ? 'bg-white text-gray-800 shadow-xs' 
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        
        {/* Data Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50/80">
              <TableRow className="border-b border-gray-100 hover:bg-transparent">
                <TableHead className="font-bold text-gray-600">Load ID</TableHead>
                <TableHead className="font-bold text-gray-600">Route & Stops</TableHead>
                <TableHead className="font-bold text-gray-600">Tonnes</TableHead>
                <TableHead className="font-bold text-gray-600">Rate/Tonne</TableHead>
                <TableHead className="font-bold text-gray-600">Estimated Value</TableHead>
                <TableHead className="font-bold text-gray-600">Dispatch Date</TableHead>
                <TableHead className="font-bold text-gray-600">Status</TableHead>
                <TableHead className="font-bold text-gray-600 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {filteredLoads.map((load, i) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 5 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, scale: 0.95 }} 
                    transition={{ delay: i * 0.02 }}
                    key={load.id} 
                    className="group border-b border-gray-50 hover:bg-green-50/20 cursor-pointer transition-colors"
                    onClick={() => setSelectedLoadId(load.id)}
                  >
                    <TableCell className="font-bold text-sm text-green-700">
                      {load.bidId}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold text-gray-800">{load.from}</span>
                        {load.stops && load.stops.length > 0 && load.stops.map((stop, idx) => (
                          <React.Fragment key={idx}>
                             <ArrowRight size={13} className="text-orange-400" />
                             <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">{stop}</span>
                          </React.Fragment>
                        ))}
                        <ArrowRight size={13} className="text-gray-400" />
                        <span className="text-sm font-semibold text-gray-800">{load.to}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-semibold text-gray-800 flex items-center gap-1"><Weight size={13}/> {load.tonnes} Tonnes</span>
                    </TableCell>
                    <TableCell className="font-bold text-sm text-gray-700">₹{load.ratePerTonne.toLocaleString('en-IN')}/T</TableCell>
                    <TableCell className="font-bold text-sm text-green-700">
                      ₹{load.totalFreight.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600 font-medium">
                      <span className="flex items-center gap-1.5"><Calendar size={12} className="text-gray-400" /> {load.dispatchDate}</span>
                    </TableCell>
                    <TableCell>{getStatusBadge(load.status)}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 hover:bg-gray-100 rounded-full text-blue-600"
                          onClick={() => setSelectedLoadId(load.id)}
                        >
                          <Eye size={15} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 hover:bg-gray-100 rounded-full text-green-600"
                          onClick={() => startEdit(load)}
                        >
                          <Edit size={15} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 hover:bg-red-50 text-red-600 rounded-full"
                          onClick={() => setDeleteConfirmId(load.id)}
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
                
                {filteredLoads.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-gray-500 italic">
                      No matching loads found in the database.
                    </TableCell>
                  </TableRow>
                )}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* ULTRA PREMIUM RIGHT-SIDE DRAWER: Load Details & Top 7 Cheapest Bids */}
      <AnimatePresence>
        {selectedLoad && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLoadId(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs z-10"
            />
            
            {/* Drawer Container */}
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="relative w-full max-w-[1250px] h-full bg-slate-50 shadow-2xl flex flex-col z-20 overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between shadow-md">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">DISPATCH CONTROL</span>
                    <span className="text-xs font-mono text-slate-300">REF: {selectedLoad.bidId}</span>
                  </div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    Load Console: <span className="text-green-400 font-mono">{selectedLoad.id}</span>
                  </h2>
                </div>
                
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" onClick={() => setSelectedLoadId(null)} className="h-8 w-8 rounded-full text-slate-400 hover:text-white hover:bg-slate-700/50">
                    <X size={18} />
                  </Button>
                </div>
              </div>

              {/* Drawer Workspace */}
              <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row">
                
                {/* Left Side: Load Spec Sheet & Route Timeline */}
                <div className="w-full lg:w-[350px] bg-white border-r border-slate-200 p-6 flex flex-col gap-6">
                  
                  {/* Status Banner */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Operational Status</h3>
                    {selectedLoad.status === 'Assigned & Dispatched' ? (
                      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
                        <div className="flex items-center gap-2 text-blue-800 font-bold text-xs">
                          <CheckCircle2 size={16} className="text-blue-600" />
                          LOAD ASSIGNED & DISPATCHED
                        </div>
                        <p className="text-[11px] text-blue-700">
                          Trip ID <span className="font-mono font-bold text-xs">{selectedLoad.tripId}</span> has been provisioned. Fleet is locked.
                        </p>
                      </div>
                    ) : selectedLoad.status === 'Negotiation In Progress' ? (
                      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-1">
                        <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
                          <Clock size={16} className="text-amber-600 animate-pulse" />
                          NEGOTIATION IN PROGRESS
                        </div>
                        <p className="text-[11px] text-amber-700">
                          Counter offer of <span className="font-bold">₹{selectedLoad.negotiationDetails?.counterOffer.toLocaleString()}</span> has been sent. Priority: {selectedLoad.negotiationDetails?.priority}.
                        </p>
                      </div>
                    ) : selectedLoad.status === 'Awaiting New Bids' ? (
                      <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 space-y-1">
                        <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                          <AlertTriangle size={16} className="text-rose-600" />
                          AWAITING NEW BIDS
                        </div>
                        <p className="text-[11px] text-rose-700">All current bids were rejected. Awaiting new user rate cards.</p>
                      </div>
                    ) : selectedLoad.status === 'Completed' ? (
                      <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-1">
                        <div className="flex items-center gap-2 text-gray-800 font-bold text-xs">
                          <CheckCircle2 size={16} className="text-gray-500" />
                          TRIP COMPLETED
                        </div>
                        <p className="text-[11px] text-gray-500">Trip has concluded. POD generated successfully.</p>
                      </div>
                    ) : (
                      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 space-y-1">
                        <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                          <Sparkles size={14} className="text-emerald-600 animate-spin" />
                          ACTIVE FREIGHT BIDDING
                        </div>
                        <p className="text-[11px] text-emerald-700">Currently taking competitive bidding quotes in real-time.</p>
                      </div>
                    )}
                  </div>

                  {/* Route Timeline */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Transit Route Timeline</h3>
                    <div className="relative pl-6 space-y-6">
                      {/* Vertical Connector Line */}
                      <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-slate-200 border-dashed border-l border-slate-300" />

                      {/* Origin */}
                      <div className="relative">
                        <span className="absolute -left-6 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold text-[10px]">A</span>
                        <h4 className="text-xs font-bold text-slate-800">{selectedLoad.from}</h4>
                        <p className="text-[10px] text-slate-400">Loading Terminal</p>
                      </div>

                      {/* Stops */}
                      {selectedLoad.stops && selectedLoad.stops.map((stop, index) => (
                        <div key={index} className="relative">
                          <span className="absolute -left-6 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-orange-700 font-bold text-[10px]">{index + 1}</span>
                          <h4 className="text-xs font-bold text-slate-800">{stop}</h4>
                          <p className="text-[10px] text-orange-500 font-medium">Intermediate Stop</p>
                        </div>
                      ))}

                      {/* Destination */}
                      <div className="relative">
                        <span className="absolute -left-6 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-[10px]">B</span>
                        <h4 className="text-xs font-bold text-slate-800">{selectedLoad.to}</h4>
                        <p className="text-[10px] text-slate-400">Receiving Warehouse</p>
                      </div>
                    </div>
                  </div>

                  {/* Load Specifications Card */}
                  <Card className="border border-slate-100 shadow-none bg-slate-50/50">
                    <CardHeader className="p-4 border-b border-slate-100 bg-slate-50">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <Building2 size={13} className="text-slate-400" /> SPECIFICATIONS
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Product Cargo:</span>
                        <span className="font-bold text-slate-800">{selectedLoad.product}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Payload Weight:</span>
                        <span className="font-bold text-slate-800">{selectedLoad.tonnes} Tonnes</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Target Freight / T:</span>
                        <span className="font-bold text-slate-800 font-mono">₹{selectedLoad.ratePerTonne}/T</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Dispatch Target:</span>
                        <span className="font-bold text-slate-800">{selectedLoad.dispatchDate}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Bid End Date:</span>
                        <span className="font-bold text-slate-800">{selectedLoad.endDate || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Bid End Time:</span>
                        <span className="font-bold text-slate-800">{selectedLoad.endTime || 'N/A'}</span>
                      </div>
                      <div className="border-t border-dashed border-slate-200 pt-3 flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-500">Target Total Freight:</span>
                        <span className="text-sm font-bold text-green-700 font-mono">₹{selectedLoad.totalFreight.toLocaleString('en-IN')}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Assigned Transporter details */}
                  {selectedLoad.assignedTransporter && (() => {
                    const isDriver = isCarrierDriver(selectedLoad.assignedTransporter.companyName, selectedLoad.assignedTransporter.ownerName, (selectedLoad.assignedTransporter as any).role);
                    return (
                      <Card className={`border shadow-none overflow-hidden ${isDriver ? 'border-indigo-200 bg-indigo-50/30' : 'border-blue-200 bg-blue-50/30'}`}>
                        <div className={`p-3.5 border-b text-xs font-bold flex items-center gap-1.5 ${isDriver ? 'bg-indigo-100/50 border-indigo-100 text-indigo-900' : 'bg-blue-100/50 border-blue-100 text-blue-900'}`}>
                          <Award size={14} className={isDriver ? 'text-indigo-600' : 'text-blue-600'} /> 
                          {isDriver ? 'CONTRACTED INDIVIDUAL DRIVER' : 'CONTRACTED CORPORATE CARRIER'}
                        </div>
                        <CardContent className={`p-4 space-y-2.5 text-xs ${isDriver ? 'text-indigo-950' : 'text-blue-950'}`}>
                          <p className={`font-bold text-sm ${isDriver ? 'text-indigo-900' : 'text-blue-900'}`}>{selectedLoad.assignedTransporter.companyName}</p>
                          <div className="flex justify-between">
                            <span className="opacity-75">{isDriver ? 'Driving License Class:' : 'Owner:'}</span>
                            <span className="font-semibold">{isDriver ? 'Commercial Heavy HZV' : selectedLoad.assignedTransporter.ownerName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="opacity-75">Rating:</span>
                            <span className="font-semibold flex items-center gap-1"><Star size={11} className="fill-amber-400 text-amber-400" /> {selectedLoad.assignedTransporter.rating}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="opacity-75">{isDriver ? 'Operating Mode:' : 'Fleet Size:'}</span>
                            <span className="font-semibold">
                              {isDriver ? 'Owner-Operator (Single Truck)' : `${selectedLoad.assignedTransporter.fleetSize} Heavy Commercials`}
                            </span>
                          </div>
                          <div className={`border-t border-dashed pt-2.5 mt-2.5 space-y-2 ${isDriver ? 'border-indigo-200' : 'border-blue-200'}`}>
                            <span className="text-[10px] font-bold tracking-wider opacity-60 uppercase block">Compliance & Dispatch Docs</span>
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className={`h-8 text-[11px] font-bold bg-white flex items-center justify-center gap-1 ${
                                  isDriver 
                                    ? 'border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800' 
                                    : 'border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800'
                                }`}
                                onClick={() => setPreviewDoc({ type: 'rc', title: 'Vehicle Registration Certificate (RC) Smart Card' })}
                              >
                                <ShieldCheck size={12} className={isDriver ? 'text-indigo-600' : 'text-blue-600'} /> View RC Card
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className={`h-8 text-[11px] font-bold bg-white flex items-center justify-center gap-1 ${
                                  isDriver 
                                    ? 'border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800' 
                                    : 'border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800'
                                }`}
                                onClick={() => setPreviewDoc({ type: 'insurance', title: 'Commercial Vehicle Insurance Certificate' })}
                              >
                                <ShieldCheck size={12} className={isDriver ? 'text-indigo-600' : 'text-blue-600'} /> View Insurance
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })()}
                  
                  {/* Export Options */}
                  <div className="mt-auto space-y-2">
                    <Button 
                      onClick={() => handleExportBidsComparison(selectedLoad)}
                      className="w-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs h-9 justify-center gap-2 text-xs font-bold"
                    >
                      <FileSpreadsheet size={14} className="text-green-600" /> Export Comparison Sheet
                    </Button>
                  </div>
                </div>

                {/* Right Side: Bid Marketplace (Cheapest Bids) */}
                <div className="flex-1 p-6 flex flex-col gap-6">
                  
                  {/* Bids Control Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        Top 7 Competitive Bids <Badge className="bg-green-600 text-white font-mono">{filteredBids.length}</Badge>
                      </h3>
                      <p className="text-xs text-slate-400">Sort carrier quotes by bid amount in ascending or descending order.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <Input 
                          value={bidSearch} 
                          onChange={e => setBidSearch(e.target.value)} 
                          placeholder="Search users..." 
                          className="pl-8 bg-white border-slate-200 text-xs h-9 shadow-xs"
                        />
                      </div>
                      
                      <div className="flex items-center gap-2 bg-slate-100 p-1 border border-slate-200 rounded-lg">
                        <div className="flex items-center gap-1.5 px-2 text-slate-500 border-r border-slate-300">
                          <Filter size={14} />
                          <span className="text-xs font-bold uppercase tracking-wider">Filter</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {(['asc', 'desc'] as const).map((opt) => (
                            <button
                              key={opt}
                              onClick={() => setBidSort(opt)}
                              className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                                bidSort === opt 
                                  ? 'bg-white text-slate-800 shadow-sm border border-slate-200' 
                                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                              }`}
                            >
                              {opt === 'asc' ? 'Low to High' : 'High to Low'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bids Table Card */}
                  <Card className="border border-slate-200/60 shadow-sm bg-white overflow-hidden flex-1 flex flex-col">
                    <div className="overflow-x-auto flex-1">
                      <Table className="w-full">
                        <TableHeader className="bg-slate-50 border-b">
                          <TableRow>
                            <TableHead className="font-bold text-slate-600 text-xs w-[60px] text-center">Rank</TableHead>
                            <TableHead className="font-bold text-slate-600 text-xs">Name</TableHead>
                            <TableHead className="font-bold text-slate-600 text-xs">Role</TableHead>
                            <TableHead className="font-bold text-slate-600 text-xs">Bid Amount</TableHead>
                            <TableHead className="font-bold text-slate-600 text-xs">Total Amount</TableHead>
                            <TableHead className="font-bold text-slate-600 text-xs">Rating</TableHead>
                            <TableHead className="font-bold text-slate-600 text-xs">Status</TableHead>
                            <TableHead className="font-bold text-slate-600 text-xs text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <AnimatePresence>
                            {filteredBids.map((bid, i) => (
                              <motion.tr 
                                layout
                                initial={{ opacity: 0, y: 12 }} 
                                animate={{ opacity: 1, y: 0 }} 
                                exit={{ opacity: 0 }} 
                                transition={{ type: 'spring', stiffness: 220, damping: 20 }}
                                key={bid.id} 
                                className={`border-b group hover:bg-slate-50/80 transition-colors ${
                                  bid.status === 'Approved' || bid.status === 'ACCEPTED' ? 'bg-green-50/20' : ''
                                }`}
                              >
                                {/* Rank */}
                                <TableCell className="text-center font-mono">
                                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs ${
                                    bid.rank === 1 ? 'bg-amber-100 text-amber-800' :
                                    bid.rank === 2 ? 'bg-slate-200 text-slate-700' :
                                    bid.rank === 3 ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {bid.rank}
                                  </span>
                                </TableCell>

                                {/* Name */}
                                <TableCell className="font-bold text-slate-800 text-xs">
                                  <span 
                                    onClick={() => setViewingTransporter(bid.transporterDetails)}
                                    className="hover:underline hover:text-green-700 cursor-pointer font-bold"
                                  >
                                    {bid.transporterName}
                                  </span>
                                </TableCell>

                                {/* Role */}
                                <TableCell>
                                  {(bid as any).role === 'Driver' ? (
                                    <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 text-[10px] font-bold px-2 py-0.5">
                                      Driver
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 text-[10px] font-bold px-2 py-0.5">
                                      Transporter
                                    </Badge>
                                  )}
                                </TableCell>

                                {/* Bid Amount (Quoted rate per tonne) */}
                                <TableCell className="font-bold text-slate-700 font-mono text-xs">
                                  ₹{bid.pricePerTonne.toLocaleString('en-IN')}/T
                                </TableCell>

                                {/* Total Amount (Quoted rate per tonne * total load tonnes) */}
                                <TableCell className="font-bold text-green-700 font-mono text-xs">
                                  ₹{(bid.pricePerTonne * selectedLoad.tonnes).toLocaleString('en-IN')}
                                </TableCell>

                                {/* Rating */}
                                <TableCell>
                                  <div className="flex items-center gap-1 text-xs font-semibold text-slate-800">
                                    <Star size={12} className="fill-amber-400 text-amber-400" />
                                    {bid.driverRating}
                                  </div>
                                </TableCell>

                                {/* Status */}
                                <TableCell>
                                  {getBidStatusBadge(bid.status)}
                                </TableCell>

                                {/* Actions */}
                                <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                                  {selectedLoad.status === 'CLOSED' || selectedLoad.status === 'Assigned & Dispatched' || selectedLoad.status === 'Completed' ? (
                                    (bid.status === 'ACCEPTED' || bid.status === 'Approved') ? (
                                      <Button 
                                        onClick={() => handleViewTruckDetails((bid as any).userId || (selectedLoad.assignedTransporter as any)?.id || '', bid)}
                                        size="sm"
                                        className="bg-blue-600 hover:bg-blue-700 text-white h-7 text-[10px] px-2.5 font-bold uppercase rounded shadow-xs"
                                      >
                                        View Truck Details
                                      </Button>
                                    ) : (
                                      <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider bg-red-50 px-2 py-1 rounded">Rejected</span>
                                    )
                                  ) : (
                                    <div className="flex items-center justify-end gap-1 select-none">
                                      <Button 
                                        onClick={() => handleApproveBid(selectedLoad.id, bid.id, bid.transporterName)}
                                        size="sm"
                                        className="bg-green-600 hover:bg-green-700 text-white h-7 text-[10px] px-2.5 font-bold uppercase rounded shadow-xs animate-pulse"
                                      >
                                        Approve
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                              </motion.tr>
                            ))}
                            
                            {filteredBids.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={8} className="h-32 text-center text-slate-400 italic">
                                  {bidSearch.trim() !== '' 
                                    ? "No bids match your search query or filters." 
                                    : "No active bids or quotes received yet for this load."}
                                </TableCell>
                              </TableRow>
                            )}
                          </AnimatePresence>
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal for Edit Load */}
      <Dialog open={!!editingLoad} onOpenChange={(val) => !val && setEditingLoad(null)}>
        <DialogContent className="sm:max-w-[550px] border-0 rounded-2xl shadow-xl overflow-hidden bg-white p-0">
          <form onSubmit={handleEditSubmit}>
            <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100 flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-bold text-gray-900">
                  Edit Load: {editingLoad?.id}
                </DialogTitle>
                <DialogDescription className="text-xs text-green-700/80 font-medium mt-1">
                  Modify dynamic cargo parameters and status.
                </DialogDescription>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setEditingLoad(null)} className="h-8 w-8 rounded-full">
                <X size={16} />
              </Button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">From Location</label>
                  <Input 
                    value={editForm.from} 
                    onChange={e => setEditForm(prev => ({ ...prev, from: e.target.value }))}
                    className="border-gray-200 shadow-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">To Location</label>
                  <Input 
                    value={editForm.to} 
                    onChange={e => setEditForm(prev => ({ ...prev, to: e.target.value }))}
                    className="border-gray-200 shadow-sm"
                  />
                </div>
              </div>

              {editForm.stops.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase block">Route Stops (Midpoints)</label>
                  {editForm.stops.map((stop, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <span className="text-xs text-orange-600 font-semibold w-16">Stop {idx+1}:</span>
                      <Input 
                        value={stop} 
                        onChange={e => handleEditStopChange(idx, e.target.value)}
                        className="border-gray-200 shadow-sm"
                      />
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="text-red-500 h-8 w-8"
                        onClick={() => {
                          const newStops = [...editForm.stops];
                          newStops.splice(idx, 1);
                          setEditForm(prev => ({ ...prev, stops: newStops }));
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex justify-start">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => setEditForm(prev => ({ ...prev, stops: [...prev.stops, ''] }))}
                  className="text-xs text-green-700 border-green-600/20 hover:bg-green-50"
                >
                  + Add Intermediate Stop
                </Button>
              </div>


              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Dispatch Date</label>
                <Input 
                  type="date"
                  value={editForm.dispatchDate}
                  onChange={e => setEditForm(prev => ({ ...prev, dispatchDate: e.target.value }))}
                  className="border-gray-200 shadow-sm"
                />
              </div>


              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Weight (Tonnes)</label>
                  <Input 
                    type="number"
                    value={editForm.tonnes}
                    onChange={e => setEditForm(prev => ({ ...prev, tonnes: parseFloat(e.target.value) || 0 }))}
                    className="border-gray-200 shadow-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Rate per Tonne (INR)</label>
                  <Input 
                    type="number"
                    value={editForm.ratePerTonne}
                    onChange={e => setEditForm(prev => ({ ...prev, ratePerTonne: parseFloat(e.target.value) || 0 }))}
                    className="border-gray-200 shadow-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase block">Dispatch Status</label>
                <select
                  value={editForm.status}
                  onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value as any }))}
                  className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="Open">Open</option>
                  <option value="Assigned">Assigned</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              {/* Real-time freight calculation preview */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase">Updated Estimated Value</span>
                <span className="text-lg font-bold text-green-700 font-mono">
                  ₹ {(editForm.tonnes * editForm.ratePerTonne).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 border-t flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingLoad(null)} className="h-9 px-4 border-gray-200">
                Cancel
              </Button>
              <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white h-9 px-4 shadow-sm">
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Delete */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(val) => !val && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-[400px] border-0 rounded-2xl shadow-xl bg-white p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900">Confirm Deletion</DialogTitle>
            <DialogDescription className="text-sm text-gray-500 mt-2">
              Are you sure you want to permanently delete load <span className="font-bold text-red-600">{deleteConfirmId}</span>? This action is irreversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} className="border-gray-200">
              Cancel
            </Button>
            <Button 
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              Permanently Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* NESTED MODAL: Carrier Profile Credentials Viewer */}
      <Dialog open={!!viewingTransporter} onOpenChange={(val) => !val && setViewingTransporter(null)}>
        <DialogContent className="sm:max-w-[450px] border-0 rounded-2xl shadow-2xl overflow-hidden bg-white p-0">
          {viewingTransporter && (() => {
            const isDriver = (viewingTransporter as any).role === 'Driver' || isCarrierDriver(viewingTransporter.companyName, viewingTransporter.ownerName, (viewingTransporter as any).role);
            return (
              <>
                <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                  <div className="space-y-1">
                    {isDriver ? (
                      <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded uppercase">
                        Verified Individual Driver
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded uppercase">
                        Verified Corporate Carrier
                      </span>
                    )}
                    <DialogTitle className="text-base font-bold tracking-tight">{viewingTransporter.companyName}</DialogTitle>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setViewingTransporter(null)} className="h-8 w-8 rounded-full text-slate-400 hover:text-white hover:bg-slate-800">
                    <X size={16} />
                  </Button>
                </div>

                <div className="p-6 space-y-4 text-sm text-slate-700">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">
                        {isDriver ? 'Driver Name' : 'Owner Name'}
                      </p>
                      <p className="font-semibold text-slate-800">
                        {isDriver ? viewingTransporter.companyName : viewingTransporter.ownerName}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">
                        {isDriver ? 'License Class' : 'Fleet Size'}
                      </p>
                      <p className="font-semibold text-slate-800">
                        {isDriver ? 'Commercial Heavy HZV' : `${viewingTransporter.fleetSize} Active Trucks`}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Trips Completed</p>
                      <p className="font-semibold text-slate-800">{viewingTransporter.completedTrips}+ Safe Trips</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">
                        {isDriver ? 'Driving Experience' : 'Experience'}
                      </p>
                      <p className="font-semibold text-slate-800">{viewingTransporter.experienceYears} Years Operational</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">KYC Verification</p>
                      <Badge className="bg-green-100 text-green-800 border-none font-bold text-[10px] px-2.5">
                        {viewingTransporter.kycStatus}
                      </Badge>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">
                        {isDriver ? 'Driver Insurance' : 'Insurance Validity'}
                      </p>
                      <p className="font-semibold text-emerald-700 flex items-center gap-1 text-xs">
                        <ShieldCheck size={13} /> {viewingTransporter.insuranceValidity}
                      </p>
                    </div>
                  </div>

                  {viewingTransporter.remarks && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mt-2">
                      <p className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                        <MessageSquare size={11} /> Negotiation Comments
                      </p>
                      <p className="text-xs italic text-slate-600 mt-1">{viewingTransporter.remarks}</p>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-slate-50 border-t flex justify-end">
                  <Button onClick={() => setViewingTransporter(null)} className="bg-slate-900 hover:bg-slate-800 text-white h-9 px-4">
                    Close Profile
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* NESTED MODAL: Freight Bid Negotiation Counter Offer */}
      <Dialog open={!!negotiatingBid} onOpenChange={(val) => !val && setNegotiatingBid(null)}>
        <DialogContent className="sm:max-w-[420px] border-0 rounded-2xl shadow-2xl overflow-hidden bg-white p-0">
          {negotiatingBid && (
            <form onSubmit={handleNegotiateSubmit}>
              <div className="p-6 bg-gradient-to-r from-amber-50 to-orange-50 text-slate-900 border-b border-amber-100 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold bg-amber-500/20 text-amber-800 border border-amber-500/30 px-2 py-0.5 rounded">NEGOTIATION CONSOLE</span>
                  <DialogTitle className="text-base font-bold tracking-tight">
                    Negotiate: {negotiatingBid.bid.transporterName}
                  </DialogTitle>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => setNegotiatingBid(null)} className="h-8 w-8 rounded-full text-slate-400 hover:text-slate-900 hover:bg-amber-100/50">
                  <X size={16} />
                </Button>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-amber-50 border border-amber-100/80 rounded-xl p-3.5 space-y-2 text-xs text-amber-950">
                  <div className="flex justify-between">
                    <span>Current Carrier Bid:</span>
                    <span className="font-bold text-slate-700 font-mono">₹{negotiatingBid.bid.bidAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Base Target Rate:</span>
                    <span className="font-bold text-slate-700 font-mono">₹{selectedLoad?.totalFreight.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                    <Coins size={13} className="text-slate-400" /> Counter Offer Amount (INR) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                    <Input 
                      type="number" 
                      value={counterOffer}
                      onChange={e => setCounterOffer(e.target.value)}
                      placeholder="Enter counter freight amount..." 
                      className="pl-7 border-slate-200 font-mono focus-visible:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Valid Till</label>
                    <Input 
                      type="date"
                      value={negotiationValidTill}
                      onChange={e => setNegotiationValidTill(e.target.value)}
                      className="border-slate-200 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Priority Level</label>
                    <select
                      value={negotiationPriority}
                      onChange={e => setNegotiationPriority(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                    <MessageSquare size={13} className="text-slate-400" /> Special Remarks / Instructions
                  </label>
                  <textarea 
                    value={negotiationRemarks}
                    onChange={e => setNegotiationRemarks(e.target.value)}
                    placeholder="Enter negotiation terms, free detention details, or trip remarks..." 
                    className="w-full min-h-[80px] p-3 rounded-md border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-amber-500 text-slate-700"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setNegotiatingBid(null)} className="h-9 px-4 border-slate-200">
                  Cancel
                </Button>
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white h-9 px-4 shadow-sm font-bold uppercase text-xs tracking-wider">
                  Transmit Counter Offer
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Bid Rejection */}
      <Dialog open={!!rejectConfirmBid} onOpenChange={(val) => !val && setRejectConfirmBid(null)}>
        <DialogContent className="sm:max-w-[400px] border-0 rounded-2xl shadow-xl bg-white p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-500" /> Reject Bid
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 mt-2">
              Are you sure you want to reject the bid from <span className="font-bold text-slate-800">{rejectConfirmBid?.transporterName}</span>? A notification will be dispatched to the carrier.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setRejectConfirmBid(null)} className="border-slate-200">
              Cancel
            </Button>
            <Button 
              className="bg-red-600 hover:bg-red-700 text-white font-bold"
              onClick={handleRejectBid}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DOCUMENT PREVIEW MODAL: High-fidelity interactive Inspector */}
      <Dialog open={!!previewDoc} onOpenChange={(val) => !val && setPreviewDoc(null)}>
        <DialogContent className="sm:max-w-[550px] border-0 rounded-2xl shadow-2xl overflow-hidden bg-slate-950 p-0 text-white">
          {previewDoc && (
            <div className="flex flex-col h-full font-sans">
              {/* Top Title Bar */}
              <div className="p-5 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="text-emerald-500 h-5 w-5 animate-pulse" />
                  <div>
                    <h3 className="text-sm font-bold tracking-tight text-white">{previewDoc.title}</h3>
                    <p className="text-[10px] text-slate-400 font-medium">Secured & Encrypted Credentials Verification</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setPreviewDoc(null)} 
                  className="h-8 w-8 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X size={16} />
                </Button>
              </div>

              {/* Document Container */}
              <div className="p-6 bg-slate-900/50 flex items-center justify-center min-h-[360px] overflow-hidden relative">
                
                {/* 1. VEHICLE RC SMART CARD */}
                {previewDoc.type === 'rc' && (
                  <div className="w-[440px] h-[260px] rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-slate-700/60 p-4 shadow-2xl flex flex-col justify-between relative overflow-hidden select-none">
                    {/* Security Watermark Map Grid */}
                    <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]" />
                    
                    {/* Header */}
                    <div className="border-b border-slate-800/80 pb-2 flex items-center justify-between z-10">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-[10px] text-emerald-400 font-bold">印</div>
                        <div>
                          <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest leading-none">MINISTRY OF ROAD TRANSPORT & HIGHWAYS</p>
                          <p className="text-[9px] font-extrabold text-white tracking-wider leading-none mt-0.5">GOVERNMENT OF INDIA</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">
                          RC VERIFIED
                        </span>
                      </div>
                    </div>

                    {/* Middle Section */}
                    <div className="flex gap-4 items-center my-auto z-10">
                      {/* Gold Chip Graphic */}
                      <div className="w-12 h-9 rounded-md bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 border border-amber-600/30 shadow-md relative flex items-center justify-center p-1 overflow-hidden shrink-0">
                        {/* Microchip Tracks */}
                        <div className="absolute inset-x-2 top-0 bottom-0 border-l border-r border-amber-700/30" />
                        <div className="absolute inset-y-1.5 left-0 right-0 border-t border-b border-amber-700/30" />
                        <div className="w-4 h-4 rounded-sm bg-amber-600/20 border border-amber-600/30 z-10" />
                      </div>

                      {/* Registration Plate */}
                      <div className="flex-1">
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider leading-none">REGISTRATION NUMBER</p>
                        <p className="text-xl font-extrabold font-mono text-white tracking-widest mt-1">
                          MH-12-KL-3402
                        </p>
                        <p className="text-[9px] font-medium text-indigo-300 mt-0.5 leading-none">
                          TATA LPT 3518 Cowl / HEAVY MOTOR VEHICLE
                        </p>
                      </div>
                    </div>

                    {/* Bottom Metadata grid */}
                    <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-slate-800/80 z-10 text-[8px]">
                      <div>
                        <span className="text-slate-400 uppercase font-bold block">REGISTERED OWNER</span>
                        <span className="font-extrabold text-white truncate block mt-0.5">
                          {selectedLoad?.assignedTransporter?.companyName || 'Biofactor Transporter'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 uppercase font-bold block">REGISTRATION DATE</span>
                        <span className="font-extrabold text-white block mt-0.5">12-Feb-2024</span>
                      </div>
                      <div>
                        <span className="text-slate-400 uppercase font-bold block">VALIDITY EXPIRE</span>
                        <span className="font-extrabold text-emerald-400 block mt-0.5">11-Feb-2039</span>
                      </div>
                    </div>

                    {/* Security Seals & Barcodes */}
                    <div className="absolute right-3 top-12 opacity-30 flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full border-2 border-dashed border-indigo-400 flex items-center justify-center text-[7px] text-indigo-400 font-bold text-center rotate-12 leading-tight">
                        STATE DEPT
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. INSURANCE POLICY SHEET */}
                {previewDoc.type === 'insurance' && (
                  <div className="w-[430px] h-[300px] rounded-xl bg-gradient-to-b from-white via-slate-50 to-white border-4 border-double border-slate-300 p-4 shadow-2xl flex flex-col justify-between text-slate-800 relative overflow-hidden select-none">
                    {/* Header */}
                    <div className="text-center border-b pb-2 border-slate-200 relative">
                      <div className="flex items-center justify-center gap-1">
                        <Award className="text-blue-700 h-4 w-4" />
                        <h4 className="text-xs font-black tracking-widest text-blue-900 uppercase">ROYAL SECURITY INSURANCE CO. LTD.</h4>
                      </div>
                      <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest leading-none mt-1">COMMERCIAL MOTOR VEHICLE COMPREHENSIVE INSURANCE POLICY</p>
                      <span className="absolute right-0 top-0 text-[7px] font-mono font-bold bg-green-100 border border-green-200 text-green-700 px-1 rounded">
                        ACTIVE
                      </span>
                    </div>

                    {/* Table grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 my-auto text-[8px] border-b pb-3 border-slate-100">
                      <div className="space-y-0.5">
                        <span className="text-slate-400 uppercase font-bold block">POLICY NUMBER</span>
                        <span className="font-bold text-slate-800 font-mono block">RS-5590-M-489021-2026</span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-slate-400 uppercase font-bold block">INSURED PARTY NAME</span>
                        <span className="font-bold text-slate-800 block truncate">
                          {selectedLoad?.assignedTransporter?.companyName || 'Biofactor Transporter'}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-slate-400 uppercase font-bold block">VEHICLE REGISTRATION NO.</span>
                        <span className="font-bold text-slate-800 font-mono block">MH-12-KL-3402</span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-slate-400 uppercase font-bold block">COVERAGE PERIOD VALIDITY</span>
                        <span className="font-bold text-slate-800 block">
                          Until Dec 31, 2026 (23:59:59)
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-slate-400 uppercase font-bold block">INSURED DECLARED VALUE (IDV)</span>
                        <span className="font-bold text-green-700 font-mono block">₹28,50,000.00</span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-slate-400 uppercase font-bold block">PREMIUM CONTRIBUTION</span>
                        <span className="font-bold text-slate-800 font-mono block">₹48,250.00 (PAID)</span>
                      </div>
                    </div>

                    {/* Stamp & Footer */}
                    <div className="flex justify-between items-end pt-2">
                      <div className="space-y-0.5">
                        <p className="text-[7px] text-slate-400 leading-none">Underwriter stamp & code</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          {/* Round stamp */}
                          <div className="w-10 h-10 rounded-full border border-dashed border-red-500/80 flex items-center justify-center text-[5px] text-red-500 font-bold text-center rotate-12 leading-tight">
                            ROYAL INS.<br/>APPROVED
                          </div>
                          <div className="w-10 h-10 rounded-full border border-double border-indigo-600/80 flex items-center justify-center text-[5px] text-indigo-600 font-bold text-center -rotate-6 leading-tight">
                            BIOFACTOR<br/>VERIFIED
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-[6px] italic font-serif text-slate-500">Chief Underwriting Officer</p>
                        <div className="w-20 h-5 border-b border-slate-300 font-serif text-[10px] text-slate-400 mt-0.5">
                          S. Chatterjee
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Footer Actions */}
              <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-end gap-2">
                <Button 
                  onClick={() => setPreviewDoc(null)} 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 text-xs px-5 shadow-lg active:scale-95"
                >
                  Approve Document Credentials
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* TRUCK PROFILE & ADDRESS DISPATCH CONSOLE DIALOG */}
      <Dialog open={!!viewingTruckProfile} onOpenChange={(val) => !val && setViewingTruckProfile(null)}>
        <DialogContent className="max-w-4xl border-0 rounded-2xl shadow-2xl overflow-hidden bg-slate-900 text-white p-0">
          {viewingTruckProfile && (
            <div className="flex flex-col h-full max-h-[90vh]">
              {/* Header */}
              <div className="p-6 bg-slate-950 border-b border-slate-800 flex justify-between items-center font-sans">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Truck size={20} />
                  </div>
                  <div className="text-left">
                    <h3 className="text-base font-bold tracking-tight text-white">Truck Details & Address Dispatch</h3>
                    <p className="text-xs text-slate-400">Audit carrier compliance documents and dispatch coordinates.</p>
                  </div>
                </div>
                <Button 
                  type="button"
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setViewingTruckProfile(null)} 
                  className="h-8 w-8 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X size={16} />
                </Button>
              </div>

              {/* Grid Content */}
              <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-900/50">
                {/* Left Column: Truck Info & Documents */}
                <div className="space-y-6">
                  {/* Truck Info Card */}
                  <Card className="border border-slate-800 bg-slate-950/80 shadow-none text-white overflow-hidden">
                    <div className="p-4 bg-slate-950 border-b border-slate-800/80 flex items-center gap-2">
                      <ShieldCheck className="text-blue-500 h-4 w-4" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Carrier & Truck Profile</span>
                    </div>
                    <CardContent className="p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-xs text-left">
                        <div className="space-y-1">
                          <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">Carrier Name</span>
                          <span className="font-bold text-slate-100 text-sm">{viewingTruckProfile.carrierName}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">Role</span>
                          <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold px-2 py-0.5">
                            {viewingTruckProfile.role}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">Truck Name</span>
                          <span className="font-bold text-slate-100 text-sm">{viewingTruckProfile.truckName}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">Truck Number</span>
                          <span className="font-bold text-blue-400 font-mono text-sm tracking-wider">{viewingTruckProfile.truckNumber}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Document Previews Container */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block text-left">Uploaded Compliance Documents</span>
                    
                    {/* Document Selector tabs */}
                    <div className="flex gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setViewingDocTab('rc')}
                        className={`flex-1 text-xs py-2 rounded-md font-bold transition-all ${
                          viewingDocTab === 'rc' 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Vehicle RC Card
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewingDocTab('insurance')}
                        className={`flex-1 text-xs py-2 rounded-md font-bold transition-all ${
                          viewingDocTab === 'insurance' 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Insurance Policy
                      </button>
                    </div>

                    {/* Active Tab Document preview */}
                    <div className="flex items-center justify-center min-h-[320px] border border-slate-800 bg-slate-950/50 rounded-xl p-4 relative overflow-hidden">
                      {viewingDocTab === 'rc' ? (
                        (viewingTruckProfile.rcImageUrl && !rcImgFallback) ? (
                          <div className="space-y-2 text-center w-full">
                            <img 
                              src={viewingTruckProfile.rcImageUrl} 
                              alt="Vehicle RC Document" 
                              className="max-h-[280px] mx-auto rounded-lg border border-slate-700 object-contain shadow-lg"
                              onError={() => {
                                setRcImgFallback(true);
                              }}
                            />
                          </div>
                        ) : (
                          renderSmartRcCard(viewingTruckProfile)
                        )
                      ) : (
                        (viewingTruckProfile.insImageUrl && !insImgFallback) ? (
                          <div className="space-y-2 text-center w-full">
                            <img 
                              src={viewingTruckProfile.insImageUrl} 
                              alt="Vehicle Insurance Document" 
                              className="max-h-[280px] mx-auto rounded-lg border border-slate-700 object-contain shadow-lg"
                              onError={() => {
                                setInsImgFallback(true);
                              }}
                            />
                          </div>
                        ) : (
                          renderSmartInsuranceCard(viewingTruckProfile)
                        )
                      )}
                    </div>
                  </div>

                  {/* Verification Button */}
                  <div className="pt-4">
                    {!isTruckVerified ? (
                      <Button
                        type="button"
                        onClick={() => {
                          setIsTruckVerified(true);
                          if (selectedLoad) {
                            localStorage.setItem(`verified_truck_${selectedLoad.id}`, 'true');
                          }
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 rounded-xl shadow-lg active:scale-95 flex items-center justify-center gap-2 border border-emerald-500/20"
                      >
                        <ShieldCheck size={18} />
                        Approve & Verify Truck Credentials
                      </Button>
                    ) : (
                      <div className="w-full py-3 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold flex items-center justify-center gap-2 text-sm">
                        <CheckCircle2 size={18} className="text-emerald-400" />
                        Truck Credentials Verified ✓
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Dispatch Input Form */}
                <div className="flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-800 md:pl-6 pt-6 md:pt-0 relative min-h-[400px]">
                  {(() => {
                    const isDispatched = selectedLoad?.status === 'Assigned & Dispatched';
                    return (
                      <>
                        {!isTruckVerified && !isDispatched && (
                          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-[3px] z-20 flex flex-col items-center justify-center p-6 text-center rounded-r-2xl">
                            <div className="w-14 h-14 rounded-full bg-slate-950 border border-slate-850 flex items-center justify-center text-slate-500 mb-4 shadow-2xl animate-pulse">
                              <AlertTriangle size={24} className="text-amber-500" />
                            </div>
                            <h4 className="text-sm font-bold text-slate-200">Verification Pending</h4>
                            <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">
                              Please review the carrier's compliance documents (RC & Insurance) on the left and click <strong>"Approve & Verify Truck Credentials"</strong> to unlock the dispatch routing console.
                            </p>
                          </div>
                        )}

                        <form onSubmit={handleDispatchTrip} className="space-y-6 flex-1 flex flex-col justify-between text-left">
                          <div className="space-y-4">
                            {isDispatched ? (
                              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 space-y-1.5 text-left">
                                <div className="flex items-center gap-2 font-bold text-blue-200">
                                  <CheckCircle2 size={14} className="text-blue-400" />
                                  TRIP ASSIGNED & DISPATCHED
                                </div>
                                <p className="leading-relaxed text-slate-300">
                                  This trip has already been successfully dispatched. The location coordinates and addresses have been transmitted to the driver.
                                </p>
                              </div>
                            ) : (
                              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 space-y-1.5 text-left">
                                <div className="flex items-center gap-2 font-bold text-emerald-200">
                                  <CheckCircle2 size={14} className="text-emerald-400" />
                                  DOCUMENT REVIEW APPROVED
                                </div>
                                <p className="leading-relaxed text-slate-300">
                                  The documents and truck credentials match standard regulations. Please proceed with specifying pickup & delivery destinations to assign the trip.
                                </p>
                              </div>
                            )}

                            {/* Loading Address */}
                            <div className="space-y-2 text-left">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <MapPin size={13} className="text-green-500" /> Loading Address
                              </label>
                              <div className="flex gap-2">
                                <Input 
                                  value={loadingAddressInput}
                                  onChange={(e) => setLoadingAddressInput(e.target.value)}
                                  placeholder="Enter dispatch pick-up point address..."
                                  className="bg-slate-950 border-slate-800 text-white focus-visible:ring-blue-500 focus-visible:ring-offset-slate-900 placeholder:text-slate-600 disabled:opacity-75 disabled:cursor-not-allowed flex-1"
                                  required
                                  disabled={isDispatched}
                                />
                                {!isDispatched && (
                                  <Button
                                    type="button"
                                    onClick={handleFetchLoadingGps}
                                    disabled={isGeocodingLoading}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-3 text-xs shrink-0 rounded-lg active:scale-95"
                                  >
                                    {isGeocodingLoading ? "..." : "Fetch GPS"}
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Unloading Address */}
                            <div className="space-y-2 text-left">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <MapPin size={13} className="text-red-500" /> Unloading Address
                              </label>
                              <div className="flex gap-2">
                                <Input 
                                  value={unloadingAddressInput}
                                  onChange={(e) => setUnloadingAddressInput(e.target.value)}
                                  placeholder="Enter drop-off destination address..."
                                  className="bg-slate-950 border-slate-800 text-white focus-visible:ring-blue-500 focus-visible:ring-offset-slate-900 placeholder:text-slate-600 disabled:opacity-75 disabled:cursor-not-allowed flex-1"
                                  required
                                  disabled={isDispatched}
                                />
                                {!isDispatched && (
                                  <Button
                                    type="button"
                                    onClick={handleFetchUnloadingGps}
                                    disabled={isGeocodingUnloading}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-3 text-xs shrink-0 rounded-lg active:scale-95"
                                  >
                                    {isGeocodingUnloading ? "..." : "Fetch GPS"}
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Advanced/Auto GPS Coordinates Inputs */}
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2 text-left">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                  <MapPin size={13} className="text-emerald-400" /> Loading Location GPS
                                </label>
                                <Input 
                                  value={loadingGpsInput}
                                  onChange={(e) => setLoadingGpsInput(e.target.value)}
                                  placeholder="e.g. 17.3850, 78.4867"
                                  className="bg-slate-950 border-slate-800 text-white font-mono text-xs focus-visible:ring-blue-500 focus-visible:ring-offset-slate-900 placeholder:text-slate-700 disabled:opacity-75 disabled:cursor-not-allowed"
                                  required
                                  disabled={isDispatched}
                                />
                              </div>
                              <div className="space-y-2 text-left">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                  <MapPin size={13} className="text-red-400" /> Unloading Location GPS
                                </label>
                                <Input 
                                  value={unloadingGpsInput}
                                  onChange={(e) => setUnloadingGpsInput(e.target.value)}
                                  placeholder="e.g. 16.5062, 80.6480"
                                  className="bg-slate-950 border-slate-800 text-white font-mono text-xs focus-visible:ring-blue-500 focus-visible:ring-offset-slate-900 placeholder:text-slate-700 disabled:opacity-75 disabled:cursor-not-allowed"
                                  required
                                  disabled={isDispatched}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="pt-6 border-t border-slate-800 mt-6 flex justify-end gap-3 w-full">
                            <Button 
                              type="button" 
                              variant="outline" 
                              onClick={() => setViewingTruckProfile(null)}
                              className="border-slate-800 text-slate-300 hover:bg-slate-850 hover:text-white"
                            >
                              {isDispatched ? 'Close Console' : 'Cancel'}
                            </Button>
                            {isDispatched ? (
                              <div className="bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 font-bold h-9 px-5 rounded-md flex items-center gap-2 text-sm shadow-md">
                                <CheckCircle2 size={16} className="text-emerald-400" />
                                Shared Location Details ✓
                              </div>
                            ) : (
                              <Button 
                                type="submit" 
                                disabled={isSubmittingAddress}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 px-5 shadow-lg active:scale-95 flex items-center gap-2"
                              >
                                {isSubmittingAddress ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Dispatching...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles size={14} />
                                    Submit Address & Dispatch
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </form>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
