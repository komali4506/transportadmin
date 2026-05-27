import { create } from 'zustand';

export interface TransporterNotification {
  id: string;
  loadId: string;
  type: 'Assignment' | 'CounterOffer' | 'Rejection';
  message: string;
  createdAt: number;
  read: boolean;
}

export type DocumentStatus = 'Pending' | 'Verified' | 'Rejected' | 'Expired' | 'Missing';

export interface TransporterDoc {
  id?: string;
  status: DocumentStatus;
  remarks: string;
  fileUrl: string;
  expiryDate?: string;
}

export interface TransporterProfile {
  id: string;
  ownerName: string;
  companyName: string;
  mobile: string;
  whatsapp: string;
  email: string;
  password?: string;
  role?: string;
  address: string;
  city: string;
  district: string;
  state: string;
  fleetSize: number;
  preferredRoutes: string[];
  vehicleTypes: string[];
  panNumber: string;
  gstNumber: string;
  bankName: string;
  bankAccount: string;
  ifsc: string;
  upiId: string;
  status: 'Pending' | 'Approved' | 'Under Review' | 'Rejected' | 'Blacklisted';
  trucks?: any[];
  documents: {
    aadhaar: TransporterDoc;
    panCard: TransporterDoc;
    gstCert: TransporterDoc;
    cancelledCheque: TransporterDoc;
    vehicleRc: TransporterDoc;
    insurance: TransporterDoc;
    fitnessCert: TransporterDoc;
    pollutionCert: TransporterDoc;
    drivingLicense: TransporterDoc;
    vehiclePhotos: TransporterDoc;
  };
}

interface TransporterState {
  transporters: TransporterProfile[];
  notifications: TransporterNotification[];
  addNotification: (loadId: string, type: TransporterNotification['type'], message: string) => void;
  markNotificationsAsRead: () => void;
  addTransporter: (profile: TransporterProfile) => void;
  updateTransporter: (id: string, updates: Partial<TransporterProfile>) => void;
  verifyDocument: (transporterId: string, docKey: keyof TransporterProfile['documents'], status: DocumentStatus, remarks: string) => void;
  blacklistTransporter: (id: string) => void;
}

export const useTransporterStore = create<TransporterState>((set, get) => ({
  notifications: [],
  transporters: [],

  addNotification: (loadId, type, message) => {
    const newNotif: TransporterNotification = {
      id: `NOTIF-${Math.floor(1000 + Math.random() * 9000)}`,
      loadId,
      type,
      message,
      createdAt: Date.now(),
      read: false
    };
    set({ notifications: [newNotif, ...get().notifications] });
  },
  
  markNotificationsAsRead: () => {
    set({ notifications: get().notifications.map(n => ({ ...n, read: true })) });
  },

  addTransporter: (profile) => {
    set({ transporters: [...get().transporters, profile] });
  },

  updateTransporter: (id, updates) => {
    set({
      transporters: get().transporters.map(tr => 
        tr.id === id ? { ...tr, ...updates } : tr
      )
    });
  },

  verifyDocument: (transporterId, docKey, status, remarks) => {
    set({
      transporters: get().transporters.map(tr => {
        if (tr.id === transporterId) {
          const updatedDocs = {
            ...tr.documents,
            [docKey]: {
              ...tr.documents[docKey],
              status,
              remarks
            }
          };

          // Re-evaluate general profile status based on documents check!
          // If any document is rejected -> status becomes "Under Review" or "Rejected"
          // If all documents are verified -> status becomes "Approved"
          const docValues = Object.values(updatedDocs);
          const hasRejected = docValues.some(d => d.status === 'Rejected');
          const hasPending = docValues.some(d => d.status === 'Pending' || d.status === 'Missing');
          const hasExpired = docValues.some(d => d.status === 'Expired');
          
          let generalStatus = tr.status;
          if (tr.status !== 'Blacklisted') {
            if (hasRejected) {
              generalStatus = 'Under Review';
            } else if (hasExpired) {
              generalStatus = 'Under Review';
            } else if (!hasPending) {
              generalStatus = 'Approved';
            } else {
              generalStatus = 'Pending';
            }
          }

          return {
            ...tr,
            status: generalStatus,
            documents: updatedDocs
          };
        }
        return tr;
      })
    });
  },

  blacklistTransporter: (id) => {
    set({
      transporters: get().transporters.map(tr => 
        tr.id === id ? { ...tr, status: 'Blacklisted' as const } : tr
      )
    });
  }
}));
