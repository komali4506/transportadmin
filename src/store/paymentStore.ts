import { create } from 'zustand';
import { apiClient } from '../services/apiClient';

export interface PaymentEntry {
  paymentId: string;
  loadId: string;
  transporter: string;
  amount: number;
  penalty: number;
  tax: number;
  extraCharges: number;
  finalAmount: number;
  status: 'Pending' | 'Processing' | 'Completed' | 'Failed' | 'Under Review' | 'Released';
  createdAt: string;
  invoiceId: string;
  invoiceUrl?: string;
  invoiceRemarks?: string;
  rcUrl?: string;
  insuranceUrl?: string;
  paymentMethod: 'Bank Transfer' | 'UPI' | 'RTGS' | 'NEFT';
}

interface PaymentState {
  payments: PaymentEntry[];
  isLoading: boolean;
  fetchInvoicesFromBackend: () => Promise<void>;
  settlePaymentOnBackend: (tripId: string, paymentMethod: 'Bank Transfer' | 'UPI' | 'RTGS' | 'NEFT', extraCharges: number) => Promise<void>;
  
  // Legacy / Local fallback compatibility methods
  addPayment: (payment: Omit<PaymentEntry, 'paymentId' | 'invoiceId' | 'createdAt'>) => void;
  releasePayment: (paymentId: string) => void;
  updatePaymentStatus: (paymentId: string, status: PaymentEntry['status']) => void;
  syncPaymentsFromLoads: () => void;
}

export const usePaymentStore = create<PaymentState>((set, get) => ({
  payments: [],
  isLoading: false,

  fetchInvoicesFromBackend: async () => {
    set({ isLoading: true });
    try {
      const data = await apiClient.getAdminInvoices();
      const mapped: PaymentEntry[] = data.map((t: any) => {
        const freight = t.amount || 0;
        const tax = 0;
        const extra = 0;
        const finalAmount = freight;
        
        const transporterName = t.assigned_user?.company_name || t.assigned_user?.name || 'Carrier';
        
        return {
          paymentId: t.id,
          loadId: t.load_id,
          transporter: transporterName,
          amount: freight,
          penalty: 0,
          tax,
          extraCharges: extra,
          finalAmount,
          status: t.invoice_status === 'PAID' ? 'Released' : 'Pending',
          createdAt: t.invoice_created_at ? t.invoice_created_at.split('T')[0] : (t.created_at ? t.created_at.split('T')[0] : 'N/A'),
          invoiceId: t.invoice_number || 'N/A',
          invoiceUrl: t.invoice_url ? `${apiClient.getApiUrl()}${t.invoice_url}` : undefined,
          invoiceRemarks: t.invoice_remarks || '',
          rcUrl: t.rc_url ? `${apiClient.getApiUrl()}${t.rc_url}` : undefined,
          insuranceUrl: t.insurance_url ? `${apiClient.getApiUrl()}${t.insurance_url}` : undefined,
          paymentMethod: (t.payment_method || 'Bank Transfer') as any,
        };
      });
      set({ payments: mapped, isLoading: false });
    } catch (err) {
      console.error("Failed to fetch invoices:", err);
      set({ isLoading: false });
    }
  },

  settlePaymentOnBackend: async (tripId, paymentMethod, extraCharges) => {
    try {
      await apiClient.payTripInvoice(tripId, { paymentMethod, extraCharges });
      await get().fetchInvoicesFromBackend();
    } catch (err) {
      console.error("Failed to settle payment on backend:", err);
      throw err;
    }
  },

  // Fallbacks for offline demo modes (Zustand backward compatibility)
  addPayment: (payment) => {
    const idSuffix = Math.floor(1000 + Math.random() * 9000);
    const newEntry: PaymentEntry = {
      ...payment,
      paymentId: `PAY-${idSuffix}`,
      invoiceId: `INV-${idSuffix}`,
      createdAt: new Date().toISOString().split('T')[0],
    };
    set({ payments: [newEntry, ...get().payments] });
  },

  releasePayment: (paymentId) => {
    set({
      payments: get().payments.map(p => 
        p.paymentId === paymentId ? { ...p, status: 'Released' as const } : p
      )
    });
  },

  updatePaymentStatus: (paymentId, status) => {
    set({
      payments: get().payments.map(p => 
        p.paymentId === paymentId ? { ...p, status } : p
      )
    });
  },

  syncPaymentsFromLoads: () => {
    // If connected to dynamic backend, it will be handled by fetchInvoicesFromBackend.
    // We run it as fallback when backend is unreachable or local.
  }
}));
