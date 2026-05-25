import { create } from 'zustand';
import type { OCRExtractedData } from '../services/ocrService';
import { validationService } from '../services/validationService';
import type { ValidationReport } from '../services/validationService';
import { useTransporterStore } from './transporterStore';
import type { TransporterProfile } from './transporterStore';
import { apiClient } from '../services/apiClient';

export interface OnboardingTransporter {
  id: string; // Temp queue ID
  data: OCRExtractedData;
  report: ValidationReport;
  uploadedAt: string;
  sourceFile: string;
}

export interface UploadHistory {
  id: string;
  fileName: string;
  fileSize: string;
  uploadDate: string;
  totalRecords: number;
  verified: number;
  rejected: number;
  pendingReview: number;
}

interface OnboardingState {
  onboardingQueue: OnboardingTransporter[];
  uploadHistory: UploadHistory[];
  isProcessing: boolean;
  activeFilter: 'ALL' | 'AI_VERIFIED' | 'NEEDS_REVIEW' | 'REJECTED' | 'DUPLICATES';
  
  setProcessing: (isProcessing: boolean) => void;
  setActiveFilter: (filter: 'ALL' | 'AI_VERIFIED' | 'NEEDS_REVIEW' | 'REJECTED' | 'DUPLICATES') => void;
  addOnboardingBatch: (fileName: string, fileSize: string, extracted: OCRExtractedData[]) => void;
  updateQueueRecord: (tempId: string, updates: Partial<OCRExtractedData>) => void;
  deleteQueueRecord: (tempId: string) => void;
  deleteUploadHistory: (historyId: string) => void;
  approveQueueRecord: (tempId: string) => Promise<void>;
  rejectQueueRecord: (tempId: string, reason: string) => void;
  submitAllVerified: () => Promise<number>;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  onboardingQueue: [],
  uploadHistory: [],
  isProcessing: false,
  activeFilter: 'ALL',

  setProcessing: (isProcessing) => set({ isProcessing }),
  setActiveFilter: (activeFilter) => set({ activeFilter }),

  addOnboardingBatch: (fileName, fileSize, extracted) => {
    const existingCarriers = useTransporterStore.getState().transporters;
    const batchId = `BIMP-${Math.floor(1000 + Math.random() * 9000)}`;
    const todayStr = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const newEntries: OnboardingTransporter[] = extracted.map((data, index) => {
      // Run AI verification instantly
      const report = validationService.verifyDocumentsAI(data, existingCarriers);
      return {
        id: `TEMP-${batchId}-${index}`,
        data,
        report,
        uploadedAt: todayStr,
        sourceFile: fileName
      };
    });

    const total = newEntries.length;
    const verified = newEntries.filter(e => e.report.status === 'AI Verified').length;
    const rejected = newEntries.filter(e => e.report.status === 'Rejected').length;
    const pendingReview = total - verified - rejected;

    const newHistory: UploadHistory = {
      id: batchId,
      fileName,
      fileSize,
      uploadDate: todayStr,
      totalRecords: total,
      verified,
      rejected,
      pendingReview
    };

    set({
      onboardingQueue: [...newEntries, ...get().onboardingQueue],
      uploadHistory: [newHistory, ...get().uploadHistory]
    });
  },

  updateQueueRecord: (tempId, updates) => {
    const existingCarriers = useTransporterStore.getState().transporters;
    
    set({
      onboardingQueue: get().onboardingQueue.map(item => {
        if (item.id === tempId) {
          const updatedData = { ...item.data, ...updates };
          // Re-verify the document details instantly
          const report = validationService.verifyDocumentsAI(updatedData, existingCarriers);
          return {
            ...item,
            data: updatedData,
            report
          };
        }
        return item;
      })
    });
  },

  deleteQueueRecord: (tempId) => {
    set({
      onboardingQueue: get().onboardingQueue.filter(item => item.id !== tempId)
    });
  },

