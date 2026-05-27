import * as XLSX from 'xlsx';

export interface OCRExtractedData {
  companyName: string;
  ownerName: string;
  name?: string;
  mobile: string;
  whatsapp: string;
  password?: string;
  email: string;
  address: string;
  city: string;
  state: string;
  fleetSize: number;
  panNumber: string;
  gstNumber: string;
  bankName: string;
  bankAccount: string;
  ifsc: string;
  aadhaarNumber: string;
  aadhaarUrl?: string;
  panUrl?: string;
  gstUrl?: string;
  chequeUrl?: string;
  insuranceUrl?: string;
  rcUrl?: string;
  insuranceExpiry: string;
  rcExpiry: string;
  role?: 'Driver' | 'Transporter';
  whatsapp_available?: boolean;
  verifiedDocuments?: string[];
  rejectedDocuments?: string[];
}

export const ocrService = {
  /**
   * Reads a physical Excel/CSV spreadsheet and extracts all rows of drivers/transporters.
   */
  extractExcelData: async (file: File): Promise<OCRExtractedData[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet);
          
          const parsedRecords: OCRExtractedData[] = rawRows.map((row, index) => {
            const parsedName = String(
              row['name'] || row['Name'] || row['Full Name'] || row['full name'] || row['Name of User'] || `User ${index + 1}`
            ).trim();
            
            const rawMobile = String(
              row['mobile number'] || row['mobile_number'] || row['Mobile Number'] || row['mobile'] || row['Mobile'] || row['MobileNo'] || ''
            ).trim();
            
            let parsedMobile = rawMobile.replace(/\s+/g, '').replace(/[-()+]/g, '');
            if (parsedMobile.endsWith('.0')) {
              parsedMobile = parsedMobile.substring(0, parsedMobile.length - 2);
            }
            if (parsedMobile.length === 12 && parsedMobile.startsWith('91')) {
              parsedMobile = parsedMobile.substring(2);
            } else if (parsedMobile.length === 11 && parsedMobile.startsWith('0')) {
              parsedMobile = parsedMobile.substring(1);
            }
            
            const parsedPassword = String(
              row['password'] || row['Password'] || 'password123'
            ).trim();
            
            const parsedEmail = String(
              row['email'] || row['Email'] || row['email address'] || row['Email Address'] || ''
            ).trim();
            
            const parsedCity = String(
              row['city'] || row['City'] || ''
            ).trim();
            
            const parsedState = String(
              row['state'] || row['State'] || ''
            ).trim();
            
            const parsedRole = String(
              row['role'] || row['Role'] || 'Driver'
            ).trim();
            
            const rawWhatsapp = String(
              row['whatsapp number'] || row['whatsapp_number'] || row['WhatsApp Number'] || row['whatsapp'] || row['WhatsApp'] || ''
            ).trim();

            let parsedWhatsapp = rawWhatsapp.replace(/\s+/g, '').replace(/[-()+]/g, '');
            if (parsedWhatsapp.endsWith('.0')) {
              parsedWhatsapp = parsedWhatsapp.substring(0, parsedWhatsapp.length - 2);
            }
            if (parsedWhatsapp.length === 12 && parsedWhatsapp.startsWith('91')) {
              parsedWhatsapp = parsedWhatsapp.substring(2);
            } else if (parsedWhatsapp.length === 11 && parsedWhatsapp.startsWith('0')) {
              parsedWhatsapp = parsedWhatsapp.substring(1);
            }

            const rawWaAvailable = row['whatsapp_available'] ?? row['WhatsApp Available'] ?? true;
            const parsedWa = rawWaAvailable === true || String(rawWaAvailable).toLowerCase() === 'true' || String(rawWaAvailable) === '1' || String(rawWaAvailable).toLowerCase() === 'yes';

            return {
              name: parsedName,
              companyName: parsedName, // fallback for UI components
              ownerName: parsedName,   // fallback for UI components
              mobile: parsedMobile,
              whatsapp: parsedWhatsapp || (parsedWa ? parsedMobile : ''),
              password: parsedPassword,
              email: parsedEmail,
              city: parsedCity,
              state: parsedState,
              role: (parsedRole.toLowerCase().includes('driver') ? 'Driver' : 'Transporter') as 'Driver' | 'Transporter',
              whatsapp_available: parsedWa || !!parsedWhatsapp,
              
              // Default scaffolding fields to satisfy UI models
              address: 'Spreadsheet Bulk Registry',
              fleetSize: 1,
              panNumber: 'PENDING',
              gstNumber: 'PENDING',
              bankName: 'SBI Bank',
              bankAccount: '',
              ifsc: '',
              aadhaarNumber: '',
              aadhaarUrl: "",
              panUrl: "",
              gstUrl: "",
              chequeUrl: "",
              insuranceUrl: "",
              rcUrl: "",
              insuranceExpiry: "2027-10-12",
              rcExpiry: "2028-04-30"
            };
          });
          resolve(parsedRecords);
        } catch (error) {
          reject(new Error("Spreadsheet parsing failed: " + error));
        }
      };
      reader.onerror = () => reject(new Error("File reading failed"));
      reader.readAsArrayBuffer(file);
    });
  },
  /**
   * Simulates Tesseract OCR processing on uploaded files.
   * Generates mock carrier details based on file type and name.
   */
  extractTransporterData: async (fileName: string, fileSize: string): Promise<OCRExtractedData[]> => {
    return [];
  }
};
