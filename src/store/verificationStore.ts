import { create } from 'zustand';

export type ScanningStep = 'Idle' | 'OCR Text Extracting' | 'Format Validating' | 'Duplicate Database Checking' | 'Fraud Signature Auditing' | 'Complete';

interface VerificationState {
  activeDocType: 'aadhaar' | 'panCard' | 'gstCert' | 'cancelledCheque' | 'insurance' | 'vehicleRc';
  activeDocUrl: string;
  activeDocName: string;
  zoomLevel: number;
  isScanning: boolean;
  scanningStep: ScanningStep;
  setDocPreview: (type: 'aadhaar' | 'panCard' | 'gstCert' | 'cancelledCheque' | 'insurance' | 'vehicleRc', url: string, name: string) => void;
  setZoomLevel: (level: number) => void;
  setScanning: (isScanning: boolean, step?: ScanningStep) => void;
  resetVerification: () => void;
}

export const useVerificationStore = create<VerificationState>((set) => ({
  activeDocType: 'gstCert',
  activeDocUrl: '',
  activeDocName: 'GST Registration Certificate',
  zoomLevel: 100,
  isScanning: false,
  scanningStep: 'Idle',

  setDocPreview: (type, url, name) => set({ 
    activeDocType: type, 
    activeDocUrl: url, 
    activeDocName: name,
    zoomLevel: 100 
  }),

  setZoomLevel: (zoomLevel) => set({ zoomLevel: Math.max(50, Math.min(200, zoomLevel)) }),

  setScanning: (isScanning, step = 'Idle') => set({ isScanning, scanningStep: step }),

  resetVerification: () => set({
    activeDocType: 'gstCert',
    activeDocUrl: '',
    activeDocName: 'GST Registration Certificate',
    zoomLevel: 100,
    isScanning: false,
    scanningStep: 'Idle'
  })
}));