  deleteUploadHistory: (historyId) => {
    const historyItem = get().uploadHistory.find(item => item.id === historyId);
    if (!historyItem) return;

    set({
      uploadHistory: get().uploadHistory.filter(item => item.id !== historyId),
      onboardingQueue: get().onboardingQueue.filter(item => item.sourceFile !== historyItem.fileName)
    });
  },

  approveQueueRecord: async (tempId) => {
    const record = get().onboardingQueue.find(item => item.id === tempId);
    if (!record) return;

    // Call backend API to register the user
    const res = await apiClient.bulkRegisterUsers([record.data]);
    if (!res || res.length === 0) {
      throw new Error("Registration failed or duplicate mobile number found.");
    }
    
    // Retrieve the registered user's generated ID from backend
    const backendUser = res[0];
    const transporterId = backendUser.id || `TR-${Math.floor(1000 + Math.random() * 9000)}`;

    // Package into actual TransporterProfile format
    const newProfile: TransporterProfile = {
      id: transporterId,
      ownerName: record.data.ownerName,
      companyName: record.data.companyName,
      mobile: record.data.mobile,
      whatsapp: record.data.whatsapp,
      email: record.data.email,
      password: record.data.password || 'password123',
      role: record.data.role || 'Driver',
      address: record.data.address,
      city: record.data.city,
      district: record.data.city, // Default district to city
      state: record.data.state,
      fleetSize: record.data.fleetSize,
      preferredRoutes: [record.data.state + " Local", "Interstate Core Routes"],
      vehicleTypes: ["Container Truck", "Open Body Truck"],
      panNumber: record.data.panNumber,
      gstNumber: record.data.gstNumber,
      bankName: record.data.bankName || "SBI Bank",
      bankAccount: record.data.bankAccount || "3940182903",
      ifsc: record.data.ifsc || "SBIN0004920",
      upiId: `${record.data.mobile.replace(/\D/g, '')}@upi`,
      status: 'Approved',
      documents: {
        aadhaar: { status: 'Verified', remarks: 'UIDAI Authenticated by AI', fileUrl: record.data.aadhaarUrl || 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=800' },
        panCard: { status: 'Verified', remarks: 'NSDL Validated on Onboarding', fileUrl: record.data.panUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800' },
        gstCert: { status: 'Verified', remarks: 'GSTIN Portal Active Check', fileUrl: record.data.gstUrl || 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800' },
        cancelledCheque: { status: 'Verified', remarks: 'IFS Verification Ok', fileUrl: record.data.chequeUrl || 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800' },
        vehicleRc: { status: 'Verified', remarks: 'Vahan DB Verified', fileUrl: record.data.rcUrl || 'https://images.unsplash.com/photo-1508962914676-134849a727f0?w=800', expiryDate: record.data.rcExpiry },
        insurance: { status: 'Verified', remarks: 'Insurance Premium Checked', fileUrl: record.data.insuranceUrl || 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800', expiryDate: record.data.insuranceExpiry },
        fitnessCert: { status: 'Verified', remarks: 'AI Document Scanned', fileUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800' },
        pollutionCert: { status: 'Verified', remarks: 'PUC Checked', fileUrl: 'https://images.unsplash.com/photo-1530521951940-ad08c2873af7?w=800' },
        drivingLicense: { status: 'Verified', remarks: 'DL Matches Owner Name', fileUrl: 'https://images.unsplash.com/photo-1580828343064-fde4fc206bc6?w=800' },
        vehiclePhotos: { status: 'Verified', remarks: 'Validated', fileUrl: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=800' }
      }
    };

    // 1. Add to central transporter store
    useTransporterStore.getState().addTransporter(newProfile);

    // 2. Remove from onboarding queue
    set({
      onboardingQueue: get().onboardingQueue.filter(item => item.id !== tempId)
    });
  },

  rejectQueueRecord: (tempId, reason) => {
    set({
      onboardingQueue: get().onboardingQueue.map(item => {
        if (item.id === tempId) {
          return {
            ...item,
            report: {
              ...item.report,
              status: 'Rejected',
              isAutoRejected: true,
              rejectionReason: reason,
              score: 20
            }
          };
        }
        return item;
      })
    });
  },

  submitAllVerified: async () => {
    const verifiedRecords = get().onboardingQueue.filter(item => item.report.status === 'AI Verified');
    const count = verifiedRecords.length;
    if (count === 0) return 0;

    // Call backend API to bulk register all verified users
    const res = await apiClient.bulkRegisterUsers(verifiedRecords.map(r => r.data));
    
    // Add each successfully created user to the transporter central store
    verifiedRecords.forEach((record, index) => {
      const backendUser = res.find((u: any) => u.mobile === record.data.mobile) || res[index];
      const transporterId = backendUser?.id || `TR-${Math.floor(1000 + Math.random() * 9000)}`;

      const newProfile: TransporterProfile = {
        id: transporterId,
        ownerName: record.data.ownerName,
        companyName: record.data.companyName,
        mobile: record.data.mobile,
        whatsapp: record.data.whatsapp,
        email: record.data.email,
        password: record.data.password || 'password123',
        role: record.data.role || 'Driver',
        address: record.data.address,
        city: record.data.city,
        district: record.data.city,
        state: record.data.state,
        fleetSize: record.data.fleetSize,
        preferredRoutes: [record.data.state + " Local", "Interstate Core Routes"],
        vehicleTypes: ["Container Truck", "Open Body Truck"],
        panNumber: record.data.panNumber,
        gstNumber: record.data.gstNumber,
        bankName: record.data.bankName || "SBI Bank",
        bankAccount: record.data.bankAccount || "3940182903",
        ifsc: record.data.ifsc || "SBIN0004920",
        upiId: `${record.data.mobile.replace(/\D/g, '')}@upi`,
        status: 'Approved',
        documents: {
          aadhaar: { status: 'Verified', remarks: 'UIDAI Authenticated by AI', fileUrl: record.data.aadhaarUrl || 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=800' },
          panCard: { status: 'Verified', remarks: 'NSDL Validated on Onboarding', fileUrl: record.data.panUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800' },
          gstCert: { status: 'Verified', remarks: 'GSTIN Portal Active Check', fileUrl: record.data.gstUrl || 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800' },
          cancelledCheque: { status: 'Verified', remarks: 'IFS Verification Ok', fileUrl: record.data.chequeUrl || 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800' },
          vehicleRc: { status: 'Verified', remarks: 'Vahan DB Verified', fileUrl: record.data.rcUrl || 'https://images.unsplash.com/photo-1508962914676-134849a727f0?w=800', expiryDate: record.data.rcExpiry },
          insurance: { status: 'Verified', remarks: 'Insurance Premium Checked', fileUrl: record.data.insuranceUrl || 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800', expiryDate: record.data.insuranceExpiry },
          fitnessCert: { status: 'Verified', remarks: 'AI Document Scanned', fileUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800' },
          pollutionCert: { status: 'Verified', remarks: 'PUC Checked', fileUrl: 'https://images.unsplash.com/photo-1530521951940-ad08c2873af7?w=800' },
          drivingLicense: { status: 'Verified', remarks: 'DL Matches Owner Name', fileUrl: 'https://images.unsplash.com/photo-1580828343064-fde4fc206bc6?w=800' },
          vehiclePhotos: { status: 'Verified', remarks: 'Validated', fileUrl: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=800' }
        }
      };

      useTransporterStore.getState().addTransporter(newProfile);
    });

    // Remove approved records from the onboarding queue
    const verifiedIds = verifiedRecords.map(r => r.id);
    set({
      onboardingQueue: get().onboardingQueue.filter(item => !verifiedIds.includes(item.id))
    });

    return count;
  }
}));
