import { create } from 'zustand';
import { loadService, type Load, type Bid, type Transporter } from '@/services/loadService';
import { useTransporterStore } from './transporterStore';
import { apiClient } from '@/services/apiClient';
import { useTrackingStore } from './trackingStore';

export type { Load, Bid, Transporter };

const getInitialLoads = (): Load[] => {
  return loadService.getLoads();
};

interface LoadState {
  loads: Load[];
  isBackendConnected: boolean;
  isConnecting: boolean;
  connectionMode: 'live' | 'demo';
  backendUrl: string;
  backendError: string | null;
  checkApiConnection: () => Promise<void>;
  addLoad: (load: Load) => Promise<void>;
  updateLoad: (id: string, updatedFields: Partial<Load>) => Promise<void>;
  deleteLoad: (id: string) => Promise<void>;
  fetchLoads: () => Promise<void>;
  fetchBidsForLoad: (loadId: string) => Promise<void>;
  approveBid: (loadId: string, bidId: string) => Promise<void>;
  rejectBid: (loadId: string, bidId: string) => void;
  negotiateBid: (loadId: string, bidId: string, counterOffer: number, remarks: string, validTill: string, priority: string) => Promise<void>;
  assignVehicle: (loadId: string, vehicleNo: string, driverName: string) => void;
  autoCloseExpiredLoads: () => number; // returns count of auto-closed loads
}

