import { create } from 'zustand';

export type TripStatus = 'Moving' | 'Stopped' | 'Idle' | 'Offline' | 'Delayed' | 'PENDING';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Stop {
  name: string;
  duration: string;
  lat: number;
  lng: number;
  idle: boolean;
  engineOff: boolean;
}

export interface TimelineEvent {
  time: string;
  event: string;
  status: 'info' | 'warning' | 'success' | 'danger';
}

export interface VehicleTrip {
  id: string;
  bidId: string;
  vehicleNumber: string;
  driverName: string;
  driverPhone: string;
  transporter: string;
  status: TripStatus;
  speed: number;
  eta: string;
  origin: { name: string; lat: number; lng: number };
  destination: { name: string; lat: number; lng: number };
  currentCoords: LatLng;
  routeCoords: LatLng[];
  currentIndex: number; // For GPS animation simulation index
  stops: Stop[];
  fuel: number;
  lastUpdated: string;
  timeline: TimelineEvent[];
  deviationAlert: boolean;
  unauthorizedStop: boolean;
  idleTime: string;
  geofences: { name: string; radius: number; lat: number; lng: number; inside: boolean }[];
  pricePerTonne?: number;
  tonnes?: number;
  bidAmount?: number;
  fromLoc?: string;
  toLoc?: string;
  loadStops?: string[];
}

export interface LiveAlert {
  id: string;
  vehicleNumber: string;
  driverName: string;
  type: 'Stopped Too Long' | 'Unauthorized Stop' | 'Route Deviation' | 'Vehicle Offline' | 'Delay Alert';
  message: string;
  time: string;
  severity: 'warning' | 'critical';
  read: boolean;
}

interface TrackingState {
  trips: VehicleTrip[];
  alerts: LiveAlert[];
  selectedTripId: string | null;
  mapViewMode: 'light' | 'dark' | 'satellite' | 'traffic';
  isReplayingRoute: boolean;
  searchQuery: string;
  statusFilter: string;
  setSelectedTripId: (id: string | null) => void;
  setMapViewMode: (mode: 'light' | 'dark' | 'satellite' | 'traffic') => void;
  setSearchQuery: (query: string) => void;
  setStatusFilter: (filter: string) => void;
  triggerEmergency: (tripId: string) => void;
  dismissAlert: (alertId: string) => void;
  reassignVehicle: (tripId: string, newVehicleNo: string) => void;
  simulateGpsMovement: () => void;
  createTripFromLoad: (load: any, bid: any) => void;
  dispatchTripDetails: (tripId: string, dispatchPayload: any) => Promise<void>;
  fetchTrips: () => Promise<void>;
}

