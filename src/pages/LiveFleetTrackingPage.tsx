import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Truck, ShieldAlert, Clock, CheckCircle2, User, Phone, MapPin, 
  Search, Filter, Activity, Bell, PhoneCall, AlertTriangle, Shield,
  Layers, Map, Play, Pause, ChevronRight, X, AlertCircle, Compass, 
  ArrowRight, Moon, Sun, Fuel, Navigation, Volume2, Settings
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useTrackingStore, type VehicleTrip, type LiveAlert, injectToastHook, type TripStatus } from '@/store/trackingStore';
import { calculateDistance } from '@/services/gpsService';
import { apiClient } from '@/services/apiClient';

declare global {
  interface Window {
    L: any;
  }
}

export default function LiveFleetTrackingPage() {
  const { toast } = useToast();
  
  // Inject toast hook into store
  useEffect(() => {
    injectToastHook(toast);
  }, [toast]);

  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab');

  const { 
    trips, 
    alerts, 
    selectedTripId, 
    mapViewMode, 
    searchQuery, 
    statusFilter,
    setSelectedTripId, 
    setMapViewMode, 
    setSearchQuery, 
    setStatusFilter,
    triggerEmergency,
    dismissAlert,
    reassignVehicle,
    simulateGpsMovement,
    fetchTrips
  } = useTrackingStore();

  // Poll live trip coordinates & statuses from the backend database every 10 seconds
  useEffect(() => {
    fetchTrips();
    const interval = setInterval(() => {
      fetchTrips();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchTrips]);

  const [simulationActive, setSimulationActive] = useState(true);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [reassignInput, setReassignInput] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);

  // Dispatch Coordinates states
  const [loadingAddress, setLoadingAddress] = useState("Plant Gate #3, Biofactor Industrial Zone, Hyderabad, TS");
  const [unloadingAddress, setUnloadingAddress] = useState("Warehouse B-12, Agriculture Center, Vijayawada, AP");
  const [loadingGps, setLoadingGps] = useState("17.385044, 78.486671");
  const [unloadingGps, setUnloadingGps] = useState("16.506174, 80.648015");
  const [isDispatching, setIsDispatching] = useState(false);
  const [isGeocodingLoading, setIsGeocodingLoading] = useState(false);
  const [isGeocodingUnloading, setIsGeocodingUnloading] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  const polylineRef = useRef<{ [key: string]: any }>({});
  const geofencesRef = useRef<{ [key: string]: any[] }>({});

  // Parse direct sub-tabs from URL query
  useEffect(() => {
    if (initialTab === 'alerts') {
      setStatusFilter('Delayed');
    } else if (initialTab === 'drivers') {
      setStatusFilter('Moving');
    } else if (initialTab === 'routes') {
      setStatusFilter('Moving');
    }
  }, [initialTab, setStatusFilter]);

  // Load Leaflet dynamically
  useEffect(() => {
    if (window.L) {
      setLeafletLoaded(true);
      return;
    }

    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(cssLink);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => {
      setLeafletLoaded(true);
    };
    document.head.appendChild(script);
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current || mapRef.current) return;

    // Center on central India logistics hub coordinates
    mapRef.current = window.L.map(mapContainerRef.current, {
      zoomControl: false,
    }).setView([22.5937, 78.9629], 5);

    // Apply Standard OpenStreetMap tiles
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapRef.current);

    // Add clean zoom control on bottom right
    window.L.control.zoom({
      position: 'bottomright'
    }).addTo(mapRef.current);
  }, [leafletLoaded]);

  // Map Tile Mode Changer
  useEffect(() => {
    if (!mapRef.current || !leafletLoaded) return;

    // Clear previous tile layer
    mapRef.current.eachLayer((layer: any) => {
      if (layer instanceof window.L.TileLayer) {
        mapRef.current.removeLayer(layer);
      }
    });

    let tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    if (mapViewMode === 'satellite') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    } else if (mapViewMode === 'light') {
      tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    } else if (mapViewMode === 'dark') {
      tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    }

    window.L.tileLayer(tileUrl, {
      attribution: 'Biofactor GPS Monitoring Tower'
    }).addTo(mapRef.current);
  }, [mapViewMode, leafletLoaded]);

  // Sync Markers and Polyline Routes
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current) return;

    // Filter trips to keep only active (Assigned & Dispatched) ones:
    // - Assigned (status is 'PENDING')
    // - Dispatched/Active (status is 'Moving', 'Idle', 'Delayed', 'Offline')
    const activeTrips = trips.filter(t => 
      t.status === 'PENDING' || 
      t.status === 'Moving' || 
      t.status === 'Idle' || 
      t.status === 'Delayed' || 
      t.status === 'Offline'
    );

    // Clear markers/polylines for trips that are no longer active/visible
    Object.keys(markersRef.current).forEach(id => {
      if (!activeTrips.some(t => t.id === id)) {
        mapRef.current.removeLayer(markersRef.current[id]);
        delete markersRef.current[id];
      }
    });
    Object.keys(polylineRef.current).forEach(id => {
      if (!activeTrips.some(t => t.id === id)) {
        mapRef.current.removeLayer(polylineRef.current[id]);
        delete polylineRef.current[id];
      }
    });
    Object.keys(geofencesRef.current).forEach(id => {
      if (!activeTrips.some(t => t.id === id)) {
        geofencesRef.current[id].forEach(layer => mapRef.current.removeLayer(layer));
        delete geofencesRef.current[id];
      }
    });

    activeTrips.forEach((trip) => {
      const { id, currentCoords, vehicleNumber, status, transporter, driverName } = trip;
      const statusColor = 
        status === 'Moving' ? '#10b981' :
        status === 'Stopped' ? '#64748b' :
        status === 'Delayed' ? '#f43f5e' :
        status === 'Idle' ? '#f59e0b' :
        status === 'Offline' ? '#94a3b8' : '#3b82f6';

      // 1. UPDATE VEHICLE MARKERS
      if (markersRef.current[id]) {
        markersRef.current[id].setLatLng([currentCoords.lat, currentCoords.lng]);
        
        // Update radar pulse color in existing custom icon HTML dynamically
        const html = `
          <div class="relative flex items-center justify-center">
            <div class="absolute h-8 w-8 rounded-full animate-ping" style="background-color: ${statusColor}40"></div>
            <div class="h-6 w-6 text-white rounded-full flex items-center justify-center shadow-md border-2 border-slate-900 transition-all duration-300" style="background-color: ${statusColor}; font-size: 10px;">
              🚚
            </div>
          </div>
        `;
        const updatedIcon = window.L.divIcon({
          html,
          className: 'custom-div-icon',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
        markersRef.current[id].setIcon(updatedIcon);
      } else {
        const html = `
          <div class="relative flex items-center justify-center">
            <div class="absolute h-8 w-8 rounded-full animate-ping" style="background-color: ${statusColor}40"></div>
            <div class="h-6 w-6 text-white rounded-full flex items-center justify-center shadow-md border-2 border-slate-900 transition-all duration-300" style="background-color: ${statusColor}; font-size: 10px;">
              🚚
            </div>
          </div>
        `;
        
        const customIcon = window.L.divIcon({
          html,
          className: 'custom-div-icon',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const marker = window.L.marker([currentCoords.lat, currentCoords.lng], { icon: customIcon })
          .addTo(mapRef.current)
          .on('click', () => {
            setSelectedTripId(id);
          });

        marker.bindTooltip(`
          <div class="p-1 font-sans text-xs bg-slate-900 text-white rounded border-0">
            <span class="font-bold font-mono">${vehicleNumber}</span>
            <div class="text-[9px] text-slate-300 mt-0.5">${driverName} | ${transporter}</div>
          </div>
        `, { direction: 'top', permanent: false });

        markersRef.current[id] = marker;
      }

      // 2. UPDATE ROUTE POLYLINES
      if (!polylineRef.current[id]) {
        const coords = trip.routeCoords.map(c => [c.lat, c.lng]);
        const polyline = window.L.polyline(coords, {
          color: statusColor,
          weight: 3,
          opacity: 0.55,
          dashArray: status === 'Delayed' ? '5, 10' : 'none'
        }).addTo(mapRef.current);
        
        polylineRef.current[id] = polyline;
      } else {
        // Dynamically update coordinate coordinates list
        polylineRef.current[id].setLatLngs(trip.routeCoords.map(c => [c.lat, c.lng]));
        // Dynamically shift color or dashArray if status updates
        polylineRef.current[id].setStyle({
          color: statusColor,
          dashArray: status === 'Delayed' ? '5, 10' : 'none'
        });
      }

      // 3. DRAW GEOFENCE CIRCLES
      if (!geofencesRef.current[id]) {
        geofencesRef.current[id] = trip.geofences.map(fence => {
          return window.L.circle([fence.lat, fence.lng], {
            radius: fence.radius,
            color: '#10b981',
            fillColor: '#10b981',
            fillOpacity: 0.05,
            weight: 1,
            dashArray: '3, 5'
          }).addTo(mapRef.current);
        });
      }
    });
  }, [trips, leafletLoaded, setSelectedTripId]);

  // Center Map on Selected Vehicle
  useEffect(() => {
    if (!selectedTripId || !leafletLoaded || !mapRef.current) return;
    const selected = trips.find(t => t.id === selectedTripId);
    if (selected) {
      mapRef.current.setView([selected.currentCoords.lat, selected.currentCoords.lng], 8, {
        animate: true,
        duration: 1
      });
    }
  }, [selectedTripId, leafletLoaded, trips]);

  // Simulation timer loop
  useEffect(() => {
    if (!simulationActive) return;

    const interval = setInterval(() => {
      simulateGpsMovement();
    }, 4000);

    return () => clearInterval(interval);
  }, [simulationActive, simulateGpsMovement]);

  // Filtering trips
  const filteredTrips = useMemo(() => {
    return trips.filter(t => {
      // Exclude Completed or Completed-equivalent (Stopped) trips from active live tracking
      const isAssignedOrDispatched = 
        t.status === 'PENDING' || 
        t.status === 'Moving' || 
        t.status === 'Idle' || 
        t.status === 'Delayed' || 
        t.status === 'Offline';
        
      if (!isAssignedOrDispatched) return false;

      const matchesSearch = 
        t.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.driverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.transporter.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.bidId && t.bidId.toLowerCase().includes(searchQuery.toLowerCase())) ||
        t.id.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesFilter = true;
      if (statusFilter !== 'All') {
        matchesFilter = t.status === statusFilter;
      }

      return matchesSearch && matchesFilter;
    });
  }, [trips, searchQuery, statusFilter]);

  // Calculations for stats
  const stats = useMemo(() => {
    const active = trips.filter(t => (t.status as string) !== 'Completed' && t.status !== 'Offline').length;
    const delayed = trips.filter(t => t.status === 'Delayed').length;
    const idle = trips.filter(t => t.status === 'Idle').length;
    const completed = trips.filter(t => (t.status as string) === 'Completed' || t.eta === 'Arrived at Destination').length;
    const offline = trips.filter(t => t.status === 'Offline').length;
    const deviations = trips.filter(t => t.deviationAlert).length;

    return { active, delayed, idle, completed, offline, deviations };
  }, [trips]);

  const selectedTrip = useMemo(() => {
    return trips.find(t => t.id === selectedTripId) || null;
  }, [trips, selectedTripId]);

  const handleFetchLoadingGps = async () => {
    if (!loadingAddress) return;
    setIsGeocodingLoading(true);
    try {
      const parts = loadingAddress.split(',').map(p => p.trim()).filter(Boolean);
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
        setLoadingGps(`${parseFloat(foundData.lat).toFixed(6)}, ${parseFloat(foundData.lon).toFixed(6)}`);
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
    if (!unloadingAddress) return;
    setIsGeocodingUnloading(true);
    try {
      const parts = unloadingAddress.split(',').map(p => p.trim()).filter(Boolean);
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
        setUnloadingGps(`${parseFloat(foundData.lat).toFixed(6)}, ${parseFloat(foundData.lon).toFixed(6)}`);
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

  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTripId) return;

    setIsDispatching(true);
    try {
      const payload = {
        loadingAddress,
        unloadingAddress,
        loadingGpsCoordinates: loadingGps,
        unloadingGpsCoordinates: unloadingGps,
      };

      try {
        await apiClient.dispatchTripDetails(selectedTripId, payload);
      } catch (backendError) {
        console.warn("Backend dispatch failed, falling back to local simulation.", backendError);
      }

      await useTrackingStore.getState().dispatchTripDetails(selectedTripId, payload);

      toast({
        title: "Trip Dispatched Successfully",
        description: `Active routing path stream plotted. Vehicle status changed to Moving.`,
        className: "bg-emerald-600 text-white font-bold border-none shadow-xl"
      });
    } catch (error: any) {
      toast({
        title: "Dispatch Failed",
        description: error.message || "Failed to dispatch trip details.",
        variant: "destructive"
      });
    } finally {
      setIsDispatching(false);
    }
  };

  const handleReassignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTripId || !reassignInput.trim()) return;

    reassignVehicle(selectedTripId, reassignInput);
    toast({
      title: "Vehicle Swapped Successfully",
      description: `Trip reassigned to vehicle ${reassignInput}.`,
      className: "bg-emerald-600 text-white font-bold border-none"
    });
    setReassignInput('');
    setIsReassigning(false);
  };

  const getStatusBadge = (status: TripStatus) => {
    switch (status) {
      case 'Moving': return <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse">Moving</Badge>;
      case 'Stopped': return <Badge className="bg-slate-50 text-slate-500 border border-slate-200">Stopped</Badge>;
      case 'Delayed': return <Badge className="bg-rose-50 text-rose-700 border border-rose-200">Delayed</Badge>;
      case 'Idle': return <Badge className="bg-amber-50 text-amber-700 border border-amber-200">Idle</Badge>;
      case 'Offline': return <Badge className="bg-slate-100 text-slate-400 border border-slate-200">Offline</Badge>;
      case 'PENDING': return <Badge className="bg-amber-50 text-amber-700 border border-amber-300 animate-pulse">Pending Dispatch</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-full overflow-hidden pb-12 font-sans">
      
      {/* Page Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Compass className="text-primary h-6 w-6 animate-spin-slow" /> Live Fleet Tracking Center
          </h1>
          <p className="text-sm text-slate-500 mt-1">Monitor active transporter vehicles, driver routes, stoppages, and live logistics movement.</p>
        </div>
        
        {/* Simulation controller widget */}
        <div className="flex items-center gap-2 bg-slate-50 border p-1.5 rounded-xl self-start">
          <Badge className={`${simulationActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'} text-white border-none text-[9px] uppercase px-2 py-0.5`}>
            {simulationActive ? 'GPS SIMULATOR ACTIVE' : 'GPS PAUSED'}
          </Badge>
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-7 w-7 text-slate-600 rounded-lg hover:bg-slate-200"
            onClick={() => setSimulationActive(!simulationActive)}
          >
            {simulationActive ? <Pause size={12} /> : <Play size={12} />}
          </Button>
        </div>
      </div>

      {/* Top GPS Analytics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <Card className="border-0 shadow-xs p-4 bg-slate-900 text-white relative overflow-hidden">
          <div className="absolute right-2 bottom-2 text-slate-800 opacity-20"><Truck size={60} /></div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Active Fleet</p>
          <h3 className="text-2xl font-extrabold font-mono text-emerald-400 mt-1">{stats.active}</h3>
          <span className="text-[9px] text-slate-500 font-medium">vehicles live</span>
        </Card>

        <Card className="border-0 shadow-xs p-4 bg-white relative overflow-hidden">
          <div className="absolute right-2 bottom-2 text-rose-100 opacity-30"><Clock size={60} /></div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Delayed Trips</p>
          <h3 className="text-2xl font-extrabold font-mono text-rose-600 mt-1">{stats.delayed}</h3>
          <span className="text-[9px] text-slate-500 font-medium">require monitoring</span>
        </Card>

        <Card className="border-0 shadow-xs p-4 bg-white relative overflow-hidden">
          <div className="absolute right-2 bottom-2 text-amber-100 opacity-30"><AlertTriangle size={60} /></div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Idle Vehicles</p>
          <h3 className="text-2xl font-extrabold font-mono text-amber-600 mt-1">{stats.idle}</h3>
          <span className="text-[9px] text-slate-500 font-medium">engines turned off</span>
        </Card>

        <Card className="border-0 shadow-xs p-4 bg-white relative overflow-hidden">
          <div className="absolute right-2 bottom-2 text-emerald-100 opacity-30"><CheckCircle2 size={60} /></div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Completed</p>
          <h3 className="text-2xl font-extrabold font-mono text-emerald-600 mt-1">{stats.completed}</h3>
          <span className="text-[9px] text-slate-500 font-medium">deliveries verified</span>
        </Card>

        <Card className="border-0 shadow-xs p-4 bg-white relative overflow-hidden">
          <div className="absolute right-2 bottom-2 text-slate-200 opacity-30"><Volume2 size={60} /></div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Offline Trackers</p>
          <h3 className="text-2xl font-extrabold font-mono text-slate-500 mt-1">{stats.offline}</h3>
          <span className="text-[9px] text-slate-500 font-medium">telemetry lost</span>
        </Card>

        <Card className="border-0 shadow-xs p-4 bg-white relative overflow-hidden">
          <div className="absolute right-2 bottom-2 text-red-100 opacity-30"><ShieldAlert size={60} /></div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Corridor Deviations</p>
          <h3 className="text-2xl font-extrabold font-mono text-red-600 mt-1">{stats.deviations}</h3>
          <span className="text-[9px] text-slate-500 font-medium">off-route corridors</span>
        </Card>
      </div>

      {/* Main Map + Alert Panel Split Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* LEFT COLUMN: Real-time GPS Alerts Panel */}
        <div className="xl:col-span-1 space-y-6 flex flex-col h-[550px] overflow-hidden">
          <Card className="border-0 shadow-sm bg-white flex flex-col h-full overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-5">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Bell size={14} className="text-amber-400 animate-pulse" /> Live Telemetry Alerts
              </CardTitle>
              <CardDescription className="text-[10px] text-slate-400 mt-0.5">Route deviations and engine stoppages.</CardDescription>
            </CardHeader>
            
            <CardContent className="p-4 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
              <AnimatePresence>
                {alerts.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 italic text-xs">No active telemetry alerts.</div>
                ) : (
                  alerts.map((alert) => (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className={`p-3 rounded-xl border flex flex-col gap-2 ${
                        alert.severity === 'critical' 
                          ? 'bg-red-50/40 border-red-100 text-red-800' 
                          : 'bg-amber-50/40 border-amber-100 text-amber-800'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[8px] font-bold tracking-widest uppercase font-mono block opacity-60">ALERT: {alert.type}</span>
                          <span className="text-xs font-bold font-mono block mt-0.5">{alert.vehicleNumber}</span>
                        </div>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-5 w-5 rounded-full hover:bg-slate-100"
                          onClick={() => dismissAlert(alert.id)}
                        >
                          <X size={10} />
                        </Button>
                      </div>
                      <p className="text-[11px] leading-snug font-medium text-slate-600">{alert.message}</p>
                      <div className="flex justify-between items-center text-[9px] text-slate-400 mt-1 border-t pt-1.5">
                        <span>Driver: {alert.driverName}</span>
                        <span>{alert.time}</span>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Full-screen interactive map panel */}
        <div className="xl:col-span-3 space-y-6">
          <Card className="border-0 shadow-sm bg-white overflow-hidden flex flex-col h-[550px]">
            
            {/* Map control widgets header */}
            <CardHeader className="border-b border-slate-100 p-4 bg-slate-50/50 flex flex-row items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Map size={14} className="text-slate-500" />
                <span className="text-xs font-bold text-slate-700 uppercase">Live GPS Control Tower Map</span>
              </div>
              
              {/* Sat/Light/Dark selector */}
              <div className="flex items-center gap-1 bg-white border p-1 rounded-xl shadow-2xs">
                <Button 
                  size="sm" 
                  variant={mapViewMode === 'dark' ? 'default' : 'ghost'} 
                  className="h-7 text-[10px] uppercase font-bold"
                  onClick={() => setMapViewMode('dark')}
                >
                  <Moon size={11} className="mr-1" /> Dark
                </Button>
                <Button 
                  size="sm" 
                  variant={mapViewMode === 'satellite' ? 'default' : 'ghost'} 
                  className="h-7 text-[10px] uppercase font-bold"
                  onClick={() => setMapViewMode('satellite')}
                >
                  <Layers size={11} className="mr-1" /> Satellite
                </Button>
                <Button 
                  size="sm" 
                  variant={mapViewMode === 'light' ? 'default' : 'ghost'} 
                  className="h-7 text-[10px] uppercase font-bold"
                  onClick={() => setMapViewMode('light')}
                >
                  <Sun size={11} className="mr-1" /> Vector
                </Button>
              </div>
            </CardHeader>

            {/* Map container */}
            <div className="flex-1 w-full bg-slate-950 relative overflow-hidden">
              {!leafletLoaded && (
                <div className="absolute inset-0 flex items-center justify-center text-white bg-slate-950/80 z-40">
                  <div className="text-center space-y-3">
                    <Activity className="h-8 w-8 text-primary animate-pulse mx-auto" />
                    <p className="text-sm font-medium">Mounting GPS Control Map layers...</p>
                  </div>
                </div>
              )}
              <div ref={mapContainerRef} className="w-full h-full z-10" />
            </div>

          </Card>
        </div>

      </div>

      {/* Active Trips Tabular Grid */}
      <Card className="border-none shadow-sm bg-white mt-6">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Activity size={15} className="text-emerald-500" /> Active Fleet Registry Table
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 mt-0.5">Real-time coordinates and speed indicators.</CardDescription>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
              <Input 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search Truck, Driver..." 
                className="pl-8 bg-gray-50 border-gray-200 text-xs h-8" 
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="flex h-8 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs outline-none focus:ring-1 focus:ring-primary text-slate-600"
            >
              <option value="All">All Statuses</option>
              <option value="Moving">Moving</option>
              <option value="Stopped">Stopped</option>
              <option value="Delayed">Delayed</option>
              <option value="Idle">Idle</option>
              <option value="Offline">Offline</option>
            </select>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="font-bold text-slate-500 uppercase text-[10px] pl-6 py-3">Bid ID</TableHead>
                  <TableHead className="font-bold text-slate-500 uppercase text-[10px]">Vehicle Number</TableHead>
                  <TableHead className="font-bold text-slate-500 uppercase text-[10px]">Driver Name</TableHead>
                  <TableHead className="font-bold text-slate-500 uppercase text-[10px]">Transporter</TableHead>
                  <TableHead className="font-bold text-slate-500 uppercase text-[10px]">Current Coordinates</TableHead>
                  <TableHead className="font-bold text-slate-500 uppercase text-[10px] text-center">Live Speed</TableHead>
                  <TableHead className="font-bold text-slate-500 uppercase text-[10px]">ETA</TableHead>
                  <TableHead className="font-bold text-slate-500 uppercase text-[10px]">Last Updated</TableHead>
                  <TableHead className="font-bold text-slate-500 uppercase text-[10px]">Trip Status</TableHead>
                  <TableHead className="font-bold text-slate-500 uppercase text-[10px] text-right pr-6">Dispatcher Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTrips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-slate-400 italic text-xs">
                      No active tracked trips matching criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTrips.map((tr) => (
                    <TableRow 
                      key={tr.id}
                      onClick={() => setSelectedTripId(tr.id)}
                      className="hover:bg-slate-50/50 cursor-pointer transition-all border-b last:border-0"
                    >
                      <TableCell className="pl-6 py-3.5 font-bold font-mono text-slate-800 text-xs">{tr.bidId}</TableCell>
                      <TableCell className="text-xs font-bold font-mono text-slate-700">{tr.vehicleNumber}</TableCell>
                      <TableCell className="text-xs font-semibold text-slate-700">{tr.driverName}</TableCell>
                      <TableCell className="text-xs text-slate-500">{tr.transporter}</TableCell>
                      <TableCell className="text-xs font-mono text-slate-500 text-[10px]">
                        {tr.currentCoords.lat.toFixed(4)}N, {tr.currentCoords.lng.toFixed(4)}E
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`font-bold font-mono text-xs ${tr.speed > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {tr.speed} km/h
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-slate-700">{tr.eta}</TableCell>
                      <TableCell className="text-xs text-slate-400 font-medium">{tr.lastUpdated}</TableCell>
                      <TableCell>{getStatusBadge(tr.status)}</TableCell>
                      <TableCell className="text-right pr-6" onClick={e => e.stopPropagation()}>
                        <Button 
                          onClick={() => setSelectedTripId(tr.id)}
                          size="sm" 
                          className="bg-slate-900 hover:bg-slate-800 text-white h-7 text-[10px] font-bold uppercase rounded"
                        >
                          Telemetry Center
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* GORGEOUS VEHICLE DETAILS DRAWER */}
      <AnimatePresence>
        {selectedTrip && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTripId(null)}
              className="fixed inset-0 bg-black z-40"
            />
            
            {/* Drawer Panel */}
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col font-sans"
            >
              {/* Header */}
              <div className="bg-slate-900 text-white p-6 flex justify-between items-center relative overflow-hidden">
                <div className="space-y-1 z-10">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-slate-800 text-emerald-400 border border-slate-700 font-bold text-[9px] uppercase px-2 py-0.5">
                      GPS Control Tower Active
                    </Badge>
                    <span className="text-xs text-slate-400 font-mono">TRIP ID: {selectedTrip.id}</span>
                  </div>
                  <h3 className="text-lg font-extrabold font-mono">{selectedTrip.vehicleNumber}</h3>
                  <p className="text-xs text-slate-400">Carrier: {selectedTrip.transporter}</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setSelectedTripId(null)}
                  className="h-8 w-8 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 z-10"
                >
                  <X size={18} />
                </Button>
              </div>

              {/* Content body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                
                {/* Active telemetry readings */}
                <div className="grid grid-cols-3 gap-3 bg-slate-50 border rounded-xl p-3 text-center">
                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Live Speed</span>
                    <span className="text-sm font-extrabold font-mono text-slate-800">{selectedTrip.speed} km/h</span>
                  </div>
                  <div className="space-y-1 border-l">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Est. Arrival</span>
                    <span className="text-sm font-extrabold font-mono text-slate-800">{selectedTrip.eta}</span>
                  </div>
                  <div className="space-y-1 border-l">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Fuel Reserve</span>
                    <span className="text-sm font-extrabold font-mono text-emerald-600 flex items-center justify-center gap-1">
                      <Fuel size={12} /> {selectedTrip.fuel}%
                    </span>
                  </div>
                </div>

                {/* Driver profile */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Driver Logistics Details</h4>
                  <div className="border border-slate-100 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-700 font-bold border">
                        {selectedTrip.driverName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{selectedTrip.driverName}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">{selectedTrip.driverPhone}</p>
                      </div>
                    </div>

                    <div className="flex gap-1.5">
                      <a href={`tel:${selectedTrip.driverPhone}`}>
                        <Button size="icon" variant="outline" className="h-8 w-8 text-emerald-600 border-emerald-100 bg-emerald-50 hover:bg-emerald-100">
                          <PhoneCall size={13} />
                        </Button>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Dispatch coordinates */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Planned Transit Corridor</h4>
                  <div className="bg-slate-50 border rounded-xl p-4 text-xs space-y-4">
                    
                    {/* Origin destination nodes */}
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-bold block">Pickup Origin</span>
                        <span className="font-bold text-slate-800 block mt-0.5">{selectedTrip.origin.name}</span>
                        <span className="font-mono text-[9px] text-slate-400 mt-0.5 block">{selectedTrip.origin.lat.toFixed(4)}N, {selectedTrip.origin.lng.toFixed(4)}E</span>
                      </div>
                      <ArrowRight size={14} className="text-slate-400 mt-4" />
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 uppercase font-bold block">Delivery Target</span>
                        <span className="font-bold text-slate-800 block mt-0.5">{selectedTrip.destination.name}</span>
                        <span className="font-mono text-[9px] text-slate-400 mt-0.5 block">{selectedTrip.destination.lat.toFixed(4)}N, {selectedTrip.destination.lng.toFixed(4)}E</span>
                      </div>
                    </div>

                    {/* Geofence warnings */}
                    {selectedTrip.deviationAlert && (
                      <div className="bg-red-50 border border-red-100 text-red-800 rounded-xl p-3 flex items-start gap-2.5">
                        <AlertCircle size={14} className="text-red-600 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-red-900">NH Corridor Route Deviation</p>
                          <p className="text-[10px] text-slate-600 mt-0.5">Alert triggered: Driver departed corridor limit. Immediate call required.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stoppage details */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Engine & Stop Audits</h4>
                  <div className="border border-slate-100 rounded-xl p-4 text-xs space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Stoppages Recorded:</span>
                      <span className="font-bold text-slate-800">{selectedTrip.stops.length} times</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Current Idle Duration:</span>
                      <span className="font-bold text-slate-800">{selectedTrip.idleTime}</span>
                    </div>
                    
                    {/* Render active stops */}
                    <div className="space-y-2 pt-2 border-t">
                      {selectedTrip.stops.map((stop, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                          <div className="flex items-center gap-2">
                            <MapPin size={11} className={stop.idle ? "text-amber-500" : "text-slate-400"} />
                            <span className="font-medium text-slate-700">{stop.name}</span>
                          </div>
                          <Badge variant="outline" className="text-[9px] font-mono font-bold">
                            {stop.duration}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Dynamic activity timeline */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live Transit Logs</h4>
                  <div className="relative pl-4 border-l border-slate-200 ml-2 space-y-4">
                    {selectedTrip.timeline.map((event, index) => (
                      <div key={index} className="relative text-xs">
                        {/* Dot indicator */}
                        <div className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white ${
                          event.status === 'success' ? 'bg-emerald-500' :
                          event.status === 'warning' ? 'bg-amber-500' :
                          event.status === 'danger' ? 'bg-red-500' : 'bg-blue-500'
                        }`} />
                        <span className="text-[10px] text-slate-400 font-mono block">{event.time}</span>
                        <p className="font-medium text-slate-700 mt-0.5 leading-snug">{event.event}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Administrative control actions */}
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Administrative Tower Controls</h4>
                  
                  {selectedTrip.status === 'PENDING' ? (
                    <form onSubmit={handleDispatchSubmit} className="space-y-3 border rounded-xl p-4 bg-slate-50/50">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Assign Location & Dispatch Details</p>
                      
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase block">Loading Address</label>
                          <div className="flex gap-2">
                            <Input 
                              value={loadingAddress}
                              onChange={e => setLoadingAddress(e.target.value)}
                              placeholder="Loading Address"
                              className="bg-white h-8 text-xs flex-1"
                              required
                            />
                            <Button
                              type="button"
                              onClick={handleFetchLoadingGps}
                              disabled={isGeocodingLoading}
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 text-[10px] px-3 uppercase"
                            >
                              {isGeocodingLoading ? "..." : "Fetch GPS"}
                            </Button>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase block">Loading GPS Coordinates</label>
                          <Input 
                            value={loadingGps}
                            onChange={e => setLoadingGps(e.target.value)}
                            placeholder="lat, lng (e.g. 17.385044, 78.486671)"
                            className="bg-white h-8 text-xs font-mono"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase block">Unloading Address</label>
                          <div className="flex gap-2">
                            <Input 
                              value={unloadingAddress}
                              onChange={e => setUnloadingAddress(e.target.value)}
                              placeholder="Unloading Address"
                              className="bg-white h-8 text-xs flex-1"
                              required
                            />
                            <Button
                              type="button"
                              onClick={handleFetchUnloadingGps}
                              disabled={isGeocodingUnloading}
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 text-[10px] px-3 uppercase"
                            >
                              {isGeocodingUnloading ? "..." : "Fetch GPS"}
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase block">Unloading GPS Coordinates</label>
                          <Input 
                            value={unloadingGps}
                            onChange={e => setUnloadingGps(e.target.value)}
                            placeholder="lat, lng (e.g. 16.506174, 80.648015)"
                            className="bg-white h-8 text-xs font-mono"
                            required
                          />
                        </div>
                      </div>

                      <Button 
                        type="submit" 
                        disabled={isDispatching}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 uppercase text-[10px] tracking-wider shadow-xs mt-2"
                      >
                        {isDispatching ? "Dispatching..." : "Dispatch Trip & Coordinates"}
                      </Button>
                    </form>
                  ) : isReassigning ? (
                    <form onSubmit={handleReassignSubmit} className="space-y-3 border rounded-xl p-3 bg-slate-50/50">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Input Reassigned Vehicle Registration Number</p>
                      <div className="flex gap-2">
                        <Input 
                          value={reassignInput}
                          onChange={e => setReassignInput(e.target.value)}
                          placeholder="e.g. MH-12-KL-3402"
                          className="bg-white h-8 text-xs font-mono"
                        />
                        <Button type="submit" size="sm" className="bg-primary text-white">Save</Button>
                        <Button size="sm" variant="outline" onClick={() => setIsReassigning(false)}>Cancel</Button>
                      </div>
                    </form>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <Button 
                        onClick={() => triggerEmergency(selectedTrip.id)}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold h-9 uppercase text-[10px] tracking-wider shadow-xs"
                      >
                        <ShieldAlert size={12} className="mr-1.5" /> Trigger SOS Alarm
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => setIsReassigning(true)}
                        className="border-slate-200 font-bold h-9 uppercase text-[10px] tracking-wider text-slate-700 hover:bg-slate-50"
                      >
                        <Settings size={12} className="mr-1.5" /> Reassign Vehicle
                      </Button>
                    </div>
                  )}
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
