import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Trash2, User, Mail, Phone, Camera, Loader2, Check } from 'lucide-react';
import { useProfileStore } from '@/store/profileStore';
import { useToast } from '@/hooks/use-toast';
import ProfileAvatar from './ProfileAvatar';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { profile, updateProfile, uploadPhoto, removePhoto, isLoading } = useProfileStore();
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local state for form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [isPhotoRemoved, setIsPhotoRemoved] = useState(false);
  const [tempFile, setTempFile] = useState<File | null>(null);

  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Sync profile details to local state when modal opens
  useEffect(() => {
    if (isOpen && profile) {
      setFullName(profile.fullName || '');
      setEmail(profile.email || '');
      setMobileNumber(profile.mobileNumber || '');
      setPhotoPreview(profile.profilePhoto || '');
      setIsPhotoRemoved(false);
      setTempFile(null);
      setErrors({});
    }
  }, [isOpen, profile]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setErrors(prev => ({ ...prev, photo: 'Supported formats are PNG, JPG, or JPEG' }));
      return;
    }

    // Validate size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, photo: 'Max file size is 2MB' }));
      return;
    }

    setErrors(prev => {
      const copy = { ...prev };
      delete copy.photo;
      return copy;
    });

    setTempFile(file);
    setIsPhotoRemoved(false);

    // Dynamic Image Preview
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoPreview('');
    setTempFile(null);
    setIsPhotoRemoved(true);
  };

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  const validateForm = () => {
    const tempErrors: Record<string, string> = {};

    if (!fullName.trim()) {
      tempErrors.fullName = 'Full Name is required';
    } else if (fullName.trim().length < 3) {
      tempErrors.fullName = 'Full Name must be at least 3 characters';
    }

    if (!email.trim()) {
      tempErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      tempErrors.email = 'Please enter a valid email address';
    }

    if (!mobileNumber.trim()) {
      tempErrors.mobileNumber = 'Mobile number is required';
    } else {
      const cleanPhone = mobileNumber.replace(/\s+/g, '');
      if (!/^\+?[0-9-]{10,15}$/.test(cleanPhone)) {
        tempErrors.mobileNumber = 'Please enter a valid mobile number (10-15 digits)';
      }
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      // 1. Process profile photo update if changed
      if (isPhotoRemoved) {
        await removePhoto();
      } else if (tempFile) {
        await uploadPhoto(tempFile);
      }

      // 2. Process text updates
      await updateProfile({
        fullName,
        email,
        mobileNumber
      });

      // 3. Notify and Close
      toast({
        title: "Profile Updated",
        description: "Your administrator credentials have been synchronized successfully.",
        variant: "default",
      });

      onClose();
    } catch (err: any) {
      toast({
        title: "Failed to Update Profile",
        description: err.message || "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          {/* Glassmorphic overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs"
            onClick={onClose}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.45 }}
            className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-10 font-sans flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-950 to-emerald-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Edit Admin Profile</h3>
                <p className="text-xs text-emerald-200 mt-0.5">Maintain your Biofactor ERP identity</p>
              </div>
              <button 
                onClick={onClose}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scroll Body */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Profile Photo Uploader Section */}
              <div className="flex flex-col items-center justify-center p-4 bg-emerald-50/30 border border-emerald-100/50 rounded-xl space-y-4">
                <div className="relative group">
                  <ProfileAvatar
                    src={photoPreview}
                    name={fullName || "Admin"}
                    size="xl"
                    showStatus={false}
                    className="ring-4 ring-emerald-500/20"
                  />
                  
                  {/* Photo Edit Trigger on Hover */}
                  <button
                    type="button"
                    onClick={handleTriggerUpload}
                    className="absolute inset-0 rounded-full bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  >
                    <Camera className="text-white" size={24} />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleTriggerUpload}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors"
                  >
                    <Upload size={14} />
                    Upload Image
                  </button>

                  {photoPreview && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                      Remove
                    </button>
                  )}
                </div>
                
                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png, image/jpeg, image/jpg"
                  className="hidden"
                />

                <p className="text-[10px] text-gray-400 text-center">
                  Supported formats: <span className="font-medium text-gray-500">PNG, JPG, JPEG</span>. Max file size: 2MB
                </p>

                {errors.photo && (
                  <p className="text-xs text-red-500 font-medium">{errors.photo}</p>
                )}
              </div>

              {/* Text Fields Form */}
              <div className="space-y-4">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label htmlFor="fullName" className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Dinesh Kumar"
                      className={`w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border rounded-xl outline-none transition-all ${
                        errors.fullName ? 'border-red-400 focus:ring-2 focus:ring-red-500/20' : 'border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10'
                      }`}
                    />
                  </div>
                  {errors.fullName && (
                    <p className="text-xs text-red-500 font-medium">{errors.fullName}</p>
                  )}
                </div>

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. dinesh.kumar@biofactor.in"
                      className={`w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border rounded-xl outline-none transition-all ${
                        errors.email ? 'border-red-400 focus:ring-2 focus:ring-red-500/20' : 'border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10'
                      }`}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-xs text-red-500 font-medium">{errors.email}</p>
                  )}
                </div>

                {/* Mobile Number */}
                <div className="space-y-1.5">
                  <label htmlFor="mobile" className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      id="mobile"
                      type="text"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="e.g. +91 98765 43210"
                      className={`w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border rounded-xl outline-none transition-all ${
                        errors.mobileNumber ? 'border-red-400 focus:ring-2 focus:ring-red-500/20' : 'border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10'
                      }`}
                    />
                  </div>
                  {errors.mobileNumber && (
                    <p className="text-xs text-red-500 font-medium">{errors.mobileNumber}</p>
                  )}
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSaving}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-800 to-emerald-700 hover:from-emerald-700 hover:to-emerald-600 text-sm font-bold text-white shadow-lg shadow-emerald-700/20 flex items-center gap-2 transition-all disabled:opacity-75"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Saving Changes...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default EditProfileModal;
