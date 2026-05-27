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
  const modalMapContainerRef = useRef<HTMLDivElement>(null);
  const modalMapRef = useRef<any>(null);

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

    trips.forEach((trip) => {
      const { id, currentCoords, vehicleNumber, status, transporter, driverName } = trip;

      // If a specific trip is selected, hide all other trips' markers, polylines, and geofences
      if (selectedTripId && id !== selectedTripId) {
        if (markersRef.current[id]) {
          mapRef.current.removeLayer(markersRef.current[id]);
          delete markersRef.current[id];
        }
        if (polylineRef.current[id]) {
          mapRef.current.removeLayer(polylineRef.current[id]);
          delete polylineRef.current[id];
        }
        if (geofencesRef.current[id]) {
          geofencesRef.current[id].forEach((fence: any) => {
            mapRef.current.removeLayer(fence);
          });
          delete geofencesRef.current[id];
        }
        return;
      }

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
  }, [trips, leafletLoaded, setSelectedTripId, selectedTripId]);

  // Fit Map to show complete Loading GPS (Origin) and Unloading GPS (Destination) route bounds
  useEffect(() => {
    if (!selectedTripId || !leafletLoaded || !mapRef.current) return;
    const selected = trips.find(t => t.id === selectedTripId);
    if (selected) {
      // Construct bounds from Loading GPS (Origin) to Unloading GPS (Destination)
      const bounds = window.L.latLngBounds([
        [selected.origin.lat, selected.origin.lng],
        [selected.destination.lat, selected.destination.lng]
      ]);

      // Expand bounds to also include the current location of the vehicle
      bounds.extend([selected.currentCoords.lat, selected.currentCoords.lng]);

      // Fit map view to these bounds with padding so origin and destination are both fully visible
      mapRef.current.fitBounds(bounds, {
        padding: [60, 60],
        animate: true,
        duration: 1.2
      });
    }
  }, [selectedTripId, leafletLoaded, trips]);



  // Dynamic Map Renderer for Individual Bid Tracking inside Details Drawer
  useEffect(() => {
    if (!leafletLoaded) return;
    
    if (selectedTripId) {
      const selected = trips.find(t => t.id === selectedTripId);
      if (!selected) return;
      
      const timer = setTimeout(() => {
        if (!modalMapContainerRef.current) return;
        
        // Destroy pre-existing map instance to avoid Leaflet "Map container is already initialized" error
        if (modalMapRef.current) {
          modalMapRef.current.remove();
          modalMapRef.current = null;
        }
        
        // Initialize individual Leaflet map
        const map = window.L.map(modalMapContainerRef.current, {
          zoomControl: false,
        });
        modalMapRef.current = map;
        
        // Apply standard OpenStreetMap tile layer
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);
        
        window.L.control.zoom({
          position: 'bottomright'
        }).addTo(map);

        const statusColor = 
          selected.status === 'Moving' ? '#10b981' :
          selected.status === 'Stopped' ? '#64748b' :
          selected.status === 'Delayed' ? '#f43f5e' :
          selected.status === 'Idle' ? '#f59e0b' :
          selected.status === 'Offline' ? '#94a3b8' : '#3b82f6';

        // 1. Draw Loading Point (Origin)
        window.L.marker([selected.origin.lat, selected.origin.lng], {
          icon: window.L.divIcon({
            html: `<div class="h-6 w-6 bg-blue-600 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white shadow-md">S</div>`,
            className: 'custom-div-icon',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          })
        }).addTo(map).bindTooltip(`Loading Point (Origin): ${selected.origin.name}`, { direction: 'top' });

        // 2. Draw Unloading Point (Destination)
        window.L.marker([selected.destination.lat, selected.destination.lng], {
          icon: window.L.divIcon({
            html: `<div class="h-6 w-6 bg-rose-600 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white shadow-md">E</div>`,
            className: 'custom-div-icon',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          })
        }).addTo(map).bindTooltip(`Unloading Point (Destination): ${selected.destination.name}`, { direction: 'top' });

        // 3. Draw Driver's Current GPS Position
        const html = `
          <div class="relative flex items-center justify-center">
            <div class="absolute h-8 w-8 rounded-full animate-ping animate-duration-1000" style="background-color: ${statusColor}40"></div>
            <div class="h-6 w-6 text-white rounded-full flex items-center justify-center shadow-md border-2 border-slate-950 transition-all duration-300" style="background-color: ${statusColor}; font-size: 10px;">
              🚚
            </div>
          </div>
        `;
        window.L.marker([selected.currentCoords.lat, selected.currentCoords.lng], {
          icon: window.L.divIcon({
            html,
            className: 'custom-div-icon',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          })
        }).addTo(map).bindTooltip(`Vehicle: ${selected.vehicleNumber}`, { direction: 'top' });

        // 4. Draw Route Path Polyline
        const coords = selected.routeCoords.map(c => [c.lat, c.lng]);
        window.L.polyline(coords, {
          color: statusColor,
          weight: 4,
          opacity: 0.85,
          dashArray: selected.status === 'Delayed' ? '5, 10' : 'none'
        }).addTo(map);

        // 5. Draw Hub Geofence Circles
        selected.geofences.forEach(fence => {
          window.L.circle([fence.lat, fence.lng], {
            radius: fence.radius,
            color: '#10b981',
            fillColor: '#10b981',
            fillOpacity: 0.04,
            weight: 1,
            dashArray: '3, 5'
          }).addTo(map);
        });

        // 6. Fit Map View bounds to span loading GPS and unloading GPS
        const bounds = window.L.latLngBounds([
          [selected.origin.lat, selected.origin.lng],
          [selected.destination.lat, selected.destination.lng]
        ]);
        bounds.extend([selected.currentCoords.lat, selected.currentCoords.lng]);
        map.fitBounds(bounds, { padding: [40, 40] });

      }, 300); // 300ms transition delay to ensure drawer DOM is fully rendered

      return () => clearTimeout(timer);
    } else {
      if (modalMapRef.current) {
        modalMapRef.current.remove();
        modalMapRef.current = null;
      }
    }
  }, [selectedTripId, leafletLoaded, trips]);

  // Filtering trips
  const filteredTrips = useMemo(() => {
    return trips.filter(t => {
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
        

      </div>

      {/* Top GPS Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
          <div className="absolute right-2 bottom-2 text-emerald-100 opacity-30"><CheckCircle2 size={60} /></div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Completed</p>
          <h3 className="text-2xl font-extrabold font-mono text-emerald-600 mt-1">{stats.completed}</h3>
          <span className="text-[9px] text-slate-500 font-medium">deliveries verified</span>
        </Card>
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
                  <TableHead className="font-bold text-slate-500 uppercase text-[10px]">Route & Stops</TableHead>
                  <TableHead className="font-bold text-slate-500 uppercase text-[10px]">Vehicle Number</TableHead>
                  <TableHead className="font-bold text-slate-500 uppercase text-[10px]">Driver Name</TableHead>
                  <TableHead className="font-bold text-slate-500 uppercase text-[10px]">Transporter</TableHead>
                  <TableHead className="font-bold text-slate-500 uppercase text-[10px]">Current Coordinates</TableHead>
                  <TableHead className="font-bold text-slate-500 uppercase text-[10px]">Last Updated</TableHead>
                  <TableHead className="font-bold text-slate-500 uppercase text-[10px]">Trip Status</TableHead>
                  <TableHead className="font-bold text-slate-500 uppercase text-[10px] text-right pr-6">Dispatcher Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTrips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-slate-400 italic text-xs">
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
                      <TableCell className="py-3.5">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-slate-700 bg-slate-50/50 border border-slate-100 rounded-lg px-2.5 py-1 w-fit max-w-[340px]">
                          <span className="text-blue-600 font-semibold">{tr.fromLoc || tr.origin.name}</span>
                          {(tr.loadStops || []).map((stop: string, idx: number) => (
                            <React.Fragment key={idx}>
                              <span className="text-slate-400 font-normal">→</span>
                              <span className="text-amber-600 font-semibold">{stop}</span>
                            </React.Fragment>
                          ))}
                          <span className="text-slate-400 font-normal">→</span>
                          <span className="text-emerald-600 font-semibold">{tr.toLoc || tr.destination.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-bold font-mono text-slate-700">{tr.vehicleNumber}</TableCell>
                      <TableCell className="text-xs font-semibold text-slate-700">{tr.driverName}</TableCell>
                      <TableCell className="text-xs text-slate-500">{tr.transporter}</TableCell>
                      <TableCell className="text-xs font-mono text-slate-500 text-[10px]">
                        {tr.currentCoords.lat.toFixed(4)}N, {tr.currentCoords.lng.toFixed(4)}E
                      </TableCell>
                      <TableCell className="text-xs text-slate-400 font-medium">{tr.lastUpdated}</TableCell>
                      <TableCell>{getStatusBadge(tr.status)}</TableCell>
                      <TableCell className="text-right pr-6" onClick={e => e.stopPropagation()}>
                        <Button 
                          onClick={() => setSelectedTripId(tr.id)}
                          size="sm" 
                          className="bg-slate-900 hover:bg-slate-800 text-white h-7 text-[10px] font-bold uppercase rounded"
                        >
                          View Tracking
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

                {/* Dispatch coordinates, Bid ID, and Bid Details */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Planned Transit Corridor</h4>
                    <Badge variant="outline" className="text-[10px] font-mono font-bold bg-slate-50 border-slate-200 text-slate-700">
                      BID ID: {selectedTrip.bidId}
                    </Badge>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs space-y-4">
                    
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

                    {/* Clean dashed line separator & Bid details */}
                    <div className="border-t border-dashed border-slate-200 pt-3.5 mt-3.5 flex justify-between items-center text-xs">
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-bold block">Bidding Rate</span>
                        <span className="font-extrabold font-mono text-emerald-600 block mt-0.5">
                          ₹{(selectedTrip.pricePerTonne || 1200).toLocaleString('en-IN')} <span className="text-[9px] font-normal text-slate-400">/ Tonne</span>
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="text-[9px] text-slate-400 uppercase font-bold block">Total Tonnes</span>
                        <span className="font-bold font-mono text-slate-700 block mt-0.5">
                          {selectedTrip.tonnes || 20} <span className="text-[9px] font-normal text-slate-400">Tons</span>
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 uppercase font-bold block">Total Amount</span>
                        <span className="font-extrabold font-mono text-slate-900 block mt-0.5">
                          ₹{(selectedTrip.bidAmount || ((selectedTrip.pricePerTonne || 1200) * (selectedTrip.tonnes || 20))).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* INDIVIDUAL TRACKING MAP FROM LOADING GPS TO UNLOADING GPS */}
                <div className="w-full h-[260px] rounded-xl overflow-hidden border border-slate-200 relative bg-slate-50 shadow-inner">
                  {!leafletLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 bg-slate-50 z-40">
                      <div className="text-center space-y-2">
                        <Activity className="h-6 w-6 text-primary animate-pulse mx-auto" />
                        <p className="text-xs">Mounting individual map...</p>
                      </div>
                    </div>
                  )}
                  <div ref={modalMapContainerRef} className="w-full h-full z-10" />
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

                {selectedTrip.status === 'PENDING' && (
                  <div className="space-y-3 pt-4 border-t">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Administrative Tower Controls</h4>
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
                  </div>
                )}

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