export const useLoadStore = create<LoadState>((set, get) => ({
  loads: typeof window !== 'undefined' ? getInitialLoads() : [],
  isBackendConnected: false,
  isConnecting: false,
  connectionMode: 'demo',
  backendUrl: '',
  backendError: null,

  checkApiConnection: async () => {
    const conn = await apiClient.checkConnection();
    set({
      isBackendConnected: conn.isConnected,
      connectionMode: conn.mode,
      backendUrl: conn.url,
      backendError: conn.errorMessage || null
    });
  },
  
  fetchLoads: async () => {
    set({ isConnecting: true });
    
    // First, verify API connectivity
    const conn = await apiClient.checkConnection();
    set({
      isBackendConnected: conn.isConnected,
      connectionMode: conn.mode,
      backendUrl: conn.url,
      backendError: conn.errorMessage || null
    });

    if (conn.isConnected) {
      try {
        const backendLoads = await apiClient.getLoads();
        
        // Ensure every load has generated bids if it's missing them, preserving already fetched/simulated bids
        const currentLoads = get().loads;
        const standardLoads = backendLoads.map(load => {
          // If we already have this load in our store with bids, preserve those bids!
          const existingLoad = currentLoads.find(l => l.id === load.id || l.bidId === load.bidId);
          if (existingLoad && existingLoad.bids && existingLoad.bids.length > 0) {
            return {
              ...load,
              bids: existingLoad.bids
            };
          }
          return {
            ...load,
            bids: load.bids || []
          };
        });

        set({ loads: standardLoads, isConnecting: false });
        loadService.saveLoads(standardLoads); // local cache
        return;
      } catch (err: any) {
        console.error("Backend fetch error, falling back to local storage:", err);
        set({ backendError: err.message || 'API standard error' });
      }
    }

    // Fallback mode if backend down or not connected
    const loads = getInitialLoads();
    set({ loads, connectionMode: 'demo', isConnecting: false });
  },

  fetchBidsForLoad: async (loadId) => {
    try {
      // Look up target bidId from our local record mapping
      const targetLoad = get().loads.find(l => l.id === loadId || l.bidId === loadId);
      let searchId = targetLoad?.bidId || loadId;

      // Normalize searchId - strip "LD-" prefix if present to match backend's expected bid_id
      if (searchId.startsWith('LD-')) {
        searchId = searchId.substring(3);
      }

      const realBids = await apiClient.getBidsForLoad(searchId);
      
      const updatedLoads = get().loads.map(l => {
        if (l.id === loadId || l.bidId === loadId) {
          return { ...l, bids: realBids };
        }
        return l;
      });

      set({ loads: updatedLoads });
      loadService.saveLoads(updatedLoads);
    } catch (err) {
      console.error(`Failed to fetch live bids for load ${loadId}:`, err);
    }
  },
  
  addLoad: async (load) => {
    const loadWithBids = {
      ...load,
      bids: load.bids || []
    };
    
    // Optimistic UI updates
    const updatedLoads = [loadWithBids, ...get().loads];
    set({ loads: updatedLoads });
    loadService.saveLoads(updatedLoads);

    if (get().connectionMode === 'live') {
      try {
        await apiClient.createLoad(loadWithBids);
      } catch (err) {
        console.error("Failed to sync new load to backend:", err);
      }
    }
  },
  
  updateLoad: async (id, updatedFields) => {
    const updatedLoads = get().loads.map((l) =>
      l.id === id ? { ...l, ...updatedFields } : l
    );
    set({ loads: updatedLoads });
    loadService.saveLoads(updatedLoads);
  },
  
  deleteLoad: async (id) => {
    const updatedLoads = get().loads.filter((l) => l.id !== id);
    set({ loads: updatedLoads });
    loadService.saveLoads(updatedLoads);
  },

  approveBid: async (loadId, bidId) => {
    let approvedBidObj: any = null;
    let targetLoadObj: any = null;

    const updatedLoads = get().loads.map((l) => {
      if (l.id === loadId) {
        const approvedBid = l.bids?.find(b => b.id === bidId);
        if (!approvedBid) return l;

        approvedBidObj = approvedBid;
        targetLoadObj = l;

        const updatedBids = l.bids?.map(b => {
          if (b.id === bidId) {
            return { ...b, status: 'ACCEPTED' as const };
          }
          return { ...b, status: 'REJECTED' as const };
        }) || [];

        const suffix = l.id.split('-')[1] || '1001';
        const generatedTripId = `TRIP-2026-${suffix}`;

        // Notify via Transporter Store
        useTransporterStore.getState().addNotification(
          loadId,
          'Assignment',
          `Congratulations! Your bid of ₹${approvedBid.bidAmount.toLocaleString('en-IN')} has been accepted. Trip ID: ${generatedTripId}.`
        );

        return {
          ...l,
          status: 'CLOSED' as const,
          bids: updatedBids,
          assignedTransporter: approvedBid.transporterDetails,
          tripId: generatedTripId
        };
      }
      return l;
    });

    set({ loads: updatedLoads });
    loadService.saveLoads(updatedLoads);

    // Instantiate a trip in trackingStore if successfully approved
    if (approvedBidObj && targetLoadObj) {
      useTrackingStore.getState().createTripFromLoad(targetLoadObj, approvedBidObj);
    }

    try {
      await apiClient.approveBid(bidId);
      await get().fetchLoads();
      await get().fetchBidsForLoad(loadId);
    } catch (err) {
      console.error("Failed to sync bid approval to backend:", err);
      throw err;
    }
  },

  rejectBid: (loadId, bidId) => {
    const updatedLoads = get().loads.map((l) => {
      if (l.id === loadId) {
        const rejectedBid = l.bids?.find(b => b.id === bidId);
        const updatedBids = l.bids?.map(b => {
          if (b.id === bidId) {
            return { ...b, status: 'Rejected' as const };
          }
          return b;
        }) || [];

        // Notify Transporter
        if (rejectedBid) {
          useTransporterStore.getState().addNotification(
            loadId,
            'Rejection',
            `Your bid of ₹${rejectedBid.bidAmount.toLocaleString('en-IN')} has been declined.`
          );
        }

        // IF ALL REJECTED: Load status: Awaiting New Bids
        const allRejected = updatedBids.every(b => b.status === 'Rejected' || b.status === 'REJECTED');
        const loadStatus = allRejected ? ('Awaiting New Bids' as const) : l.status;

        return {
          ...l,
          bids: updatedBids,
          status: loadStatus
        };
      }
      return l;
    });
    set({ loads: updatedLoads });
    loadService.saveLoads(updatedLoads);
  },

  negotiateBid: async (loadId, bidId, counterOffer, remarks, validTill, priority) => {
    const updatedLoads = get().loads.map((l) => {
      if (l.id === loadId) {
        const targetBid = l.bids?.find(b => b.id === bidId);
        const updatedBids = l.bids?.map(b => {
          if (b.id === bidId) {
            return { 
              ...b, 
              status: 'Negotiating' as const,
              bidAmount: counterOffer,
              transporterDetails: {
                ...b.transporterDetails,
                remarks
              }
            };
          }
          return b;
        }) || [];

        // Notify Transporter of Counter Offer
        if (targetBid) {
          useTransporterStore.getState().addNotification(
            loadId,
            'CounterOffer',
            `Received a counter offer of ₹${counterOffer.toLocaleString('en-IN')} with priority: ${priority}. Remarks: ${remarks}.`
          );
        }

        return {
          ...l,
          status: 'Negotiation In Progress' as const,
          bids: updatedBids,
          priority: priority as any,
          negotiationDetails: {
            counterOffer,
            remarks,
            validTill,
            priority
          }
        };
      }
      return l;
    });

    set({ loads: updatedLoads });
    loadService.saveLoads(updatedLoads);
  },

  assignVehicle: (loadId, vehicleNo, driverName) => {
    const updatedLoads = get().loads.map((l) => {
      if (l.id === loadId) {
        return {
          ...l,
          assignedVehicle: vehicleNo,
          assignedDriver: driverName
        };
      }
      return l;
    });
    set({ loads: updatedLoads });
    loadService.saveLoads(updatedLoads);
  },



  autoCloseExpiredLoads: () => {
    const now = new Date();
    let closedCount = 0;

    const updatedLoads = get().loads.map(load => {
      // Only auto-close loads that are still open and have a deadline
      if (load.status !== 'Open') return load;
      if (!load.dispatchDate) return load;

      // Build deadline: use dispatchDate + endTime if available, else end of dispatch day
      const timeStr = load.endTime || '23:59';
      const deadlineStr = `${load.dispatchDate}T${timeStr}`;
      const deadline = new Date(deadlineStr);

      if (!isNaN(deadline.getTime()) && now >= deadline) {
        closedCount++;
        return { ...load, status: 'Completed' as const };
      }
      return load;
    });

    if (closedCount > 0) {
      set({ loads: updatedLoads });
      loadService.saveLoads(updatedLoads);
    }

    return closedCount;
  }
}));
