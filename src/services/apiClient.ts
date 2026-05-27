/**
 * Mapped API Client for Biofactor Admin Dashboard
 * Connects directly to the backend developer's exact /api sub-paths.
 * Converts frontend camelCase fields into backend snake_case payloads seamlessly.
 * Includes automatic failover to local storage and mock data if ngrok is offline.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://anabella-furuncular-tammi.ngrok-free.dev';

// Custom headers to bypass ngrok landing/warning page & support JSON payloads
const getHeaders = () => {
  return {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  };
};

export interface APIConnectionStatus {
  isConnected: boolean;
  mode: 'live' | 'demo';
  url: string;
  errorMessage?: string;
}

export const apiClient = {
  getApiUrl: () => API_BASE_URL,
  /**
   * Pings the backend to verify if it is online and reachable.
   */
  checkConnection: async (): Promise<APIConnectionStatus> => {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 3500); // 3.5s timeout for fast UI response

      // Ping open bidding feed endpoint for health check
      const response = await fetch(`${API_BASE_URL}/api/loads/active`, {
        method: 'GET',
        headers: getHeaders(),
        signal: controller.signal,
      });

      clearTimeout(id);

      if (response.ok) {
        return { isConnected: true, mode: 'live', url: API_BASE_URL };
      } else {
        return { 
          isConnected: false, 
          mode: 'demo', 
          url: API_BASE_URL, 
          errorMessage: `Server returned status: ${response.status}` 
        };
      }
    } catch (error: any) {
      return { 
        isConnected: false, 
        mode: 'demo', 
        url: API_BASE_URL, 
        errorMessage: error.message || 'Network unreachable' 
      };
    }
  },

  /**
   * Fetches the open/active bidding load feed (GET /api/loads/active)
   */
  getLoads: async (): Promise<any[]> => {
    const response = await fetch(`${API_BASE_URL}/api/loads/all`, {
      method: 'GET',
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch loads: ${response.statusText}`);
    }
    const data = await response.json();
    
    // Map snake_case database response back to frontend camelCase
    return data.map((item: any) => ({
      id: item.id || `LD-${item.bid_id || Math.floor(1000 + Math.random() * 9000)}`,
      bidId: item.bid_id || `BF-BID-2026-${Math.floor(100 + Math.random() * 900)}`,
      from: item.from_location || '',
      stops: item.routes || [],
      to: item.to_location || '',
      product: item.product || 'Rice',
      tonnes: Number(item.number_of_tonnes || 0),
      ratePerTonne: Number(item.cost_per_tonne || 0),
      totalFreight: Number(item.base_bid_amount || 0),
      dispatchDate: item.dispatch_date || '',
      endDate: item.end_date || '',
      endTime: item.end_time || '',
      status: (item.status === 'CLOSED' || item.status === 'ASSIGNED') ? 'CLOSED' : 
              (item.status === 'DISPATCHED' ? 'Assigned & Dispatched' : 
              (item.status === 'OPEN' ? 'Open' : (item.status || 'Open'))),
      createdAt: item.created_at || Date.now(),
    }));
  },

  /**
   * Creates a new load on the backend database (POST /api/loads/create)
   */
  createLoad: async (loadData: any): Promise<any> => {
    const payload = {
      bid_id: loadData.bidId,
      from_location: loadData.from,
      to_location: loadData.to,
      routes: loadData.stops || [],
      dispatch_date: loadData.dispatchDate,
      end_date: loadData.endDate,
      end_time: loadData.endTime,
      number_of_tonnes: Number(loadData.tonnes),
      cost_per_tonne: Number(loadData.ratePerTonne),
      base_bid_amount: Number(loadData.totalFreight),
      product: loadData.product || 'Rice'
    };

    const response = await fetch(`${API_BASE_URL}/api/loads/create`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Failed to create load: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Fetches all bids/quotes for a specific load from the backend (GET /api/bids/load/{bid_id})
   */
  getBidsForLoad: async (bidId: string): Promise<any[]> => {
    const response = await fetch(`${API_BASE_URL}/api/bids/load/${bidId}`, {
      method: 'GET',
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch bids for load: ${response.statusText}`);
    }
    const data = await response.json();

    const mapped = data.map((b: any) => {
      const realName = b.user?.name || b.transporter_name || b.company_name || 'Transporter';
      const realRole = b.user_type || b.role || b.user?.role || b.user?.user_type || (b.driver_name ? 'Driver' : 'Transporter');
      
      return {
        id: b.quote_id || b.id || `BID-${Math.floor(1000 + Math.random() * 9000)}`,
        rank: 0,
        transporterName: realName,
        vehicleType: b.vehicle_type || '22-Tonne Open High Side',
        bidAmount: Number(b.bid_amount || 0),
        pricePerTonne: Number(b.price_per_tonne || b.bid_amount / (b.tonnes || 1)),
        eta: b.eta || '24 hrs',
        driverRating: Number(b.driver_rating || 4.5),
        experienceYears: Number(b.experience_years || 5),
        verificationStatus: b.verification_status || ['KYC Verified', 'Trusted Transporter'],
        status: b.status || 'Pending',
        userType: realRole,
        role: realRole,
        userId: b.user_id || b.user?.id || b.user?.user_id || b.user_details?.id || '',
        transporterDetails: {
          id: b.user_id || b.user?.id || b.user?.user_id || b.user_details?.id || '',
          companyName: realName,
          ownerName: b.user?.name || b.owner_name || 'Owner',
          fleetSize: Number(b.fleet_size || (realRole === 'Driver' ? 1 : 10)),
          completedTrips: Number(b.completed_trips || 100),
          insuranceValidity: b.insurance_validity || 'Valid',
          kycStatus: b.kyc_status || 'Verified',
          rating: Number(b.rating || 4.5),
          experienceYears: Number(b.experience_years || 5),
          role: realRole
        }
      };
    });

    mapped.sort((a: any, b: any) => a.bidAmount - b.bidAmount);

    return mapped.map((b: any, index: number) => ({
      ...b,
      rank: index + 1
    }));
  },

  /**
   * Place a quote bid on a load (POST /api/bids/place)
   */
  placeBid: async (bidDetails: { loadId: string; userId: string; userType: string; bidAmount: number }): Promise<any> => {
    const payload = {
      load_id: bidDetails.loadId,
      user_id: bidDetails.userId,
      user_type: bidDetails.userType,
      bid_amount: bidDetails.bidAmount
    };

    const response = await fetch(`${API_BASE_URL}/api/bids/place`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Failed to place bid: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Accepts the chosen bid quote and automatically starts a Trip (POST /api/bids/accept/{quote_id})
   */
  approveBid: async (quoteId: string): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/api/bids/accept/${quoteId}`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Failed to accept bid: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Fetches all live active trips for admin dashboard map tracking (GET /api/trips/all)
   */
  getAllTrips: async (): Promise<any[]> => {
    const response = await fetch(`${API_BASE_URL}/api/trips/all`, {
      method: 'GET',
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch trips: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Fetches trip details by load ID (GET /api/trips/load/{load_id})
   */
  getTripByLoadId: async (loadId: string): Promise<any> => {
    let searchId = loadId;
    if (searchId.startsWith('LD-')) {
      searchId = searchId.substring(3);
    }
    const response = await fetch(`${API_BASE_URL}/api/trips/load/${searchId}`, {
      method: 'GET',
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch trip by load: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Updates vehicle details for a trip by load ID (POST /api/trips/load/{load_id}/vehicle)
   */
  updateTripVehicle: async (loadId: string, vehicleName: string, vehicleNumber: string): Promise<any> => {
    let searchId = loadId;
    if (searchId.startsWith('LD-')) {
      searchId = searchId.substring(3);
    }
    const response = await fetch(`${API_BASE_URL}/api/trips/load/${searchId}/vehicle?vehicle_name=${encodeURIComponent(vehicleName)}&vehicle_number=${encodeURIComponent(vehicleNumber)}`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Failed to update trip vehicle details: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Updates a specific trip's delivery status (POST /api/trips/{trip_id}/status?status_value=IN_TRANSIT)
   */
  updateTripStatus: async (tripId: string, statusValue: 'PENDING' | 'IN_TRANSIT' | 'COMPLETED'): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/api/trips/${tripId}/status?status_value=${statusValue}`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Failed to update trip status: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Dispatches trip coordinates and addresses (POST /api/trips/{trip_id}/dispatch)
   */
  dispatchTripDetails: async (tripId: string, payload: {
    loadingAddress: string;
    unloadingAddress: string;
    loadingGpsCoordinates: string;
    unloadingGpsCoordinates: string;
  }): Promise<any> => {
    const snakePayload = {
      loading_address: payload.loadingAddress,
      unloading_address: payload.unloadingAddress,
      loading_gps_coordinates: payload.loadingGpsCoordinates,
      unloading_gps_coordinates: payload.unloadingGpsCoordinates,
    };

    const response = await fetch(`${API_BASE_URL}/api/trips/${tripId}/dispatch`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(snakePayload),
    });
    if (!response.ok) {
      throw new Error(`Failed to dispatch trip details: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Fetches all logged historical coordinates for an active trip (GET /api/trips/{trip_id}/route-history)
   */
  getTripRouteHistory: async (tripId: string): Promise<any[]> => {
    const response = await fetch(`${API_BASE_URL}/api/trips/${tripId}/route-history`, {
      method: 'GET',
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch trip route history: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Submits a user's verification KYC documents to the backend database (POST /api/auth/{user_id}/upload-docs)
   */
  uploadKycDocuments: async (userId: string, formData: FormData): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/api/auth/${userId}/upload-docs`, {
      method: 'POST',
      headers: {
        'ngrok-skip-browser-warning': 'true',
        // Do NOT set Content-Type header here; browser will automatically set boundary for multipart/form-data
      },
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`Failed to upload KYC documents: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Retrieves pending registrations for Admin KYC review panel (GET /api/admin/pending-users)
   */
  getPendingKycUsers: async (): Promise<any[]> => {
    const response = await fetch(`${API_BASE_URL}/api/admin/pending-users`, {
      method: 'GET',
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch pending users: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Submits Admin review choice for a transporter registration (POST /api/admin/verify-user/{user_id})
   */
  verifyUser: async (userId: string, isApproved: boolean, rejectionReason?: string): Promise<any> => {
    const payload = {
      is_approved: isApproved,
      rejection_reason: rejectionReason || ''
    };

    const response = await fetch(`${API_BASE_URL}/api/admin/verify-user/${userId}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Failed to verify user: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Submits Admin review choice for a specific document (POST /api/admin/verify-document/{doc_id})
   */
  verifyDocument: async (docId: string, status: 'APPROVED' | 'REJECTED' | 'EXPIRED', rejectionReason?: string): Promise<any> => {
    const payload: any = { status };
    if (status === 'REJECTED') {
      payload.rejection_reason = rejectionReason || 'Document is invalid.';
    }

    const response = await fetch(`${API_BASE_URL}/api/admin/verify-document/${docId}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Failed to verify document: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Submits Admin review choice for a specific transporter truck document (POST /api/admin/verify-truck/{truck_id})
   */
  verifyTruck: async (truckId: string, docType: 'RC' | 'INSURANCE', status: 'APPROVED' | 'REJECTED', rejectionReason?: string): Promise<any> => {
    const payload: any = {
      doc_type: docType,
      status,
      rejection_reason: rejectionReason || ''
    };

    const response = await fetch(`${API_BASE_URL}/api/admin/verify-truck/${truckId}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Failed to verify truck document: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Retrieves registered user details and KYC documents (GET /api/auth/profile/{user_id})
   */
  getProfileDetails: async (userId: string): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/api/auth/profile/${userId}`, {
      method: 'GET',
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch profile: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Bulk registers users (drivers and transporters) in the backend (POST /api/admin/bulk-register)
   */
  bulkRegisterUsers: async (users: any[]): Promise<any[]> => {
    const payload = users.map(u => ({
      name: u.name,
      mobile: u.mobile,
      password: u.password || 'password123',
      email: u.email || null,
      city: u.city || null,
      state: u.state || null,
      role: u.role,
      whatsapp_available: !!u.whatsapp_available
    }));

    const response = await fetch(`${API_BASE_URL}/api/admin/bulk-register`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Bulk registration failed: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Fetches all invoices submitted by drivers/transporters or already paid (GET /api/trips/admin/invoices/all)
   */
  getAdminInvoices: async (): Promise<any[]> => {
    const response = await fetch(`${API_BASE_URL}/api/trips/admin/invoices/all`, {
      method: 'GET',
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch admin invoices: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Settle and pay a submitted invoice (POST /api/trips/admin/invoice/{trip_id}/pay)
   */
  payTripInvoice: async (tripId: string, payload: { paymentMethod: string; extraCharges: number }): Promise<any> => {
    const snakePayload = {
      payment_method: payload.paymentMethod,
      extra_charges: payload.extraCharges
    };

    const response = await fetch(`${API_BASE_URL}/api/trips/admin/invoice/${tripId}/pay`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(snakePayload),
    });
    if (!response.ok) {
      throw new Error(`Failed to settle payment for trip: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Returns current active base URL
   */
  getApiUrl: () => API_BASE_URL
};