export const useTrackingStore = create<TrackingState>((set, get) => ({
  selectedTripId: null,
  mapViewMode: 'dark',
  isReplayingRoute: false,
  searchQuery: '',
  statusFilter: 'All',
  alerts: [],
  trips: [],
  fetchTrips: async () => {
    try {
      const { apiClient } = await import('@/services/apiClient');
      const backendTrips = await apiClient.getAllTrips();

      const parseGps = (gpsStr: string | null | undefined): LatLng => {
        if (!gpsStr) return { lat: 17.3850, lng: 78.4867 };
        const parts = gpsStr.split(',').map(p => parseFloat(p.trim()));
        return { lat: parts[0] || 17.3850, lng: parts[1] || 78.4867 };
      };

      // Filter to only include trips that are actually active/dispatched (IN_TRANSIT or DISPATCHED load status)
      const activeTrips = backendTrips.filter((bt: any) => {
        const loadStatus = bt.load?.status?.toUpperCase();
        return loadStatus === 'DISPATCHED' || bt.status === 'IN_TRANSIT';
      });

      const mappedTrips = await Promise.all(activeTrips.map(async (bt: any): Promise<VehicleTrip> => {
        const loadingCoords = parseGps(bt.loading_gps_coordinates);
        const unloadingCoords = parseGps(bt.unloading_gps_coordinates);

        let currentStatus: TripStatus = 'PENDING';
        if (bt.status === 'IN_TRANSIT') {
          currentStatus = 'Moving';
        } else if (bt.status === 'COMPLETED') {
          currentStatus = 'Stopped';
        }

        const currentCoords = bt.current_gps_coordinates ? parseGps(bt.current_gps_coordinates) : loadingCoords;

        // Fetch actual route history coordinates from the backend database for the travelled route
        let historicalCoords: LatLng[] = [];
        if (bt.status === 'IN_TRANSIT' || bt.status === 'COMPLETED') {
          try {
            historicalCoords = await apiClient.getTripRouteHistory(bt.id);
          } catch (historyErr) {
            console.warn(`Failed to fetch history for trip ${bt.id}`, historyErr);
          }
        }

        // Generate a route path polyline between origin and destination
        let routeCoords: LatLng[] = [];
        if (historicalCoords.length > 0) {
          routeCoords = [...historicalCoords];
          // Ensure current coordinate is also appended
          if (routeCoords.every(c => c.lat !== currentCoords.lat || c.lng !== currentCoords.lng)) {
            routeCoords.push(currentCoords);
          }
        } else {
          const steps = 30;
          for (let i = 0; i <= steps; i++) {
            const ratio = i / steps;
            routeCoords.push({
              lat: loadingCoords.lat + (unloadingCoords.lat - loadingCoords.lat) * ratio,
              lng: loadingCoords.lng + (unloadingCoords.lng - loadingCoords.lng) * ratio
            });
          }
        }

        const tonnes = bt.load?.number_of_tonnes || 20;
        const bidAmount = bt.amount || bt.load?.base_bid_amount || (1200 * tonnes);
        const pricePerTonne = tonnes > 0 ? Math.round(bidAmount / tonnes) : (bt.load?.cost_per_tonne || 1200);

        return {
          id: bt.id,
          bidId: bt.load_id || 'N/A',
          vehicleNumber: bt.vehicle_number || 'Pending Assignment',
          driverName: bt.assigned_user?.name || 'Pending Driver',
          driverPhone: bt.assigned_user?.mobile_number || 'N/A',
          transporter: bt.assigned_user?.name || 'Pending Carrier',
          status: currentStatus,
          speed: currentStatus === 'Moving' ? 65 : 0,
          eta: currentStatus === 'Moving' ? '4h 15m' : (currentStatus === 'Stopped' ? 'Arrived' : 'Awaiting Dispatch'),
          origin: { name: bt.loading_address || 'Origin', lat: loadingCoords.lat, lng: loadingCoords.lng },
          destination: { name: bt.unloading_address || 'Destination', lat: unloadingCoords.lat, lng: unloadingCoords.lng },
          currentCoords,
          routeCoords,
          currentIndex: 0,
          stops: [],
          fuel: 85,
          lastUpdated: 'Just now',
          timeline: [
            { time: 'Just Now', event: `Trip record sync active. Telemetry updated.`, status: 'info' }
          ],
          deviationAlert: false,
          unauthorizedStop: false,
          idleTime: '0 mins',
          geofences: [
            { name: 'Loading Hub', radius: 500, lat: loadingCoords.lat, lng: loadingCoords.lng, inside: true },
            { name: 'Unloading Hub', radius: 500, lat: unloadingCoords.lat, lng: unloadingCoords.lng, inside: false }
          ],
          pricePerTonne,
          tonnes,
          bidAmount,
          fromLoc: bt.load?.from_location || bt.loading_address || 'Origin',
          toLoc: bt.load?.to_location || bt.unloading_address || 'Destination',
          loadStops: Array.isArray(bt.load?.routes) ? bt.load.routes : (bt.load?.stops || [])
        };
      }));

      set({ trips: mappedTrips });
    } catch (error) {
      console.error("Failed to sync backend trips into tracking store:", error);
    }
  },
  setSelectedTripId: (id) => set({ selectedTripId: id }),
  setMapViewMode: (mode) => set({ mapViewMode: mode }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setStatusFilter: (filter) => set({ statusFilter: filter }),
  dismissAlert: (alertId) => set((state) => ({
    alerts: state.alerts.filter((a) => a.id !== alertId)
  })),
  triggerEmergency: (tripId) => set((state) => {
    toast?.({
      title: "SOS Alert Dispatched",
      description: "Emergency responders and local depot notified instantly.",
      variant: "destructive"
    });
    return {
      trips: state.trips.map((t) => {
        if (t.id === tripId) {
          return {
            ...t,
            status: 'Delayed' as const,
            timeline: [
              { time: 'Just Now', event: 'CRITICAL: SOS Triggered by Administrative Tower', status: 'danger' },
              ...t.timeline
            ]
          };
        }
        return t;
      })
    };
  }),
  reassignVehicle: (tripId, newVehicleNo) => set((state) => ({
    trips: state.trips.map((t) => {
      if (t.id === tripId) {
        return {
          ...t,
          vehicleNumber: newVehicleNo,
          timeline: [
            { time: 'Just Now', event: `Vehicle reassigned to ${newVehicleNo}`, status: 'info' },
            ...t.timeline
          ]
        };
      }
      return t;
    })
  })),
  simulateGpsMovement: () => set((state) => {
    const updatedTrips = state.trips.map((trip) => {
      if (trip.status === 'Moving') {
        const nextIndex = (trip.currentIndex + 1) % trip.routeCoords.length;
        const nextCoords = trip.routeCoords[nextIndex];

        // Randomly calculate speed fluctuate around 60-75 km/h
        const simulatedSpeed = Math.floor(60 + Math.random() * 15);

        // Countdowns fuel slowly
        const nextFuel = Math.max(5, trip.fuel - 1);

        // Update ETA string
        const remainingHours = Math.max(1, trip.routeCoords.length - nextIndex);
        const nextEta = `${remainingHours}h ${Math.floor(10 + Math.random() * 45)}m`;

        return {
          ...trip,
          currentIndex: nextIndex,
          currentCoords: nextCoords,
          speed: simulatedSpeed,
          fuel: nextFuel,
          eta: nextEta,
          lastUpdated: 'Just now',
        };
      }
      return trip;
    });

    return { trips: updatedTrips };
  }),
  createTripFromLoad: (load: any, bid: any) => {
    const suffix = load.id.split('-')[1] || '1001';
    const generatedTripId = `TRIP-2026-${suffix}`;

    // Check if trip already exists
    const existing = get().trips.find(t => t.id === generatedTripId);
    if (existing) return;

    const newTrip: VehicleTrip = {
      id: generatedTripId,
      bidId: load.bidId || load.bid_id || 'N/A',
      vehicleNumber: bid.vehicleNumber || 'MH-12-KL-3402',
      driverName: bid.transporterName || 'Transporter',
      driverPhone: '+91 98765 43210',
      transporter: bid.transporterName || 'Transporter',
      status: 'PENDING',
      speed: 0,
      eta: 'Awaiting Dispatch',
      origin: { name: load.from || 'Origin', lat: 17.3850, lng: 78.4867 },
      destination: { name: load.to || 'Destination', lat: 16.5062, lng: 80.6480 },
      currentCoords: { lat: 17.3850, lng: 78.4867 },
      routeCoords: [],
      currentIndex: 0,
      stops: [],
      fuel: 100,
      lastUpdated: 'Just now',
      timeline: [
        { time: 'Just Now', event: `Trip created from Load Bid Approval. Pending location dispatch coordinates.`, status: 'info' }
      ],
      deviationAlert: false,
      unauthorizedStop: false,
      idleTime: '0 mins',
      geofences: [],
      fromLoc: load.from || 'Origin',
      toLoc: load.to || 'Destination',
      loadStops: load.stops || []
    };

    set((state) => ({
      trips: [...state.trips, newTrip]
    }));
  },
  dispatchTripDetails: async (tripId: string, dispatchPayload: any) => {
    const parseGps = (gpsStr: string): LatLng => {
      const parts = gpsStr.split(',').map(p => parseFloat(p.trim()));
      return { lat: parts[0] || 0, lng: parts[1] || 0 };
    };

    const loadingCoords = parseGps(dispatchPayload.loading_gps_coordinates || dispatchPayload.loadingGpsCoordinates || '17.385044, 78.486671');
    const unloadingCoords = parseGps(dispatchPayload.unloading_gps_coordinates || dispatchPayload.unloadingGpsCoordinates || '16.506174, 80.648015');

    const steps = 30;
    const routeCoords: LatLng[] = [];
    for (let i = 0; i <= steps; i++) {
      const ratio = i / steps;
      routeCoords.push({
        lat: loadingCoords.lat + (unloadingCoords.lat - loadingCoords.lat) * ratio,
        lng: loadingCoords.lng + (unloadingCoords.lng - loadingCoords.lng) * ratio
      });
    }

    set((state) => ({
      trips: state.trips.map((t) => {
        if (t.id === tripId) {
          return {
            ...t,
            origin: {
              name: dispatchPayload.loading_address || dispatchPayload.loadingAddress || t.origin.name,
              lat: loadingCoords.lat,
              lng: loadingCoords.lng
            },
            destination: {
              name: dispatchPayload.unloading_address || dispatchPayload.unloadingAddress || t.destination.name,
              lat: unloadingCoords.lat,
              lng: unloadingCoords.lng
            },
            currentCoords: loadingCoords,
            routeCoords,
            status: 'Moving',
            speed: 65,
            eta: '4h 15m',
            lastUpdated: 'Just now',
            timeline: [
              { time: 'Just Now', event: `Transit coordinates dispatched. GPS live stream tracking initiated.`, status: 'success' },
              ...t.timeline
            ],
            geofences: [
              { name: 'Loading Site Geofence', radius: 500, lat: loadingCoords.lat, lng: loadingCoords.lng, inside: true },
              { name: 'Unloading Hub Geofence', radius: 500, lat: unloadingCoords.lat, lng: unloadingCoords.lng, inside: false }
            ]
          };
        }
        return t;
      })
    }));
  }
}));

// Safe references to toast hook
let toast: any = null;
export const injectToastHook = (toastHook: any) => {
  toast = toastHook;
};
